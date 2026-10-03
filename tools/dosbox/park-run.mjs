// node tools/dosbox/park-run.mjs --id floor-2 [--steer 700] [--drive 1500]
// Prerequisites: the DOSBox bridge is running a played race paused at its start. Drives forward for --drive ms, steers left for --steer ms, brakes until the throttle and speed words are 0, pauses, and records the
// `screen` scenario with the floor (the car at rest, so that the words and the displayed page agree).
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, steer: { type: 'string', default: '700' }, drive: { type: 'string', default: '900' }, args: { type: 'string', default: '{"floor":true}' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (path, body) => (await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const key = (k, down) => post('/input/sequence', { events: [{ type: 'key', key: k, pressed: down, frame: 1 }] });
const BASE = 0x239000; // @math obj2's live base in this build
const i16 = async a => Buffer.from(await readMemory(a, 2)).readInt16LE(0), i32 = async a => Buffer.from(await readMemory(a, 4)).readInt32LE(0);
await post('/debug/pause');
const car = await i32(BASE + 0x1d5b0);
await key('KBD_leftalt', true); await post('/debug/continue'); await sleep(Number(values.drive));
await key('KBD_left', true); await sleep(Number(values.steer)); await key('KBD_left', false);
await key('KBD_leftalt', false); await key('KBD_down', true);
for (let i = 0; i < 100; i++) { await sleep(100); await post('/debug/pause'); const t = await i16(car + 0x42), s = await i16(car + 0x26); if (t === 0 && s === 0) break; await post('/debug/continue'); } // @math at most ten seconds of braking
await post('/debug/pause'); await sleep(300); await post('/debug/continue'); await sleep(300); await post('/debug/pause'); // two more calls with nothing moving, so that both video pages hold the same picture
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'screen', '--id', values.id, '--moment', 'a played race on track 1 of the plain archive: driven forward, steered left, braked to a stop and paused (the car at rest); the displayed page read from video memory', '--args', values.args], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
