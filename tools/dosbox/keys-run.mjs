// node tools/dosbox/keys-run.mjs
// Prerequisites: the DOSBox bridge is running with the game (demo race or menus) running and paused. Holds groups of keys through the input API, lets the game run for
// a moment, pauses it and records the `keys` scenario for each group (ids keys-1 ...; the last group holds nothing, after the others were released).
import { spawnSync } from 'node:child_process';
const API = 'http://127.0.0.1:8386/api/v1', sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (path, body) => (await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) })).json();
const KEYS = { KBD_left: 0x4b, KBD_right: 0x4d, KBD_leftalt: 0x38, KBD_leftctrl: 0x1d, KBD_down: 0x50, KBD_space: 0x39, KBD_d: 0x20, KBD_f: 0x21, KBD_a: 0x1e, KBD_s: 0x1f, KBD_g: 0x22, KBD_h: 0x23, KBD_up: 0x48, KBD_f10: 0x44, KBD_enter: 0x1c };
const GROUPS = [['KBD_left'], ['KBD_right'], ['KBD_leftalt', 'KBD_leftctrl', 'KBD_space', 'KBD_down'], ['KBD_d', 'KBD_f', 'KBD_a', 'KBD_s', 'KBD_g', 'KBD_h'], ['KBD_up'], ['KBD_enter', 'KBD_f10'], []];
let n = 0, down = [];
for (const group of GROUPS) {
  const events = [...down.map(k => ({ type: 'key', key: k, pressed: false, frame: 1 })), ...group.map(k => ({ type: 'key', key: k, pressed: true, frame: 2 }))];
  if (events.length) await post('/input/sequence', { events });
  await post('/debug/continue'); await sleep(1500); await post('/debug/pause');
  down = group; n++;
  const held = group.map(k => KEYS[k]).join(',');
  const out = spawnSync('npm', ['run', '-s', 'observe', '--', 'keys', '--id', `keys-${n}`, ...(held ? ['--held', held] : []), '--moment', `sound mode 0 in the run copy; demo race running; keys held for 1.5 s then game paused: ${group.join(' ') || 'none (all released)'}`], { encoding: 'utf8' });
  console.log(n, group.join('+') || 'none', out.stdout.trim().split('\n').pop().slice(0, 70), out.stderr.trim());
}
