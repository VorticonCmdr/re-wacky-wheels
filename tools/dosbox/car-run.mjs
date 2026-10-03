// node tools/dosbox/car-run.mjs --id car-1 [--schedule '5:KBD_left:1,15:KBD_left:0,...']
// Prerequisites: the DOSBox bridge is running a played race on track 1 of the plain archive, paused at its start. The accelerate key is held; the schedule presses and releases other keys before the given
// samples. At each of 80 pauses (about 40 ms of play apart) the player's car as the draw list holds it (the record with the type word 0, view.player-car-draw) and the car words behind its picture are
// read; the `carframes` scenario of observe.mjs records them.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, schedule: { type: 'string', default: '' }, samples: { type: 'string', default: '80' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (path, body) => (await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const BASE = 0x239000; // @math obj2's live base in this build
const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0), u8 = async a => (await readMemory(a, 1))[0];
const schedule = values.schedule.split(',').filter(Boolean).map(x => { const [at, key, down] = x.split(':'); return { at: Number(at), key, down: down === '1' }; });
await post('/debug/pause');
const car = await i32(BASE + 0x1d5b0), buffer = await i32(BASE + 0x1d708);
const WORDS = ['stateWord', 'frameWord', 'fallWord', 'hopWord', 'turnWord', 'frameCount']; // the car words +0x18, +0x1a, +0x44, +0x5a, +0x5c, +0x5e
const sample = async () => {
  const count = await i16(BASE + 0x28b78), raw = Buffer.from(await readMemory(BASE + 0x19a50, 0x28 * Math.min(Math.max(count, 0), 30))), own = []; // @math at most 30 records
  for (let r = 0; r < raw.length / 0x28; r++) if (raw.readInt16LE(r * 0x28 + 0x24) === 0) for (let i = 0; i < 20; i++) own.push(raw.readInt16LE(r * 0x28 + i * 2)); // @math the first record of the type 0: twenty words
  return { own: own.slice(0, 20), car: [await i16(car + 0x18), await i16(car + 0x1a), await i16(car + 0x44), await i16(car + 0x5a), await i16(car + 0x5c), await i16(car + 0x5e), await i32(car + 0x4e), await i32(car + 0x64)], keys: [await u8(BASE + 0x28cd5), await u8(BASE + 0x28cdd), await i16(BASE + 0x28b40), await i16(BASE + 0x28b44), await i16(BASE + 0x28b46)] };
};
const samples = [];
await post('/input/sequence', { events: [{ type: 'key', key: 'KBD_leftalt', pressed: true, frame: 2 }] });
for (let k = 0; k < Number(values.samples); k++) {
  const events = schedule.filter(s => s.at === k).map(s => ({ type: 'key', key: s.key, pressed: s.down, frame: 1 }));
  if (events.length) await post('/input/sequence', { events });
  await post('/debug/continue'); await sleep(k ? 40 : 400); await post('/debug/pause'); samples.push(await sample());
}
const args = JSON.stringify({ schedule, buffer, samples });
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'carframes', '--id', values.id, '--moment', `a played race on track 1 of the plain archive; the accelerate key held, other keys by a schedule; the player's draw-list record and car words at 80 pauses`, '--args', args], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
