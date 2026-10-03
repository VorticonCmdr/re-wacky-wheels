// node tools/dosbox/placement-run.mjs --id placement-1
// Prerequisites as for gate-run.mjs (bridge running, C: mounted, WW typed, the protected-mode interrupt breakpoint armed). Execute breakpoints at racer.init's
// entry (obj1+0x6f90) and at the ret of its first branch (obj1+0x70a8); at the entry stop the gate dword obj2+0x1ec74 is set to 1, and the `placement`
// scenario is recorded at the ret stop.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
const { values } = parseArgs({ options: { id: { type: 'string' } } });
const API = 'http://127.0.0.1:8386/api/v1', DEBUG = `${API}/debug`, sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (path, method = 'GET', body) => (await fetch(DEBUG + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const OBJ1 = 0x1ec000, OBJ2 = 0x239000, SELECTOR = 0x180, ENTRY = 0x6f90, RET = 0x70a8, GATE = 0x1ec74, ROUTE_LAST = 0x28b7a; // @math live bases and flat code selector found by page voting in earlier runs; racer.init entry and the ret of its first branch
const stopped = async (since, tries = 6000) => { for (let i = 0; i < tries; i++) { const d = await j('/status'); if (d.debugging && d.stop.stop_id > since) return d.stop; await sleep(100); } throw new Error('no stop'); };
const readWord = async a => Buffer.from(await (await fetch(`${API}/memory/${a}/2`)).arrayBuffer()).readInt16LE(0);
const write = async (a, v) => { const b = Buffer.alloc(4); b.writeInt32LE(v); const r = await fetch(`${API}/memory/${a}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: b }); if (!r.ok) throw new Error(`write failed ${r.status}`); };
let stop = await stopped(0);
if (!stop.protected_mode || stop.registers.cs !== SELECTOR) throw new Error('the first stop is not in the protected-mode game code');
await fetch(`${DEBUG}/breakpoints`, { method: 'DELETE' });
for (const at of [ENTRY, RET]) await j('/breakpoints', 'POST', { type: 'execute', segment: SELECTOR, offset: OBJ1 + at });
await j('/continue', 'POST');
let last = stop.stop_id, forced = false;
for (;;) {
  try { stop = await stopped(last, forced ? 200 : 6000); } catch (e) { // after the gate was forced: the ret was not reached, report where the game is
    await j('/pause', 'POST'); await sleep(500); const d = (await j('/status')).stop;
    console.log('no stop at the ret; paused at', d.linear_eip.toString(16), 'obj1+0x' + (d.linear_eip - OBJ1).toString(16), 'eax', d.registers.eax, 'esi', d.registers.esi, 'ecx', d.registers.ecx);
    process.exit(2);
  }
  last = stop.stop_id;
  if (stop.linear_eip === OBJ1 + RET) break;
  if (stop.linear_eip !== OBJ1 + ENTRY) throw new Error(`unexpected stop at ${stop.linear_eip.toString(16)}`);
  // FUN_00016f24 draws a random route index until it lies in 0..word obj2+0x28b7a: force the gate only where that word is a valid index, or the loop would not end.
  const routeLast = await readWord(OBJ2 + ROUTE_LAST);
  console.log('racer.init entry, route-last word', routeLast, 'gate', await readWord(OBJ2 + GATE));
  if (routeLast >= 1) { await write(OBJ2 + GATE, 1); forced = true; }
  await j('/continue', 'POST');
}
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'placement', '--id', values.id, '--moment', 'first demo race (track 2) with the racer.init gate obj2+0x1ec74 forced to 1 at its entry; read at the ret of its first branch (obj1+0x70a8)'], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
