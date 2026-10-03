import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { expected } from '../expect.js';

const values = () => ({ s: expected('midi.songs'), p: expected('midi.player') });

const be = (b, at, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[at + i]; return v; }; // @math big-endian bytes
const tag = (b, at, text) => String.fromCharCode(...b.subarray(at, at + text.length)) === text;

// Walk one file with the sequencer's grammar (midi.player).
function walk(b, P, stats) {
  const H = P.header;
  assert.ok(tag(b, 0, H.tag), 'MThd');
  const headerLength = be(b, H.lengthAt, 4), format = be(b, H.formatAt, 2), tracks = be(b, H.tracksAt, 2), division = be(b, H.divisionAt, 2); // @math big-endian dword and words
  assert.ok(format <= P.maxFormat && tracks > 0, 'format and tracks the loader accepts');
  let p = H.chunkHeader + headerLength;
  for (let t = 0; t < tracks; t++) {
    assert.ok(tag(b, p, P.trackTag), 'MTrk');
    const end = p + P.header.chunkHeader + be(b, p + P.trackLengthAt, 4); // @math the length dword
    let q = p + P.header.chunkHeader, status = 0, ended = false;
    while (q < end) {
      assert.ok(!ended, 'nothing follows the end of track');
      while (b[q++] & P.statusBit); // the delta
      if (b[q] === P.meta) {
        const type = b[q + 1], length = b[q + 2]; // @math the type and the single length byte
        assert.ok(length < P.statusBit, 'a one-byte meta length');
        stats.metas.add(type); q += 3 + length; stats.events++; // @math meta, type and length bytes
        if (type === P.endOfTrack) ended = true;
        continue;
      }
      if (b[q] & P.statusBit) { status = b[q]; q++; } else { assert.ok(status, 'running status has a status'); stats.running++; }
      const kind = status >> P.kindShift;
      assert.ok(kind >= P.firstChannelKind && kind <= P.lastChannelKind, `status ${status.toString(16)} is a channel event`); // @math hexadecimal radix
      if (kind === P.kinds.control) stats.controllers.add(b[q]);
      stats.kinds.add(kind); q += P.dataBytes[kind]; stats.events++;
    }
    assert.ok(ended && q === end, 'the track ends with its end-of-track event');
    p = end;
  }
  assert.equal(p, b.length, 'the chunks fill the file');
  return { headerLength, format, tracks, division };
}

function validate(dat, V) {
  const S = V.s, stats = { events: 0, running: 0, kinds: new Set(), controllers: new Set(), metas: new Set() }, files = parseDatDirectory(dat).filter(e => /\.MID$/i.test(e.name));
  const heads = files.map(e => walk(e.data, V.p, stats));
  assert.equal(files.length, S.files, 'the number of files');
  assert.deepEqual([...new Set(heads.map(h => h.format))].sort(), S.formats, 'the formats');
  assert.deepEqual([...new Set(heads.map(h => h.division))], [S.division], 'one division');
  assert.deepEqual([...new Set(heads.map(h => h.headerLength))], [S.headerLength], 'one header length');
  assert.equal(Math.max(...heads.map(h => h.tracks)), S.mostTracks, 'the most tracks');
  assert.equal(Math.min(...heads.map(h => h.tracks)), S.fewestTracks, 'the fewest tracks');
  assert.equal(stats.events, S.events, 'the events');
  assert.equal(stats.running, S.running, 'the events in running status');
  assert.deepEqual([...stats.kinds].sort((a, b) => a - b), S.kinds, 'the channel event kinds');
  assert.deepEqual([...stats.controllers].sort((a, b) => a - b), S.controllers, 'the controllers');
  assert.deepEqual([...stats.metas].sort((a, b) => a - b), S.metas, 'the meta types');
}

export default {
  id: 'midi-songs',
  claims: ['midi.songs'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), p = patch => () => validate(dat, { ...V, p: { ...V.p, ...patch } }), s = patch => () => validate(dat, { ...V, s: { ...V.s, ...patch } });
    return [
      { label: 'program change with two data bytes', fn: p({ dataBytes: V.p.dataBytes.map((n, k) => (k === V.p.kinds.program ? 2 : n)) }) }, // @math the note-style two bytes
      { label: 'pitch bend with one data byte', fn: p({ dataBytes: V.p.dataBytes.map((n, k) => (k === V.p.kinds.pitchBend ? 1 : n)) }) }, // @math one byte
      { label: 'channel aftertouch with two data bytes', fn: p({ dataBytes: V.p.dataBytes.map((n, k) => (k === V.p.kinds.channelAftertouch ? 2 : n)) }) }, // @math two bytes
      { label: 'chunk header of 7 bytes', fn: p({ header: { ...V.p.header, chunkHeader: V.p.header.chunkHeader - 1 } }) },
      { label: 'track tag MThd', fn: p({ trackTag: V.p.header.tag }) },
      { label: 'one more file', fn: s({ files: V.s.files + 1 }) },
      { label: 'another division', fn: s({ division: V.s.division + 1 }) },
      { label: 'one event more', fn: s({ events: V.s.events + 1 }) },
      { label: 'one running-status event more', fn: s({ running: V.s.running + 1 }) },
    ];
  },
};
