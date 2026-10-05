// node tools/dosbox/start-run.mjs --id start-1 --moment "..." [--stops 180] [--ms 12,12]
// Prerequisites: the DOSBox bridge is running a played race of the plain archive (run copy) or its Esc menu / main menu is reachable by the keys below; the game may be running or paused.
// Leaves the race through the Esc menu (Esc, Down, Enter), takes the main menu's two Enter presses to a new race, pauses it in the first frames of its countdown (tick 0 to 3, mode 1) and
// records the `startseq` scenario of observe.mjs: one row for every race frame from there on, through the countdown and the first moves of the race.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, moment: { type: 'string' }, stops: { type: 'string', default: '180' }, ms: { type: 'string', default: '12,12' } } });
if (!values.id || !values.moment) { console.error('usage: start-run --id <id> --moment "<text>" [--stops N] [--ms a,b]'); process.exit(1); }
const API = 'http://127.0.0.1:8386/api/v1', BASE = 0x239000; // @math obj2's live base in this build
const post = (path, body) => fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r32 = async a => Buffer.from(await readMemory(BASE + a, 4)).readInt32LE(0), r16 = async a => Buffer.from(await readMemory(BASE + a, 2)).readInt16LE(0);
const ALL = ['KBD_leftalt', 'KBD_left', 'KBD_right', 'KBD_space', 'KBD_down', 'KBD_leftctrl', 'KBD_up'];
const taps = async (...keys) => {
  const events = ALL.map(key => ({ type: 'key', key, pressed: false, frame: 1 }));
  let frame = 2;
  for (const k of keys) { events.push({ type: 'key', key: k, pressed: true, frame }, { type: 'key', key: k, pressed: false, frame: frame + 30 }); frame += 70; } // @math the 30 frame hold and 70 frame spacing of docs/binaries.md
  await post('/input/sequence', { events });
};
await fetch(`${API}/debug/breakpoints`, { method: 'DELETE' });
await post('/debug/continue'); await taps('KBD_esc', 'KBD_down', 'KBD_enter'); await sleep(7000); await taps('KBD_enter'); await sleep(5000); await taps('KBD_enter');
let ok = false;
for (let i = 0; i < 400 && !ok; i++) { await sleep(25); await post('/debug/pause'); const now = await r32(0x1ec64), mode = await r16(0x28c44); if (mode === 1 && now <= 3) ok = true; else await post('/debug/continue'); } // @math the first frames of the countdown
if (!ok) { console.error('missed the start'); process.exit(2); }
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'startseq', '--id', values.id, '--moment', values.moment, '--stops', values.stops, '--ms', values.ms], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
