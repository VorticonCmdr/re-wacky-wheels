// Contact shadows: a soft ellipse under the ground anchor of a drawn picture, stamped into the shade layer. The compositor darkens only the
// pixels that end up as floor, so a picture drawn over a shadow (a nearer racer, the shadow's own car) covers it, whatever the order.
// At a geometry G of Stage 4 (geometry.js: a whole scale s, m margin columns a side) the shadows are drawn on a grid of u pixels a reference
// pixel: the output (u = s, HD.look 'full') or the reference grid (u = 1, refW x 200: HD.look 'reference', the composite reading it at each
// output pixel's reference cell). The pictures are placed by the caller (`at`: the unclipped picture's top left on that grid, m included,
// a fraction on the reference grid where the place is a fine one), and their footprints and silhouettes come from the blit on that grid
// (blit.js blitAt: the output pixels, or the picture's reference samples), so a shadow stays under the picture as drawn. A reference
// position x becomes u x + at's column, a row u y + at's row; at the reference geometry (no `at`) every number is the one it always was.
import { SHADOW, SUN } from './config.js';
import { headingVector, cameraPointAt, fromCameraAt, pixelsPerUnit } from './project.js';
import { fillQuad } from './raster.js';
import { models } from './models.js';

// The shadow of a draw record, or null. `foot` is the opaque bottom of the drawn picture (objects), `ground` the own car's ground row (a
// reference row). With `at` ({ x, y, u, m }: the unclipped picture's top left on a grid of u pixels a reference pixel, and the margin) the
// shadow is on that grid, `foot` the blit's on it; the own car stands on u times its ground row.
export function casterOf(r, P, foot, ground, opts, at = null) {
  const S = SHADOW, u = at ? at.u : 1;
  if (r.type === 0) { // the own car: at the ground row whatever its jump, smaller and lighter the higher it is; none while it falls in a pit, flies off a crash or is wrecked
    if (!opts.shadows || P.fx?.pit || P.fx?.crash || P.car.crashed || P.car.wrecked) return null;
    const lift = Math.max(ground - (r.top + r.picture.h), 0), keep = 1 - Math.min(lift / S.liftFade, 1) / 2; // @math down to half at the full fade height
    if (at) return { x: at.x + u * (r.picture.w >> 1), y: u * ground, rx: u * ((r.picture.w * S.widthOfPicture * keep) / 2), strength: keep }; // @math half the width is the radius
    return { x: r.left + (r.picture.w >> 1), y: ground, rx: (r.picture.w * S.widthOfPicture * keep) / 2, strength: keep }; // @math half the width is the radius
  }
  if (r.type === 1) { // a racer, a duck or the other human, at the bottom of its picture; none for a wrecked one
    if (!opts.shadows) return null;
    const racer = P.versus && r.racer === 1 ? null : P.ai?.racers?.[r.racer];
    if (racer?.crashed) return null;
    if (at) return { x: at.x + u * (r.picture.w >> 1), y: at.y + u * r.picture.h, rx: u * ((r.picture.w * S.widthOfPicture) / 2), strength: 1 }; // @math the anchor column; half the width is the radius
    return { x: r.left - r.firstColumn + (r.picture.w >> 1), y: r.top + r.picture.h, rx: (r.picture.w * S.widthOfPicture) / 2, strength: 1 }; // @math the anchor column; half the width is the radius
  }
  if (r.shot !== undefined || !opts.sceneryShadows || !foot) return null; // the shots fly; the scenery (the objects and the starter) by the footprint of its lowest rows
  const keep = 1 - Math.min((foot.lift ?? 0) / (S.liftFade * u), 1) / 2; // @math a bouncing frame's shadow stays on the anchor row, down to half
  return { x: (foot.minX + foot.maxX + 1) / 2, y: at ? at.y + u * r.picture.h : r.top + r.picture.h, rx: ((foot.maxX - foot.minX + 1) * S.objectWidth * keep) / 2, strength: keep }; // @math the middle of the footprint; half its width is the radius
}

// Stamps the ellipse into the shade layer (the larger of the shadows that overlap). `s` is the geometry's scale: the shadow `c` is in output
// pixels, and the smallest shadow and the anchor row's middle are a reference pixel's (s output pixels).
export function stampShadow(L, c, width, height, s = 1) {
  const S = SHADOW, rx = c.rx, ry = Math.max(rx * S.aspect, (S.minRows * s) / 2); // @math the radius of the smallest shadow
  if (rx * 2 < S.minRows * s || c.strength <= 0) return; // @math the width from the radius
  const cx = c.x, cy = c.y - 0.5 * s - S.rise * ry; // @math the anchor row's middle
  const y0 = Math.max(Math.floor(cy - ry), 0), y1 = Math.min(Math.ceil(cy + ry), height - 1), x0 = Math.max(Math.floor(cx - rx), 0), x1 = Math.min(Math.ceil(cx + rx), width - 1);
  for (let y = y0; y <= y1; y++) {
    const v = (y + 0.5 - cy) / ry; // @math the pixel's middle
    for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - cx) / rx, q = u * u + v * v; // @math the pixel's middle
      if (q >= 1) continue;
      const dark = c.strength * (1 - q) ** S.falloff, o = y * width + x;
      if (dark > L.shade[o]) L.shade[o] = dark;
    }
  }
}

// The box stampShadow may darken for the shadow `c` (before the picture's edges cut it), on its grid: { x0, y0, x1, y1 } (the checks' record
// of what a record's shadow can touch).
export function shadowBox(c, s = 1) {
  const S = SHADOW, ry = Math.max(c.rx * S.aspect, (S.minRows * s) / 2), cy = c.y - 0.5 * s - S.rise * ry; // @math the radius of the smallest shadow; the anchor row's middle
  return { x0: Math.floor(c.x - c.rx), y0: Math.floor(cy - ry), x1: Math.ceil(c.x + c.rx), y1: Math.ceil(cy + ry) };
}

// The sun shadow of a draw record, or null: the record, the columns of its drawn silhouette, its ground row and its anchor column. The same
// pictures cast as have a contact shadow (racers, ducks, the other human, the own car on the ground, the scenery), never a shot. With `at`
// (casterOf's: the unclipped picture's top left on a grid of u pixels a reference pixel, and the margin) everything is on that grid: `cols`
// (the blit's silhouette on it, from the picture's first column), the ground row, the anchor column, the picture's `left` and `top`, and the
// grid's scale `s` (u) and margin `m` for castShadow.
export function castOf(r, P, drawn, ground, at = null) {
  if (!drawn?.cols || r.shot !== undefined) return null;
  if (r.type === 1 && !(P.versus && r.racer === 1) && P.ai?.racers?.[r.racer]?.crashed) return null;
  if (r.type === 0 && (P.fx?.pit || P.fx?.crash || P.car.crashed || P.car.wrecked)) return null;
  if (!at) return r.type === 0 ? { r, cols: drawn.cols, ground, anchor: r.left + (r.picture.w >> 1) } : { r, cols: drawn.cols, ground: r.top + r.picture.h, anchor: r.left - r.firstColumn + (r.picture.w >> 1) }; // @math the column is the left edge plus half the width
  const { u, m } = at, anchor = at.x + u * (r.picture.w >> 1); // @math the column is the left edge plus half the width
  return { r, cols: drawn.cols, ground: r.type === 0 ? u * ground : at.y + u * r.picture.h, anchor, left: at.x, top: at.y, s: u, m };
}

// The silhouette of the record laid on the ground away from the sun. A picture is flat, but what it shows has depth: each drawn column is cast
// as the band its line from the lowest to the highest opaque pixel sweeps when the picture is moved through its depth along the camera's view
// (the drawn width times SUN.depth), the heights read off the picture at its distance, the ground taken as the camera sees it. `sun` is
// { f, l, length }: the direction the shadows fall in the camera's terms and the length of a shadow per unit of height. `c` is castOf's (or
// { r, cols, ground, anchor } in reference pixels, as the garage's preview gives it); with its `s` and `m` the silhouette, the ground and the
// anchor are output pixels, an output pixel is 1/s of a reference one and each output column casts its own band. With a margin (m > 0, the
// wide view) the camera's ground is reached through the wide projection (project.js cameraPointAt and fromCameraAt: the pinhole inside the
// reference fan, its equiangular continuation outside it), so a cast in the margins lies on the texels the floor draws there. Writes L.cast
// and returns the box it touched (output pixels).
export function castShadow(L, c, world, sun, width, height, box) {
  const { r, cols } = c, s = c.s ?? 1, m = c.m ?? 0, left = c.left ?? r.left, top = c.top ?? r.top, d = r.distance, unit = pixelsPerUnit(d), ppu = unit * s, A = cameraPointAt(world, c.anchor / s - m, d, m), half = ((r.picture.w / unit) * SUN.depth) / 2; // @math half the depth either side of the point
  for (let i = 0; i < cols.top.length; i++) {
    if (cols.top[i] < 0) continue;
    const u = (left + i - c.anchor) / ppu, zTop = (c.ground - (top + cols.top[i])) / ppu, zBottom = Math.max((c.ground - (top + cols.bottom[i] + 1)) / ppu, 0);
    const at = (z, depth) => fromCameraAt(world, A.f + depth + z * sun.length * sun.f, A.l + u + z * sun.length * sun.l, true, m);
    const corners = [at(zBottom, -half), at(zTop, -half), at(zTop, half), at(zBottom, half)];
    if (corners.some(p => !p)) continue;
    const pts = corners.map(p => [s * (p.column + m), s * (p.bottom - 1)]); // the row above the ground row, as the picture's bottom row is
    fillQuad(L.cast, pts, 1, width, height, null, 0, 1); // one scanline a row: the blur softens the edges
    fillQuad(L.cast, [[pts[0][0], pts[0][1]], [pts[0][0] + 1, pts[0][1]], [pts[1][0] + 1, pts[1][1]], [pts[1][0], pts[1][1]]], 1, width, height, null, 0, 1); // the column's own line at least a pixel wide
    for (const [x, y] of pts) { if (x < box.x0) box.x0 = Math.max(Math.floor(x), 0); if (x > box.x1) box.x1 = Math.min(Math.ceil(x), width - 1); if (y < box.y0) box.y0 = Math.max(Math.floor(y), 0); if (y > box.y1) box.y1 = Math.min(Math.ceil(y), height - 1); }
  }
  return box;
}

// The shadows' direction in the camera's terms for a sun at `angle` (a part of a turn) and the camera's heading, with `length` the shadow of a
// unit of height (SUN.length unless the track's atmosphere sets the sun's height).
export function sunDirection(world, angle, heading, length = SUN.length) {
  const turn = models().view.turn, [f, l] = headingVector(world, Math.round(angle * turn) - heading);
  return { f, l, length };
}

// Softens the cast layer inside the box: a box blur of R pixels (SUN.blur), first along the rows, then down the columns; a pixel outside the
// picture counts as 0, and every sum is over the 2 R + 1 pixels of its window. Each pixel sums its window: the reference geometry's blur.
export function blurCast(L, box, width, height, scratch, R = SUN.blur) {
  const x0 = Math.max(box.x0 - R, 0), x1 = Math.min(box.x1 + R, width - 1), y0 = Math.max(box.y0 - R, 0), y1 = Math.min(box.y1 + R, height - 1), n = 2 * R + 1; // @math the window of the blur
  if (x1 < x0 || y1 < y0) return;
  for (let y = Math.max(y0 - R, 0); y <= Math.min(y1 + R, height - 1); y++) for (let x = x0; x <= x1; x++) { let s = 0; for (let k = -R; k <= R; k++) { const X = x + k; if (X >= 0 && X < width) s += L.cast[y * width + X]; } scratch[y * width + x] = s / n; } // the rows the column pass reads
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { let s = 0; for (let k = -R; k <= R; k++) { const Y = y + k; if (Y >= 0 && Y < height) s += scratch[Y * width + x]; } L.cast[y * width + x] = s / n; }
}

// blurCast at any radius in O(1) a pixel (the blur above 1x, R = SUN.blur x s): the same windows, the same box and the same zero outside the
// picture, each sum carried along its row or column (one pixel enters, one leaves) instead of summed again, so it is blurCast's result within
// the rounding of the carried sums (test/geometry.test.js: within 1e-6).
export function boxBlurCast(L, box, width, height, scratch, R) {
  const x0 = Math.max(box.x0 - R, 0), x1 = Math.min(box.x1 + R, width - 1), y0 = Math.max(box.y0 - R, 0), y1 = Math.min(box.y1 + R, height - 1), n = 2 * R + 1, cast = L.cast; // @math the window of the blur
  if (x1 < x0 || y1 < y0) return;
  for (let y = Math.max(y0 - R, 0); y <= Math.min(y1 + R, height - 1); y++) { // the rows the column pass reads
    const row = y * width;
    let s = 0;
    for (let X = Math.max(x0 - R, 0); X <= Math.min(x0 + R, width - 1); X++) s += cast[row + X];
    for (let x = x0; x <= x1; x++) {
      scratch[row + x] = s / n;
      const out = x - R, into = x + R + 1;
      if (out >= 0) s -= cast[row + out];
      if (into < width) s += cast[row + into];
    }
  }
  for (let x = x0; x <= x1; x++) {
    let s = 0;
    for (let Y = Math.max(y0 - R, 0); Y <= Math.min(y0 + R, height - 1); Y++) s += scratch[Y * width + x];
    for (let y = y0; y <= y1; y++) {
      cast[y * width + x] = s / n;
      const out = y - R, into = y + R + 1;
      if (out >= 0) s -= scratch[out * width + x];
      if (into < height) s += scratch[into * width + x];
    }
  }
}
