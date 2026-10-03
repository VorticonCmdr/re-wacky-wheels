// node tools/dosbox/miss-run.mjs --id miss-1 --member 2.GAM --edit 4="back2.pcx "
// Prerequisites as for gate-run.mjs, with the run archive made by make-test-archive with the same --edit arguments. Replaces the interrupt breakpoint
// with an execute breakpoint on the archive lookup's not-found path (obj1+0x41b2) and records the `miss` scenario at its first stop.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
const { values } = parseArgs({ options: { id: { type: 'string' }, member: { type: 'string' }, edit: { type: 'string', multiple: true } } });
const API = 'http://127.0.0.1:8386/api/v1/debug', sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (path, method = 'GET', body) => (await fetch(API + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const OBJ1 = 0x1ec000, SELECTOR = 0x180, MISS = 0x41b2; // @math live obj1 base and flat code selector found by page voting in earlier runs; the not-found path of the lookup
const stopped = async since => { for (let i = 0; i < 3000; i++) { const d = await j('/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } throw new Error('no stop'); };
let stop = await stopped(0);
if (!stop.protected_mode || stop.registers.cs !== SELECTOR) throw new Error('the first stop is not in the protected-mode game code');
await fetch(`${API}/breakpoints`, { method: 'DELETE' });
await j('/breakpoints', 'POST', { type: 'execute', segment: SELECTOR, offset: OBJ1 + MISS });
await j('/continue', 'POST');
stop = await stopped(stop.stop_id);
if (stop.linear_eip !== OBJ1 + MISS) throw new Error(`stopped elsewhere: ${stop.linear_eip.toString(16)}`);
const args = ['run', '-s', 'observe', '--', 'miss', '--id', values.id, '--moment', 'first demo race (track 2) with a trailing space on the sky name line of 2.GAM in the run copy; execute breakpoint on the lookup not-found path (obj1+0x41b2); read at its first stop', '--member', values.member, ...values.edit.flatMap(e => ['--edit', e])];
const out = spawnSync('npm', args, { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
