// node tools/dosbox/fit-run.mjs --prefix fit --from 2 --moment "..." --cameras '[[x, y], ...]' [--heading 480]
// Prerequisites: a played race paused in its countdown (tick 2 to 30, timer mode 1). For every camera: write the position words (obj2+0x28b0a, +0x28b0e) and put the tick counter back to 2,
// let the game draw for 150 ms, pause and record the `screen` scenario with the sprite fit spec (observe.mjs) as <prefix>-<n>.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
const { values } = parseArgs({ options: { prefix: { type: 'string', default: 'fit' }, from: { type: 'string', default: '2' }, moment: { type: 'string' }, cameras: { type: 'string' }, lengths: { type: 'string', default: '[768,784,392,1064,195,234,1506]' } } });
const API = 'http://127.0.0.1:8386/api/v1', BASE = 0x239000; // @math obj2's live base in this build
const post = (path, body) => fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const put = async (offset, bytes) => { for (let k = 0; k < 20; k++) { const r = await fetch(`${API}/memory/${BASE + offset}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from(bytes) }); if (r.ok) return; await sleep(30); } throw new Error(`write at ${offset} failed`); };
const w16 = v => [v & 0xff, (v >> 8) & 0xff], w32 = v => [...w16(v & 0xffff), ...w16(v >>> 16)];
let n = Number(values.from);
for (const [x, y] of JSON.parse(values.cameras)) {
  await post('/debug/pause'); await sleep(80);
  await put(0x28b0a, w16(x)); await put(0x28b0e, w16(y)); await put(0x1ec64, w32(2));
  await post('/debug/continue'); await sleep(150); await post('/debug/pause'); await sleep(80);
  const id = `${values.prefix}-${n++}`;
  const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'screen', '--id', id, '--moment', `${values.moment} (camera words poked to ${x}, ${y})`, '--args', JSON.stringify({ spritefit: true, frameLengths: JSON.parse(values.lengths) })], { encoding: 'utf8' });
  console.log(id, out.stdout.trim().split('\n').pop().slice(0, 60), out.stderr.trim().slice(0, 200));
}
