export function bytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  throw new Error('Expected binary file data');
}
export function view(data) {
  const b = bytes(data);
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}
export function need(data, offset, length, label = 'File') {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > data.byteLength) {
    throw new Error(`${label} is truncated or has an invalid offset`);
  }
}
export function ascii(data) { return new TextDecoder('windows-1252').decode(bytes(data)).split('\0')[0]; }
export function extension(name) { return name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? ''; }
export function hexDump(data, limit = 2048) {
  const b = bytes(data), rows = [];
  for (let o = 0; o < Math.min(b.length, limit); o += 16) {
    const row = b.subarray(o, o + 16);
    rows.push(`${o.toString(16).padStart(6, '0')}  ${Array.from(row, v => v.toString(16).padStart(2, '0')).join(' ').padEnd(47)}  ${Array.from(row, v => v >= 32 && v < 127 ? String.fromCharCode(v) : '.').join('')}`);
  }
  if (b.length > limit) rows.push(`… ${b.length - limit} more bytes. Download Original for the complete file.`);
  return rows.join('\n');
}
