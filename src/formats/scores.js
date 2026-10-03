// The time-trial tables (.TIM, .OTT) and the duck-shoot table (.DTT), with the layouts the game's own code and the installed files
// show (claims tim.layout, score.defaults, score.references, score.insert). The race high score tables (.HI, .HTT) are not here:
// no code of the game reads their records, so their layout is still the wiki's lead (docs/hi.md).
import { bytes, view, ascii } from '../binary.js';
import { K } from '../evidence/k.js';

const TIM = () => K({ records: 30, recordBytes: 120, names: 4, nameBytes: 20, namePadded: 16, timesAt: 0x50, times: 4, overallNameAt: 0x60, overallTimeAt: 0x74, minLap: 148, maxLap: 683, minOverall: 934, maxOverall: 3254 }, 'tim.layout');
const DTT = () => K({ entries: 4, entryBytes: 24, nameBytes: 20, namePadded: 16, scoreAt: 20 }, 'dtt.layout');

// A time table of any whole number of records (the game's files have 30).
export function parseTimeTable(data) {
  const T = TIM(), b = bytes(data), dv = view(b);
  if (b.length % T.recordBytes) throw new Error('Time-trial file has an incomplete record');
  return Array.from({ length: b.length / T.recordBytes }, (_, r) => {
    const o = r * T.recordBytes;
    return {
      laps: Array.from({ length: T.names }, (_, i) => ({ name: ascii(b.subarray(o + i * T.nameBytes, o + (i + 1) * T.nameBytes)), time: dv.getUint32(o + T.timesAt + i * 4, true) })), // @math a time is a dword
      overall: { name: ascii(b.subarray(o + T.overallNameAt, o + T.overallNameAt + T.nameBytes)), time: dv.getUint32(o + T.overallTimeAt, true) },
    };
  });
}

// The duck-shoot table: entries of a 20-byte name field and a dword score.
export function parseDuckTable(data) {
  const D = DTT(), b = bytes(data), dv = view(b);
  if (b.length % D.entryBytes) throw new Error('Duck-shoot file has an incomplete record');
  return Array.from({ length: b.length / D.entryBytes }, (_, i) => ({ name: ascii(b.subarray(i * D.entryBytes, i * D.entryBytes + D.nameBytes)), score: dv.getInt32(i * D.entryBytes + D.scoreAt, true) }));
}
