// The draw list of a frame: the records sorted farthest first by the game's own selection sort (view.draw-order) and blitted in that order.
import { blitRecord } from './sprites.js';

// obj1+0x15430: for each record i from the second and each later record j, swap them when the distance of i is smaller than that of j.
export function sortDrawList(records) {
  const list = records.slice();
  for (let i = 0; i < list.length - 1; i++) for (let j = i + 1; j < list.length; j++) if (list[i].distance < list[j].distance) { const t = list[i]; list[i] = list[j]; list[j] = t; }
  return list;
}

export function drawList(fb, records) {
  for (const r of sortDrawList(records)) blitRecord(fb, r);
  return fb;
}
