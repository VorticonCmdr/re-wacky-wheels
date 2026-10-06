// The track lighting of the Enhanced presentation (docs/enhancements.md, Stage 3): a colour grade of the finished picture (GRADES in
// config.js) at a strength, as a table per component and a saturation, a weaker one for the pictures (racers, objects, shots), the gradient
// the track's sky is mixed toward and the clouds' light. composite.js applies it to every pixel but the overlays'.
import { GRADES } from './config.js';
import { models } from './models.js';

// The table of one component: x (0 to 255) to ((x / 255) * gain + lift / 255) ** gamma, mixed with x by `strength`.
function table(gain, lift, gamma, strength) {
  const t = new Uint8ClampedArray(256); // @math every 8-bit value
  for (let x = 0; x < 256; x++) { // @math every 8-bit value
    const v = Math.min(Math.max((x / 255) * gain + lift / 255, 0), 1) ** gamma * 255; // @math 8-bit components to 0 to 1 and back
    t[x] = Math.round(x + (v - x) * strength);
  }
  return t;
}

// { lut (768 bytes: red, green, blue), saturation, sprite: { lut, saturation }, sky: { colours (skyRows x 3), amount }, cloudLight } of a
// grade at a strength (0 to 1), or null for none.
const grades = new Map();
export function gradeOf(name, strength) {
  const g = GRADES[name];
  if (name === 'none' || !g || !(strength > 0)) return null;
  const key = `${name}:${strength}`;
  if (grades.has(key)) return grades.get(key);
  const part = s => {
    const lut = new Uint8ClampedArray(768); // @math three tables of 256
    for (let k = 0; k < 3; k++) lut.set(table(g.gain[k], g.lift[k], g.gamma[k], s), k * 256); // @math three components, 256 entries each
    return { lut, saturation: 1 + (g.saturation - 1) * s };
  };
  const S = models().sky, H = S.skyRows, rows = H + S.horizonRows, colours = new Float32Array(rows * 3); // @math three components a row; the sky rows, then the strip's (its sky-coloured background)
  for (let y = 0; y < rows; y++) for (let k = 0; k < 3; k++) colours[y * 3 + k] = g.sky.top[k] + (g.sky.bottom[k] - g.sky.top[k]) * Math.min(y / (H - 1), 1); // @math three components; the bottom colour goes on over the strip
  const out = { ...part(strength), sprite: part(strength * g.sprites), sky: { colours, amount: g.sky.amount * strength }, cloudLight: g.cloudLight, strength };
  grades.set(key, out);
  return out;
}

// One pixel through a part of a grade: the tables, then the saturation against the grey of the result (Rec. 601 weights). Writes into `out`
// at `o`, each component at most `cap`.
export function gradePixel(out, o, part, cap) {
  const t = part.lut, r = t[out[o]], g = t[256 + out[o + 1]], b = t[512 + out[o + 2]], s = part.saturation; // @math the green and blue tables follow the red one
  const grey = 0.299 * r + 0.587 * g + 0.114 * b; // @math the Rec. 601 luma weights
  out[o] = Math.min(grey + (r - grey) * s, cap); out[o + 1] = Math.min(grey + (g - grey) * s, cap); out[o + 2] = Math.min(grey + (b - grey) * s, cap); // @math the three components
}
