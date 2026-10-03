// node tools/dosbox/strip-run.mjs --id wall-1 --build '{"track":1,"id":56,"rows":[26,27],"cols":[3,9],"value":3}'
// Prerequisites: the DOSBox bridge is running the run copy made with tools/dosbox/make-test-sin.mjs (the same --id/--rows/--cols/--value as --build) with a played race on track 1 running and
// paused at its start. The accelerate key is held and the car drives into the strip (a wall, value 3, or a pit, value 10); the game is paused every 40 ms to read the car's words and the
// collision word, then the `strip` scenario of observe.mjs records them. Nothing is written into the game.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, run: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, wide: { type: 'boolean' }, object: { type: 'string' }, stop: { type: 'string' }, count: { type: 'string' }, pickup: { type: 'boolean' }, fire: { type: 'string' }, hold: { type: 'string' }, tyres: { type: 'boolean' }, racers: { type: 'boolean' }, shots: { type: 'boolean' }, build: { type: 'string', default: '{"track":1,"id":56,"rows":[26,27],"cols":[3,9],"value":3}' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (path, body) => (await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const put = (addr, bytes) => fetch(`${API}/memory/${addr}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: bytes });
const BASE = 0x239000; // @math the data object's live base in this DOSBox build (obj2, bases in the record)
const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
await post('/debug/pause');
const car = await i32(BASE + 0x1d5b0);
const forced = [];
const WIDE = ['state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a']; // the car words a fall changes (car.collision-test)
const OBJ = ['objectHit', 'objectX', 'objectY', 'carWord7e']; // the table record's words +2, +4, +6 (spw.read) and the car's crash word (atr.kind-effects)
const SHOTS = ['activeShots', 'shotFlag']; // the number of active 0x22-byte records of the list at obj2+0x1f2b0 (view.object-projection) and the racer record word +0x12 (the shot in flight)
const TYRES = ['tyreState', 'tyreA', 'tyreB', 'tyreC']; // obj2+0x28c8c and the three words at obj2+0x20ae8 the kind-1 pickup sets (docs/leads/pickups.md)
const PICKUP = ['carHeld', 'carAmmo']; // the car's held item word +0x16 and its counter +0x6a (atr.kind-effects)
const sample = async () => [await i16(car + 0x42), await i16(car + 0x26), await i16(BASE + 0xaa90 + 0x16), await i16(BASE + 0xaa90 + 0x18), await i32(BASE + 0x1d5d4), await i16(BASE + 0x28bae), await i16(car + 0xa), await i16(car + 0x7c), await i32(BASE + 0x1e568), ...(values.wide ? [await i16(car + 0x44), await i16(car + 0x5a), await i16(car + 0xc), await i16(car + 0xe), await i16(car + 0x10), await i16(car + 0x18), await i16(car + 0x1a)] : []), ...(values.object ? [await i16(BASE + 0x13938 + 12 * Number(values.object) + 2), await i16(BASE + 0x13938 + 12 * Number(values.object) + 4), await i16(BASE + 0x13938 + 12 * Number(values.object) + 6), await i16(car + 0x7e)] : []), ...(values.pickup ? [await i16(car + 0x16), await i16(car + 0x6a)] : []), ...(values.tyres ? [await i16(BASE + 0x28c8c), await i16(BASE + 0x20ae8), await i16(BASE + 0x20aea), await i16(BASE + 0x20aec)] : []), ...(values.shots ? await shotWords() : [])];
const racerRows = [], RACER_WORDS = [0x04, 0x08, 0x0a, 0x16, 0x18, 0x26, 0x58]; // the racer record words read for --racers: state, the two speed words, x, y, +0x26, the hit state of obj1+0x189ec
const readRacers = async () => { const out = []; for (let n = 1; n < 8; n++) { const row = []; for (const off of RACER_WORDS) row.push(await i16(BASE + 0xaa90 + n * 0x68 + off)); out.push(row); } return out; }; // @math racers 1 to 7
const holdSpec = (values.hold ?? '').split(':').filter(Boolean).map(Number); // --hold at:count presses the fire key before sample `at` and releases it before sample at + count
const samples = [], stops = [], lists = [], fireAt = (values.fire ?? '').split(',').filter(Boolean).map(Number);
const shotEntries = async () => { const raw = Buffer.from(await readMemory(BASE + 0x1f2b0, 0x22 * 0x3d)), out = []; for (let k = 0; k < 0x3d; k++) { const w = []; for (let i = 0; i < 17; i++) w.push(raw.readInt16LE(k * 0x22 + i * 2)); if (w[2] !== 0) out.push(w); } return out; }; // @math 61 records of 0x22 bytes, read as 17 words; active when the word +4 is not 0
const shotWords = async () => [(await shotEntries()).length, await i16(BASE + 0xaa90 + 0x12)];
const OBJ1 = 0x1ec000, SELECTOR = 0x180; // @math obj1's live base in this build and the flat code selector of the game
const status = async () => (await fetch(`${API}/debug/status`)).json();
if (values.stop) { await fetch(`${API}/debug/breakpoints`, { method: 'DELETE' }); await post('/debug/breakpoints', { type: 'execute', segment: SELECTOR, offset: OBJ1 + Number(values.stop) }); } // an execute breakpoint at obj1+STOP, added while the block has not yet run
const takeStop = async () => { const d = await status(); if (values.stop && d.debugging && d.stop?.breakpoint) { stops.push(await sample()); await post('/debug/continue'); await sleep(20); } };
await post('/input/sequence', { events: [{ type: 'key', key: 'KBD_leftalt', pressed: true, frame: 2 }] });
for (let k = 0; k < Number(values.count ?? 60); k++) { if (holdSpec.length && (k === holdSpec[0] || k === holdSpec[0] + holdSpec[1])) await post('/input/sequence', { events: [{ type: 'key', key: 'KBD_leftctrl', pressed: k === holdSpec[0], frame: 1 }] }); if (fireAt.includes(k)) await post('/input/sequence', { events: [{ type: 'key', key: 'KBD_leftctrl', pressed: true, frame: 1 }, { type: 'key', key: 'KBD_leftctrl', pressed: false, frame: 9 }] }); await post('/debug/continue'); await sleep(k ? 40 : 400); await takeStop(); await post('/debug/pause'); samples.push(await sample()); if (values.shots) lists.push((await shotEntries()).slice(0, 5)); if (values.racers) racerRows.push(await readRacers()); }
const args = JSON.stringify({ build: JSON.parse(values.build), samples, ...(values.wide ? { wide: WIDE } : {}), ...(values.object ? { object: [...OBJ, ...(values.pickup ? PICKUP : []), ...(values.tyres ? TYRES : [])] } : {}), ...(values.stop ? { stops, stopAt: Number(values.stop) } : {}), ...(values.shots ? { lists, fireAt, hold: holdSpec } : {}), ...(values.shots ? { shots: SHOTS } : {}), ...(values.racers ? { racers: racerRows, racerWords: RACER_WORDS } : {}) });
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'strip', '--id', values.id, '--run', values.run, '--moment', 'played race on track 1 on the run copy with tile 56 laid over a strip of the map as the terrain value in the build; accelerate held, nothing written into the game, sampled every 40 ms', '--args', args], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
