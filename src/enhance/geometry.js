// The geometry of a rendered world (docs/enhancements.md, Stage 4 as built): the original's 320 x 200 reference grid drawn at a whole scale `s`
// (s x s output pixels a reference pixel) with `m` reference columns of margin on each side (the wide view). Everything is aligned top-left:
// output pixel (X, Y) reads the reference column u = X/s - m and row v = Y/s, so the output pixel (s(x + m), s y) is the reference sample (x, y)
// itself and a higher scale only adds samples between the original ones. Pure: nothing here draws, and at s = 1, m = 0 (IDENTITY) every map is
// the identity, which the enhancer meets by calling today's functions unchanged.
// - geometryOf({ s, m }): refW = 320 + 2m reference columns and refH = 200 rows; W = s refW and H = s refH output pixels; `key`; `identity`;
//   u(X), v(Y) (fractions) and their inverses outX(u), outY(v); colRef[X] = floor(X/s) - m and rowRef[Y] = floor(Y/s) (Int32Array), the
//   reference cell of each output column and row; sample[i], for the page's 320 x 200 index i = y 320 + x, the output pixel of its reference
//   sample, (s y) W + s (x + m). One object per (s, m), shared: its arrays are read, never written.
// - bandSample(G, bands): G.sample with the reference rows of `bands` mirrored as the split screen mirrors an upside-down viewer's.
// - viewMargin(view, aspect, world): the margin of a view for the display's shape (0 for the standard view, and for a world that fails
//   wideReport: its strip's period and its VIEW words against the cosine, viewWorst).
// - cosT(trig, D): the cosine of D TRIG entries from the loaded table itself, without Math.cos.
import { models } from './models.js';
import { RENDER, DISPLAY, WIDE } from './config.js';

const geometries = new Map();
export function geometryOf({ s = 1, m = 0 } = {}) {
  if (!Number.isInteger(s) || s < 1 || !Number.isInteger(m) || m < 0) throw new Error(`no geometry at scale ${s} with a margin of ${m}: both are whole numbers, the scale at least 1`);
  const key = `${s}:${m}`, known = geometries.get(key);
  if (known) return known;
  const F = models().floor, refW = F.width + 2 * m, refH = F.height, W = s * refW, H = s * refH; // @math a margin on either side
  const colRef = new Int32Array(W), rowRef = new Int32Array(H), sample = new Int32Array(F.width * F.height);
  for (let X = 0; X < W; X++) colRef[X] = Math.floor(X / s) - m;
  for (let Y = 0; Y < H; Y++) rowRef[Y] = Math.floor(Y / s);
  for (let y = 0, i = 0; y < F.height; y++) for (let x = 0; x < F.width; x++, i++) sample[i] = s * y * W + s * (x + m);
  const G = { s, m, refW, refH, W, H, key, identity: s === 1 && m === 0, u: X => X / s - m, v: Y => Y / s, outX: u => s * (u + m), outY: v => s * v, colRef, rowRef, sample };
  geometries.set(key, G);
  return G;
}
export const IDENTITY = geometryOf({ s: 1, m: 0 });

// The output pixel the page's 320 x 200 canvas shows for each reference pixel once the output rows of `bands` ([{ first, rows }], reference
// rows) have been mirrored, s first .. s (first + rows) - 1 as the split screen mirrors an upside-down viewer's picture: G.sample, except that a
// pixel inside a band reads the output row s y + s - 1, which after the mirror holds the top-left sample of the reference row the overlays'
// own mirror put at y. Kept per geometry and set of bands; read, never written.
const banded = new Map();
export function bandSample(G, bands) {
  if (!bands.length) return G.sample;
  const key = `${G.key}|${bands.map(b => `${b.first}+${b.rows}`).join(',')}`, known = banded.get(key);
  if (known) return known;
  const F = models().floor, out = Int32Array.from(G.sample);
  for (const { first, rows } of bands) for (let y = first; y < first + rows; y++) for (let x = 0; x < F.width; x++) out[y * F.width + x] = (G.s * y + G.s - 1) * G.W + G.s * (x + G.m);
  banded.set(key, out);
  return out;
}

// The horizon strip's panorama period in pixels: the span of horizon.bounds' first two wraps (offsets 0 and 160, in steps of pixelsPerByte),
// never a literal. A strip whose rows do not repeat with it gets no wide view.
export const stripPeriod = () => { const S = models().sky, B = models().horizon; return (B[2] - B[0]) * S.pixelsPerByte; }; // @math the bound the first wrap goes back to and the one it starts from
const periodic = new WeakMap();
export function stripRepeats(par) {
  if (periodic.has(par)) return periodic.get(par);
  const S = models().sky, P = stripPeriod();
  let ok = par.length === S.parBytes && P > 0 && P < S.parRowPixels;
  for (let j = 0; ok && j < S.horizonRows; j++) for (let p = 0; p < S.parRowPixels - P; p++) if (par[S.parRowPixels * j + p] !== par[S.parRowPixels * j + p + P]) { ok = false; break; }
  periodic.set(par, ok);
  return ok;
}

// How far a world's VIEW words are from the TRIG cosine: the largest |VIEW[c] / VIEW[centre] - cosT(c - centre)| over the table's columns (a
// VIEW word of 0 is a scale of 1.0, as the floor has it). The wide view continues the floor's distances and the pictures' sizes past the
// table through cosT (caster.js, project.js), which holds only for a world whose VIEW is the cosine (WIDE.viewTolerance). Cached per table.
const viewChecks = new WeakMap();
export function viewWorst(world) {
  const known = viewChecks.get(world.view);
  if (known && known.trig === world.trig) return known.worst;
  const V = models().view, word = c => world.view.getUint32(c * V.viewBytes, true) || 2 ** V.viewShift, centre = word(V.center); // @math the VIEW word is a 2.14 fixed-point scale
  let worst = 0;
  for (let c = 0; c <= V.maxColumn; c++) worst = Math.max(worst, Math.abs(word(c) / centre - cosT(world.trig, c - V.center)));
  viewChecks.set(world.view, { trig: world.trig, worst });
  return worst;
}
// What decides whether a world gets a wide view: { period, view, worst, ok }, its horizon strip repeating with the panorama's period
// (stripRepeats) and its VIEW words within WIDE.viewTolerance of the cosine (viewWorst). The checks print it per track.
export function wideReport(world) {
  const period = stripRepeats(world.par), worst = viewWorst(world), view = worst <= WIDE.viewTolerance;
  return { period, view, worst, ok: period && view };
}

// The margin of a view, in reference columns on each side: 0 for the standard view; for the wide view, as many as make the picture the view's
// shape (RENDER.views) on a display of `aspect` (DISPLAY.aspects: the whole 320 x 200 picture's shape), 53 at 4 BY 3 and 18 at 16 BY 10 for
// 16:9; never so many that the picture would be wider than the strip's period (it would show the panorama twice). With a `world` (its .PAR,
// VIEW and TRIG), 0 where it fails wideReport: a horizon strip that does not repeat with that period, or VIEW words that are not the cosine.
export function viewMargin(view, aspect, world = null) {
  const target = Object.hasOwn(RENDER.views, view) ? RENDER.views[view] : null, ratio = Object.hasOwn(DISPLAY.aspects, aspect) ? DISPLAY.aspects[aspect] : null;
  if (!target || !ratio) return 0;
  const F = models().floor, shape = (ratio * F.height) / F.width; // @math a picture pixel's width over its height
  const m = Math.max(0, Math.round((F.height * target / shape - F.width) / 2)), cap = Math.floor((stripPeriod() - F.width) / 2); // @math the extra columns split between the two sides
  if (world && !wideReport(world).ok) return 0;
  return Math.max(0, Math.min(m, cap));
}

// cosT(trig, D): the cosine of an angle of D TRIG entries (fractions allowed, any sign), read from the table itself: the dot product of entry
// e with entry 0 over entry 0's own, both read as signed 16.16 words, lerped between floor(D) and the entry after it (never renormalized).
// Cached per table (world.trig, a DataView).
const dots = new WeakMap();
function dotsOf(trig) {
  let d = dots.get(trig);
  if (d) return d;
  const V = models().view, half = V.trigEntryBytes / 2, x0 = trig.getInt32(0, true), y0 = trig.getInt32(half, true), n0 = x0 * x0 + y0 * y0; // @math the second dword of an entry is half an entry on
  d = new Float64Array(V.turn);
  for (let e = 0; e < V.turn; e++) d[e] = (trig.getInt32(e * V.trigEntryBytes, true) * x0 + trig.getInt32(e * V.trigEntryBytes + half, true) * y0) / n0;
  dots.set(trig, d);
  return d;
}
export function cosT(trig, D) {
  const d = dotsOf(trig), n = d.length, f = Math.floor(D), t = D - f, a = ((f % n) + n) % n, b = (a + 1) % n;
  return t === 0 ? d[a] : d[a] + (d[b] - d[a]) * t;
}
