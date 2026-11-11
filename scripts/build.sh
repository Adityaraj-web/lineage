#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for crate in vault registry mock-usdc; do
  echo "→ building contracts/$crate"
  (cd "contracts/$crate" && cargo near build non-reproducible-wasm)
done

echo
for name in lineage_vault lineage_registry lineage_mock_usdc; do
  wasm="target/near/$name/$name.wasm"
  [ -f "$wasm" ] || { echo "✘ missing $wasm" >&2; exit 1; }
  echo "✔ $wasm ($(stat -c %s "$wasm") bytes)"
done
