// npm run make-test-archive -- --rename 42.GAM=42.GAX --rename 20.GAM=20.GAX   (renamed directory entries)
// npm run make-test-archive -- --member 2.GAM --edit 8=" 12" --edit 9="+7" [--out analysis/dosbox/WACKY/WACKY.DAT] [--game DIR]
// Writes a copy of the user's WACKY.DAT in which one member's lines are edited (see src/verify/patch.js)
// into the run copy of the game, and prints the new archive's SHA-1. The installed archive is never touched.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { openGameFolder } from '../../src/vfs/node.js';
import { parseDatDirectory } from '../../src/formats/dat.js';
import { replaceMember, renameMember, editLines } from '../../src/verify/patch.js';

const { values } = parseArgs({ options: { member: { type: 'string' }, edit: { type: 'string', multiple: true, default: [] }, rename: { type: 'string', multiple: true, default: [] }, out: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, game: { type: 'string' } } });
if (!values.member && !values.rename.length) { console.error('usage: make-test-archive --member NAME --edit N=text ... | --rename OLD=NEW ... [--out PATH]'); process.exit(1); }
const dat = await (await openGameFolder(values.game && resolve(values.game))).open('WACKY.DAT');
let out = dat;
for (const r of values.rename) { const [from, to] = r.split('='); out = renameMember(out, from, to); }
if (values.member) {
  const member = parseDatDirectory(dat).find(e => e.name === values.member);
  if (!member) throw new Error(`no member ${values.member}`);
  const edits = values.edit.map(e => { const i = e.indexOf('='); return [Number(e.slice(0, i)), e.slice(i + 1)]; });
  out = replaceMember(out, values.member, editLines(member.data, edits));
}
await writeFile(resolve(values.out), out);
console.log(`${values.out}: ${out.length} bytes, sha1 ${createHash('sha1').update(out).digest('hex')}`);
