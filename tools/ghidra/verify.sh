#!/bin/sh
# Read-only check that the Ghidra import matches analysis/ww. Run after tools/ghidra/import.sh.
set -eu
cd "$(dirname "$0")/../.."
GHIDRA_HEADLESS="${GHIDRA_HEADLESS:-$(dirname "$(readlink -f "$(command -v ghidraRun)")")/../libexec/support/analyzeHeadless}"
"$GHIDRA_HEADLESS" ghidra wackywheels \
  -process obj1.bin -noanalysis -readOnly \
  -scriptPath tools/ghidra \
  -postScript VerifyWwImport.java analysis/ww
