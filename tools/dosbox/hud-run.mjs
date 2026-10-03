// node --env-file=.env tools/dosbox/hud-run.mjs [--count 6] [--prefix hud]
// Prerequisites: the DOSBox bridge is running a played race on track 1 of the plain archive, paused at its start. Drives the car with the local controller of jev-drive.mjs for a few seconds at a time
// and, at each pause, records the `screen` scenario of observe.mjs (ids hud-1 ...): the displayed page's pixels under the HUD elements of the report in docs/leads/hud.md and the HUD words.
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ strict: false, options: { count: { type: 'string', default: '6' }, prefix: { type: 'string', default: 'hud' }, seconds: { type: 'string', default: '4' } } });
// The timer: each of the 11 glyphs of GENEF.SP (7 x 9, the digits and ':' from 13733, 63 bytes each) at each of the 7 places of "MM:SS:T" from (264, 112).
const timerSprites = []; for (let place = 0; place < 7; place++) for (let g = 0; g < 11; g++) timerSprites.push({ member: 'GENEF.SP', at: 13733 + 63 * g, w: 7, h: 9, x: 264 + 7 * place, y: 112, tag: `${place}:${g}` });
const timer = process.argv.includes('--timer');
const spec = timer ? { rects: [], sprites: timerSprites } : {
  rects: [[25, 12, 22, 29], [0, 181, 42, 19]],
  sprites: [
    { member: 'LAP.SP', at: 0x378c, w: 38, h: 41, x: 17, y: 6, exclude: [[25, 12, 22, 29]] },
    { member: 'LAP.SP', at: 0x3da2, w: 65, h: 19, x: 68, y: 6, exclude: [[118, 11, 10, 9]] },
    { member: 'LAP.SP', at: 0x4275, w: 61, h: 19, x: 146, y: 6, exclude: [[181, 11, 20, 9]] },
  ],
};
for (let n = 1; n <= Number(values.count); n++) {
  const drive = spawnSync('node', ['--env-file=.env', 'tools/dosbox/jev-drive.mjs', '--policy', 'local', '--seconds', values.seconds], { encoding: 'utf8' });
  const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'screen', '--id', `${values.prefix}-${n}`, '--moment', `a played race on track 1 of the plain archive, paused after about ${n * Number(values.seconds)} s of driving; the displayed page read from video memory`, '--args', JSON.stringify(spec)], { encoding: 'utf8' });
  console.log(n, drive.stdout.trim().slice(0, 90), out.stdout.trim().split('\n').pop().slice(0, 50), out.stderr.trim().slice(0, 200));
}
