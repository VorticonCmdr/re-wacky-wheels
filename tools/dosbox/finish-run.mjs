// node tools/dosbox/finish-run.mjs --id finish-1 --moment "..." [--stops 700] [--key KBD_e]
// Prerequisites: the DOSBox bridge is running a played race of the plain archive (run copy) or its Esc menu / main menu is reachable by the keys below; the game may be running or paused.
// Leaves the race through the Esc menu (Esc, Down, Enter), takes the main menu's two Enter presses to a new race, pauses it in the countdown (counter 5 to 24, the race mode word 1: the setup
// of the race has finished by then, an earlier write is overwritten), writes the player's lap word obj2+0x84c2 with the laps word obj2+0x28b9c, holds the accelerate key of the run copy's key
// table (KBD_e by default: the keys differ between run copies, see docs/binaries.md) and records the `finish` scenario of observe.mjs: the car crosses the line, finishes and coasts to a stop.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, moment: { type: 'string' }, stops: { type: 'string', default: '700' }, ms: { type: 'string', default: '35,55' }, key: { type: 'string', default: 'KBD_e' } } });
if (!values.id || !values.moment) { console.error('usage: finish-run --id <id> --moment "<text>" [--stops N] [--ms a,b] [--key KBD_x]'); process.exit(1); }
const API = 'http://127.0.0.1:8386/api/v1', BASE = 0x239000; // @math obj2's live base in this build
const post = (path, body) => fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r32 = async a => Buffer.from(await readMemory(BASE + a, 4)).readInt32LE(0), r16 = async a => Buffer.from(await readMemory(BASE + a, 2)).readInt16LE(0);
const ALL = ['KBD_leftalt', 'KBD_left', 'KBD_right', 'KBD_space', 'KBD_down', 'KBD_leftctrl', 'KBD_up', 'KBD_q', 'KBD_w', 'KBD_e', 'KBD_r', 'KBD_t', 'KBD_y'];
const release = () => ALL.map(key => ({ type: 'key', key, pressed: false, frame: 1 }));
const taps = async (...keys) => { const events = release(); let frame = 2; for (const k of keys) { events.push({ type: 'key', key: k, pressed: true, frame }, { type: 'key', key: k, pressed: false, frame: frame + 30 }); frame += 70; } await post('/input/sequence', { events }); }; // @math the 30 frame hold and 70 frame spacing of docs/binaries.md
await fetch(`${API}/debug/breakpoints`, { method: 'DELETE' });
await post('/debug/continue'); await taps('KBD_esc', 'KBD_down', 'KBD_enter'); await sleep(7000); await taps('KBD_enter'); await sleep(5000); await taps('KBD_enter');
let ok = false;
for (let i = 0; i < 1200 && !ok; i++) { await sleep(25); await post('/debug/pause'); const now = await r32(0x1ec64), mode = await r16(0x28c44); if (mode === 1 && now >= 5 && now <= 24) ok = true; else await post('/debug/continue'); } // @math the countdown after the setup
if (!ok) { console.error('missed the start'); process.exit(2); }
const laps = Buffer.alloc(2); laps.writeInt16LE(await r16(0x28b9c));
await fetch(`${API}/memory/${BASE + 0x84c2}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: laps });
await post('/input/sequence', { events: [...release(), { type: 'key', key: values.key, pressed: true, frame: 2 }] });
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'finish', '--id', values.id, '--moment', values.moment, '--stops', values.stops, '--ms', values.ms], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
