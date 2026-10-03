import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseMidiEvents } from '../../formats/midi.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['midi-1', 'midi-2', 'midi-3', 'midi-4', 'midi-5'];
const values = () => ({ m: expected('midi.driver-state'), p: expected('midi.player') });

// Cross-validate a `midi` record: the file in memory is an archive MIDI file (size and CRC-32), the sequencer holds one record per track in a
// run of 0x1c-byte records, and each track's pointer, pending delay and running status are consistent with walking that track with the
// grammar of midi.player: an active track's pointer rests on an event right after its delta, with at most that delta still to count and the
// running status in force before that event; an ended track's pointer is one byte past its chunk (the delta the sequencer reads after the end event).
function validate(dat, record, V) {
  const M = V.m, P = V.p;
  assertArchive(record, dat);
  assert.equal(record.firstTrackOffset, M.firstTrackAt);
  assert.equal(record.divisionOffset, M.divisionAt);
  assert.equal(record.activeOffset, M.activeAt);
  assert.equal(record.playingOffset, M.playingAt);
  assert.equal(record.loopOffset, M.loopAt);
  assert.deepEqual(record.recordFields, M.fields, 'the record fields the tool read');
  const file = parseDatDirectory(dat).filter(e => /\.MID$/i.test(e.name)).find(e => e.data.length === record.size && crc(e.data) === record.crc);
  assert.ok(file, 'the file in memory is an archive MIDI file');
  const parsed = parseMidiEvents(file.data);
  assert.equal(record.division, parsed.division, 'the division the sequencer holds');
  assert.equal(record.tracks.length, parsed.tracks, 'one record per track');
  assert.deepEqual(record.recordAddresses, record.tracks.map((_, i) => i * M.recordBytes), 'the records follow each other'); // @math the records are contiguous
  assert.equal(record.playing, 1, 'the sequencer is playing'); // @math the flag is 1 while a song plays
  assert.ok(record.loop === 0 || record.loop === 1, 'the loop flag is a flag'); // @math a flag
  assert.equal(record.tracks.filter(t => t.active).length, record.activeTracks, 'the count of tracks still playing');
  record.tracks.forEach((t, i) => {
    const walk = parsed.walks[i];
    assert.equal(t.start, walk.start, `track ${i} starts where its chunk data starts`);
    assert.ok(t.active === 0 || t.active === 1, 'a flag'); // @math a flag
    if (!t.active) { // the sequencer reads a delta right after the end-of-track event, from the first byte of the next chunk (the M of MTrk, one byte long as a variable-length quantity)
      if (i < parsed.tracks - 1) assert.equal(t.current, walk.end + 1, `track ${i} stopped just past the first byte after its chunk`); // @math one byte of the next chunk's tag
      else assert.ok(t.current >= walk.end, `track ${i} stopped at or past the end of the file`);
      return;
    }
    const step = walk.steps.find(s => s.eventAt === t.current);
    assert.ok(step, `track ${i}: the pointer rests on an event right after a delta`);
    assert.ok(t.delta >= 0 && t.delta <= step.delta, `track ${i}: at most the event's delta is left (${t.delta} of ${step.delta})`); // @math a delta counts down from its value
    assert.equal(t.status, step.statusBefore, `track ${i}: the running status in force before the event`);
    assert.ok(t.status === 0 || (t.status & P.statusBit) !== 0, 'a status byte'); // @math status bytes have bit 7 set
  });
  return file.name;
}

export default {
  id: 'obs-midi',
  claims: ['midi.driver-state'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), names = IDS.map(id => validate(dat, ctx.obs(id), V));
    assert.deepEqual([...new Set(names)].sort(), V.m.songs, 'the songs observed');
    assert.equal(names.length, V.m.samples, 'the samples');
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), rs = IDS.map(id => ctx.obs(id)), multi = rs.find(r => r.tracks.length > 1), at = (list, i, patch) => list.map((x, k) => (k === i ? { ...x, ...patch } : x));
    const live = multi.tracks.findIndex(t => t.active), m = patch => ({ ...V, m: { ...V.m, ...patch } });
    return [
      { label: 'a pointer one byte on', fn: () => validate(dat, { ...multi, tracks: at(multi.tracks, live, { current: multi.tracks[live].current + 1 }) }, V) },
      { label: 'a delta larger than any', fn: () => validate(dat, { ...multi, tracks: at(multi.tracks, live, { delta: 0x10000 }) }, V) }, // @math more than a VLQ of this file
      { label: 'the running status changed', fn: () => validate(dat, { ...multi, tracks: at(multi.tracks, live, { status: multi.tracks[live].status ^ 1 }) }, V) }, // @math flip a bit
      { label: 'an ended track not at its end', fn: () => validate(dat, { ...multi, tracks: at(multi.tracks, multi.tracks.findIndex(t => !t.active), { current: 0 }) }, V) }, // @math the start of the file
      { label: 'the track count word wrong', fn: () => validate(dat, { ...multi, activeTracks: multi.activeTracks + 1 }, V) },
      { label: 'division 96', fn: () => validate(dat, { ...multi, division: multi.division - 24 }, V) }, // @math a quarter less
      { label: 'records 0x20 apart', fn: () => validate(dat, multi, m({ recordBytes: V.m.recordBytes + 4 })) }, // @math one dword
      { label: 'another file', fn: () => validate(dat, { ...multi, crc: '00000000' }, V) },
    ];
  },
};
