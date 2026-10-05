// The playtest page's sound: the VOC samples of the numbered sounds with the game's priorities and eight voices, the looping engine whose pitch follows the speed, and the songs
// (audio.race-sounds). Everything is decoded in the browser from the player's own WACKY.DAT; the Web Audio context starts with the first key.
import { decodeVoc } from './audio.js';
import { soundOf, soundCount, voiceLimit, soundVolumes, engineSound, enginePitch, hornSound } from './game/sounds.js';

const MAX_VOLUME = 255; // @math the volume words run from 0 to 255 (audio.race-sounds)
const centsToRate = cents => 2 ** (cents / 1200); // @math 1200 cents are an octave

export function createAudio(members) {
  let ctx = null, effects = null, music = null, engineVoice = null, song = null;
  const buffers = new Map(), numbers = new Array(soundCount()).fill(null), voices = new Set(), songCache = new Map();
  const volumes = { ...soundVolumes(), engine: engineSound().volume }; // the effects, music and engine levels (the volume screen changes them)
  const worker = new Worker(new URL('./audio-worker.js', import.meta.url), { type: 'module' });
  const waiting = new Map(); let ticket = 0;
  worker.onmessage = ({ data: { id, result, error } }) => { const w = waiting.get(id); waiting.delete(id); if (w) error ? w.reject(new Error(error)) : w.resolve(result); };

  const level = v => v / MAX_VOLUME;
  function context() {
    if (!ctx) {
      ctx = new AudioContext();
      effects = ctx.createGain(); effects.gain.value = level(volumes.effects); effects.connect(ctx.destination);
      music = ctx.createGain(); music.gain.value = level(volumes.music); music.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function bufferOf(member) {
    if (!buffers.has(member)) {
      const data = members.get(member);
      if (!data) { buffers.set(member, null); return null; }
      const voc = decodeVoc(data), b = context().createBuffer(1, voc.samples.length, voc.sampleRate);
      b.copyToChannel(voc.samples, 0); buffers.set(member, { buffer: b, loop: voc.loop });
    }
    return buffers.get(member);
  }
  const alive = v => v.end === Infinity || v.end > ctx.currentTime;
  const prune = () => { for (const v of voices) if (!alive(v)) voices.delete(v); };

  // The game's play (obj1+0x1c04): a free voice or the lowest priority one that is not above the new sound's; otherwise nothing.
  function start(member, number, priority, cents = 0, gainValue = 1, loop = false) {
    const art = bufferOf(member);
    if (!art) return null;
    context(); prune();
    if (voices.size >= voiceLimit()) {
      let lowest = null; for (const v of voices) if (!lowest || v.priority < lowest.priority) lowest = v;
      if (priority < lowest.priority) return null;
      stop(lowest);
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = art.buffer; source.loop = loop || art.loop; source.playbackRate.value = centsToRate(cents);
    gain.gain.value = gainValue; source.connect(gain); gain.connect(effects);
    const voice = { number, priority, source, gain, end: source.loop ? Infinity : ctx.currentTime + art.buffer.duration / source.playbackRate.value };
    source.start(); voices.add(voice); if (number !== null) numbers[number] = voice;
    return voice;
  }
  function stop(voice) { try { voice.source.stop(); } catch { /* already stopped */ } voices.delete(voice); voice.end = 0; }

  return {
    // Starts on the first key: browsers keep the context suspended until then.
    unlock: () => context(),
    // One of the three volumes (0 to 255): the music's and the effects' master gains follow at once, the engine's applies to the running loop and to the next one.
    setVolume(kind, value) {
      volumes[kind] = value;
      if (kind === 'effects' && effects) effects.gain.value = level(value);
      if (kind === 'music' && music) music.gain.value = level(value);
      if (kind === 'engine' && engineVoice) engineVoice.gain.gain.value = level(value);
    },
    // One sound event: a number, or { id, guard } where a guarded sound waits for the last voice of its number to end (the sites that ask the is-playing routine first).
    play(event) {
      if (event.member) { start(event.member, null, event.priority ?? 1, event.cents ?? 0); return; } // a sample by its member name (the taunts' voices, versus.taunts)
      const e = typeof event === 'number' ? { id: event } : event, s = soundOf(e.id, e.quack);
      if (e.guard && this.isPlaying(s.number)) return;
      start(s.member, s.number, s.priority, e.cents ?? 0);
    },
    isPlaying(number) { if (!ctx) return false; const v = numbers[number]; return Boolean(v && alive(v)); },
    stopAll() { for (const v of [...voices]) stop(v); engineVoice = null; },
    engineStart() {
      if (engineVoice) return;
      const E = engineSound(); engineVoice = start(E.member, null, E.priority, E.startCents, level(volumes.engine), true);
    },
    engineStop() { if (engineVoice) { stop(engineVoice); engineVoice = null; } },
    engineSpeed(speed) { if (engineVoice && alive(engineVoice)) engineVoice.source.playbackRate.value = centsToRate(enginePitch(speed)); },
    horn(slot, cents) { const H = hornSound(); start(H.member, null, H.priority, cents ?? H.cents[slot]); },
    // A song by name: rendered once in a worker (the OPL emulation of the KLM file), then looped or played once.
    async song(name, loop = true, then = null) {
      this.songStop();
      const wanted = ++ticket; song = wanted;
      if (!songCache.has(name)) {
        songCache.set(name, new Promise((resolve, reject) => {
          const id = ++ticket; waiting.set(id, { resolve, reject });
          const data = members.get(`${name}.KLM`); if (!data) { resolve(null); return; }
          worker.postMessage({ id, kind: 'klm', data, limit: 1e9 });
        }));
      }
      const result = await songCache.get(name);
      if (!result || song !== wanted) return;
      const frames = result.samples.length / result.channels, b = context().createBuffer(result.channels, frames, result.sampleRate);
      for (let ch = 0; ch < result.channels; ch++) { const out = b.getChannelData(ch); for (let i = 0; i < frames; i++) out[i] = result.samples[i * result.channels + ch]; }
      const source = ctx.createBufferSource(); source.buffer = b; source.loop = loop; source.connect(music); source.onended = () => { if (this.current === source && then) then(); }; source.start(); this.current = source;
    },
    songStop() { song = null; if (this.current) { try { this.current.stop(); } catch { /* done */ } this.current = null; } },
    // Renders a song ahead of its use (the cup's race songs while the card shows).
    prefetch(name) { if (!songCache.has(name) && members.get(`${name}.KLM`)) { const id = ++ticket; songCache.set(name, new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); worker.postMessage({ id, kind: 'klm', data: members.get(`${name}.KLM`), limit: 1e9 }); })); } },
  };
}
