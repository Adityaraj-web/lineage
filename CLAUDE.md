# Lineage

Prepared statements for money: a NEAR vault for AI agents that checks **where a payee came from** before paying.
Built solo by Adityaraj Paul for NEAR HACKATHON (deadline 14 Nov 2026 23:59 UTC). Network: NEAR testnet.

Payee provenance, enforced on-chain in `contracts/vault`:
- **P1 UserSigned**: payee is in a task mandate the owner signed → auto-paid within caps
- **P2 Resolved**: the vault calls a resolver the owner pinned (`lineage_resolve`) and pays exactly the payee and price it returns → auto-paid
- **P3 Untrusted**: raw address from the model → never auto-paid; waits for owner approval
- Standard layer too: budget, per-payment cap, expiry, freeze. A `LimitsOnly` vault (same code) is the comparison "guardrail wallet".

## Layout

- `contracts/vault`: `lineage-vault` (near-sdk 5.30.1). Owner actions need exactly 1 yocto (proves a full-access key). NEP-297 events, standard `lineage`.
- `contracts/registry`: `lineage-registry`, a curated P2 resolver. Re-`apply` resets a service to Pending.
- `contracts/mock-usdc`: NEP-141 tUSDC, 6 decimals, `mint` faucet (max 10k per call).
- `scripts/`: TypeScript deploy/verify scripts (tsx, near-api-js 7.5.x); `scripts/lib/` is shared by every script.
- `deployments/testnet.json`: public account ids of the live deployment (committed).
- `docs/specs/F0X.md`: one spec per feature. **Read the spec for the current feature before planning.**

## Commands

- Contracts: `cargo test` (workspace) · `npm run build` (cargo near build non-reproducible-wasm for all three; output in repo-root `target/near/<crate_name>/`)
- Deploy: `LINEAGE_ROOT=<your-account>.testnet npm run deploy` (idempotent; needs ~15 testnet NEAR)
- Verify the live deployment, no account needed: `npm install && npm run verify:deploy`

## Workflow rules

- One feature per branch `f0X-<name>`, commit prefix `F0X:`, merged into `main` with `git merge --no-ff` by Adityaraj.
- Tests / acceptance checks first, watch them fail, then implement.
- Plan before editing, in two phases when the spec says so; stop at the end of each phase for review.
- Commits are authored by Adityaraj. Do not push; he pushes.
- After Adityaraj merges, he deletes the feature branch locally and on GitHub. Start each feature from an up-to-date `main`.
- Minimal inline comments. Explanations go in chat.
- Never commit secrets: `.env.local` holds agent private keys and stays gitignored. `.env.example` lists variable names only.

## NEAR pitfalls (read before writing NEAR code)

- near-api-js **v7**: check the installed `.d.ts` before using an API. No v4/v5 APIs (`connect`, `keyStores`, `WalletConnection`).
- RPC: `NEAR_RPC_URL`, default `https://test.rpc.fastnear.com` with failover. Do not use `rpc.testnet.near.org` (deprecated, rate-limited).
- Agent accounts must only ever have one function-call key (receiver = its vault, methods = `["request_payment"]`). Create them with one tx `[createAccount, transfer, addKey(functionCallAccessKey)]`. Never use the `createAccount`/`createSubAccount` helpers (they add a full-access key). Save the private key before sending the tx.
- U128 values are JSON strings. Use `BigInt`, never `Number`. `usdc(n) = n * 1_000_000n`.
- Owner calls (`create_task`, `approve_payment`, `reject_payment`, `unfreeze`, `close_task`, `withdraw`) attach exactly 1 yocto. `freeze` attaches nothing.
- In a negative test, assert the specific error (e.g. access-key method-name mismatch), not just "it threw".

## Definition of done (every feature, before its last commit)

1. Update this file: move the feature into Status → Done, set Next, and update Layout, Commands and NEAR pitfalls if the feature changed them or taught something new.
2. Run `npm run typecheck`, the unit tests and the feature's acceptance check, and paste the results in the final summary.
3. Include the CLAUDE.md change in the feature's last commit. Keep this file short: facts, commands and rules, not history.

## Status

- Done: F00 scaffold · F01 vault · F02 registry · F03 mock USDC (23 unit tests) · F04 testnet deploy + verify (12/12 checks)
- Live on testnet: `deployments/testnet.json` (root `lineage-aditya.testnet`; vault and guarded run the same wasm, code hash `7tq25xKEFJ2FhJBiznTZdiTX6dzFKKGF8VbAtSwtZCea`; task 0 on both, expires 2026-11-25)
- Next: F05 agent (`docs/specs/F05.md`) · F06–F08 Next.js dashboard · F09 README, video, X post