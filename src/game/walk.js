// The walk of a move (obj1+0x11de0 for the cars, obj1+0x12230 for the shots, the same Bresenham line with a different test): from a point to a point one unit at a time along the longer
// axis, the error term starting at half of it; the test looks at each point first, a hit ends the walk there, and the end point gets a last test. Positions are 16-bit words.
const wrap16 = v => ((v % 0x10000) + 0x10000) % 0x10000; // @math 16-bit world words
const signed16 = v => ((v + 0x8000) & 0xffff) - 0x8000; // @math the difference of two 16-bit words as a signed number

// `test(point)` returns a falsy value to go on or what it found. Returns { point, hit } for the first hit (the point the test found it at, or the end point), or null.
export function walkLine(from, to, test) {
  let x = from.x, y = from.y;
  const dx = signed16(to.x - from.x), dy = signed16(to.y - from.y), stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1, ax = Math.abs(dx), ay = Math.abs(dy);
  if (ay < ax) { // along x
    let error = ax >> 1; // @math half of the longer axis (sar by 1 of a non-negative word)
    while (x !== to.x) {
      const hit = test({ x, y }); if (hit) return { point: { x, y }, hit };
      error += ay;
      if (error > ax) { y = wrap16(y + stepY); error -= ax; }
      x = wrap16(x + stepX);
    }
  } else { // along y (also a walk of no length)
    let error = ay >> 1; // @math half of the longer axis
    while (y !== to.y) {
      const hit = test({ x, y }); if (hit) return { point: { x, y }, hit };
      error += ax;
      if (error > ay) { x = wrap16(x + stepX); error -= ay; }
      y = wrap16(y + stepY);
    }
  }
  const hit = test({ x, y });
  return hit ? { point: { x, y }, hit } : null;
}
