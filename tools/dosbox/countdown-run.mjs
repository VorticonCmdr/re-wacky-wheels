// node tools/dosbox/countdown-run.mjs --id shot-1 --moment "..." --phases '[[["KBD_leftctrl"],80]]' [--poke '[[offset, value], ...]'] [--extra] [--extra2] [--ms 15,40] [--no-restart]
// Prerequisites: the DOSBox bridge is running a played race of the plain archive (run copy) or its Esc menu / main menu is reachable by the keys below; the game may be running or paused.
// Releases every key, leaves the race through the Esc menu (Esc, Down, Enter), takes the main menu's two Enter presses to a new race, pauses it in the countdown (tick 2 to 30, timer mode 1:
// the racers stand still on the grid, fire does nothing and the position words can be written) and records the `steps` scenario of observe.mjs with the given phases, pokes and extra columns.
// The pokes are 16-bit writes to obj2 offsets in decimal (obj2+0x28b0a = 166666 and +0x28b0e = 166670 are the camera/position words; the player's car stands 124 units ahead of them along the heading;
// obj2+0x8426 = 33830 is the held item word; obj2+0x847a = 33914 the pickup counter).
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, moment: { type: 'string' }, phases: { type: 'string' }, poke: { type: 'string' }, extra: { type: 'boolean' }, extra2: { type: 'boolean' }, extra3: { type: 'boolean' }, ms: { type: 'string' }, 'no-restart': { type: 'boolean' } } });
if (!values.id || !values.moment || !values.phases) { console.error('usage: countdown-run --id <id> --moment "<text>" --phases \'[[[keys], samples], ...]\' [--poke ...] [--extra] [--extra2] [--ms lo,hi] [--no-restart]'); process.exit(1); }
const API = 'http://127.0.0.1:8386/api/v1', BASE = 0x239000; // @math obj2's live base in this build
const post = (path, body) => fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r32 = async a => Buffer.from(await readMemory(BASE + a, 4)).readInt32LE(0), r16 = async a => Buffer.from(await readMemory(BASE + a, 2)).readInt16LE(0);
const ALL = ['KBD_leftalt', 'KBD_left', 'KBD_right', 'KBD_space', 'KBD_down', 'KBD_leftctrl', 'KBD_up'];
// A new input sequence replaces the pending one, so every call also releases all keys (the previous experiment may have left Alt or Ctrl down).
const taps = async (...keys) => {
  const events = ALL.map(key => ({ type: 'key', key, pressed: false, frame: 1 }));
  let frame = 2;
  for (const k of keys) { events.push({ type: 'key', key: k, pressed: true, frame }, { type: 'key', key: k, pressed: false, frame: frame + 30 }); frame += 70; } // @math the 30 frame hold and 70 frame spacing of docs/binaries.md
  await post('/input/sequence', { events });
};
if (!values['no-restart']) {
  await post('/debug/continue'); await taps('KBD_esc', 'KBD_down', 'KBD_enter'); await sleep(7000); await taps('KBD_enter'); await sleep(5000); await taps('KBD_enter');
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) { await sleep(250); await post('/debug/pause'); const now = await r32(0x1ec64), mode = await r16(0x28c44); if (now >= 2 && now <= 30 && mode === 1) ok = true; else await post('/debug/continue'); } // @math the countdown: tick 2 to 30, timer mode 1
  if (!ok) { console.error('missed the countdown'); process.exit(2); }
}
const args = ['run', '-s', 'observe', '--', 'steps', '--id', values.id, '--moment', values.moment, '--phases', values.phases, ...(values.poke ? ['--poke', values.poke] : []), ...(values.extra ? ['--extra'] : []), ...(values.extra2 ? ['--extra2'] : []), ...(values.extra3 ? ['--extra3'] : []), ...(values.ms ? ['--ms', values.ms] : [])];
const out = spawnSync('npm', args, { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
