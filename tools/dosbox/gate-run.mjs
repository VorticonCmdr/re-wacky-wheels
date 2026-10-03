// node tools/dosbox/gate-run.mjs --mode N --id gate-N
// Prerequisites: the DOSBox bridge is running with C: mounted on analysis/dosbox, the run copy's WACKY.CFG sound-mode dword (offset 0x786) is N,
// and WW has just been typed. This arms an interrupt breakpoint that only fires in the game's protected-mode code (cs 0x180), swaps it for execute
// breakpoints at the library routines (execute breakpoints take their linear address in the mode they are added in, so they must be added in
// protected mode), lets the game run through them and records the `gate` scenario at the last stop.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
const { values } = parseArgs({ options: { mode: { type: 'string' }, id: { type: 'string' } } });
const API = 'http://127.0.0.1:8386/api/v1/debug', sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (path, method = 'GET', body) => (await fetch(API + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const OBJ1 = 0x1ec000, SELECTOR = 0x180, FINAL = { 2: 0x317e2, 3: 0x318d8 }[values.mode]; // @math live obj1 base and flat code selector found by page voting in earlier runs; the stop that ends each run
const SITES = [0x31644, 0x317e2, 0x31820, 0x318d8, 0x2124, 0x1f98];
const stopped = async since => { for (let i = 0; i < 300; i++) { const d = await j('/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } throw new Error('no stop'); };
// Phase A (before WW is typed) is done by the caller: pause, add the interrupt breakpoint, continue. Phase B starts here.
let stop = await stopped(0);
if (!stop.protected_mode || stop.registers.cs !== SELECTOR) throw new Error('the first stop is not in the protected-mode game code');
await fetch(`${API}/breakpoints`, { method: 'DELETE' }); // no body: clear them all
for (const s of SITES) await j('/breakpoints', 'POST', { type: 'execute', segment: SELECTOR, offset: OBJ1 + s });
let last = stop.stop_id;
await j('/continue', 'POST');
for (;;) {
  stop = await stopped(last); last = stop.stop_id;
  if (stop.reason !== 'breakpoint') throw new Error(`unexpected stop: ${stop.reason}`);
  if (stop.linear_eip === OBJ1 + FINAL) break;
  await j('/continue', 'POST');
}
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'gate', '--id', values.id, '--moment', `sound mode ${values.mode} in the run copy; execute breakpoints at the library check, init, their error stubs, the bank-load routine and the loader; read at the error-stub stop`], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
