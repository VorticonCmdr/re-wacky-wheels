// The zones the object pass gives every draw record against the player's car (car.object-zones, STATIC): the row zone (nearer, level or farther than the car) and the column zone
// (centre, left or right of the car's centre column).
import { K } from '../evidence/k.js';
import { projectPoint, viewSetup } from './view.js';

const ZONES = () => K({ passRoutine: 0x12bf4, zoneAt: 0x12ccb, obstacleAt: 0x1334d, centreRange: 4, rowZones: { nearer: 2, equal: 3, farther: 1 }, columnZones: { centre: 3, left: 4, right: 5 } }, 'car.object-zones');

const centreOf = r => r.left + (r.width >> 1) - 1; // @math the half of the width rounds down, one less than the middle column (obj1+0x12c52)
const bottomOf = r => r.top + r.height - 1; // @math the last row of the picture

// The two zone words of a draw record against the player's record.
export function zonesOf(record, player) {
  const Z = ZONES(), row = bottomOf(record) > bottomOf(player) ? Z.rowZones.nearer : bottomOf(record) === bottomOf(player) ? Z.rowZones.equal : Z.rowZones.farther;
  const d = centreOf(record) - centreOf(player), column = Math.abs(d) <= Z.centreRange ? Z.columnZones.centre : d > 0 ? Z.columnZones.right : Z.columnZones.left;
  return { row, column };
}

// The column zone of a world point seen from the car (the point's draw record against the player's), 3 (the middle) when the point cannot be projected.
export function columnZoneAt(world, car, x, y, player) {
  const camera = { x: car.cx, y: car.cy, heading: car.heading }, hit = projectPoint(world, viewSetup(world, camera), camera, x, y, world.rows), Z = ZONES();
  if (!hit) return Z.columnZones.centre;
  const d = hit.column - 1 - centreOf(player), left = Z.centreRange; // @math the centre of a record is its column less 1 (clipped records aside)
  return Math.abs(d) <= left ? Z.columnZones.centre : d > 0 ? Z.columnZones.right : Z.columnZones.left;
}

export const isCentred = (record, player) => zonesOf(record, player).column === ZONES().columnZones.centre;
