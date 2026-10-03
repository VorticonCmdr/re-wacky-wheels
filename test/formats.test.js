import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDat, parseAudioT } from '../src/archive.js';
import { decodePcx } from '../src/pcx.js';
import { rawFrame, parseAtr } from '../src/sprites.js';
import { composeTrack, parseRoute, parseSpawns } from '../src/tracks.js';
import { decodeVoc, decodePcSpeaker, parseKlm, parseMidi, encodeWav } from '../src/audio.js';
import { renderOpl, renderMidi } from '../src/synthesis.js';
import { b800Cells, cp437, inspectData } from '../src/data-formats.js';

const le16 = n => [n & 255, n >> 8 & 255];
const le32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24];
const be16 = n => [n >> 8 & 255, n & 255];
const be32 = n => [n >>> 24, n >> 16 & 255, n >> 8 & 255, n & 255];
const ascii = s => [...s].map(c => c.charCodeAt(0));

test('DAT offsets exclude the count; directory and payload bounds are enforced', () => {
  const b = new Uint8Array(28), v = new DataView(b.buffer); v.setUint16(0, 1, true); b.set(ascii('test.sp'), 2); v.setUint32(16, 4, true); v.setUint32(20, 22, true); b.set([1, 2, 3, 4], 24);
  const [e] = parseDat(b); assert.equal(e.offset, 24); assert.deepEqual([...e.data], [1, 2, 3, 4]);
  assert.throws(() => parseDat(b.subarray(0, 27)), /truncated/);
  v.setUint32(20, 0, true); assert.throws(() => parseDat(b), /overlaps/);
  assert.throws(() => parseDat(new Uint8Array([255, 255])), /negative/, 'the game sign-extends the count');
});

test('AudioT preserves silent PC/AdLib slots and skips empty digital slots', () => {
  const h = new Uint8Array([0, 7, 31, 31].flatMap(le32)), a = new Uint8Array(31);
  const entries = parseAudioT(h, a); assert.equal(entries.length, 2); assert.equal(entries[0].name, 'pcs-00.pcs'); assert.equal(entries[1].name, 'adl-00.adl');
  assert.throws(() => parseAudioT(h.subarray(0, 8), a), /boundaries/);
});

function pcx(pixels, width = 3, stride = 4) {
  const b = new Uint8Array(128 + pixels.length + 769), v = new DataView(b.buffer); b[0] = 10; b[1] = 5; b[2] = 1; b[3] = 8; b[65] = 1; v.setUint16(8, width - 1, true); v.setUint16(66, stride, true); b.set(pixels, 128); b[128 + pixels.length] = 12; b.set([12, 34, 56], b.length - 768 + 3); return b;
}
test('PCX RLE runs may cross a scanline, as in the game\'s decoders, but not overshoot the picture', () => {
  const two = stream => { const b = pcx(stream); new DataView(b.buffer).setUint16(10, 1, true); return b; }; // height 2: 8 stored bytes
  const img = decodePcx(two([0xc6, 7, 0xc2, 9]));
  assert.deepEqual([...img.indices], [7, 7, 7, 7, 7, 9], 'a run of 6 crosses the end of the first stored row (3 pixels plus 1 padding byte)');
  assert.throws(() => decodePcx(two([0xc6, 7, 0xc3, 9])), /overshoots/);
  assert.throws(() => decodePcx(two([0xc6, 7])), /truncated/);
});
test('PCX decodes palette colors, padded rows, RLE and escaped literals', () => {
  const img = decodePcx(pcx([1, 0xc1, 0xc0, 2, 0])); assert.equal(img.width, 3); assert.deepEqual([...img.indices], [1, 192, 2]); assert.deepEqual([...img.palette.slice(3, 6)], [12, 34, 56]);
  assert.throws(() => decodePcx(pcx([0xc5, 1])), /overshoots/);
  assert.throws(() => decodePcx(pcx([0xc0, 1])), /Invalid/);
  assert.throws(() => decodePcx(new Uint8Array(10)), /header/);
});

test('column-major sprite data is transposed without reversing axes', () => {
  const frame = rawFrame(new Uint8Array([1, 2, 3, 4, 5, 6]), 3, 2); assert.deepEqual([...frame.indices], [1, 3, 5, 2, 4, 6]);
  assert.throws(() => rawFrame(new Uint8Array(10), 0, 2), /dimensions/);
  assert.throws(() => rawFrame(new Uint8Array(10), 2, 2, 3), /end/);
});
test('ATR count and frame dimensions are read from 40-byte records', () => {
  const b = new Uint8Array(42), v = new DataView(b.buffer); v.setUint16(0, 1, true); v.setUint16(6, 32, true); v.setUint16(8, 24, true); v.setUint16(16, 2, true); b.set(ascii('H1.SP'), 18);
  assert.deepEqual(parseAtr(b)[0], { id: 0, type: 0, width: 32, height: 24, frames: 2, name: 'h1.sp' });
  assert.throws(() => parseAtr(b.subarray(0, 41)), /expected 42/);
});
test('track tiles use ten image-stride columns, not nine; tile 107 is valid', () => {
  function sheet(bias) { const indices = new Uint8Array(320 * 200); for (let y = 0; y < 192; y++) for (let x = 0; x < 320; x++) indices[y * 320 + x] = bias + Math.floor(y / 32) * 10 + Math.floor(x / 32); return { width: 320, height: 200, indices, palette: new Uint8Array(768) }; }
  const map = new Uint8Array(4096); map[0] = 10; map[1] = 107;
  const track = composeTrack(map, sheet(0), sheet(54)); assert.equal(track.indices[0], 10); assert.equal(track.indices[32], 107);
  map[0] = 108; assert.throws(() => composeTrack(map, sheet(0), sheet(54)), /exceeds/);
});
test('route and spawn counts reject incomplete records', () => {
  assert.throws(() => parseRoute(new Uint8Array([1, 0, 0])), /records/); assert.throws(() => parseSpawns(new Uint8Array([1, 0, 0])), /records/);
});

function voc(blocks) {
  return new Uint8Array([...ascii('Creative Voice File'), 26, ...le16(26), ...le16(0x10a), ...le16((~0x10a + 0x1234) & 65535), ...blocks, 0]);
}
const block = (type, data) => [type, data.length & 255, data.length >> 8 & 255, data.length >> 16 & 255, ...data];
test('VOC PCM samples and infinite loop markers are decoded', () => {
  const b = voc([...block(6, [255, 255]), ...block(1, [156, 0, 0, 128, 255]), ...block(7, [])]); const result = decodeVoc(b);
  assert.equal(result.loop, true); assert.equal(result.sampleRate, 10000); assert.deepEqual([...result.samples], [-1, 0, 127 / 128]);
  assert.throws(() => decodeVoc(voc(block(1, [156, 1, 1]))), /codec/);
  const truncated = b.slice(0, 30); assert.throws(() => decodeVoc(truncated), /truncated/);
});
test('PC speaker silence and tones produce bounded sample data', () => {
  const audio = decodePcSpeaker(new Uint8Array([...le32(2), 0, 0, 0, 60, 0]));
  assert.equal(audio.samples[0], 0); assert.ok(audio.samples.some(v => v !== 0)); assert.ok(audio.samples.every(v => Math.abs(v) <= .201));
});
function klm() {
  // A simple sustained tone on channel 6 verifies the boundary correction found in the actual game.
  const instrument = [0, 0, 0xf0, 0xf0, 0x77, 0x77, 1, 1, 0, 0, 1];
  return new Uint8Array([...le16(100), 1, ...le16(16), ...instrument, 0x36, 0, 0x16, 0x57, 0x25, 0xfd, 20, 0x06, 0xff]);
}
test('KLM channel 6 consumes two frequency bytes and renders a tone', () => {
  const song = parseKlm(klm()); assert.equal(song.duration, .2); assert.ok(song.events.some(e => e.reg === 0xA6 && e.value === 0x57));
  const audio = renderOpl(klm(), 'klm', 1); assert.ok(audio.samples.some(v => Math.abs(v) > 0.001)); assert.ok(audio.samples.every(Number.isFinite));
  assert.throws(() => parseKlm(klm().slice(0, -1)), /end/);
});
function midi(track) { return new Uint8Array([...ascii('MThd'), ...be32(6), ...be16(0), ...be16(1), ...be16(96), ...ascii('MTrk'), ...be32(track.length), ...track]); }
test('MIDI running status, tempo changes and duration are respected', () => {
  const b = midi([0, 255, 81, 3, 7, 161, 32, 0, 0x90, 60, 100, 96, 60, 0, 0, 255, 47, 0]);
  const result = parseMidi(b); assert.equal(result.notes.length, 1); assert.equal(result.duration, .5); assert.equal(result.notes[0].end, .5);
  const audio = renderMidi(b, 1); assert.ok(audio.samples.some(v => Math.abs(v) > .01));
  assert.throws(() => parseMidi(b.slice(0, -1)), /truncated/);
});
test('MIDI sustain releases notes on pedal-up', () => {
  const b = midi([0, 0xB0, 64, 127, 0, 0x90, 60, 100, 96, 0x80, 60, 0, 96, 0xB0, 64, 0, 0, 255, 47, 0]);
  assert.equal(parseMidi(b).notes[0].end, 1);
});
test('WAV exports real lengths, channels and signed PCM', () => {
  const wav = encodeWav({ samples: new Float32Array([-1, 0, 1, 2]), sampleRate: 22050, channels: 2 }), v = new DataView(wav);
  assert.equal(wav.byteLength, 52); assert.equal(v.getUint16(22, true), 2); assert.equal(v.getUint32(40, true), 8); assert.equal(v.getInt16(44, true), -32767); assert.equal(v.getInt16(50, true), 32767);
});
test('B800 preserves CP437 box drawing and character attributes', () => {
  const b = new Uint8Array(4000); b[0] = 0xc4; b[1] = 0x9f; const cell = b800Cells(b)[0]; assert.equal(cell.character, '─'); assert.equal(cell.foreground, 15); assert.equal(cell.background, 1); assert.equal(cell.blink, true); assert.equal(cp437(255), ' ');
});
test('high-score structures reject partial records', () => {
  assert.throws(() => inspectData('x.hi', new Uint8Array(47)), /incomplete/); assert.throws(() => inspectData('x.tim', new Uint8Array(121)), /incomplete/);
});
