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
- `scripts/`: TypeScript deploy/verify scripts (tsx, near-api-js 7.5.x); `scripts/lib/` is shared by every script. The root key is loaded only via `scripts/lib/root-key.ts`.
- `agent/`: the demo agent. `inbox/*.md` (untrusted emails) → `planner-scripted.ts` (`Planner` interface) → `tools.ts` (tool call → `request_payment` args) → `agent.ts` + `executor.ts` (agent function-call key only). `owner.ts` (root-signed setup) and `run.ts` (orchestrator, report, acceptance) are the only agent files that touch the root key.
- `web/`: static Next.js dashboard (`output: "export"`, no server, no keys): read-only for viewers; owner actions signed in the owner's wallet. `src/lib` is pure data logic (rpc with failover, views, provenance, risk); `src/components/screens/*` are the only importers of `lib/live`; pages are server shells. `npm run sync` copies `deployments/*.json` and `agent/inbox/*.md` (as `inbox.json`) into `web/src/shared/` before dev/build. `lib/story.ts` (story strip, attacker totals, task split) and `lib/emails.ts` (parse the synced emails) are pure. `components/backdrop/` is the page background (`palette.ts` pure: moods, one hue per page (Compare two), `fieldAt` mirrors the GLSL, `inkShare`, tier, frame budget; `Backdrop.tsx` a hand-written WebGL mesh gradient at 0.5x and 30 fps, CSS fallback, grain, cursor light; `?bgstats` exposes `window.__backdrop`, `?nogl` forces the fallback). Every panel is `components/Glass.tsx` (tiers stage, card, chip); only the doorways and the hero vault use `Tilt`. Threads are drawn only in the hero, scenes 2 and 3, the Compare stage and the A-102 connector (`story/GlowPath`). `components/story/` holds the scroll-scene helpers (pinned section, progress, `Counter`). Agent memos and emails are untrusted: React text nodes only, never `dangerouslySetInnerHTML`. `components/wallet/`: `connector.ts` is the only importer of `@hot-labs/near-connect` (`WalletPort` in `lib/wallet.ts`), `WalletProvider` (status `unavailable` hides Connect, reading still works), `ConnectButton` (nav), `useOwnerAction` (one action at a time), `TxResult`; `?fakewallet=owner|viewer` swaps in a fake wallet under `next dev` only. `lib/actions.ts` builds owner txs (approve/reject/unfreeze 1 yocto, freeze 0), `lib/tx.ts` parses outcomes (`parseOutcome` incl. the decoded return `value`, `walletErrorMessage`). `lib/mandate.ts` is pure: parse/validate the mandate form, `createTaskTx` (create_task, 1 yocto, 50 Tgas, built only from validated args), `demoMandateForm` (from task 0), `createdTaskId`. Owner controls render only for `role === "owner"`: inbox cards (Reject primary, Approve with inline confirm), the freeze switch in `VaultHeader`, and on the Lineage vault only `TasksSection`'s "New task" → `vault/MandateForm` (inline form, confirm rendered from the args) → `vault/CreatedTask` (task #N, hash, copyable `npm run demo -- --task N`). `TasksSection` puts the newest task first. `web/scripts/check-site.ts` is a read-only smoke check of a deployed site.
- `deployments/demo-run.json`: public record of the latest `npm run demo` (committed).
- `deployments/testnet.json`: public account ids of the live deployment (committed).
- `docs/owner-wallet.md`: add/remove the owner's Meteor full-access key (near-cli-rs) and the testnet rehearsal checklist.
- `docs/specs/F0X.md`: one spec per feature. **Read the spec for the current feature before planning.**

## Commands

- Contracts: `cargo test` (workspace) · `npm run build` (cargo near build non-reproducible-wasm for all three; output in repo-root `target/near/<crate_name>/`)
- Deploy: `LINEAGE_ROOT=<your-account>.testnet npm run deploy` (idempotent; needs ~15 testnet NEAR)
- Verify the live deployment, no account needed: `npm install && npm run verify:deploy`
- Upgrade vault code (state kept, no `new` call; idempotent): `npm run build && npm run upgrade:vaults [-- --dry-run]`
- Web: `npm run web:install` · `npm run web:dev` · `npm run web:test` (vitest: lib in node, components in jsdom) · `npm --prefix web run typecheck` · `npm run web:build` (static site in `web/out/`, serve with `npx serve@14 web/out`) · `npm run verify:web` (live read-only checks, no account needed)
- Site check (read-only; 200 HTML + footer, no dev flags): `npm --prefix web run check:site -- <base-url>`
- Vercel (dashboard import, nothing secret): Root Directory `web` ("Include files outside the root directory" on: `prebuild` sync reads `../deployments`, `../agent/inbox`), preset Next.js, build `npm run build`, output default (`out`), Node 22.x, no env vars
- Owner wallet key and rehearsals (Adityaraj signs): see `docs/owner-wallet.md`
- Agent: `npm test` (offline unit tests) · `npm run demo [-- --only vault|guarded]` (deployer only: owner setup, a fresh task per vault, agent runs, exits 0 only if acceptance holds) · `npm run demo -- --plan-only` (read-only, prints the plan) · `npm run demo -- --task N [--plan-only]` (a dashboard-created task on the Lineage vault, N ≠ 0: read-only preflight, then agent-l's key only)

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
- RPC errors: the real reason is `error.cause.name` (e.g. `UNKNOWN_ACCOUNT`); top-level `error.name` is just `HANDLER_ERROR`. A view call that fails in the contract (e.g. `CodeDoesNotExist`) returns HTTP 200 with a string `result.error`, not `error`. Check both.
- `test.rpc.fastnear.com` accepts browser POSTs (CORS OK); the dashboard needs no proxy.
- Rust `String::truncate` and string slicing are byte-indexed and panic mid-character (`assertion failed: self.is_char_boundary(new_len)`). Cut untrusted text on `is_char_boundary`.
- `demo --task` never loads the root key (a source test guards `runTask`) and never writes `deployments/demo-run.json` (that stays the official two-vault run). Plain `npm run demo` rejects stale held approvals, so don't run it while a P3 is held for the video.

## Web pitfalls

- Import `cn` from `@/components/cn`, not `cn`: plain tailwind-merge doesn't know the custom type scale and drops `text-stat`/`text-small` when a text colour follows.
- Type page/layout props by hand (`params: Promise<{ key: string }>`). The generated `PageProps`/`LayoutProps` globals fail `tsc` from a clean `.next`.
- Reduced motion: use `hooks/useReducedMotionPref`, not motion's `useReducedMotion` (that caches its first answer and misses a later change).
- Numbers are Plus Jakarta Sans with tabular figures (body sets `tabular-nums`): its proportional "1" has no foot and reads as "l", the tabular one does not. Instrument Serif is never used for numbers or below 36px; a count inside a serif heading goes through `NeedsYou` (digits in the sans).
- Big numbers use `.stat` inside a `.stat-box` that sets `--stat-chars` (the text length): the size is the box width over the text width, clamped, so it never overflows; in a flex row the box's basis makes two stats wrap before shrinking below `--stat-min`, but in a flex column that basis becomes a height, so don't put a `.stat-box` directly in a `flex-col`. `.stat` and `.stat-box` are plain classes, not utilities: no `md:` variants on them.
- Glass CSS lives in `@layer components`: unlayered, its `position: relative` and `border-radius` beat `absolute` and `rounded-*`. Glass inside glass doesn't blur again; chips never blur (budget: at most 8 blurred panels in view). On glass, muted text is the lighter `#B8C0CF` and faint is never used; small coloured text on a coloured tint gets `.chip-ink` (a dark base), or that one panel gets a higher `--glass-ink`. Check contrast against the real pixels under each text box: the gradient moves the result.
- View transitions: `<ViewTransition>` wrappers go in each `page.tsx` (`PageTransition`), not the layout. A shared element (`Shared`) pairs only if the old and new elements are both on screen in the same commit, so the destination needs cached data (`usePolling(..., { cacheKey })`, `poll-cache.ts`) and must render at its final value (Compare's `settled`). Next scrolls after the commit: `ScrollOnEnter` handles hash and top.
- Pinned scroll scenes need `(min-width: 768px) and (min-height: 620px)` (`usePinned`); below that they are stacked steps, and under reduced motion the settled frame. A pinned stage must fit under the nav at 620px high: the `short:` variant (768px+ wide, 820px or less high) tightens spacing (Compare's seal becomes a pill). Text in a fixed-height card needs `shrink-0`: `truncate`/`line-clamp` make it shrinkable and the flex column cuts it in half. Lenis (`SmoothScroll`) runs only for fine pointers without reduced motion; Replay stops and restarts it via `useSmoothScroll`. In jsdom, `setPinned`/`setReducedMotion` in `test/media.ts` flip the queries.
- near-connect only through the dynamic `import()` in `components/wallet/connector.ts` (a test greps `src/`); never add a function-call key on connect. Role = `get_config().owner`, exact string match (no lower-casing or trimming).
- Owner actions: no optimistic state (the freeze switch shows the chain's value); after an action, refresh at once and again after 2 s (approve settles a block later through the callback). Amount and payee in a confirm come from the payment row, never the memo.
- Payee history is chain state: once a poisoned P3 is approved, later cards for that payee say `paid-before`, not `never-paid` (still high). Live checks accept either.
- Closed `<details>` content still has layout boxes: browser checks must skip elements where `checkVisibility()` is false.
- The contract's instruction limit is 1000 UTF-8 bytes (`new TextEncoder().encode(s).length`), not `s.length`; labels are capped in code points (`[...s].length`).
- Backdrop: top light, one hue per page with the rest near ink (Compare is the one two-hue page). `inkShare` must stay in 0.65–0.78 for every mood (tested); keep `fieldAt` in step with the GLSL when either changes.
- `usePolling` surfaces `error` only after 2 consecutive failures; one blip retries silently.
- Radix single `ToggleGroup` emits `""` when the active item is clicked again: ignore values that aren't an option, never set state to `""`.

## Definition of done (every feature, before its last commit)

1. Update this file: move the feature into Status → Done, set Next, and update Layout, Commands and NEAR pitfalls if the feature changed them or taught something new.
2. Run `npm run typecheck`, the unit tests and the feature's acceptance check, and paste the results in the final summary.
3. Include the CLAUDE.md change in the feature's last commit. Keep this file short: facts, commands and rules, not history.

## Status

- Done: F00 scaffold · F01 vault · F02 registry · F03 mock USDC (23 unit tests) · F04 testnet deploy + verify (12/12 checks) · F05 agent (35 agent unit tests) · F05.1 memo cut on a char boundary + `upgrade:vaults` (21 vault unit tests, 13 verify checks) · F06 read-only dashboard in `web/` (Overview scroll story with a glass vault hero, both vaults, Compare scroll stage; glass panels over a WebGL mesh gradient; live testnet reads; 191 web tests, 8 verify:web checks) · F07 wallet connection (NEAR Connect) and owner actions: approve/reject from the inbox, freeze/unfreeze (288 web tests, 8 verify:web checks) · F08 mandate builder signed in the owner's wallet, `demo --task` on the agent key only, one-hue backdrop and polish, `check:site` (449 web tests, 53 agent tests, 13 verify:deploy, 8 verify:web)
- F07 rehearsal (Meteor, key `ed25519:A5Fouq…1gh4`): reject #5 `5fTE3HuGfBtN8Z7NdWwKJHV8XC6MKWMptScPXwcVCwLz` · freeze `CWFa5AdSPrrumK2uBtuiGQK6cVXLwZTdC61UNJuifKYX` · unfreeze `dEPneAJzQX7osrupuVEPUec2iHEcELyQGfLdRUXknzp` · approve #11 `6wxcrjgmyiDJH5YmTfxzkpRfnUSmC8WdmoYdPajBByXK` · 0-deposit approve #14 rejected by the contract `BgHENiFvG9brA9YcabunzxFWoBimivo3SJUQEwz1JXLx`
- Live on testnet: `deployments/testnet.json` (root `lineage-aditya.testnet`; vault and guarded run identical code; `npm run verify:deploy` prints the current code hash; task 0 on both, expires 2026-11-25)
- Next: F09 README, video, X post. Before it, Adityaraj: Vercel import, F08 rehearsal (`docs/owner-wallet.md`), `check:site` on the Vercel URL
