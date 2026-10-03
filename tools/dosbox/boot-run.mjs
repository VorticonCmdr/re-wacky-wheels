// node tools/dosbox/boot-run.mjs --id boot-1 [--seconds 90] [--taps 25,30,...]
// Prerequisites: the DOSBox bridge is running with the run copy mounted, `WW` just typed at the prompt. Every 0.5 s the picture on the screen is read from video memory (chain-4 mode 13h linearly, mode X
// plane by plane, the mode from the sequencer's memory mode register) and its CRC-32 and the video mode are recorded with the time since the start; Enter is tapped at the times of --taps (seconds).
// The `boot` scenario of observe.mjs writes the record.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { crc32, hex8 } from '../../src/evidence/crc32.js';
import { readMemory } from './live.mjs';
const { values } = parseArgs({ options: { id: { type: 'string' }, seconds: { type: 'string', default: '90' }, taps: { type: 'string', default: '' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const io = (port, value, width) => fetch(`${API}/io/port`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ port, value, width }) });
const inPort = async port => (await (await fetch(`${API}/io/port?port=${port}`)).json()).value;
const post = path => fetch(`${API}${path}`, { method: 'POST' });
const taps = values.taps.split(',').filter(Boolean).map(Number), samples = [], t0 = Date.now(), end = t0 + Number(values.seconds) * 1000;
let tapped = 0;
while (Date.now() < end) {
  const t = (Date.now() - t0) / 1000;
  if (tapped < taps.length && t >= taps[tapped]) { await fetch(`${API}/input/sequence`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events: [{ type: 'key', key: 'KBD_enter', pressed: true, frame: 1 }, { type: 'key', key: 'KBD_enter', pressed: false, frame: 6 }] }) }); tapped++; }
  await post('/debug/pause');
  await io(0x3c4, 4, 1); const seq4 = await inPort(0x3c5), chain4 = (seq4 & 8) !== 0; // @math the memory mode register is sequencer index 4, chain-4 is bit 3
  await io(0x3d4, 0x0c, 1); const hi = await inPort(0x3d5); await io(0x3d4, 0x0d, 1); const lo = await inPort(0x3d5), start = hi * 256 + lo; // @math the CRTC start address registers
  let image = null;
  if (chain4) image = Buffer.from(await readMemory(0xa0000, 64000)); // @math a 320 x 200 picture, one byte a pixel
  else { const planes = []; for (let p = 0; p < 4; p++) { await io(0x3ce, (p << 8) | 4, 2); planes.push(Buffer.from(await readMemory(0xa0000 + start, 16000))); } image = Buffer.alloc(64000); for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) image[y * 320 + x] = planes[x & 3][y * 80 + (x >> 2)]; } // @math four planes of 80 bytes a line
  const textLike = (await readMemory(0xb8000, 2)).length > 0;
  samples.push([Math.round(t * 10) / 10, chain4 ? 1 : 0, start, hex8(crc32(image)), textLike ? 1 : 0]); // @math seconds to a tenth
  await post('/debug/continue'); await sleep(450);
}
const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'boot', '--id', values.id, '--moment', 'WW started from the DOS prompt of the run copy, the screen read every 0.5 s; Enter tapped at the listed times', '--args', JSON.stringify({ taps, samples })], { encoding: 'utf8' });
console.log(out.stdout.trim().split('\n').pop(), out.stderr.trim());
