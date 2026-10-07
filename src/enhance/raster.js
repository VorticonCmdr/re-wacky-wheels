// Shared rasterisation of the Enhanced presentation's ground shapes (skid marks, sun shadows).

// A convex polygon (screen x, y corners) filled into `layer` (width x height), keeping the larger value; with `kinds` and `kind` only where
// the pixel is of that kind. Each pixel takes the part of it the polygon covers (`sub` scanlines a row, the exact span along each), so a
// far, thin shape fades instead of breaking up. A row is worked only over the columns its scanlines cross (a long, slanted shape crosses a
// few of its box's columns a row): the others have no cover and take nothing.
const SUB = 4; // @math scanlines a pixel row
let cover = new Float32Array(0); // the coverage of one row, kept between calls (0 outside the columns being worked)
export function fillQuad(layer, pts, value, width, height, kinds = null, kind = 0, sub = SUB) {
  const ys = pts.map(p => p[1]), y0 = Math.max(Math.floor(Math.min(...ys)), 0), y1 = Math.min(Math.floor(Math.max(...ys)), height - 1);
  const xs = pts.map(p => p[0]), left = Math.max(Math.floor(Math.min(...xs)), 0), right = Math.min(Math.floor(Math.max(...xs)), width - 1);
  if (right < left) return;
  if (cover.length < right - left + 1) cover = new Float32Array(right - left + 1);
  for (let y = y0; y <= y1; y++) {
    let from = right + 1, to = left - 1; // the columns the row's scanlines cross
    for (let s = 0; s < sub; s++) {
      const cy = y + (s + 0.5) / sub; // @math the sub-scanline's middle
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < pts.length; k++) {
        const [xa, ya] = pts[k], [xb, yb] = pts[(k + 1) % pts.length];
        if ((cy < ya && cy < yb) || (cy > ya && cy > yb) || ya === yb) continue;
        const x = xa + ((cy - ya) * (xb - xa)) / (yb - ya);
        if (x < lo) lo = x; if (x > hi) hi = x;
      }
      if (lo > hi) continue;
      const a = Math.max(Math.floor(lo), left), b = Math.min(Math.floor(hi), right);
      if (a < from) from = a; if (b > to) to = b;
      for (let x = a; x <= b; x++) cover[x - left] += Math.max(Math.min(hi, x + 1) - Math.max(lo, x), 0) / sub; // @math the span inside the pixel
    }
    for (let x = from; x <= to; x++) {
      const v = value * Math.min(cover[x - left], 1), o = y * width + x;
      cover[x - left] = 0;
      if (v > 0 && (!kinds || kinds[o] === kind) && v > layer[o]) layer[o] = v;
    }
  }
}
