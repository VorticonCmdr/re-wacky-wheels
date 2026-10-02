import { bytes, view, need, ascii } from './binary.js';
import { parseAtr } from './sprites.js';
import { parseGam, parseRoute, parseSpawns } from './tracks.js';
import { parseKlm, parseMidi } from './audio.js';
const racers = ['Uno', 'Sultan', 'Morris', 'Peggles', 'Razer', 'Ringo', 'Blombo', 'Tigi'];

export function numericValues(data, width = 2, signed = true, offset = 0) {
  const b = bytes(data), v = view(b); if (![1, 2, 4].includes(width)) throw new Error('Invalid number width');
  const n = Math.floor((b.length - offset) / width);
  if (n < 0) throw new Error('Invalid data offset');
  return Array.from({ length: n }, (_, i) => width === 1 ? (signed ? v.getInt8(offset + i) : v.getUint8(offset + i)) : width === 2 ? (signed ? v.getInt16(offset + i * 2, true) : v.getUint16(offset + i * 2, true)) : (signed ? v.getInt32(offset + i * 4, true) : v.getUint32(offset + i * 4, true)));
}
function objects(rows) { return { columns: rows.length ? Object.keys(rows[0]) : [], rows: rows.map(r => Object.values(r)) }; }
export function inspectData(name, data) {
  const ext = name.split('.').at(-1).toLowerCase(), b = bytes(data), v = view(b);
  if (ext === 'atr') return { ...objects(parseAtr(b)), note: 'Object catalogue; IDs are used by SPW track placements.' };
  if (ext === 'gam') { const g = parseGam(b); return { columns: ['Line', 'Value'], rows: g.lines.map((line, i) => [i + 1, line]), note: 'Track configuration. Lines 1–4 reference tilesets and masks; 9–10 specify the starting position.' }; }
  if (ext === 'rd') return { ...objects(parseRoute(b)), note: 'Computer-driver path segments in world coordinates.' };
  if (ext === 'spw') return { ...objects(parseSpawns(b)), note: 'Track objects. ID references sprite.atr.' };
  if (ext === 'bmc') {
    need(b, 0, 2, 'BMC'); const n = v.getUint16(0, true); need(b, 2, n * 3, 'BMC records');
    return { columns: ['Record', 'Duration', 'Action bits'], rows: Array.from({ length: n }, (_, i) => [i, v.getInt16(2 + i * 3, true), '0x' + b[4 + i * 3].toString(16).padStart(2, '0')]), note: 'Demo controls: left=01, right=02, accelerate=04, fire=08, brake=10, handbrake=20, end=40.' };
  }
  if (ext === 'sin') return { columns: ['Tile', 'u16@0', 'u16@2', 'u16@4', 'u16@6', 'u16@8', 'u16@10'], rows: Array.from({ length: Math.floor(b.length / 12) }, (_, i) => [i, ...Array.from({ length: 6 }, (_, j) => v.getUint16(i * 12 + j * 2, true))]), note: 'Raw 12-byte tile-property records. The wiki’s field widths conflict, so values are shown without assigning unverified meanings.' };
  if (['hi', 'htt'].includes(ext)) {
    if (b.length % 46) throw new Error('High-score file has an incomplete record');
    return { columns: ['Index', 'Unknown', 'Racer', 'Score', 'Date', 'Name'], rows: Array.from({ length: b.length / 46 }, (_, i) => { const p = i * 46; return [i, v.getInt16(p, true), racers[v.getInt16(p + 2, true)] ?? '?', v.getInt16(p + 4, true), ascii(b.subarray(p + 6, p + 26)), ascii(b.subarray(p + 26, p + 46))]; }), note: 'Race high scores; alternate four-record groups are unused.' };
  }
  if (['tim', 'ott'].includes(ext)) {
    if (b.length % 120) throw new Error('Time-trial file has an incomplete record');
    return { columns: ['Track index', 'Lap 1', 'Time', 'Lap 2', 'Time', 'Lap 3', 'Time', 'Lap 4', 'Time', 'Overall', 'Time'], rows: Array.from({ length: b.length / 120 }, (_, i) => { const p = i * 120, row = [i]; for (let j = 0; j < 4; j++) row.push(ascii(b.subarray(p + j * 20, p + j * 20 + 20)), (v.getUint32(p + 80 + j * 4, true) / 10).toFixed(1) + 's'); row.push(ascii(b.subarray(p + 96, p + 116)), (v.getUint32(p + 116, true) / 10).toFixed(1) + 's'); return row; }), note: 'Time-trial records; stored times are tenths of a second.' };
  }
  if (ext === 'dtt') {
    if (b.length % 24) throw new Error('Duck-shoot file has an incomplete record');
    return { columns: ['Name', 'Score'], rows: Array.from({ length: b.length / 24 }, (_, i) => [ascii(b.subarray(i * 24, i * 24 + 20)), v.getInt32(i * 24 + 20, true)]), note: 'Duck-shoot high scores.' };
  }
  if (ext === 'cfg') {
    const fields = [['Single save', 0x866], ['Single laps', 0x872], ['Single class', 0x876], ['Single cup', 0x87a], ['Single track', 0x87e], ['Single points', 0x882], ['Single hedgehogs', 0x8c2], ['Single item', 0x8c6], ['Two-player save', 0x8da], ['Two-player mode', 0x94e]];
    return { columns: ['Field', 'Hex offset', 'INT32LE'], rows: fields.filter(([, p]) => p + 4 <= b.length).map(([n, p]) => [n, '0x' + p.toString(16), v.getInt32(p, true)]), note: 'Known saved-game fields only. Other settings and overlapping wiki field widths remain undocumented; the byte view is complete.' };
  }
  if (ext === 'klm') { const s = parseKlm(b); return { columns: ['Property', 'Value'], rows: [['Duration', s.duration.toFixed(2) + 's'], ['Instruments', s.instruments], ['Ticks/second', s.tempo], ['Register writes', s.events.length]], note: 'Original FM instruments and timed OPL commands.' }; }
  if (ext === 'mid') { const s = parseMidi(b); return { columns: ['Property', 'Value'], rows: [['Duration', s.duration.toFixed(2) + 's'], ['Tracks', s.tracks], ['Notes', s.notes.length], ['Ticks/quarter', s.division]], note: 'MIDI playback uses an approximate synthesizer. AdLib KLM playback uses the original instrument definitions.' }; }
  return null;
}

const extended437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const controls437 = '\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼';
export function cp437(code) {
  if (code === 0) return ' ';
  if (code < 32) return controls437[code];
  if (code === 127) return '⌂';
  return code < 128 ? String.fromCharCode(code) : extended437[code - 128];
}
export function b800Cells(data) {
  const b = bytes(data); need(b, 0, 4000, 'B800 text');
  return Array.from({ length: 2000 }, (_, i) => ({ character: cp437(b[i * 2]), foreground: b[i * 2 + 1] & 15, background: b[i * 2 + 1] >> 4 & 7, blink: !!(b[i * 2 + 1] & 128) }));
}
