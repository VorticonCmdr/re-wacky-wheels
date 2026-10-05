// The constants of the Wacky Duck Shoot (duck.race-rules, duck.racers, duck.pictures, duck.glance, STATIC), apart from the game modules so that the car and control routines can read them.
import { K } from '../evidence/k.js';

export const RULES = () => K({ flow: 0x1037c, flag: 0x1ec74, engine: 2, level: 4, racers: 7, timer: 0x4b0, scoreWord: 0x1edb4, scoreCap: 0x63, heading: 0x1e0, throttleStep: 6, crates: { prepare: 0x113f0, aboveKind: 2, kind: 2 }, zones: 6, firstTrack: 16, bonusTrack: 37 }, 'duck.race-rules');
export const RACERS = () => K({ init: 0x6f90, placement: 0x6f24, walker: 0x6d68, slots: 0xbf00, rounds: 0x6eac, stepSkip: 0x18cf1, stun: 0x189ec, hit: 0x118a4, state: 2, speedEntry: 50, gap: 0x104, hitPoints: 1, range: 18, stunFrames: 4, crashPictures: 4, points: { plain: 1, helmeted: 2 }, helmetedFirst: 1, helmetedLimit: 0x15, sounds: { hit: 0xff, boom: 0xd } }, 'duck.racers');
export const PICTURES = () => K({ member: 'DIGGER.SP', frames: 16, frameBytes: 0x428, width: 38, height: 28, plain: 0, helmeted: 8, loader: 0x227e0, explosion: { member: 'GENEF.SP', at: 7641, frames: 4 }, icon: { at: 14426, width: 19, height: 14 }, crashTable: 0x1c7f0 }, 'duck.pictures');
export const HUD = () => K({ block: 0x1a9e9, timer: { x: 264, y: 112 }, score: { x: 26, y: 32, advance: 10, places: 2 }, icon: { x: 26, y: 14 }, name: { x: 4, y: 50 } }, 'duck.hud');
export const GLANCE = () => K({ pass: 0x12bf4, flagFrames: [0, 2, 4, 6], quack: 'QUACK.VOC', zones: [3, 1], sizeClass: 2 }, 'duck.glance');

export const duckRules = () => RULES();
export const duckPictures = () => PICTURES();
export const duckSounds = () => RACERS().sounds;
export const duckGlance = () => GLANCE();

export const FLOW = () => K({ menu: { items: ['REGULAR ZONES', 'BONUS PACK ZONES'] }, chooser: { pictures: ['SBCS.PCX', 'BSBCS.PCX'], routine: 0x93a8, first: 6, last: 11, indices: [5, 10], blink: 13, pass: 8, pause: 0x14, sound: 0x12 }, songs: ['BANSHI', 'KARD', 'TURBO', 'BRICWALL', 'STARBRAI', 'FLIGHT'], loading: { text: 'LOADING ZONE' }, intro: { title: { text: 'THE WACKY DUCK SHOOT', x: 50, y: 10 }, lines: [{ text: 'YOU HAVE TWO MINUTES TO', x: 68, y: 30 }, { text: 'BLAST AS MANY DUCKS AS YOU CAN!', x: 36, y: 40 }], ducks: [{ x: 76, y: 60, helmeted: false, frame: 7 }, { x: 205, y: 60, helmeted: true, frame: 1 }], shooters: { text: 'THE WACKY DUCK TOP SHOOTERS', x: 11, y: 110, rowsAt: 130, rowStep: 10, x2: 84 } }, end: { title: { text: 'YOUR DUCK SCORE', x: 77, y: 10 }, score: { x: 138, y: 60, advance: 22, at: 0x13f0, frameBytes: 0x27e, width: 22, height: 29 }, prompt: { text: 'PRESS FIRE', x: 120, y: 180 } }, entry: { title: 'DUCK SHOOT HALL OF FAME', y: 10, max: 16 }, table: { names: ['SHAUN', 'ANDY', 'NUGGET', 'RUEBEN'], scores: [16, 12, 8, 6], padded: 16, file: 'WACKY.DTT' }, pause: { back: 'BACK TO ZONE', leave: 'LEAVE ZONE' } }, 'duck.flow');
