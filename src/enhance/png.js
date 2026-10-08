// The PNG pictures of the artwork packs (Stage 4: docs/artpacks.md): read and written here rather than through the browser's image decoder,
// so that a pack's pixels arrive exactly as the author saved them (no colour management, no premultiplied alpha) in the page and in node (the
// checks and the tests) alike, and so that an indexed picture's palette indices are read as they are. The game's palettes repeat colours
// (entries 4 and 90 of A_F1.PCX are index 0's black, and every tile sheet's palette has dozens of such pairs), so an indexed pack cannot be
// told by its colours: it is a palette PNG (colour type 3) whose index bytes are the game's indices.
// - decodePng(bytes): a non-interlaced PNG of 8 bits a sample (grey, grey and alpha, RGB, RGBA), 16 bits a sample (the high byte is kept), or a
//   palette of 1, 2, 4 or 8 bits a pixel (a grey of 1, 2 or 4 bits too): { width, height, rgba (4 bytes a pixel), indices (a palette PNG's
//   index a pixel, else null), palette (its 256 RGB entries, else null), alpha (its tRNS alpha a palette entry, 255 where none, else null) }.
//   An interlaced picture or another depth throws with the reason, and so does a picture larger than a pack's may be (`maxSide` a side,
//   `maxPixels` in all: ART.maxSide and ART.maxImagePixels unless given), from its header, before its data is inflated; the data is inflated
//   no further than the picture's rows.
// - encodePng({ width, height, rgba }) writes an RGBA PNG; encodePng({ width, height, indices, palette, alpha }) a palette PNG (alpha: a tRNS
//   entry a palette entry, or null for none). Every row is written unfiltered; the data is deflated by the platform's CompressionStream.
import { crc32 } from '../evidence/crc32.js';
import { ART } from './config.js';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]; // @math the PNG signature
const TYPES = { grey: 0, rgb: 2, palette: 3, greyAlpha: 4, rgba: 6 }; // @math the PNG colour types
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }; // @math samples a pixel of each colour type
const ascii = (b, at) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]); // @math a chunk type's four letters
const u32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0; // @math a big-endian 32-bit word

// The bytes through the platform's (de)compression stream ('deflate' is zlib's format, as PNG's data is), at most `limit` of them: the stream
// is read piece by piece and given up once `limit` bytes have come, so data that inflates to far more than the picture needs (a few kilobytes
// can inflate to gigabytes) never fills the memory.
async function through(bytes, stream, limit = Infinity) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader(), parts = [];
  let n = 0;
  while (n < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const take = Math.min(value.length, limit - n);
    parts.push(take < value.length ? value.subarray(0, take) : value); n += take;
  }
  if (n >= limit) await reader.cancel().catch(() => {}); // the rest is not read
  const out = new Uint8Array(n);
  parts.reduce((o, p) => { out.set(p, o); return o + p.length; }, 0);
  return out;
}
export const inflate = (bytes, format = 'deflate', limit = Infinity) => through(bytes, new DecompressionStream(format), limit);
export const deflate = (bytes, format = 'deflate') => through(bytes, new CompressionStream(format));

// The Paeth predictor of PNG's filter 4.
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export async function decodePng(input, { maxSide = ART.maxSide, maxPixels = ART.maxImagePixels } = {}) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < SIGNATURE.length || SIGNATURE.some((v, i) => b[i] !== v)) throw new Error('not a PNG picture');
  let at = SIGNATURE.length, header = null, palette = null, trns = null;
  const data = [];
  while (at + 12 <= b.length) { // @math a chunk's length, type and CRC words
    const length = u32(b, at), type = ascii(b, at + 4), body = b.subarray(at + 8, at + 8 + length); // @math past the length and the type
    if (at + 12 + length > b.length) throw new Error(`the PNG's ${type} chunk runs past its end`); // @math the length, the type and the CRC words
    if (crc32(b.subarray(at + 4, at + 8 + length)) !== u32(b, at + 8 + length)) throw new Error(`the PNG's ${type} chunk is damaged (its CRC)`); // @math the type and the body; the CRC word after them
    if (type === 'IHDR') header = { width: u32(body, 0), height: u32(body, 4), depth: body[8], color: body[9], compression: body[10], filter: body[11], interlace: body[12] }; // @math the header's fields
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    at += 12 + length; // @math the length, the type and the CRC words
  }
  if (!header) throw new Error('the PNG has no header');
  const { width, height, depth, color, interlace } = header, channels = CHANNELS[color];
  if (!width || !height) throw new Error('the PNG has no pixels');
  if (width > maxSide || height > maxSide || width * height > maxPixels) throw new Error(`a picture of ${width} x ${height}: a pack's pictures are at most ${maxSide} pixels a side and ${maxPixels} pixels in all`); // before anything is inflated or made
  if (channels === undefined) throw new Error(`a PNG of colour type ${color} is not one a pack may use`);
  if (header.compression !== 0 || header.filter !== 0) throw new Error('the PNG uses a compression or filter method PNG does not define');
  if (interlace !== 0) throw new Error('an interlaced PNG: save the picture without interlacing');
  const small = depth === 1 || depth === 2 || depth === 4, wide = depth === 16; // @math the depths below a byte and the 16-bit one
  if (!(depth === 8 || wide || (small && (color === TYPES.palette || color === TYPES.grey)))) throw new Error(`a PNG of ${depth} bits a sample in colour type ${color} is not one a pack may use`); // @math 8 bits a sample
  if (color === TYPES.palette && !palette) throw new Error('a palette PNG without its palette');
  const joined = new Uint8Array(data.reduce((n, d) => n + d.length, 0));
  data.reduce((o, d) => { joined.set(d, o); return o + d.length; }, 0);
  const bitsPerPixel = depth * channels, bpp = Math.max(Math.ceil(bitsPerPixel / 8), 1), stride = Math.ceil((width * bitsPerPixel) / 8); // @math bits to bytes
  const raw = await inflate(joined, 'deflate', height * (stride + 1)); // the rows with their filter bytes, nothing past them
  if (raw.length < height * (stride + 1)) throw new Error('the PNG\'s data is shorter than its pictures\'s rows');
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) { // undo each row's filter
    const kind = raw[y * (stride + 1)], src = y * (stride + 1) + 1, o = y * stride;
    if (kind > 4) throw new Error(`the PNG has a row of filter ${kind}`); // @math the last of the five filters
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x], left = x >= bpp ? rows[o + x - bpp] : 0, up = y > 0 ? rows[o - stride + x] : 0, corner = x >= bpp && y > 0 ? rows[o - stride + x - bpp] : 0;
      rows[o + x] = kind === 0 ? v : kind === 1 ? v + left : kind === 2 ? v + up : kind === 3 ? v + ((left + up) >> 1) : v + paeth(left, up, corner); // @math the filters 0 to 4
    }
  }
  // The samples of a pixel: a byte (8 bits), the high byte (16), or a field below a byte, scaled to 8 bits for grey.
  const sample = (y, x, c) => {
    if (depth === 8) return rows[y * stride + x * channels + c]; // @math a byte a sample
    if (wide) return rows[y * stride + (x * channels + c) * 2]; // @math two bytes a sample, the high one first
    const bit = x * depth, byte = rows[y * stride + (bit >> 3)], v = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1); // @math the field of the pixel in its byte, high bits first
    return color === TYPES.palette ? v : Math.round((v * 0xff) / ((1 << depth) - 1)); // @math a grey scaled to 8 bits
  };
  const n = width * height, rgba = new Uint8ClampedArray(n * 4); // @math four bytes a colour
  let indices = null, entries = null, alpha = null;
  if (color === TYPES.palette) {
    indices = new Uint8Array(n); entries = new Uint8Array(256 * 3); alpha = new Uint8Array(256).fill(0xff); // @math 256 entries of three components
    entries.set(palette.subarray(0, Math.min(palette.length, entries.length)));
    if (trns) alpha.set(trns.subarray(0, Math.min(trns.length, alpha.length)));
  }
  const greyKey = color === TYPES.grey && trns && trns.length >= 2 ? (wide ? trns[0] : depth === 8 ? trns[1] : Math.round((trns[1] * 0xff) / ((1 << depth) - 1))) : -1; // @math the grey sample tRNS names transparent (16-bit: its high byte)
  const rgbKey = color === TYPES.rgb && trns && trns.length >= 6 ? [trns[wide ? 0 : 1], trns[wide ? 2 : 3], trns[wide ? 4 : 5]] : null; // @math the RGB sample tRNS names transparent
  for (let y = 0, i = 0; y < height; y++) for (let x = 0; x < width; x++, i++) {
    const o = i * 4; // @math four bytes a colour
    if (color === TYPES.palette) { const v = sample(y, x, 0); indices[i] = v; rgba[o] = entries[v * 3]; rgba[o + 1] = entries[v * 3 + 1]; rgba[o + 2] = entries[v * 3 + 2]; rgba[o + 3] = alpha[v]; continue; } // @math three components an entry
    if (color === TYPES.grey || color === TYPES.greyAlpha) { const g = sample(y, x, 0); rgba[o] = g; rgba[o + 1] = g; rgba[o + 2] = g; rgba[o + 3] = color === TYPES.greyAlpha ? sample(y, x, 1) : g === greyKey ? 0 : 0xff; continue; } // @math the three components
    const r = sample(y, x, 0), g = sample(y, x, 1), bl = sample(y, x, 2); // @math the three components
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = bl; // @math the three components
    rgba[o + 3] = color === TYPES.rgba ? sample(y, x, 3) : rgbKey && r === rgbKey[0] && g === rgbKey[1] && bl === rgbKey[2] ? 0 : 0xff; // @math the alpha sample
  }
  return { width, height, rgba, indices, palette: entries, alpha };
}

// A chunk: its length, type, body and CRC.
function chunk(type, body) {
  const out = new Uint8Array(body.length + 12), view = new DataView(out.buffer); // @math the length, the type and the CRC words
  view.setUint32(0, body.length);
  for (let k = 0; k < 4; k++) out[4 + k] = type.charCodeAt(k); // @math a type's four letters, after the length word
  out.set(body, 8); // @math past the length and the type
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length))); // @math the CRC of the type and the body
  return out;
}

export async function encodePng({ width, height, rgba = null, indices = null, palette = null, alpha = null }) {
  const indexed = indices !== null, channels = indexed ? 1 : 4, stride = width * channels; // @math one index or four bytes a pixel
  if (!(width > 0 && height > 0)) throw new Error('a PNG needs pixels');
  if (indexed ? indices.length !== width * height || !palette : rgba?.length !== width * height * 4) throw new Error('the pixels do not fill the picture'); // @math four bytes a colour
  const header = new Uint8Array(13), view = new DataView(header.buffer); // @math the header's size
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = indexed ? TYPES.palette : TYPES.rgba; // @math the width and height words, 8 bits a sample
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) raw.set((indexed ? indices : rgba).subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1); // each row unfiltered (filter 0)
  const parts = [Uint8Array.from(SIGNATURE), chunk('IHDR', header)];
  if (indexed) { parts.push(chunk('PLTE', Uint8Array.from(palette.subarray(0, 256 * 3)))); if (alpha) parts.push(chunk('tRNS', Uint8Array.from(alpha.subarray(0, 256)))); } // @math 256 entries of three components
  parts.push(chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((o, p) => { out.set(p, o); return o + p.length; }, 0);
  return out;
}
