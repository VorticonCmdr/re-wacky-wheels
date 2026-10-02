import { parseDat } from './archive.js';
import { parseGam, parseRoute, parseSpawns } from './tracks.js';

const keys = ['x1', 'y1', 'x2', 'y2', 'angle', 'direction', 'distance'];
export const equalBytes = (a, b) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
export const clampPoint = (n) => Math.max(0, Math.min(2047, Math.round(n)));
export function fingerprint(data) {
  let hash = 2166136261;
  for (const value of data) hash = Math.imul(hash ^ value, 16777619);
  return `${data.length}-${(hash >>> 0).toString(16)}`;
}
export function createTrack(byName, stem) {
  const get = (suffix) => {
    const entry = byName.get(`${stem}.${suffix}`);
    if (!entry)
      throw new Error(`Track ${stem} is missing its .${suffix} file.`);
    return entry.data;
  };
  const original = {
    m: get('m'),
    gam: get('gam'),
    rd: get('rd'),
    spw: get('spw'),
  };
  if (original.m.length !== 4096 || original.m.some((n) => n > 107))
    throw new Error(`Track ${stem} has an invalid tile map.`);
  const config = parseGam(original.gam);
  return {
    stem,
    original,
    config,
    map: new Uint8Array(original.m),
    start: { x: config.startX, y: config.startY },
    route: parseRoute(original.rd),
    objects: parseSpawns(original.spw),
  };
}
export function snapshot(track) {
  return {
    map: Array.from(track.map),
    start: { ...track.start },
    route: track.route.map((r) => ({ ...r })),
    objects: track.objects.map((o) => ({ ...o })),
  };
}
function integer(n, min, max, label) {
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new Error(`Invalid ${label}.`);
}
export function restore(track, draft, catalogSize = 65536) {
  if (!draft || !Array.isArray(draft.map) || draft.map.length !== 4096)
    throw new Error('Draft needs a 64 × 64 tile map.');
  draft.map.forEach((n) => integer(n, 0, 107, 'tile'));
  for (const key of ['x', 'y'])
    integer(draft.start?.[key], 0, 2048, 'start coordinate');
  if (
    !Array.isArray(draft.route) ||
    !Array.isArray(draft.objects) ||
    draft.route.length > 4096 ||
    draft.objects.length > 4096
  )
    throw new Error('Draft has too many routes or objects.');
  draft.route.forEach((r) =>
    keys.forEach((k) =>
      integer(
        r[k],
        0,
        ['x1', 'x2', 'y1', 'y2'].includes(k) ? 2048 : 65535,
        'route field'
      )
    )
  );
  draft.objects.forEach((o) => {
    integer(o.id, 0, catalogSize - 1, 'object type');
    for (const k of ['x', 'y']) integer(o[k], 0, 2048, 'object coordinate');
    for (const k of ['unknown1', 'unknown2'])
      integer(o[k], 0, 65535, 'object field');
    integer(o.unknown3, -32768, 32767, 'object field');
  });
  track.map = Uint8Array.from(draft.map);
  track.start = { ...draft.start };
  track.route = draft.route.map((r) =>
    Object.fromEntries(keys.map((k) => [k, r[k]]))
  );
  track.objects = draft.objects.map((o) =>
    Object.fromEntries(
      ['id', 'x', 'y', 'unknown1', 'unknown2', 'unknown3'].map((k) => [k, o[k]])
    )
  );
}
export function routeSegment(x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  const angle = Math.trunc(
    ((Math.atan2(dy, dx) * 960) / Math.PI + 1920) % 1920
  );
  return {
    x1,
    y1,
    x2,
    y2,
    angle,
    direction: Math.trunc(angle / 240 + 6.5) % 8,
    distance: Math.trunc(Math.hypot(dx, dy)),
  };
}
export function moveWaypoint(track, index, x, y) {
  const old = track.route[index];
  const previous =
    track.route[(index + track.route.length - 1) % track.route.length];
  const connected =
    previous &&
    previous !== old &&
    previous.x2 === old.x1 &&
    previous.y2 === old.y1;
  track.route[index] =
    previous === old && old.x2 === old.x1 && old.y2 === old.y1
      ? routeSegment(x, y, x, y)
      : routeSegment(x, y, old.x2, old.y2);
  if (connected)
    Object.assign(previous, routeSegment(previous.x1, previous.y1, x, y));
}
export function insertWaypoint(track, index, x, y) {
  if (!track.route.length) {
    track.route.push(routeSegment(x, y, x, y));
    return 0;
  }
  const old = track.route[index];
  track.route.splice(
    index,
    1,
    routeSegment(old.x1, old.y1, x, y),
    routeSegment(x, y, old.x2, old.y2)
  );
  return index + 1;
}
export function deleteWaypoint(track, index) {
  const old = track.route[index],
    previous =
      track.route[(index + track.route.length - 1) % track.route.length];
  if (
    previous &&
    previous !== old &&
    previous.x2 === old.x1 &&
    previous.y2 === old.y1
  )
    Object.assign(
      previous,
      routeSegment(previous.x1, previous.y1, old.x2, old.y2)
    );
  track.route.splice(index, 1);
}
export function paintBrush(map, x, y, tile, size = 1) {
  const half = Math.floor((size - 1) / 2);
  for (let dy = 0; dy < size; dy++)
    for (let dx = 0; dx < size; dx++) {
      const px = x + dx - half,
        py = y + dy - half;
      if (px >= 0 && px < 64 && py >= 0 && py < 64) map[py * 64 + px] = tile;
    }
}
export function paintLine(map, from, to, tile, size = 1) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (let i = 0; i <= steps; i++)
    paintBrush(
      map,
      Math.round(from.x + (to.x - from.x) * (steps ? i / steps : 0)),
      Math.round(from.y + (to.y - from.y) * (steps ? i / steps : 0)),
      tile,
      size
    );
}
export function floodFill(map, x, y, tile) {
  const target = map[y * 64 + x];
  if (target === tile) return;
  const queue = [y * 64 + x];
  map[queue[0]] = tile;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i],
      neighbors = [];
    if (p % 64 > 0) neighbors.push(p - 1);
    if (p % 64 < 63) neighbors.push(p + 1);
    if (p >= 64) neighbors.push(p - 64);
    if (p < 4032) neighbors.push(p + 64);
    for (const next of neighbors)
      if (map[next] === target) {
        map[next] = tile;
        queue.push(next);
      }
  }
}
function encodeRecords(records, width, original, fields) {
  const oldCount = new DataView(
    original.buffer,
    original.byteOffset,
    original.byteLength
  ).getUint16(0, true);
  // Preserve unexplained trailing bytes as well as every uninterpreted record field.
  const tail = original.subarray(2 + oldCount * width);
  const out = new Uint8Array(2 + records.length * width + tail.length),
    v = new DataView(out.buffer);
  v.setUint16(0, records.length, true);
  records.forEach((r, i) =>
    fields.forEach(([key, signed], j) =>
      v[signed ? 'setInt16' : 'setUint16'](2 + i * width + j * 2, r[key], true)
    )
  );
  out.set(tail, 2 + records.length * width);
  return out;
}
export function trackChanges(track) {
  const changes = new Map();
  const add = (suffix, data) => {
    if (!equalBytes(data, track.original[suffix]))
      changes.set(`${track.stem}.${suffix}`, data);
  };
  add('m', track.map);
  if (
    track.start.x !== track.config.startX ||
    track.start.y !== track.config.startY
  ) {
    const text = Array.from(track.original.gam, (byte) =>
      String.fromCharCode(byte)
    ).join('');
    const lines = text.split(/(\r\n|\n|\r)/);
    lines[16] = lines[16].replace(/\S+/, String(track.start.x));
    lines[18] = lines[18].replace(/\S+/, String(track.start.y));
    add(
      'gam',
      Uint8Array.from(lines.join(''), (char) => char.charCodeAt(0))
    );
  }
  add(
    'rd',
    encodeRecords(
      track.route,
      14,
      track.original.rd,
      keys.map((k) => [k, false])
    )
  );
  add(
    'spw',
    encodeRecords(track.objects, 12, track.original.spw, [
      ['id'],
      ['unknown1'],
      ['x'],
      ['y'],
      ['unknown2'],
      ['unknown3', true],
    ])
  );
  return changes;
}
export function patchArchive(original, replacements) {
  const entries = parseDat(original),
    byName = new Map(entries.map((e, i) => [e.name, { ...e, index: i }]));
  let length = original.length;
  for (const [name, data] of replacements) {
    if (!byName.has(name)) throw new Error(`Archive has no ${name}.`);
    if (!(data instanceof Uint8Array))
      throw new Error('Archive replacements must be bytes.');
    length += data.length;
  }
  if (length > 0xffffffff) throw new Error('Edited archive is too large.');
  // Append modified payloads: original gaps, aliases and unreferenced bytes survive.
  const out = new Uint8Array(length),
    v = new DataView(out.buffer);
  out.set(original);
  let offset = original.length;
  for (const [name, data] of replacements) {
    const p = 2 + byName.get(name).index * 22;
    v.setUint32(p + 14, data.length, true);
    v.setUint32(p + 18, offset - 2, true);
    out.set(data, offset);
    offset += data.length;
  }
  return out;
}
export class History {
  constructor(limit = 80) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }
  commit(before, after, label) {
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    this.undoStack.push({ before, after, label });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }
  undo(track) {
    const item = this.undoStack.pop();
    if (!item) return;
    restore(track, item.before);
    this.redoStack.push(item);
    return item.label;
  }
  redo(track) {
    const item = this.redoStack.pop();
    if (!item) return;
    restore(track, item.after);
    this.undoStack.push(item);
    return item.label;
  }
}
