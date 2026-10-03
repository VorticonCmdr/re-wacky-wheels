// node tools/dosbox/tick-run.mjs --id tick-1
// Prerequisites as for gate-run.mjs (bridge running, C: mounted, run copy WACKY.CFG sound mode 7, interrupt breakpoint armed in the paused emulator, WW typed).
// Replaces the interrupt breakpoint with an execute breakpoint at obj1+0x371f8 (the PC-speaker tick handler's tone path) and records the `tick` scenario.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
const { values } = parseArgs({ options: { id: { type: 'string' } } });
const API = 'http://127.0.0.1:8386/api/v1/debug', sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (path, method = 'GET', body) => (await fetch(API + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const OBJ1 = 0x1ec000, SELECTOR = 0x180, TONE = 0x371f8; // @math live obj1 base and flat code selector found by page voting in earlier runs; the tone path of the tick handler
const stopped = async since => { for (let i = 0; i < 600; i++) { const d = await j('/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } throw new Error('no stop'); };
let stop = await stopped(0);
if (!stop.protected_mode || stop.registers.cs !== SELECTOR) throw new Error('the first stop is not in the protected-mode game code');
await fetch(`${API}/breakpoints`, { method: 'DELETE' });
await j('/breakpoints', 'POST', { type: 'execute', segment: SELECTOR, offset: OBJ1 + TONE });
await j('/continue', 'POST');
stop = await stopped(stop.stop_id);
if (stop.linear_eip !== OBJ1 + TONE) throw new Error(`stopped elsewhere: ${stop.linear_eip.toString(16)}`);
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'tick', '--id', values.id, '--moment', 'sound mode 7 in the run copy; execute breakpoint at the PC-speaker tick handler tone path (obj1+0x371f8); 40 consecutive stops'], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
