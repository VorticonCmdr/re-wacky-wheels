// .GAM track configuration, parsed strictly with the layout read from the game's parser and
// proven on the archive (claims gam.*). Names and integers are returned as read; the game's
// added biases (gam.read) are not applied here. parseGam in src/tracks.js uses this parser first and keeps a lenient
// fallback for files it rejects. The game's line reader ends a line at CR and consumes the byte after
// it (gam.line-reader), so only CRLF files are accepted.
import { bytes } from '../binary.js';
import { K } from '../evidence/k.js';

const READ = () => K({ prefix: 'A_', tilesetSlots: 0x02, maskSlots: 0x02, startBias: 0x03e0, extraLines: 0x03 }, 'gam.read');
const LAYOUT = () => K({ separator: '\r\n', tilesets: 0x02, masks: 0x02, sky: 0x01, values: 0x02, skipped: 0x01, startPairs: 0x08, extraLines: 0x03 }, 'gam.layout');

// atoi-like but strict: optional spaces, optional sign, digits, anything after is ignored.
function integer(line, what) {
  const m = /^\s*([-+]?\d+)/.exec(line);
  if (!m) throw new Error(`GAM ${what} "${line}" is not an integer`);
  return Number(m[1]);
}

export function parseGamWith(data, L) {
  const text = new TextDecoder('windows-1252').decode(bytes(data)), lines = text.split(L.separator);
  if (lines.length > 1 && lines.at(-1) === '') lines.pop(); // a final separator is not a line
  const head = L.tilesets + L.masks + L.sky, flagAt = head + L.values + L.skipped + L.startPairs * 2; // @math each pair is two lines
  if (lines.length <= flagAt) throw new Error(`GAM has ${lines.length} lines, expected at least ${flagAt + 1}`);
  const take = (from, count) => lines.slice(from, from + count);
  const flag = integer(lines[flagAt], 'flag line');
  const extra = flag === 0 ? [] : take(flagAt + 1, L.extraLines).map((l, i) => integer(l ?? '', `extra line ${i + 1}`));
  if (flag !== 0 && extra.length !== L.extraLines) throw new Error('GAM flag is set but the extra lines are missing');
  const pairs = take(head + L.values + L.skipped, L.startPairs * 2).map((l, i) => integer(l, `coordinate line ${i + 1}`)); // @math each pair is two lines
  return {
    tilesets: take(0, L.tilesets), masks: take(L.tilesets, L.masks), sky: lines[L.tilesets + L.masks],
    values: take(head, L.values).map((l, i) => integer(l, `value line ${i + 1}`)), skipped: lines[head + L.values],
    starts: Array.from({ length: L.startPairs }, (_, i) => ({ x: pairs[i * 2], y: pairs[i * 2 + 1] })), // @math each pair is two lines
    flag, extra,
  };
}

export const parseGam = data => parseGamWith(data, LAYOUT());

// The archive names the game asks for: the four tileset and mask lines are prefixed (gam.read), the sky line is used as read.
export function gamFileNames(gam) {
  const { prefix } = READ();
  return { tilesets: gam.tilesets.map(n => prefix + n), masks: gam.masks.map(n => prefix + n), sky: gam.sky };
}
