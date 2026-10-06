// Contact shadows: a soft ellipse under the ground anchor of a drawn picture, stamped into the shade layer. The compositor darkens only the
// pixels that end up as floor, so a picture drawn over a shadow (a nearer racer, the shadow's own car) covers it, whatever the order.
import { SHADOW, SUN } from './config.js';
import { headingVector, cameraPoint, fromCamera, pixelsPerUnit } from './project.js';
import { fillQuad } from './raster.js';
import { models } from './models.js';

// The shadow of a draw record, or null. `foot` is the opaque bottom of the drawn picture (objects), `ground` the own car's ground row.
export function casterOf(r, P, foot, ground, opts) {
  const S = SHADOW;
  if (r.type === 0) { // the own car: at the ground row whatever its jump, smaller and lighter the higher it is; none while it falls in a pit, flies off a crash or is wrecked
    if (!opts.shadows || P.fx?.pit || P.fx?.crash || P.car.crashed || P.car.wrecked) return null;
    const lift = Math.max(ground - (r.top + r.picture.h), 0), keep = 1 - Math.min(lift / S.liftFade, 1) / 2; // @math down to half at the full fade height
    return { x: r.left + (r.picture.w >> 1), y: ground, rx: (r.picture.w * S.widthOfPicture * keep) / 2, strength: keep }; // @math half the width is the radius
  }
  if (r.type === 1) { // a racer, a duck or the other human, at the bottom of its picture; none for a wrecked one
    if (!opts.shadows) return null;
    const racer = P.versus && r.racer === 1 ? null : P.ai?.racers?.[r.racer];
    if (racer?.crashed) return null;
    return { x: r.left - r.firstColumn + (r.picture.w >> 1), y: r.top + r.picture.h, rx: (r.picture.w * S.widthOfPicture) / 2, strength: 1 }; // @math the anchor column; half the width is the radius
  }
  if (r.shot !== undefined || !opts.sceneryShadows || !foot) return null; // the shots fly; the scenery (the objects and the starter) by the footprint of its lowest rows
  const keep = 1 - Math.min((foot.lift ?? 0) / S.liftFade, 1) / 2; // @math a bouncing frame's shadow stays on the anchor row, down to half
  return { x: (foot.minX + foot.maxX + 1) / 2, y: r.top + r.picture.h, rx: ((foot.maxX - foot.minX + 1) * S.objectWidth * keep) / 2, strength: keep }; // @math the middle of the footprint; half its width is the radius
}

// Stamps the ellipse into the shade layer (the larger of the shadows that overlap).
export function stampShadow(L, c, width, height) {
  const S = SHADOW, rx = c.rx, ry = Math.max(rx * S.aspect, S.minRows / 2); // @math the radius of the smallest shadow
  if (rx * 2 < S.minRows || c.strength <= 0) return; // @math the width from the radius
  const cx = c.x, cy = c.y - 0.5 - S.rise * ry; // @math the anchor row's middle
  const y0 = Math.max(Math.floor(cy - ry), 0), y1 = Math.min(Math.ceil(cy + ry), height - 1), x0 = Math.max(Math.floor(cx - rx), 0), x1 = Math.min(Math.ceil(cx + rx), width - 1);
  for (let y = y0; y <= y1; y++) {
    const v = (y + 0.5 - cy) / ry; // @math the pixel's middle
    for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - cx) / rx, q = u * u + v * v; // @math the pixel's middle
      if (q >= 1) continue;
      const s = c.strength * (1 - q) ** S.falloff, o = y * width + x;
      if (s > L.shade[o]) L.shade[o] = s;
    }
  }
}

// The sun shadow of a draw record, or null: the record, the columns of its drawn silhouette, its ground row and its anchor column. The same
// pictures cast as have a contact shadow (racers, ducks, the other human, the own car on the ground, the scenery), never a shot.
export function castOf(r, P, drawn, ground) {
  if (!drawn?.cols || r.shot !== undefined) return null;
  if (r.type === 0) return P.fx?.pit || P.fx?.crash || P.car.crashed || P.car.wrecked ? null : { r, cols: drawn.cols, ground, anchor: r.left + (r.picture.w >> 1) }; // @math the column is the left edge plus half the width
  if (r.type === 1 && !(P.versus && r.racer === 1) && P.ai?.racers?.[r.racer]?.crashed) return null;
  return { r, cols: drawn.cols, ground: r.top + r.picture.h, anchor: r.left - r.firstColumn + (r.picture.w >> 1) }; // @math the column is the left edge plus half the width
}

// The silhouette of the record laid on the ground away from the sun. A picture is flat, but what it shows has depth: each drawn column is cast
// as the band its line from the lowest to the highest opaque pixel sweeps when the picture is moved through its depth along the camera's view
// (the drawn width times SUN.depth), the heights read off the picture at its distance, the ground taken as the camera sees it. `sun` is
// { f, l, length }: the direction the shadows fall in the camera's terms and the length of a shadow per unit of height. Writes L.cast and returns the box it touched.
export function castShadow(L, c, world, sun, width, height, box) {
  const { r, cols } = c, d = r.distance, ppu = pixelsPerUnit(d), A = cameraPoint(world, c.anchor, d), half = ((r.picture.w / ppu) * SUN.depth) / 2; // @math half the depth either side of the point
  for (let i = 0; i < cols.top.length; i++) {
    if (cols.top[i] < 0) continue;
    const u = (r.left + i - c.anchor) / ppu, zTop = (c.ground - (r.top + cols.top[i])) / ppu, zBottom = Math.max((c.ground - (r.top + cols.bottom[i] + 1)) / ppu, 0);
    const at = (z, depth) => fromCamera(world, A.f + depth + z * sun.length * sun.f, A.l + u + z * sun.length * sun.l);
    const corners = [at(zBottom, -half), at(zTop, -half), at(zTop, half), at(zBottom, half)];
    if (corners.some(p => !p)) continue;
    const pts = corners.map(p => [p.column, p.bottom - 1]); // the row above the ground row, as the picture's bottom row is
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

// Softens the cast layer inside the box: a box blur of SUN.blur pixels, first along the rows, then down the columns.
export function blurCast(L, box, width, height, scratch) {
  const R = SUN.blur, x0 = Math.max(box.x0 - R, 0), x1 = Math.min(box.x1 + R, width - 1), y0 = Math.max(box.y0 - R, 0), y1 = Math.min(box.y1 + R, height - 1), n = 2 * R + 1; // @math the window of the blur
  if (x1 < x0 || y1 < y0) return;
  for (let y = Math.max(y0 - R, 0); y <= Math.min(y1 + R, height - 1); y++) for (let x = x0; x <= x1; x++) { let s = 0; for (let k = -R; k <= R; k++) { const X = x + k; if (X >= 0 && X < width) s += L.cast[y * width + X]; } scratch[y * width + x] = s / n; } // the rows the column pass reads
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { let s = 0; for (let k = -R; k <= R; k++) { const Y = y + k; if (Y >= 0 && Y < height) s += scratch[Y * width + x]; } L.cast[y * width + x] = s / n; }
}
