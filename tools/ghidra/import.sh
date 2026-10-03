#!/bin/sh
# Import WW.EXE's LE objects into the machine-local Ghidra project (ghidra/, git-ignored).
#   npm run dump:le && sh tools/ghidra/import.sh
# Close the project in the Ghidra GUI first; headless import needs the project lock.
set -eu
cd "$(dirname "$0")/../.."
GHIDRA_HEADLESS="${GHIDRA_HEADLESS:-$(dirname "$(readlink -f "$(command -v ghidraRun)")")/../libexec/support/analyzeHeadless}"
OBJ1_BASE=$(node -e "console.log('0x'+require('./analysis/ww/layout.json').objects[0].base.toString(16))")
"$GHIDRA_HEADLESS" ghidra wackywheels \
  -import analysis/ww/obj1.bin \
  -overwrite \
  -loader BinaryLoader -loader-baseAddr "$OBJ1_BASE" \
  -processor x86:LE:32:default \
  -scriptPath tools/ghidra \
  -preScript ImportWwObjects.java analysis/ww
