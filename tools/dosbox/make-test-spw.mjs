// node tools/dosbox/make-test-spw.mjs --track 1 --index 0 --x 256 --y 876 [--out analysis/dosbox/WACKY/WACKY.DAT]
// Writes a copy of the user's WACKY.DAT in which record INDEX of the track's .SPW member has its x and y words (record words 2 and 3, before the loader adds the map origin) set, so that an object
// of the track is moved onto the road, into the run copy of the game, and prints the new archive's SHA-1. The installed archive is never touched.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { openGameFolder } from '../../src/vfs/node.js';
import { replaceSpwRecord } from '../../src/verify/strip.js';

const { values } = parseArgs({ options: { track: { type: 'string' }, index: { type: 'string' }, x: { type: 'string' }, y: { type: 'string' }, out: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, game: { type: 'string' } } });
const dat = await (await openGameFolder(values.game && resolve(values.game))).open('WACKY.DAT');
const out = replaceSpwRecord(dat, { track: Number(values.track), index: Number(values.index), x: Number(values.x), y: Number(values.y) });
await writeFile(resolve(values.out), out);
console.log(`${values.out}: ${out.length} bytes, sha1 ${createHash('sha1').update(out).digest('hex')}`);
