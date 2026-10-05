// The constants of the two player modes (versus.layout, versus.shootout-rules, STATIC), apart from the game modules so that the render and the shot code can read them.
import { K } from '../evidence/k.js';

export const LAYOUT = () => K({ background: 'BLANK.PCX', viewRow: 100, shift: 100, names: { x: 4, y: [101, 1] }, counter: { x: 154, y: [100, 0], advance: 10 }, score: { text: 'SCORE', x: 221, y: [101, 1], box: [38, 8], boxColour: 46, digitsX: [263, 273], digitsY: [100, 0] }, held: { x: 293, y: [178, 78] }, flip: { first: 110, rows: 90, clearAfter: 300, routine: 0x26ec2, block: 0x1fb9e } }, 'versus.layout');

export const SHOOT = () => K({
  flag: 0x28be2, hitsWord: 0x1eda0, hitsMenu: [5, 10, 15, 20], headings: [0x1e0, 0x5a0], startPairs: [0, 1], throttleStep: 6,
  animation: { first: 2, restart: 1, lag: 1, flame: 2 }, compass: { table: [6, 7, 0, 1, 2, 3, 4, 5], at: 0x1d328, init: 0x2634f, routine: 0x1876c }, wreck: { sound: 0xd, shotTypes: 2, pictures: 4, ready: 12, handler: 0x11ba2, iceToHog: 0x11a7f, headOn: { throttle: 100, frames: [0, 1, 7], site: 0x13482, both: 0x13600 } },
  message: { y: 92, counts: 400, double: 'THAT WAS A DOUBLE KILL!', waxed: ' HAS BEEN WAXED!', race: 'WHAT A CRASH!', routine: 0x1a414, roundEnd: 0x21229, pageGate: 0x3e80, margin: 4, glyph: 8, width: 320 },
}, 'versus.shootout-rules');

export const FLOW = () => K({
  titles: ['PLAYER ONE', 'PLAYER TWO'], titleRoutine: 0xa3ec, cross: { member: 'GENEF.SP', at: 11897, frameBytes: 1064, width: 38, height: 28, word: 0x1eae8, drawn: 0x4680 }, marker: { frames: 2, pair: [0, 2], table: 0xa878 },
  hits: { items: [' PLAY FOR 5  HITS ', ' PLAY FOR 10 HITS ', ' PLAY FOR 15 HITS ', ' PLAY FOR 20 HITS '], routine: 0xbc63 }, flow: { entry: 0x100f2, loop: 0x1027d, loading: 'LOADING ZONE', loadingAt: 0x7d2d },
  winner: { routine: 0x1bbd8, picture: 'ORDER.PCX', won: ' IS THE OVERALL WINNER!', draw: 'YOU HAVE BOTH DRAWN!', textY: 54, pictureY: 86, picture1X: 141, drawX: [120, 160], size: [38, 28], hint: 'PRESS FIRE', hintY: 180, screen: 320, glyph: 8 },
}, 'versus.flow');

export const RACE = () => K({
  flag: 0x28bdc, menu: [' RACE HEAD TO HEAD  ', ' RACE WITH ALL CARS '], lastRacer: [1, 7], firstComputer: 2, secondDx: 0x14, headings: [0x1e0, 0x1e0], start: 0x2062e, aiSkip: 0x18d0d, helperGate: 0x18b2d, progress: 0x2b44, finish: 0x2150c,
  animation: { first: 1, flame: 1, jiggle: [0, 1], dustStart: 1 }, hud: { block: 0x1a92c, timerY: [112, 12], speedDy: 100, placeX: 4, placeY: [111, 11], placeFrom: 0x166e, lapY: [164, 64], figureRows: [0x78, 0x14] }, points: 9, firstPlace: 8, crash: 'WHAT A CRASH!',
}, 'versus.race-rules');

export const TAUNT = () => K({
  keys: { first: { scans: [0x3b, 0x40], base: 0x3a }, second: { scans: [2, 7], base: 1 } }, limit: 6, refuse: 0x1a, column: 0x8d, rows: [20, 120], figureBlocks: 0x1b210, voices: { files: 5, prefix: 'GIG', suffix: '.VOC', table: 0xa490 },
  routines: { draw: 0x1aade, input: 0x1d70e, voice: 0x1d628, scans: 0x1fb11 },
}, 'versus.taunts');
