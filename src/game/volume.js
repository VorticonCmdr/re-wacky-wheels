// The Game Options menu's VOLUME LEVELS (menu.volume-screen): three bars, a selection icon and two preview sounds.
import { K } from '../evidence/k.js';
import { frameMs } from './clock.js';
import { soundVolumes, engineSound } from './sounds.js';

const V = () => K({ routine: 0xe760, preview: 0xe6dc, engineStart: 0xd04, picture: 'CHECK.PCX', title: { text: 'SOUND VOLUMES', y: 0x46 }, hints: [{ text: 'UP AND DOWN TO SELECT', y: 0xb0 }, { text: 'LEFT AND RIGHT TO ADJUST. ESC TO QUIT', y: 0xba }], labels: ['MUSIC     -', 'SOUND FX  -', 'ENGINE FX -'], labelX: 0xa, firstRow: 0x5a, rowStep: 0x14, glyph: 8, screen: 320, bar: { above: 2, height: 5, unit: 4, perUnit: 5, min: 1, max: 0x33, border: 0x26, fill: 0x2c }, icon: { member: 'GENEF.SP', offset: 13577, width: 0xc, height: 0xd, above: 8, back: 2, wobble: [-2, 2] }, volume: { min: 5, max: 0xff, step: 5 }, ticks: 14, preview: { sound: 21, wait: 0x13 }, engine: { member: 'MOTOR.VOC', cents: -1800 } }, 'menu.volume-screen');

export const volumeModel = () => V();
export const KINDS = ['music', 'effects', 'engine']; // the three bars, top to bottom

// The volumes the game starts with (audio.race-sounds: the effects 240, the music 250, the engine 100).
export const defaultVolumes = () => ({ music: soundVolumes().music, effects: soundVolumes().effects, engine: engineSound().volume });

export const startVolume = volumes => ({ volumes: { ...volumes }, cursor: 1, wobble: 0, preview: { phase: 'idle', frames: 0 } }); // @math the first bar is selected
export const frameWait = () => frameMs(V().ticks);

// The bars' geometry for the volumes: per bar its label, its row, the box of the bar and the column of its end.
export function layoutOf(volumes) {
  const v = V(), labelWidth = v.glyph * v.labels[0].length;
  return KINDS.map((kind, k) => {
    const x = v.labelX + labelWidth, units = Math.min(Math.max(Math.trunc(volumes[kind] / v.bar.perUnit), 0), v.bar.max), y = v.firstRow + v.rowStep * k;
    return { kind, label: v.labels[k], labelX: v.labelX, y, bar: { x, y: y + v.bar.above, width: v.bar.unit * units, height: v.bar.height }, end: x + v.bar.unit * units };
  });
}

// Where the icon is drawn for the state: at the selected bar's end less 2 and 8 rows above its label, or 2 columns back and 2 rows down on the other frame.
export function iconAt(s) {
  const v = V(), row = layoutOf(s.volumes)[s.cursor - 1], x = row.end - v.icon.back, y = row.y - v.icon.above; // the cursor counts from 1
  return s.wobble ? { x: x + v.icon.wobble[0], y: y + v.icon.wobble[1] } : { x, y };
}

// One frame of the routine after its picture was shown and its wait is over; `keys` is { up, down, left, right, escape }. Returns { state, done, changed } where `changed` names the volume
// that changed.
export function stepVolume(s, keys = {}) {
  const v = V();
  if (keys.escape) return { state: s, done: true, changed: null };
  let { cursor, wobble } = s, volumes = s.volumes, changed = null;
  wobble = wobble ? 0 : 1; // the icon alternates every frame
  const kind = KINDS[cursor - 1];
  if (keys.left || keys.right) {
    let value = volumes[kind];
    if (keys.left) value = Math.max(value - v.volume.step, v.volume.min); // the left key first, then the right one: both held cancel
    if (keys.right) value = Math.min(value + v.volume.step, v.volume.max);
    volumes = { ...volumes, [kind]: value }; changed = kind; // the routine applies the volume even when the clamp left it as it was
    wobble = 0;
  }
  if (keys.up) { wobble = 0; if (cursor > 1) cursor -= 1; } // @math the first bar is the top
  if (keys.down) { wobble = 0; if (cursor < KINDS.length) cursor += 1; }
  return { state: { ...s, cursor, wobble, volumes }, done: false, changed };
}

// The CLANG preview (obj1+0xe6dc): it plays when nothing played, and again 0x13 frames after it ended. `playing` tells whether the sound is still going.
export function stepPreview(p, playing) {
  const w = V().preview.wait;
  if (p.phase === 'idle') return { preview: { phase: 'playing', frames: 0 }, play: true };
  if (p.phase === 'playing') return playing ? { preview: p, play: false } : { preview: { phase: 'waiting', frames: 0 }, play: false };
  const frames = p.frames + 1; // @math one more frame
  return frames >= w ? { preview: { phase: 'idle', frames: 0 }, play: false } : { preview: { phase: 'waiting', frames }, play: false };
}
