// The perspective floor, exactly the model of floor.render-observed and floor.detail-modes-observed:
// every `step`-th column casts a ray at the heading minus the bias plus that column through the 70 NDIST
// distances of its group, each hit looks up the 128 x 128 tile table (the .M map from the cell 32) and
// copies the tile pixel to the screen row bottomRow - k of `step` columns. Output is the 320 x 200
// indexed picture; the palette is applied by the caller.
import { K } from '../evidence/k.js';

const MODEL = () => K({ columns: 320, steps: 70, angleBias: 160, wrap: 1920, bottomRow: 199, trigEntryBytes: 8, fixedBits: 16, groupDwords: 70, ndistDwordBytes: 4, mapRows: 64, mapColumns: 64, mapOrigin: 32, tileShift: 5, tileMask: 31, tileBytes: 1024, sheetCount: 54, sheetSize: 32, sheetColumns: 10, columnSteps: [1, 2, 4], resetTo: 0, gamPrefix: 'A_', width: 320, height: 200 }, 'floor.model');

// camera: {x, y, heading}; mode: 1 (high), 2 (medium) or 3 (low) detail; fb: Uint8Array(320 x 200).
export function renderFloor(world, camera, mode, fb) {
  const F = MODEL(), step = F.columnSteps[mode - 1], half = F.trigEntryBytes / 2, lowMask = F.tileMask; // @math the second dword of a TRIG entry is half an entry on
  let angle = (((camera.heading - F.angleBias) % F.wrap) + F.wrap) % F.wrap;
  for (let c = 0; c < F.columns; c += step) {
    const v0 = world.trig.getUint32(angle * F.trigEntryBytes, true), v1 = world.trig.getUint32(angle * F.trigEntryBytes + half, true);
    for (let k = 0; k < F.steps; k++) {
      const n = world.ndist.getUint32((c * F.groupDwords + k) * F.ndistDwordBytes, true);
      const dx = Math.imul(v0, n) >>> F.fixedBits, dy = Math.imul(v1, n) >>> F.fixedBits; // @math the low 32 bits of the product, shifted right
      const x = (dx + camera.x) & 0xffff, y = (dy + camera.y) & 0xffff; // @math 16-bit sums
      const row = (y >> F.tileShift) - F.mapOrigin, col = (x >> F.tileShift) - F.mapOrigin;
      const inside = row >= 0 && row < F.mapRows && col >= 0 && col < F.mapColumns;
      const id = inside ? world.tiles[row * F.mapColumns + col] : 0, sheet = Math.floor(id / F.sheetCount);
      const pixel = world.sheets[sheet][(id % F.sheetCount) * F.tileBytes + ((y & lowMask) << F.tileShift) + (x & lowMask)];
      const at = (F.bottomRow - k) * F.width + c;
      fb.fill(pixel, at, at + step);
    }
    angle += step;
    if (angle >= F.wrap) angle = F.resetTo;
  }
  return fb;
}
