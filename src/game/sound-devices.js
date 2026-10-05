// The sound devices of the page, which the game does not have in its menus (SETUP.EXE sets the devices in WACKY.CFG, audio.device-numbers): GAME OPTIONS gets the item SOUND DEVICES, which opens the lists of the
// sound effects device and the music device, as SETUP.EXE's sound menu does. The lists hold what the page can play from the player's own WACKY.DAT: the effects as the digital samples of the Sound Blaster, as the
// tones of the PC speaker (the first bank of AUDIOT.FX) or none; the music as the AdLib songs (the KLM files), as the General MIDI files (approximate timbres, no soundfont) or none.
import { K } from '../evidence/k.js';

export const SOUND_MENU = { item: 'SOUND DEVICES', items: ['SOUND EFFECTS DEVICE', 'MUSIC DEVICE'], effects: ['SOUND BLASTER', 'PC SPEAKER', 'NO SOUND EFFECTS'], music: ['ADLIB', 'GENERAL MIDI', 'NO MUSIC'] };

// The device of each list as the item number counts it from 1: the first of each list is what the game plays with the installed files (the Sound Blaster's samples and the AdLib songs).
export const defaultDevices = () => ({ effects: 1, music: 1 }); // @math the first item of each list

const valid = (value, list) => Number.isInteger(value) && value >= 1 && value <= list.length; // @math items count from 1
export const validDevices = devices => Boolean(devices) && valid(devices.effects, SOUND_MENU.effects) && valid(devices.music, SOUND_MENU.music);

// The choice kept in this browser (localStorage may be missing or throw): the default one when nothing usable is stored.
const STORE = 'wackywheels.sound';
export function loadDevices(storage = globalThis.localStorage) {
  try { const devices = JSON.parse(storage.getItem(STORE)); if (validDevices(devices)) return { effects: devices.effects, music: devices.music }; } catch { /* no storage or nothing stored */ }
  return defaultDevices();
}
export function saveDevices(devices, storage = globalThis.localStorage) {
  try { storage.setItem(STORE, JSON.stringify(devices)); } catch { /* storage is not available: the choice lasts until the page closes */ }
}

// The list a menu id stands for and the key it sets: 'soundEffects' and 'soundMusic'.
export const deviceList = id => (id === 'soundEffects' ? { key: 'effects', items: SOUND_MENU.effects } : { key: 'music', items: SOUND_MENU.music });

// The PC speaker's sound for a sound number: the game's records are slots 0 to 25 of the first bank (audio.load), the first eight of them share the sound of record 20 (audio.alias: the drivers' voices have no
// tones of their own), and the sound NO (26) is a copy of the record of PUF (audio.no-alias). Returns the slot of the first bank, or null where the speaker stays quiet. The sounds the game plays by name (the engine, the horn, the taunts' voices and the duck game's quacks) are digital samples that the game does not even load in
// the PC speaker mode, and every site that plays them tests the digital flag (audio.digital-flag): the page plays them only on the Sound Blaster.
const LOAD = () => K({ headName: 0x224, bodyName: 0x230, bufferPointerAt: 0x1eb14, recordTable: 0x1a9c8, recordBytes: 0x18, records: 0x1a, pointerAt: 0x00, lengthAt: 0x04, zeroAt: 0x08, priorityAt: 0x0c, priorityFirst: 0x1b }, 'audio.load');
const ALIAS = () => K({ source: 0x14, firstTarget: 0x00, count: 0x08, sourceOffset: 0x1e0 }, 'audio.alias');
const NO = () => K({ source: 18, target: 26, bufferPointerAt: 0x1eb14, copied: [0x00, 0x04, 0x0c, 0x10], zeroed: 0x08, playCount: 0x14 }, 'audio.no-alias');
export function speakerSlotOf(number) {
  const A = ALIAS(), N = NO();
  if (number === N.target) return N.source; // NO is a copy of the record of PUF
  if (!Number.isInteger(number) || number < 0 || number >= LOAD().records) return null; // @math a number outside the records has no tones
  return number >= A.firstTarget && number < A.firstTarget + A.count ? A.source : number; // @math the aliased records are the first eight
}
