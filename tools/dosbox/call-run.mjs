// node tools/dosbox/call-run.mjs --id calls-7 --mode 7 [--stops 12] [--sites 0xd04,0xd5f,0xd78,0xc90,0xc9f,0xce6,0x31bc8] [--attach]
// --attach arms the breakpoints in a game that already runs (instead of the DOS prompt route): only code blocks that have never run in that game can stop.
// Prerequisites as for gate-run.mjs (bridge running, C: mounted, the run copy's WACKY.CFG sound mode N, an interrupt breakpoint (int 0x21, ah 0x3d) armed in the paused emulator at the DOS prompt, WW typed; with
// mode 0 SET BLASTER=A220 I7 D1 H5 T6 first). The first stop in the flat protected-mode game code (cs 0x180) is swapped for execute breakpoints at the given sites of the sound code, armed before they ever ran
// (the emulator's dynamic core stops at a block only the first time it runs); the game is then played to a race by hand. One row per stop is written for `observe -- calls`.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const { values } = parseArgs({ options: { id: { type: 'string' }, mode: { type: 'string' }, stops: { type: 'string' }, sites: { type: 'string' }, rows: { type: 'string' }, wait: { type: 'string' }, attach: { type: 'boolean' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (path, method = 'GET', body) => { const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }); return r.json(); };
const OBJ1 = 0x1ec000, SELECTOR = 0x180; // @math live obj1 base and flat code selector found by page voting in earlier runs
const SITES = (values.sites ?? '0xd04,0xd5f,0xd78,0xc90,0xc9f,0xce6,0x31bc8').split(',').map(Number), STOPS = Number(values.stops ?? 12), WAIT = Number(values.wait ?? 600); // @math the default sites and number of stops, and seconds to wait
const waitStop = async since => { for (let i = 0; i < WAIT * 10; i++) { const d = await j('/debug/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } return null; };
const rd = async (a, n) => Buffer.from(await (await fetch(`${API}/memory/${a}/${n}`)).arrayBuffer());
let stop;
if (values.attach) { // a game that is already running: pause it inside the flat game code (only blocks that never ran stop)
  for (let k = 0; k < 60 && !(stop?.protected_mode && stop.registers.cs === SELECTOR); k++) { await j('/debug/pause', 'POST'); await sleep(150); const d = await j('/debug/status'); stop = d.debugging ? d.stop : null; if (!(stop?.protected_mode && stop.registers.cs === SELECTOR)) { await j('/debug/continue', 'POST'); await sleep(60 + Math.random() * 80); } } // @math sixty tries
} else {
  stop = await waitStop(0);
  while (stop && !(stop.protected_mode && stop.registers.cs === SELECTOR)) { await j('/debug/continue', 'POST'); stop = await waitStop(stop.stop_id); } // the interrupt stops of DOS/4G and the real-mode loader are passed over
}
if (!stop) throw new Error('no stop in the game code');
await fetch(`${API}/debug/breakpoints`, { method: 'DELETE' });
for (const s of SITES) await j('/debug/breakpoints', 'POST', { type: 'execute', segment: SELECTOR, offset: OBJ1 + s });
await j('/debug/continue', 'POST');
const rows = []; let last = stop.stop_id;
for (let n = 0; n < STOPS; n++) {
  const s = await waitStop(last);
  if (!s) break;
  last = s.stop_id;
  const r = s.registers, mem = await rd(r.esp, 8);
  rows.push([s.stop_id - stop.stop_id, s.linear_eip - OBJ1, r.eax, r.edx, r.ebx, mem.readUInt32LE(0) - OBJ1]); // the stop's number, its site, three registers and the return address on top of the stack
  writeFileSync(values.rows ?? '/tmp/calls-rows.json', JSON.stringify(rows));
  await j('/debug/continue', 'POST');
}
await j('/debug/pause', 'POST'); await sleep(200);
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'calls', '--id', values.id, '--moment', `sound mode ${values.mode} in the run copy; execute breakpoints at the engine start, horn and library play routines armed before they ran, the game played to a race`, '--cfg', 'analysis/dosbox/WACKY/WACKY.CFG', '--rows', values.rows ?? '/tmp/calls-rows.json', '--args', JSON.stringify({ sites: SITES })], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
await j('/debug/continue', 'POST');
