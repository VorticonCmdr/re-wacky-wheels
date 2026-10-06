// The playtest page's sound: the VOC samples of the numbered sounds with the game's priorities and eight voices, the looping engine whose pitch follows the speed, and the songs
// (audio.race-sounds). Everything is decoded in the browser from the player's own WACKY.DAT; the Web Audio context starts with the first key.
import { decodeVoc, decodePcSpeaker } from './audio.js';
import { parseAudioBank } from './formats/audio-bank.js';
import { defaultDevices, speakerSlotOf } from './game/sound-devices.js';
import { soundOf, soundCount, voiceLimit, soundVolumes, engineSound, enginePitch, hornSound } from './game/sounds.js';

const MAX_VOLUME = 255; // @math the volume words run from 0 to 255 (audio.race-sounds)
const centsToRate = cents => 2 ** (cents / 1200); // @math 1200 cents are an octave
const SAMPLES = 1, SPEAKER = 2, NO_EFFECTS = 3, ADLIB = 1, MIDI = 2, NO_MUSIC = 3; // the items of the page's sound device lists (game/sound-devices.js)

export function createAudio(members) {
  let ctx = null, effects = null, music = null, engineVoice = null, song = null, playing = null, devices = defaultDevices(), speakerBank = null, active = false; // active: a song asked for that has not ended (the library's is-playing)
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
  // The sound as the PC speaker plays it: the tones of the sound number's record in the first bank of AUDIOT.FX (speakerSlotOf), null where the speaker is quiet.
  function speakerArt(number) {
    const slot = number === null ? null : speakerSlotOf(number);
    if (slot === null) return null;
    const key = `speaker:${slot}`;
    if (!buffers.has(key)) {
      const head = members.get('AUDIOHED.FX'), body = members.get('AUDIOT.FX');
      let entry = null;
      try { entry = head && body ? parseAudioBank(head, body).slots[slot] : null; } catch { /* a bank of another shape: no tones */ }
      if (!entry || entry.length === 0) { buffers.set(key, null); return null; }
      const tones = decodePcSpeaker(body.subarray(entry.start, entry.start + entry.size)), b = context().createBuffer(1, tones.samples.length, tones.sampleRate);
      b.copyToChannel(tones.samples, 0); buffers.set(key, { buffer: b, loop: false });
    }
    return buffers.get(key);
  }
  const alive = v => v.end === Infinity || v.end > ctx.currentTime;
  const prune = () => { for (const v of voices) if (!alive(v)) voices.delete(v); };

  // The game's play (obj1+0x1c04): a free voice or the lowest priority one that is not above the new sound's; otherwise nothing.
  function start(member, number, priority, cents = 0, gainValue = 1, loop = false) {
    const art = devices.effects === SAMPLES ? bufferOf(member) : devices.effects === SPEAKER ? speakerArt(number) : null; // the loops of the engine and the horn are digital: the PC speaker has none
    if (!art) return null;
    context(); prune();
    if (voices.size >= (devices.effects === SPEAKER ? 1 : voiceLimit())) { // the PC speaker has one voice (audio.speaker-player: one counter, pointer and priority)
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
  const halt = () => { song = null; active = false; if (api.current) { try { api.current.stop(); } catch { /* done */ } api.current = null; } }; // the song stops, what plays is kept for a change of the music device
  function stop(voice) { try { voice.source.stop(); } catch { /* already stopped */ } voices.delete(voice); voice.end = 0; }

  const api = {
    // Starts on the first key: browsers keep the context suspended until then.
    unlock: () => context(),
    // The sound devices of the page's menu (game/sound-devices.js): the effects as samples, as PC speaker tones or none, the music as KLM songs, MIDI files or none. The song that plays starts again on the new device.
    setDevices(next) {
      const musicChanged = next.music !== devices.music, effectsChanged = next.effects !== devices.effects;
      devices = { effects: next.effects, music: next.music };
      if (effectsChanged) { for (const v of [...voices]) stop(v); engineVoice = null; }
      if (musicChanged) { const again = playing; halt(); if (again) this.song(again.name, again.loop, again.then); }
    },
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
      if (e.quack && devices.effects === SPEAKER) return; // the duck game's quacks are digital samples: with the PC speaker the game's play routine returns silent (audio.digital-flag)
      if (e.guard && this.isPlaying(s.number)) return;
      if (e.restart && ctx && numbers[s.number]) stop(numbers[s.number]); // the site stops the sound's own voice before it plays it again (boot.intro's cars)
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
      halt();
      playing = { name, loop, then };
      if (devices.music === NO_MUSIC) return;
      const wanted = ++ticket, kind = devices.music === MIDI ? 'mid' : 'klm', cacheKey = `${kind}:${name}`; song = wanted; active = true;
      if (!songCache.has(cacheKey)) {
        songCache.set(cacheKey, new Promise((resolve, reject) => {
          const id = ++ticket; waiting.set(id, { resolve, reject });
          const data = members.get(`${name}.${kind === 'mid' ? 'MID' : 'KLM'}`); if (!data) { resolve(null); return; }
          worker.postMessage({ id, kind, data, limit: 1e9 });
        }));
      }
      const result = await songCache.get(cacheKey);
      if (song !== wanted) return;
      if (!result) { active = false; return; }
      const frames = result.samples.length / result.channels, b = context().createBuffer(result.channels, frames, result.sampleRate);
      for (let ch = 0; ch < result.channels; ch++) { const out = b.getChannelData(ch); for (let i = 0; i < frames; i++) out[i] = result.samples[i * result.channels + ch]; }
      const source = ctx.createBufferSource(); source.buffer = b; source.loop = loop; source.connect(music); source.onended = () => { if (this.current === source) { active = false; if (then) then(); } }; source.start(); this.current = source;
    },
    songStop() { playing = null; halt(); },
    // Is a song playing (obj1+0x32160 as the intro asks it)? One asked for counts until it ends, also while it is being rendered; a context the browser keeps suspended plays nothing.
    songPlaying: () => active && !(ctx && ctx.state === 'suspended'),
    hasMusic: () => devices.music !== NO_MUSIC,
    // Renders a song ahead of its use (the cup's race songs while the card shows).
    prefetch(name) { // the song of the current music device, rendered ahead
      const kind = devices.music === MIDI ? 'mid' : 'klm', key = `${kind}:${name}`, data = members.get(`${name}.${kind === 'mid' ? 'MID' : 'KLM'}`);
      if (devices.music !== NO_MUSIC && !songCache.has(key) && data) { const id = ++ticket; songCache.set(key, new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); worker.postMessage({ id, kind, data, limit: 1e9 }); })); }
    },
  };
  return api;
}
