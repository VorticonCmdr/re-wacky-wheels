// node tools/dosbox/boost-run.mjs --id boost-1 [--gate 1]
// Prerequisites: the DOSBox bridge is running the run copy made with tools/dosbox/make-test-sin.mjs (track 1, tile 56 laid over rows 22-34, columns 3-9, terrain value 2) with a played
// race on track 1 running and paused at its start. With --gate 1 the boost's gate inputs are written first (the car word +0xa to 1 and the heading range words obj2+0x1ec40 and +0x1ec44 to 1920,
// so that every heading is inside the range; the range's low words stay 0); without it they are left as the game set them. The accelerate key is held and the car drives over the strip,
// paused every 0.1 s to read the boost words, the car word +0xa, the heading, the throttle, the speed, the terrain and the car's row, then the `boost` scenario of observe.mjs records them.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, gate: { type: 'string', default: '0' }, run: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, build: { type: 'string', default: '{"track":1,"id":56,"rows":[22,34],"cols":[3,9],"value":2}' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (path, body) => (await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const put = (addr, bytes) => fetch(`${API}/memory/${addr}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: bytes });
const BASE = 0x239000; // @math the data object's live base in this DOSBox build (obj2, bases in the record)
const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
await post('/debug/pause');
const car = await i32(BASE + 0x1d5b0), forced = [];
const gateWords = async () => [await i16(car + 0xa), await i32(BASE + 0x1ebc4), await i32(BASE + 0x1ec40), await i32(BASE + 0x1ebc8), await i32(BASE + 0x1ec44), await i32(BASE + 0x1e728)]; // the car word +0xa, the four range words, the track word
const gateBefore = await gateWords();
const word = v => { const b = Buffer.alloc(2); b.writeInt16LE(v); return b; }, dword = v => { const b = Buffer.alloc(4); b.writeInt32LE(v); return b; };
if (values.gate === '1') {
  await put(car + 0xa, word(1)); forced.push(['car', 0xa, 2, 1]);
  for (const off of [0x1ec40, 0x1ec44]) { await put(BASE + off, dword(1920)); forced.push(['obj2', off, 4, 1920]); }
}
const gateAfter = await gateWords();
const sample = async () => [await i16(car + 0xb4), await i16(car + 0xb6), await i16(car + 0x42), await i16(car + 0x26), await i32(BASE + 0x1e568), await i16(BASE + 0xaa90 + 0x18), await i32(car + 0x36), await i16(car + 0x56), await i16(BASE + 0x1e730 + 2 * await i16(car + 0x42)), await i16(car + 0xa), await i32(BASE + 0x1d5d4)];
const samples = [];
await post('/input/sequence', { events: [{ type: 'key', key: 'KBD_leftalt', pressed: true, frame: 2 }] });
for (let k = 0; k < 24; k++) { await post('/debug/continue'); await sleep(k ? 100 : 500); await post('/debug/pause'); samples.push(await sample()); }
const args = JSON.stringify({ build: JSON.parse(values.build), forced, gateBefore, gateAfter, samples });
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'boost', '--id', values.id, '--run', values.run, '--moment', `played race on track 1 on the run copy with tile 56 laid over a strip of the map as terrain 2; gate inputs ${values.gate === '1' ? 'written (car word +0xa = 1, heading range words open)' : 'left as the game set them'}; accelerate held, sampled every 0.1 s`, '--args', args], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
