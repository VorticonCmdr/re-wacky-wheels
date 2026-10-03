// node tools/dosbox/clamp-run.mjs --id terrain-4
// Prerequisites as for gate-run.mjs (bridge running, C: mounted, WW typed, the protected-mode interrupt breakpoint armed). Replaces it with execute
// breakpoints at the terrain lookup's entry (obj1+0x27b04) and its popa (obj1+0x27baf); at each entry stop it overwrites the lookup's row and column
// inputs (obj2+0x1d7a8, +0x1d7a4) with the next forced pair, single-steps out of the routine and reads the result (obj2+0x1e568). Records the `clamp` scenario.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { readMemory, locateObjects } from './live.mjs';
import { openGameFolder } from '../../src/vfs/node.js';
import { locateLe } from '../../src/formats/le.js';
const { values } = parseArgs({ options: { id: { type: 'string' } } });
const API = 'http://127.0.0.1:8386/api/v1', DEBUG = `${API}/debug`, sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (path, method = 'GET', body) => (await fetch(DEBUG + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const OBJ1 = 0x1ec000, OBJ2 = 0x239000, SELECTOR = 0x180, ENTRY = 0x27b04, EXIT = 0x27bb0, ROW = 0x1d7a8, COL = 0x1d7a4, RESULT = 0x1e568; // @math live bases and flat code selector found by page voting in earlier runs; lookup entry and the ret after its popa
const FORCED = [[2000, 1500], [-1, 1500], [-100000, 1500], [0, 1500], [0xfff, 1500], [0x1000, 1500], [0x1001, 1500], [100000, 1500], [1500, -1], [1500, -100000], [1500, 0], [1500, 0xfff], [1500, 0x1000], [1500, 100000], [-1, -1], [0x1000, 0x1000], [0xfff, 0xfff], [0xffe, 0xffe], [100000, -100000]]; // @math the forced inputs: in range, then each side of each limit
const stopped = async since => { for (let i = 0; i < 3000; i++) { const d = await j('/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } throw new Error('no stop'); };
const track = async () => { const b = Buffer.from(await readMemory(OBJ2 + 0x1d770, 8)); const z = b.indexOf(0); return b.subarray(0, z < 0 ? 8 : z).toString('latin1'); }; // @math the track-name field is NUL-terminated within 8 bytes
const i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
const write = async (a, v) => { const b = Buffer.alloc(4); b.writeInt32LE(v); const r = await fetch(`${API}/memory/${a}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: b }); if (!r.ok) throw new Error(`write failed ${r.status}`); };
let stop = await stopped(0);
const existing = (await j('/breakpoints')).breakpoints.some(b => b.type === 'execute');
if (!existing) { // first run: still at the interrupt stop
  if (!stop.protected_mode || stop.registers.cs !== SELECTOR) throw new Error('the first stop is not in the protected-mode game code');
  await fetch(`${DEBUG}/breakpoints`, { method: 'DELETE' });
  await j('/breakpoints', 'POST', { type: 'execute', segment: SELECTOR, offset: OBJ1 + ENTRY });
  await j('/continue', 'POST');
  stop = null;
}
const samples = [];
let last = stop ? stop.stop_id - 1 : (await j('/status')).stop.stop_id; // @math take the current stop again when re-running against an armed breakpoint
// At each entry stop the inputs are forced, then the routine is single-stepped until the instruction pointer leaves it; the result is read there.
for (const [row, col] of FORCED) {
  stop = await stopped(last); last = stop.stop_id;
  if (stop.linear_eip !== OBJ1 + ENTRY) throw new Error(`expected the lookup entry, stopped at ${stop.linear_eip.toString(16)}`);
  await write(OBJ2 + ROW, row); await write(OBJ2 + COL, col);
  let at = stop.linear_eip;
  for (let steps = 0; at >= OBJ1 + ENTRY && at <= OBJ1 + EXIT; steps++) {
    if (steps > 200) throw new Error('the routine did not return'); // @math step budget, the routine has about 50 instructions
    const r = await j('/step', 'POST'); at = r.stop.linear_eip; last = r.stop.stop_id;
  }
  samples.push([await i32(OBJ2 + ROW), await i32(OBJ2 + COL), await i32(OBJ2 + RESULT), Number(await track())]);
  await j('/continue', 'POST');
}
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'clamp', '--id', values.id, '--moment', 'first demo race (track 2); row and column forced at the terrain lookup entry (obj1+0x27b04), stepped out of the routine, result read', '--args', JSON.stringify(samples)], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
