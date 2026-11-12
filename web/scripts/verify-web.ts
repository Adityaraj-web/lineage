// Live checks of the dashboard data layer against testnet. No account needed.
import { chain } from "../src/lib/chain";
import { AGENT_IDS, DEPLOYMENT, VAULT_IDS, VAULT_KEYS, type VaultKey } from "../src/lib/config";
import { fmtUsdc } from "../src/lib/format";
import { DEMO_RUN, liveDeps } from "../src/lib/live";
import { rpcUrls } from "../src/lib/rpc";
import { agentKeyProof, loadCompareView, loadOverview, loadVaultView } from "../src/lib/views";

class CheckFailed extends Error {}

class Checklist {
  passed = 0;
  failed = 0;

  async check(label: string, fn: () => Promise<string | void>): Promise<void> {
    try {
      const detail = await fn();
      this.passed++;
      console.log(`✔ ${label}${detail ? ` — ${detail}` : ""}`);
    } catch (e) {
      this.failed++;
      const reason = e instanceof CheckFailed ? e.message : e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.log(`✘ ${label} — ${reason}`);
    }
  }

  skipped(label: string, reason: string): void {
    console.log(`- ${label} — skipped: ${reason}`);
  }
}

function expect(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new CheckFailed(msg);
}

const fmtNear = (yocto: string | null): string => {
  if (yocto === null) return "unlimited";
  const v = BigInt(yocto);
  return `${v / 10n ** 24n}.${((v % 10n ** 24n) / 10n ** 20n).toString().padStart(4, "0")} NEAR`;
};

const MODES: Record<VaultKey, string> = { vault: "Lineage", guarded: "LimitsOnly" };

async function main(): Promise<number> {
  const list = new Checklist();
  const deps = liveDeps();
  const c = chain();
  console.log(`Lineage web check · demo run ${DEMO_RUN.runId} · RPC ${rpcUrls()[0]}\n`);

  await list.check("1. both vaults reachable, modes Lineage and LimitsOnly", async () => {
    const modes = await Promise.all(VAULT_KEYS.map(async (k) => (await c.getConfig(VAULT_IDS[k])).mode));
    VAULT_KEYS.forEach((k, i) => expect(modes[i] === MODES[k], `${VAULT_IDS[k]} mode is ${modes[i]}, expected ${MODES[k]}`));
    return VAULT_KEYS.map((k, i) => `${k}=${modes[i]}`).join(", ");
  });

  await list.check("2. vault and guarded run the same code", async () => {
    const [a, b] = await Promise.all(VAULT_KEYS.map((k) => c.codeHash(VAULT_IDS[k])));
    expect(a !== null && a === b, `code hashes differ: ${a} vs ${b}`);
    return a;
  });

  for (const k of VAULT_KEYS) {
    await list.check(`3. ${AGENT_IDS[k]} has exactly one key: request_payment on ${VAULT_IDS[k]}`, async () => {
      const proof = agentKeyProof(await c.accessKeys(AGENT_IDS[k]), VAULT_IDS[k]);
      expect(proof.ok, proof.problems.join("; "));
      return `FunctionCall ${JSON.stringify(proof.methodNames)}, allowance ${fmtNear(proof.allowance)}`;
    });
  }

  const compare = await loadCompareView(deps).catch((e: unknown) => e as Error);
  await list.check(`4. compare view of demo-run tasks (vault #${DEMO_RUN.vaults.vault?.taskId}, guarded #${DEMO_RUN.vaults.guarded?.taskId})`, async () => {
    if (compare instanceof Error) throw compare;
    expect(compare.rows.length === 3, `expected 3 rows, got ${compare.rows.length}`);
    const status = (k: VaultKey, code: string) => {
      const row = compare.rows.find((r) => r.sides[k].badge?.code === code);
      expect(!!row, `${k}: no ${code} payment`);
      return row.sides[k].payment!.status;
    };
    expect(status("vault", "P2") === "Paid", `Lineage P2 is ${status("vault", "P2")}`);
    expect(status("vault", "P1") === "Paid", `Lineage P1 is ${status("vault", "P1")}`);
    const p3 = status("vault", "P3");
    expect(p3 === "AwaitingApproval" || p3 === "Rejected", `Lineage P3 is ${p3}, expected AwaitingApproval or Rejected`);
    for (const code of ["P1", "P2", "P3"]) {
      expect(status("guarded", code) === "Paid", `LimitsOnly ${code} is ${status("guarded", code)}`);
    }
    const r = compare.attackerReceived;
    expect(r.vault === 0n && r.guarded === 49_000_000n, `attacker received ${fmtUsdc(r.vault)} vs ${fmtUsdc(r.guarded)}`);
    return `Lineage P2 Paid, P1 Paid, P3 ${p3}; LimitsOnly all Paid; attacker received ${compare.attackerReceivedText.vault} vs ${compare.attackerReceivedText.guarded}`;
  });

  const p3Id = DEMO_RUN.vaults.vault?.payments.find((p) => p.payment?.provenance === "Untrusted")?.payment?.id;
  const p3Live = compare instanceof Error ? undefined : compare.rows.find((r) => r.poisoned)?.sides.vault.payment;
  const label5 = `5. risk card for the held demo P3 (vault #${p3Id})`;
  if (p3Live?.status !== "AwaitingApproval") {
    list.skipped(label5, `payment is ${p3Live?.status ?? "missing"}, not AwaitingApproval`);
  } else {
    await list.check(label5, async () => {
      const v = await loadVaultView("vault", deps);
      if (v.inbox.kind !== "lineage") throw new CheckFailed("vault inbox is not a Lineage inbox");
      const item = v.inbox.items.find((i) => i.row.payment.id === p3Id);
      expect(!!item, `payment #${p3Id} not in the inbox`);
      const ids = item.risk.findings.map((f) => f.id);
      expect(item.risk.level === "high", `level is ${item.risk.level}`);
      for (const id of ["untrusted-source", "not-signed", "never-paid", "duplicate-reference"] as const) {
        expect(ids.includes(id), `missing ${id} (have ${ids.join(", ")})`);
      }
      return `high: ${ids.join(", ")}`;
    });
  }

  await list.check("6. registry: translate-hi is Verified → hindi-translator, 25 tUSDC", async () => {
    const want = DEPLOYMENT.registry["translate-hi"];
    const s = (await c.listServices()).find((x) => x.id === "translate-hi");
    expect(!!s, "translate-hi not listed");
    expect(s.status === "Verified", `status ${s.status}`);
    expect(s.payee === want.payee, `payee ${s.payee}`);
    expect(s.price === want.price, `price ${s.price}`);
    return `${s.payee}, ${fmtUsdc(s.price)}`;
  });

  await list.check("7. overview loads", async () => {
    const o = await loadOverview(deps);
    const proofs = VAULT_KEYS.map((k) => `${k} key ${o.keyProofs[k].ok ? "ok" : "BAD"}`).join(", ");
    return `${o.services.length} service(s), needs you: ${o.awaitingCount}, ${proofs}, same code: ${o.sameCode}`;
  });

  console.log(`\n${list.passed} passed, ${list.failed} failed`);
  return list.failed === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
