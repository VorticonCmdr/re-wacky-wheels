// node tools/dosbox/strip-run.mjs --id wall-1 --build '{"track":1,"id":56,"rows":[26,27],"cols":[3,9],"value":3}'
// Prerequisites: the DOSBox bridge is running the run copy made with tools/dosbox/make-test-sin.mjs (the same --id/--rows/--cols/--value as --build) with a played race on track 1 running and
// paused at its start. The accelerate key is held and the car drives into the strip (a wall, value 3, or a pit, value 10); the game is paused every 40 ms to read the car's words and the
// collision word, then the `strip` scenario of observe.mjs records them. Nothing is written into the game.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, run: { type: 'string', default: 'analysis/dosbox/WACKY/WACKY.DAT' }, wide: { type: 'boolean' }, object: { type: 'string' }, stop: { type: 'string' }, build: { type: 'string', default: '{"track":1,"id":56,"rows":[26,27],"cols":[3,9],"value":3}' } } });
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
const sample = async () => [await i16(car + 0x42), await i16(car + 0x26), await i16(BASE + 0xaa90 + 0x16), await i16(BASE + 0xaa90 + 0x18), await i32(BASE + 0x1d5d4), await i16(BASE + 0x28bae), await i16(car + 0xa), await i16(car + 0x7c), await i32(BASE + 0x1e568), ...(values.wide ? [await i16(car + 0x44), await i16(car + 0x5a), await i16(car + 0xc), await i16(car + 0xe), await i16(car + 0x10), await i16(car + 0x18), await i16(car + 0x1a)] : []), ...(values.object ? [await i16(BASE + 0x13938 + 12 * Number(values.object) + 2), await i16(BASE + 0x13938 + 12 * Number(values.object) + 4), await i16(BASE + 0x13938 + 12 * Number(values.object) + 6), await i16(car + 0x7e)] : [])];
const samples = [], stops = [];
const OBJ1 = 0x1ec000, SELECTOR = 0x180; // @math obj1's live base in this build and the flat code selector of the game
const status = async () => (await fetch(`${API}/debug/status`)).json();
if (values.stop) { await fetch(`${API}/debug/breakpoints`, { method: 'DELETE' }); await post('/debug/breakpoints', { type: 'execute', segment: SELECTOR, offset: OBJ1 + Number(values.stop) }); } // an execute breakpoint at obj1+STOP, added while the block has not yet run
const takeStop = async () => { const d = await status(); if (values.stop && d.debugging && d.stop?.breakpoint) { stops.push(await sample()); await post('/debug/continue'); await sleep(20); } };
await post('/input/sequence', { events: [{ type: 'key', key: 'KBD_leftalt', pressed: true, frame: 2 }] });
for (let k = 0; k < 60; k++) { await post('/debug/continue'); await sleep(k ? 40 : 400); await takeStop(); await post('/debug/pause'); samples.push(await sample()); }
const args = JSON.stringify({ build: JSON.parse(values.build), samples, ...(values.wide ? { wide: WIDE } : {}), ...(values.object ? { object: OBJ } : {}), ...(values.stop ? { stops, stopAt: Number(values.stop) } : {}) });
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'strip', '--id', values.id, '--run', values.run, '--moment', 'played race on track 1 on the run copy with tile 56 laid over a strip of the map as the terrain value in the build; accelerate held, nothing written into the game, sampled every 40 ms', '--args', args], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
