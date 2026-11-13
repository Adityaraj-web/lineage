# Owner wallet (testnet)

The dashboard signs owner actions (approve, reject, freeze, unfreeze) in the owner's own wallet. Meteor gets its own full-access key on `lineage-aditya.testnet`. The legacy-keychain root key is never exported.

Adityaraj runs every command below. Claude Code does not sign or send.

Commands checked against near-cli-rs 0.31.1 (`--help` at each level).

## Add a dedicated full-access key for Meteor

```bash
near account add-key lineage-aditya.testnet \
  grant-full-access autogenerate-new-keypair print-to-terminal \
  network-config testnet sign-with-legacy-keychain send
```

- It prints a seed phrase and the new public key. Keep the default key type (ed25519, no `--signature-scheme` flag): Meteor needs ed25519.
- Write the public key here (public keys are safe to commit):

  Meteor key: `ed25519:A5FouqsuTqDD6Kz3oKtD8Zjn2cNddXUmCaXJr6Vi1gh4` (imported in Meteor by seed phrase)

- Import the seed phrase in Meteor (testnet → Import → seed phrase). If Meteor cannot find the account (some wallets look it up through an indexer), import the printed private key instead.
- Then `clear` the terminal. Never paste the phrase anywhere else.
- Check:

  ```bash
  near account list-keys lineage-aditya.testnet network-config testnet now
  ```

  It shows the old key plus the new one, both full access.
- If `near` prompts interactively instead, follow the prompts with the same choices. `near account add-key --help` lists them.

## Remove it after the hackathon (one command)

```bash
near account delete-keys lineage-aditya.testnet \
  public-keys ed25519:<METEOR_PUBLIC_KEY> \
  network-config testnet sign-with-legacy-keychain send
```

Then run `list-keys` again: only the original key remains.

## Alternative for README readers

Choose "NEAR CLI" in the NEAR Connect picker. It signs with near-cli-rs on your machine, so the key never leaves your keychain.

## Rehearsal on testnet (in this order; done 2026-11-12/13)

1. `npm run web:dev`, connect Meteor as `lineage-aditya.testnet`. Both vaults show owner controls. Connect a different testnet account once: Viewer line, no controls.
2. **Reject #5** on `/vault/vault` with the prefilled reason. The card leaves the inbox, "Last action" shows the hash, and the payments table shows #5 `Rejected` with the reason.
   tx: `5fTE3HuGfBtN8Z7NdWwKJHV8XC6MKWMptScPXwcVCwLz`
3. **Freeze `vault`.** Run `npm run demo -- --only vault`: the new task's payments end `Blocked` ("Vault is frozen by the owner"). Acceptance fails, which is expected here. **Unfreeze** in the UI.
   freeze tx: `CWFa5AdSPrrumK2uBtuiGQK6cVXLwZTdC61UNJuifKYX` · unfreeze tx: `dEPneAJzQX7osrupuVEPUec2iHEcELyQGfLdRUXknzp`
4. `npm run demo` (both vaults, fresh run). **Approve** the new P3 once (tick the box). Expect `Paid` after the refresh. This pays the demo attacker account 49 tUSDC on the Lineage vault, which is fine on testnet.
   approve #11 tx: `6wxcrjgmyiDJH5YmTfxzkpRfnUSmC8WdmoYdPajBByXK`
   Approving a poisoned P3 changes later risk cards for that payee from "never paid" to "paid before" (still high risk).
5. Final clean `npm run demo`, so the latest task has a held P3 for the video and `demo-run.json` shows 0 vs 49 again. Then `npm run verify:web` (8/8) and `npm run verify:deploy`.
6. Wrong-key check (optional, one tx): in the NEAR CLI wallet or by hand, try `approve_payment` with deposit 0 against the new P3. Expect the contract error "Attach exactly 1 yoctoNEAR (requires a full-access key)".
   0-deposit approve on #14 (failed as expected): `BgHENiFvG9brA9YcabunzxFWoBimivo3SJUQEwz1JXLx`

## F08 rehearsal: create a task in the dashboard, run the agent on it

Adityaraj signs. Leave vault payment #14 alone (held for the video), so don't run plain `npm run demo` (it rejects stale held approvals).

1. `npm run web:build && npx serve@14 web/out` (or the Vercel URL once imported) and open `/vault/vault`.
2. Connect Meteor as `lineage-aditya.testnet` → **New task** → **Use demo mandate** → **Review**. Check the summary (agent-l, budget 100, max 50 tUSDC, payee Alice up to 20, the registry resolver, 14 days) → **Sign in wallet**. The result line shows "Task #N created" and the hash.
3. `npm run demo -- --task N --plan-only` (read-only: the same three calls as the official plan), then `npm run demo -- --task N`. It uses only agent-l's function-call key, never the root key, and doesn't write `deployments/demo-run.json`. Expect P2 Paid 25, P1 Paid 18, P3 AwaitingApproval 49, acceptance passes.
4. The new held P3 sits next to #14. Leave both, or reject the new one from the UI; decide in F09 with the video script.
5. `npm --prefix web run check:site -- <Vercel URL>`: 4/4 pages passed.

Record:

- create_task tx: ``
- task id: ``
- payment `#` P2 → hindi-translator, 25 tUSDC: ``
- payment `#` P1 → Alice, 18 tUSDC: ``
- payment `#` P3 → vendor-payments, 49 tUSDC: ``
- check:site on the Vercel URL: ``
