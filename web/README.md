# Lineage dashboard

A static Next.js dashboard (`output: "export"`, no server, no keys). It reads both vaults live from NEAR testnet RPC in the browser; owner actions (approve, reject, freeze, new task) are signed in the owner's own wallet.

Run these from the repo root: `npm run web:dev` (http://localhost:3000) · `npm run web:test` · `npm run web:build` (static site in `web/out`) · `npm run verify:web` · `npm --prefix web run check:site -- <base-url>`.

See the root [README.md](../README.md).
