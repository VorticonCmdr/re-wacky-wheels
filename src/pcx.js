import { bytes, view, need } from './binary.js';

export function grayscalePalette() {
  return Uint8Array.from({ length: 768 }, (_, i) => Math.floor(i / 3));
}
export function decodePcx(data) {
  const b = bytes(data), v = view(b);
  need(b, 0, 128, 'PCX header');
  if (b[0] !== 10) throw new Error('Not a PCX image');
  const width = v.getUint16(8, true) - v.getUint16(4, true) + 1;
  const height = v.getUint16(10, true) - v.getUint16(6, true) + 1;
  const bits = b[3], planes = b[65], stride = v.getUint16(66, true);
  if (width < 1 || height < 1 || width * height > 16e6 || ![1, 2, 4, 8].includes(bits) || !planes || planes > 4 || stride < Math.ceil(width * bits / 8) || stride > 32768 || ![0, 1].includes(b[2])) throw new Error('Unsupported PCX dimensions or encoding');
  const rgb = bits === 8 && planes === 3;
  if (!rgb && bits * planes > 8) throw new Error('Unsupported PCX color planes');
  let palette = grayscalePalette(), end = b.length;
  if (!rgb && bits * planes === 8 && b.length >= 897 && b[b.length - 769] === 12) {
    palette = b.slice(-768); end -= 769;
  } else if (bits * planes <= 4) palette.set(b.subarray(16, 64));
  let pos = 128;
  const rowSize = stride * planes, row = new Uint8Array(rowSize);
  const indices = rgb ? null : new Uint8Array(width * height);
  const rgba = rgb ? new Uint8ClampedArray(width * height * 4) : null;
  for (let y = 0; y < height; y++) {
    let p = 0;
    while (p < rowSize) {
      if (pos >= end) throw new Error('PCX pixel data is truncated');
      const code = b[pos++];
      let n = 1, value = code;
      if (b[2] === 1 && code >= 192) {
        n = code & 63;
        if (!n || pos >= end) throw new Error('Invalid PCX RLE run');
        value = b[pos++];
      }
      if (p + n > rowSize) throw new Error('PCX RLE run crosses a scanline');
      row.fill(value, p, p + n); p += n;
    }
    for (let x = 0; x < width; x++) {
      if (rgb) {
        const p = (y * width + x) * 4;
        rgba[p] = row[x]; rgba[p + 1] = row[stride + x]; rgba[p + 2] = row[stride * 2 + x]; rgba[p + 3] = 255;
      } else {
        let index = 0;
        for (let plane = 0; plane < planes; plane++) {
          const bit = x * bits;
          index |= ((row[plane * stride + (bit >> 3)] >> (8 - bits - bit % 8)) & ((1 << bits) - 1)) << (plane * bits);
        }
        indices[y * width + x] = index;
      }
    }
  }
  return { width, height, indices, palette, rgba, bits, planes };
}

export function toRgba(indices, palette, transparent = -1) {
  const rgba = new Uint8ClampedArray(indices.length * 4);
  for (let i = 0; i < indices.length; i++) {
    const c = indices[i];
    rgba[i * 4] = palette[c * 3]; rgba[i * 4 + 1] = palette[c * 3 + 1]; rgba[i * 4 + 2] = palette[c * 3 + 2]; rgba[i * 4 + 3] = c === transparent ? 0 : 255;
  }
  return rgba;
}
