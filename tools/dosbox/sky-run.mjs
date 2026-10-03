// node tools/dosbox/sky-run.mjs --prefix sky [--count 4]
// Prerequisites: the DOSBox bridge is running a played race, paused. Drives with the left key held and, at each of --count pauses about 0.4 s apart, records the `screen` scenario with the sky rows
// (rows 52 to 109, columns 80 to 319: below the HUD banner and right of the minimap) and the heading.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { prefix: { type: 'string', default: 'sky' }, count: { type: 'string', default: '4' } } });
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (path, body) => (await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const key = (k, down) => post('/input/sequence', { events: [{ type: 'key', key: k, pressed: down, frame: 1 }] });
await key('KBD_leftalt', true); await post('/debug/continue'); await sleep(300); await key('KBD_left', true);
for (let n = 1; n <= Number(values.count); n++) {
  await sleep(450); await post('/debug/pause');
  const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'screen', '--id', `${values.prefix}-${n}`, '--moment', 'a played race on track 1 of the plain archive, the car steering left; the displayed page read from video memory', '--args', JSON.stringify({ sky: [52, 109, 80, 319] })], { encoding: 'utf8' });
  console.log(n, out.stdout.trim().split('\n').pop().slice(0, 60), out.stderr.trim());
  await post('/debug/continue');
}
await key('KBD_left', false); await post('/debug/pause');
