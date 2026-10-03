// node tools/dosbox/stop-run.mjs --at 0x17499 --scenario gamload --id gamload-1 --moment "..."
// Prerequisites as for gate-run.mjs (bridge running, C: mounted, WW typed, the protected-mode interrupt breakpoint armed). Replaces it with one execute
// breakpoint at obj1+<at> and records the named observe scenario at the first stop there.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
const { values } = parseArgs({ options: { at: { type: 'string' }, scenario: { type: 'string' }, id: { type: 'string' }, moment: { type: 'string' } } });
const API = 'http://127.0.0.1:8386/api/v1/debug', sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (path, method = 'GET', body) => (await fetch(API + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const OBJ1 = 0x1ec000, SELECTOR = 0x180, AT = Number(values.at); // @math live obj1 base and flat code selector found by page voting in earlier runs
const stopped = async since => { for (let i = 0; i < 6000; i++) { const d = await j('/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } throw new Error('no stop'); };
let stop = await stopped(0);
if (!stop.protected_mode || stop.registers.cs !== SELECTOR) throw new Error('the first stop is not in the protected-mode game code');
await fetch(`${API}/breakpoints`, { method: 'DELETE' });
await j('/breakpoints', 'POST', { type: 'execute', segment: SELECTOR, offset: OBJ1 + AT });
await j('/continue', 'POST');
stop = await stopped(stop.stop_id);
if (stop.linear_eip !== OBJ1 + AT) throw new Error(`stopped elsewhere: ${stop.linear_eip.toString(16)}`);
const out = spawnSync('npm', ['run', '-s', 'observe', '--', values.scenario, '--id', values.id, '--moment', values.moment], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
