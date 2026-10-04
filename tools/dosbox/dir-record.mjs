// node tools/dosbox/dir-record.mjs --id setup-1 --moment "..." --exe SETUP.EXE --before DIR --after DIR [--pattern REGEX]
// Writes an observation record of two directory listings of the run copy: the name, size and CRC-32 of every file whose name matches the pattern, before and after an experiment in a program that
// changes files (the files are read from the host's folders; nothing of their content is kept). `--before` is a backup folder made before the experiment.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { crc32, hex8 } from '../../src/evidence/crc32.js';

const { values } = parseArgs({ options: { id: { type: 'string' }, moment: { type: 'string' }, exe: { type: 'string', default: 'SETUP.EXE' }, before: { type: 'string' }, after: { type: 'string' }, pattern: { type: 'string', default: '^WACKY.*\\.(HI|TIM|DTT)$' }, game: { type: 'string', default: 'analysis/dosbox/WACKY' } } });
if (!values.id || !values.moment || !values.before || !values.after) { console.error('usage: dir-record --id ID --moment TEXT --before DIR --after DIR [--exe NAME] [--pattern REGEX]'); process.exit(1); }
const re = new RegExp(values.pattern);
const list = async dir => {
  const out = [];
  for (const name of (await readdir(resolve(dir))).filter(n => re.test(n)).sort()) { const data = await readFile(resolve(dir, name)); out.push({ name, size: (await stat(resolve(dir, name))).size, crc: hex8(crc32(data)) }); }
  return out;
};
const exe = await readFile(resolve(values.game, values.exe));
const record = { id: values.id, tool: 'dosbox-automation 0.84.0-vc1 (f6d9b)', via: 'host directory listings of the run copy', date: new Date().toISOString().slice(0, 10), exe: { name: values.exe, size: exe.length, sha1: createHash('sha1').update(exe).digest('hex') }, moment: values.moment, pattern: values.pattern, before: await list(values.before), after: await list(values.after) };
await writeFile(resolve('src/evidence/obs', `${values.id}.json`), JSON.stringify(record) + '\n');
console.log(`wrote src/evidence/obs/${values.id}.json: ${record.before.length} files before, ${record.after.length} after`);
