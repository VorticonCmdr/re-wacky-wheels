// node tools/dosbox/make-test-sin.mjs --track 1 --id 56 --rows 22-25 --cols 4-9 --value 2 [--out analysis/dosbox/WACKY/WACKY.DAT]
// Writes a copy of the user's WACKY.DAT in which tile id ID (one the track's .M does not use) has both kept dwords of its .SIN record set to VALUE (so every pixel of it has
// that terrain value) and the .M cells in the given row and column ranges are that tile, into the run copy of the game, and prints the new archive's SHA-1.
// The installed archive is never touched.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { openGameFolder } from '../../src/vfs/node.js';
import { parseDatDirectory } from '../../src/formats/dat.js';
import { replaceMember } from '../../src/verify/patch.js';

const { values } = parseArgs({ options: { track: { type: 'string' }, id: { type: 'string' }, rows: { type: 'string' }, cols: { type: 'string' }, value: { type: 'string' }, out: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, game: { type: 'string' } } });
const range = s => s.split('-').map(Number), [r0, r1] = range(values.rows), [c0, c1] = range(values.cols);
let dat = await (await openGameFolder(values.game && resolve(values.game))).open('WACKY.DAT');
const member = name => { const m = parseDatDirectory(dat).find(e => e.name === name); if (!m) throw new Error(`no member ${name}`); return Uint8Array.from(m.data); };
const id = Number(values.id), value = Number(values.value), recordBytes = 12, skipped = 4, columns = 64;
const map = member(`${values.track}.M`);
if (map.includes(id)) throw new Error(`tile ${id} is used by the track`);
for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) map[r * columns + c] = id;
const sin = member(`${values.track}.SIN`), dv = new DataView(sin.buffer);
dv.setUint32(id * recordBytes + skipped, value, true); dv.setUint32(id * recordBytes + skipped + 4, value, true);
dat = replaceMember(dat, `${values.track}.M`, map);
dat = replaceMember(dat, `${values.track}.SIN`, sin);
await writeFile(resolve(values.out), dat);
console.log(`${values.out}: ${dat.length} bytes, sha1 ${createHash('sha1').update(dat).digest('hex')}`);
