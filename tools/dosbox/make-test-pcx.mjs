// node tools/dosbox/make-test-pcx.mjs --member APOG1.PCX [--no-zero] [--out analysis/dosbox/WACKY/WACKY.DAT]
// An experiment input: your archive with one PCX member re-encoded to the same 320 x 200 picture by an encoding no archive file uses (src/verify/pcxrle.js): runs that cross the row
// boundaries and, unless --no-zero, a run with the count 0 and the value 0x55 before the first pixel and after every 40th token. The game's VGA decoder shows the original picture for the
// version without zero runs (runs continue across rows) and a picture entirely of 0x55 for the version with them (a zero count is a 16-bit loop that fills the rest). Written to the run copy, never to game/.
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openGameFolder } from '../../src/vfs/node.js';
import { parseDatDirectory } from '../../src/formats/dat.js';
import { crossingArchive } from '../../src/verify/pcxrle.js';
const { values } = parseArgs({ options: { member: { type: 'string', default: 'APOG1.PCX' }, out: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, 'no-zero': { type: 'boolean' } } });
const dat = await (await openGameFolder()).open('WACKY.DAT');
const member = parseDatDirectory(dat).find(e => e.name === values.member)?.data;
if (!member) throw new Error(`no member ${values.member}`);
const built = crossingArchive(dat, values.member, member, { zero: !values['no-zero'] });
writeFileSync(values.out, built);
console.log(`${values.member} re-encoded${values['no-zero'] ? '' : ' with zero-count runs'}: archive ${built.length} bytes, sha1 ${createHash('sha1').update(built).digest('hex')}; written to ${values.out}`);
