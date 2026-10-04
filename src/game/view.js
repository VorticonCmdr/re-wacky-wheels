// The view of a frame: the fan about the heading, the bounding box and cone of what can be seen, and the projection of a world point
// (view.object-projection, view.setup): forward and lateral distance, screen column, distance scaled by VIEW, size class and bottom row.
import { K } from '../evidence/k.js';

const MODEL = () => K({ fixedBits: 16, tan: 37837, center: 160, maxColumn: 319, viewShift: 14, viewRound: 8096, minDistance: 80, maxDistance: 1122, sizeBase: 124, sizeStep: 70, maxSize: 9, maxRow: 199, worldOffset: 1024, fanHalf: 160, fanReach: 1122, rowFirst: 240, rowNumerator: 18000, rowMinimum: 21, rowMaximum: 240, rowBase: 120, rowEntries: 4096, trigEntryBytes: 8, turn: 1920, slopeBytes: 4, viewBytes: 4, rounding: 32768 }, 'view.model');

const s16 = v => (v << 16) >> 16; // @math the low 16 bits as a signed word

// The integer square root of obj1+0x149b0: the floor root, plus one when the remainder reaches the root less one.
export function isqrt(n) {
  if (n <= 1) return n;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return n - r * r >= r - 1 ? r + 1 : r;
}

// The table of screen rows by distance (view.row-table).
export function buildRowTable() {
  const V = MODEL(), table = new Uint16Array(V.rowEntries);
  table[0] = V.rowFirst;
  for (let d = 1; d < V.rowEntries; d++) {
    let b = Math.floor(V.rowNumerator / d); const rest = V.rowNumerator - b * d;
    if (rest > Math.floor(d / 2)) b++; // @math the remainder must exceed half the divisor, halves rounding down
    b = Math.min(Math.max(b, V.rowMinimum), V.rowMaximum);
    table[d] = V.rowBase - (b >> 1) + b; // @math base less half the value plus the value
  }
  return table;
}

// The rounded step along a heading, as in car.js.
function step(world, heading, distance) {
  const V = MODEL(), half = V.trigEntryBytes / 2; // @math the second dword of a TRIG entry
  const vx = world.trig.getInt32(heading * V.trigEntryBytes, true), vy = world.trig.getInt32(heading * V.trigEntryBytes + half, true), scale = 2 ** V.fixedBits; // @math 16.16 fixed point
  return [Math.floor((vx * distance + V.rounding) / scale), Math.floor((vy * distance + V.rounding) / scale)];
}

// obj1+0x18480: the heading vector words, the cone indices and the box of the points the camera can see.
export function viewSetup(world, camera) {
  const V = MODEL(), half = V.trigEntryBytes / 2, turn = V.turn; // @math the second dword of a TRIG entry is half an entry on
  const left = (((camera.heading - V.fanHalf) % turn) + turn) % turn, right = (camera.heading + V.fanHalf) % turn;
  const pointA = step(world, left, V.fanReach), pointB = step(world, right, V.fanReach);
  const ends = [[camera.x, camera.y], [(camera.x + pointA[0]) & 0xffff, (camera.y + pointA[1]) & 0xffff], [(camera.x + pointB[0]) & 0xffff, (camera.y + pointB[1]) & 0xffff]]; // @math 16-bit world words
  const xs = ends.map(p => p[0]), ys = ends.map(p => p[1]);
  return {
    a: world.trig.getInt32(camera.heading * V.trigEntryBytes, true), b: world.trig.getInt32(camera.heading * V.trigEntryBytes + half, true),
    leftIndex: left, rightIndex: right, box: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) },
  };
}

// obj1+0x14a08: is the point inside the cone between the two edge slopes? (the decision tree of the routine, branch for branch)
export function inCone(world, view, camera, x, y) {
  const V = MODEL(), dxc = s16(camera.x - x), dyc = s16(camera.y - y), shifted = dyc * 2 ** V.fixedBits; // @math dy << 16
  const slope = dxc !== 0 ? Math.trunc(shifted / dxc) : shifted;
  const b = world.slp.getInt32(view.leftIndex * V.slopeBytes, true), c = world.slp.getInt32(view.rightIndex * V.slopeBytes, true);
  if ((b > 0 && c > 0) || (b < 0 && c < 0)) return slope >= b && slope <= c;
  if ((b < 0 && slope < 0) || (b > 0 && slope > 0)) return slope >= b;
  return slope <= c;
}

// obj1+0x15a78 for one object: the column, the distance, the size class and the bottom row, or null when it is not drawn. `rows` is the row table.
export function projectPoint(world, view, camera, x, y, rows) {
  const V = MODEL(), fix = BigInt(V.fixedBits);
  if (x < view.box.x0 || x > view.box.x1 || y < view.box.y0 || y > view.box.y1) return null;
  if (!inCone(world, view, camera, x, y)) return null;
  const dx = s16(x - camera.x), dy = s16(y - camera.y);
  const f = Number((BigInt(view.a) * BigInt(dx) + BigInt(view.b) * BigInt(dy)) >> fix), l = Number((BigInt(view.a) * BigInt(dy) - BigInt(view.b) * BigInt(dx)) >> fix);
  let div = Number((BigInt(f) * BigInt(V.tan)) >> fix);
  if (s16(y - camera.y) < s16(y)) div = -div; // the routine's sign test: true whenever the camera row is above 0
  const col = div === 0 ? V.center : V.center - Math.trunc((l * V.center) / div);
  if (col < 0 || col > V.maxColumn) return null;
  const root = isqrt(f * f + l * l), scale = world.view.getUint32(col * V.viewBytes, true);
  let d = root;
  if (scale !== 0) { const product = root * scale; d = Math.floor(product / 2 ** V.viewShift); if (product - d * 2 ** V.viewShift >= V.viewRound) d++; } // @math the product shifted right, rounded up from the remainder 0x1fa0
  if (d < V.minDistance || d > V.maxDistance) return null;
  const klass = Math.min(Math.max(Math.trunc((d - V.sizeBase) / V.sizeStep), 0), V.maxSize);
  return { column: col, distance: d, sizeClass: klass, bottom: rows[d] };
}
