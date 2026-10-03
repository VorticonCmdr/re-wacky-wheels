// The route rasteriser, as the game's loader runs it (Ghidra FUN_00021554, obj1+0x11554; claim
// rd.route): walks one .RD segment from (x1, y1) to (x2, y2) in the major axis, advancing the
// minor axis with a Bresenham error term, and returns every point visited as [x, y]. The last
// point is (x2, y2) itself; the loop stops one step short of it and the end point is appended.
// Pure integer arithmetic on the coordinates; nothing here is a game constant.
// A segment longer than the 4096-pixel world cannot be real (corrupt or mis-ordered words), so it throws
// instead of building millions of points.
export function rasterSegment(x1, y1, x2, y2, limit = 0x1000) { // @math sanity bound: the world is 4096 pixels across
  if (![x1, y1, x2, y2].every(Number.isInteger)) throw new Error('Route segment coordinates must be integers');
  if (Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) >= limit) throw new Error(`Route segment (${x1}, ${y1}) to (${x2}, ${y2}) is longer than ${limit} pixels`);
  const points = [];
  let dx = x2 - x1, dy = y2 - y1, x = x1, y = y1;
  const stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
  dx = Math.abs(dx); dy = Math.abs(dy);
  if (dx > dy) { // x is the major axis
    let error = dx >> 1;
    for (; x !== x2; x += stepX) {
      points.push([x, y]);
      error += dy;
      if (error > dx) { y += stepY; error -= dx; }
    }
  } else { // y is the major axis (also when the segment is a single point)
    let error = dy >> 1;
    for (; y !== y2; y += stepY) {
      points.push([x, y]);
      error += dx;
      if (error > dy) { x += stepX; error -= dy; }
    }
  }
  points.push([x, y]);
  return points;
}
