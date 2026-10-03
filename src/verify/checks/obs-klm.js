import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseKlmSong } from '../../formats/klm.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ d: expected('klm.driver-state'), p: expected('klm.player') });

// Cross-validate a `klm` record: the song is identified by the CRC-32 of its header and instruments and of the commands consumed so far; running the
// product's KLM decoder (the driver of klm.player) over those commands must leave the driver's shadow tables exactly as the game holds them.
function validate(dat, record, V) {
  const D = V.d, P = V.p, songs = parseDatDirectory(dat).filter(e => /\.KLM$/i.test(e.name));
  assertArchive(record, dat);
  assert.deepEqual(record.stateWords, D.stateWords, 'the state words the tool read');
  assert.deepEqual(record.arrays, D.arrays, 'the tables the tool read');
  assert.equal(record.low.length, D.channels); assert.equal(record.cache.length, D.channels); assert.equal(record.channelVolume.length, D.channels);
  assert.equal(record.slotVolume.length, D.slots); assert.equal(record.level.length, D.slots); assert.equal(record.ksl.length, D.slots);
  assert.equal(record.tempo, D.tempo, 'the tick rate of the songs');
  assert.equal(record.playing, 1, 'a song is playing'); // @math the driver's flag is 1 while a song plays
  assert.equal(record.loop, 1, 'with its loop flag set');
  const song = songs.find(e => e.data.length >= record.headBytes && crc(e.data.subarray(0, record.headBytes)) === record.headCrc);
  assert.ok(song, 'the header and instruments are those of an archive song');
  assert.equal(crc(song.data.subarray(record.songAt, record.position)), record.consumedCrc, 'the commands consumed so far are the song\'s');
  const run = parseKlmSong(song.data, record.position), st = run.state;
  assert.equal(run.position, record.position, 'the decoder stops where the game is');
  assert.ok(record.delay >= 0 && record.delay <= run.lastDelay, 'the pending delay is at most the last delay command'); // @math a delay counts down from the command's value
  assert.deepEqual(st.low, record.low, 'the last low frequency bytes');
  assert.deepEqual(st.high, record.high, 'the last high frequency bytes');
  assert.deepEqual(st.loaded.map(i => (i < 0 ? 0 : P.header.instrumentsAt + i * P.header.instrumentBytes)), record.cache, 'the instruments held by the channels'); // @math no instrument is stored as 0
  assert.deepEqual(st.channelVolume, record.channelVolume, 'the channel volumes');
  assert.equal(st.rhythm, record.rhythm, 'the rhythm register');
  assert.deepEqual(st.slotVolume, record.slotVolume, 'the operator volumes');
  assert.deepEqual(st.level, record.level, 'the operator levels');
  assert.deepEqual(st.ksl, record.ksl, 'the key scaling bits');
  return song.name;
}

export default {
  id: 'obs-klm',
  claims: ['klm.driver-state'],
  obs: ['klm-1', 'klm-2', 'klm-3', 'klm-4', 'klm-5'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), names = ['klm-1', 'klm-2', 'klm-3', 'klm-4', 'klm-5'].map(id => validate(dat, ctx.obs(id), V));
    assert.deepEqual([...new Set(names)].sort(), V.d.songs, 'the songs observed');
    assert.equal(names.length, V.d.samples, 'the samples');
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r = ctx.obs('klm-2'), at = (list, i, v) => list.map((x, k) => (k === i ? v : x));
    const d = patch => ({ ...V, d: { ...V.d, ...patch } });
    return [
      { label: 'a low frequency byte changed', fn: () => validate(dat, { ...r, low: at(r.low, 0, r.low[0] + 1) }, V) },
      { label: 'a high frequency byte changed', fn: () => validate(dat, { ...r, high: at(r.high, 1, r.high[1] ^ 1) }, V) }, // @math flip one bit
      { label: 'a channel volume changed', fn: () => validate(dat, { ...r, channelVolume: at(r.channelVolume, 4, r.channelVolume[4] + 1) }, V) }, // @math one channel
      { label: 'an operator volume changed', fn: () => validate(dat, { ...r, slotVolume: at(r.slotVolume, 3, r.slotVolume[3] - 1) }, V) }, // @math one operator
      { label: 'an operator level changed', fn: () => validate(dat, { ...r, level: at(r.level, 0, r.level[0] + 1) }, V) },
      { label: 'the rhythm register changed', fn: () => validate(dat, { ...r, rhythm: r.rhythm ^ 0x10 }, V) }, // @math the bass drum bit
      { label: 'another instrument held', fn: () => validate(dat, { ...r, cache: at(r.cache, 0, r.cache[0] + V.p.header.instrumentBytes) }, V) },
      { label: 'the consumed commands changed', fn: () => validate(dat, { ...r, consumedCrc: '00000000' }, V) },
      { label: 'another tick rate', fn: () => validate(dat, r, d({ tempo: V.d.tempo + 1 })) },
    ];
  },
};
