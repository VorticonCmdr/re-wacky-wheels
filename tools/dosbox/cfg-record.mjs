// node tools/dosbox/cfg-record.mjs --id setup-2 --moment "..." --before FILE --after FILE [--exe SETUP.EXE]
// Writes an observation record of what a program of the game changed in WACKY.CFG: the offsets whose byte differs between a copy made before the run and the file after it, with both values.
// Only offsets and byte values are kept (the file's other bytes are not).
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { crc32, hex8 } from '../../src/evidence/crc32.js';

const { values } = parseArgs({ options: { id: { type: 'string' }, moment: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, exe: { type: 'string', default: 'SETUP.EXE' }, game: { type: 'string', default: 'analysis/dosbox/WACKY' } } });
if (!values.id || !values.moment || !values.before || !values.after) { console.error('usage: cfg-record --id ID --moment TEXT --before FILE --after FILE [--exe NAME]'); process.exit(1); }
const a = await readFile(resolve(values.before)), b = await readFile(resolve(values.after)), exe = await readFile(resolve(values.game, values.exe));
if (a.length !== b.length) throw new Error('the file sizes differ');
const changes = []; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changes.push([i, a[i], b[i]]);
const record = { id: values.id, tool: 'dosbox-automation 0.84.0-vc1 (f6d9b)', via: 'host copies of WACKY.CFG before and after the run', date: new Date().toISOString().slice(0, 10), exe: { name: values.exe, size: exe.length, sha1: createHash('sha1').update(exe).digest('hex') }, moment: values.moment, cfg: { size: a.length, beforeCrc: hex8(crc32(a)), afterCrc: hex8(crc32(b)) }, changes };
await writeFile(resolve('src/evidence/obs', `${values.id}.json`), JSON.stringify(record) + '\n');
console.log(`wrote src/evidence/obs/${values.id}.json: ${changes.length} bytes differ`);
