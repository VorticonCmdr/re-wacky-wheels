// The numbered sounds of the game, the engine, the horn and the songs (audio.race-sounds, STATIC): which member a number plays, with which priority, and which song a race has.
import { K } from '../evidence/k.js';
import { GLANCE } from './duck-rules.js';

const SOUNDS = () => K({ names: ['UNO', 'SULTAN', 'MORRIS', 'PEGGLES', 'RAZER', 'RINGO', 'BLOMBO', 'TIGI', 'PASS', 'BELL', 'START', 'GLASS', 'WARP', 'BOOM', 'HORN', 'SPLASH', 'PLIP', 'SKID', 'PUF', 'FLAME', 'HOG', 'CLANG', 'SWIPE', 'DROP', 'BACKFIRE', 'STALL1', 'NO'], suffix: '.VOC', playRoutine: 0x1c04, playingRoutine: 0x1bbc, voices: 8, priority: { base: 27, stall: { sound: 25, value: 0x20 }, no: { sound: 26, value: 9 } }, substitute: { from: 0xff, to: 3 }, engine: { member: 'MOTOR.VOC', priority: 0x28, startCents: -1800, perSpeed: 20, offset: 0x708, volume: 100 }, horn: { member: 'HORN1.VOC', priority: 0x16, cents: [-650, -300, 200, 750, 0, -300, 750, 200] }, volumes: { effects: 240, music: 250 }, songs: ['MAINMENU', 'LEADRBRD', 'GAMEOVER', 'SPACEY', 'ASHES'], cups: [['TURBO', 'DANCE', 'FLIGHT'], ['STARBRAI', 'BASSATTK', 'KARD'], ['BANSHI', 'STARBRAI', 'BRICWALL'], ['FLIGHT', 'KARD', 'PUMPER'], ['DANCE', 'BASSATTK', 'TURBO'], ['BANSHI', 'BRICWALL', 'STARBRAI']], finalSong: 'OVERDRIV', raceSongs: [0, 1, 2, 0, 3], boardSong: 'ASHES' }, 'audio.race-sounds');

export const voiceLimit = () => SOUNDS().voices;
// The name of a driver slot (the names of the driver voices, in the order of the vehicle screen): UNO, SULTAN, MORRIS, PEGGLES, RAZER, RINGO, BLOMBO, TIGI.
export const driverName = slot => SOUNDS().names[slot];
export const soundVolumes = () => SOUNDS().volumes;
export const engineSound = () => SOUNDS().engine;
export const hornSound = () => SOUNDS().horn;

// The sound a number plays: its member, name and priority (0xff plays 3).
export function soundOf(number, quack = false) {
  const S = SOUNDS(), n = number === S.substitute.from ? S.substitute.to : number;
  const priority = n === S.priority.stall.sound ? S.priority.stall.value : n === S.priority.no.sound ? S.priority.no.value : S.priority.base - n;
  return { number: n, name: S.names[n], member: quack ? GLANCE().quack : `${S.names[n]}${S.suffix}`, priority }; // the duck game plays the quack for a driver's voice (duck.glance)
}
export const soundCount = () => SOUNDS().names.length;
export const driverVoice = slot => slot; // @math the numbers 0 to 7 are the drivers' own voices

// The engine's pitch in cents for a speed word (every frame).
export const enginePitch = speed => { const E = SOUNDS().engine; return speed * E.perSpeed - E.offset; };

// The songs of a race: the member name (without extension) of the cup's race.
export function raceSong(cup, bonus, race) {
  const S = SOUNDS(), index = cup + bonus - 1, slot = S.raceSongs[race - 1]; // @math the cup index counts from 0, the race from 1
  return slot === S.cups[index].length ? S.finalSong : S.cups[index][slot]; // the slot after the cup's three songs is the final song
}
export const menuSong = () => SOUNDS().songs[0]; // @math MAINMENU is the first song
export const boardSong = () => SOUNDS().boardSong;
export const gameOverSong = () => SOUNDS().songs[2]; // @math GAMEOVER is the third song
export const leaderboardSong = () => SOUNDS().songs[1]; // @math LEADRBRD is the second song
