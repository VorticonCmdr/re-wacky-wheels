import { bytes, view, need, ascii } from './binary.js';
export function parseAtr(data) {
  const b = bytes(data), v = view(b); need(b, 0, 2, 'ATR');
  const n = v.getInt16(0, true); if (n < 0) throw new Error('Invalid ATR count');
  need(b, 2, n * 40, 'ATR entries');
  return Array.from({ length: n }, (_, i) => {
    const p = 2 + i * 40;
    return { id: i, type: v.getInt16(p, true), width: v.getInt16(p + 4, true), height: v.getInt16(p + 6, true), frames: v.getInt16(p + 14, true), name: ascii(b.subarray(p + 16, p + 40)).toLowerCase() };
  });
}
export function spriteLayout(name, data, catalog = []) {
  const known = catalog.find(s => s.name === name.toLowerCase());
  if (known) return { ...known, certainty: 'Dimensions from sprite.atr' };
  const length = bytes(data).length;
  const drivers = /^(cars|panda|camel|moose|pelican|shark|ringo|ele|tiger|digger|aj|puf)\.sp$/i;
  if (drivers.test(name) && length % (38 * 28) === 0) return { width: 38, height: 28, frames: length / 1064, certainty: '38×28 inferred from file size; adjustable' };
  if (name.toLowerCase() === 'action.sp') return { width: 251, height: 6, frames: 1, certainty: '251×6 inferred from file size; adjustable' };
  const inferred = {
    'bronzem.sp': [78, 50], 'silverm.sp': [78, 50], 'goldm.sp': [78, 50],
    'bonusb.sp': [78, 50], 'bonuss.sp': [78, 50], 'bonusg.sp': [78, 50],
    'wfont1.sp': [15, 13], 'hogmis.sp': [18, 13], 'handle.sp': [160, 23],
    'giggles.sp': [133, 44], 'spark.sp': [12, 10],
  }[name.toLowerCase()];
  if (inferred && length % (inferred[0] * inferred[1]) === 0) return { width: inferred[0], height: inferred[1], frames: length / (inferred[0] * inferred[1]), certainty: 'Layout inferred from size and inspected pixel patterns; adjustable' };
  // Files without catalogue metadata remain fully accessible as editable raw images.
  const width = [32, 28, 18, 15, 14, 65, 320].find(w => length % w === 0) ?? 64;
  return { width, height: Math.min(256, Math.ceil(length / width)), frames: Math.max(1, Math.ceil(length / (width * 256))), certainty: 'Raw layout estimate; set width, height and offset to inspect other layouts' };
}
export function rawFrame(data, width, height, frame = 0, offset = 0, columnMajor = true) {
  const b = bytes(data);
  if (![width, height, frame, offset].every(Number.isSafeInteger) || width < 1 || height < 1 || width * height > 4e6 || frame < 0 || offset < 0) throw new Error('Invalid raw image dimensions');
  const start = offset + frame * width * height;
  if (start >= b.length && b.length) throw new Error('Frame starts past the end of the file');
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) indices[y * width + x] = b[start + (columnMajor ? x * height + y : y * width + x)] ?? 0;
  return { width, height, indices };
}
