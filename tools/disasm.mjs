// npm run disasm -- obj1+0x18180 [instructions]   (default 60; DISASM_DIR=analysis/setup for SETUP.EXE after dump:le -- --exe SETUP.EXE --out analysis/setup)
// Offline 32-bit disassembly of the dumped, pre-fixup WW.EXE objects (npm run dump:le first) with
// `ndisasm`. Operands that were fixed up show the target as an object-relative offset (obj2+0x5080
// appears as 0x5080), so addresses here are citation-form, not Ghidra-form. It is a reading aid:
// it does not replace Ghidra, and nothing it prints is evidence until cited with `npm run cite`.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const [spec, count = '60'] = process.argv.slice(2);
const m = spec?.match(/^obj(\d+)\+0x([0-9a-f]+)$/i);
if (!m) { console.error('usage: npm run disasm -- obj1+0x18180 [instructions]'); process.exit(1); }
const file = resolve(`${process.env.DISASM_DIR ?? 'analysis/ww'}/obj${m[1]}.bin`), start = parseInt(m[2], 16); // @math hex radix
// -o sets the address of the first displayed byte when combined with -e, so offsets and branch targets are object offsets.
const out = execFileSync('ndisasm', ['-b', '32', '-o', String(start), '-e', String(start), file], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n'); // @math output buffer size
console.log(out.slice(0, Number(count)).join('\n'));
