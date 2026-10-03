// npm run cite -- <address> [--exe WW.EXE] [--game DIR]
// Turns a Ghidra address (0x411a8) or an object offset (obj1+0x311a8) into the canonical citation
// `WW.EXE:obj<N>+0x<off> fp=<crc32 of 16 pre-fixup bytes>`, computed in-process from the user's
// executable. Warns when fixup sites fall inside the fingerprinted bytes, because Ghidra shows
// those bytes post-fixup while the fingerprint covers the pre-fixup values.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { openGameFolder } from '../src/vfs/node.js';
import { locateLe, parseFixups, objectBytes, fromGhidra, toGhidra } from '../src/formats/le.js';
import { crc32, hex8, FP_LENGTH } from '../src/evidence/crc32.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { exe: { type: 'string', default: 'WW.EXE' }, game: { type: 'string' } } });
if (!positionals.length) { console.error('usage: npm run cite -- <0xGHIDRA | objN+0xOFF> ...'); process.exit(1); }
const vfs = await openGameFolder(values.game && resolve(values.game));
const exe = await vfs.open(values.exe), { le } = locateLe(exe), fixups = parseFixups(exe, le);
for (const arg of positionals) {
  const m = arg.match(/^obj(\d+)\+0x([0-9a-f]+)$/i);
  const { object, offset } = m ? { object: Number(m[1]), offset: parseInt(m[2], 16) } : fromGhidra(le, parseInt(arg, 16));
  const fp = hex8(crc32(objectBytes(le, object, offset, FP_LENGTH)));
  const obj = le.objects[object - 1];
  const inside = fixups.filter(f => f.page >= obj.pageIndex && f.page < obj.pageIndex + obj.pageCount).map(f => (f.page - obj.pageIndex) * le.pageSize + f.source).filter(s => s + 4 > offset && s < offset + FP_LENGTH);
  console.log(`${values.exe}:obj${object}+0x${offset.toString(16)} fp=${fp}    (ghidra 0x${toGhidra(le, object, offset).toString(16)})`);
  if (inside.length) console.log(`  note: fixup sites at ${inside.map(s => `obj${object}+0x${s.toString(16)}`).join(', ')} overlap the fingerprint; Ghidra shows those bytes post-fixup`);
}
