import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./env.js";
import { EXPLORER, NETWORK, usdc } from "./near.js";

export const DEFAULT_DEPLOYMENT_FILE = path.join(REPO_ROOT, "deployments", "testnet.json");

export interface AgentInfo {
  account: string;
  publicKey: string;
  createTx: string;
}

export interface Deployment {
  network: string;
  root: string;
  explorer: string;
  contracts: { usdc: string; registry: string; vault: string; guarded: string };
  agents: { vault: AgentInfo; guarded: AgentInfo };
  actors: { alice: string; hindiTranslator: string; vendorPayments: string };
  registry: { "translate-hi": { payee: string; price: string } };
  tasks: { vault: number; guarded: number };
  deployedAt: string;
}

export type VaultKey = "vault" | "guarded";
export const VAULTS: VaultKey[] = ["vault", "guarded"];

export function namesFor(root: string) {
  const sub = (p: string) => `${p}.${root}`;
  return {
    root,
    usdc: sub("usdc"),
    registry: sub("registry"),
    vault: sub("vault"),
    guarded: sub("guarded"),
    agentFor: { vault: sub("agent-l"), guarded: sub("agent-g") } as Record<VaultKey, string>,
    alice: sub("alice"),
    hindiTranslator: sub("hindi-translator"),
    vendorPayments: sub("vendor-payments"),
  };
}

export const DEMO = {
  network: NETWORK,
  explorer: EXPLORER,
  vaultModes: { vault: "Lineage", guarded: "LimitsOnly" } as Record<VaultKey, string>,
  vaultTarget: usdc(500),
  rootMintThreshold: usdc(1000),
  rootMint: usdc(2000),
  service: {
    id: "translate-hi",
    price: usdc(25),
    description: "EN→HI landing page translation",
  },
  task: {
    instruction:
      "Get our landing page translated to Hindi via the verified registry, and pay Alice up to 20 tUSDC for the logo.",
    budget: usdc(100),
    maxPerPayment: usdc(50),
    ttlMinutes: 20160,
    aliceMax: usdc(20),
    aliceLabel: "Alice — logo",
  },
  run: {
    vaultMin: usdc(150),
    rootMin: usdc(300),
  },
  agentFunding: 2n,
  agentAllowanceNear: 2,
  agentMethods: ["request_payment"],
};

export function readDeployment(file: string): Deployment {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Deployment;
}

export function writeDeployment(file: string, d: Deployment): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(d, null, 2) + "\n");
}
