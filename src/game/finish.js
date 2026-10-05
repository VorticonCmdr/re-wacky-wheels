// What the finish of a race shows: the labels of the first three finishers, the message and the points (race.finish-flow, STATIC).
import { K } from '../evidence/k.js';

const FLOW = () => K({ finishBlock: 0x21609, labelRoutine: 0x2770, messageRoutine: 0x1d264, stage1: 0x21813, stage2: 0x21919, addPoints: 0x21cf0, delay: 800, label: { texts: ['1ST', '2ND', '3RD'], textX: 240, pictureX: 270, firstY: 4, step: 28, places: 3 }, points: { 1: [9, 6, 3], 2: [12, 9, 6], 3: [15, 12, 9] }, messages: [['GOOD DRIVING. KEEP IT UP!', 'EXCELLENT SKILL!', 'FANTASTIC PIECE OF DRIVING!', 'BRILLIANT. NOW COMES THE BIG ONE!', 'YOU ARE TOO GOOD!'], ['WELL DONE!', 'WOW! WHAT A RACE!', 'THESE GUYS DON\'T KNOW WHAT HIT THEM!', 'GLORY IS A SMALL STEP AWAY!', 'THE FINAL WAS BREATHTAKING!'], ['THAT WAS CLOSE!', 'YOU LIVE TOO CLOSE TO THE EDGE!', 'KEEP DOING WHAT YOU\'RE DOING!', 'GO FOR GLORY!', 'YOU DESERVED TO WIN!']], trialMessage: 'TIMES HAVE BEEN RECORDED', box: { y: 100, border: 0x26, fill: 0x2c, height: 16, margin: 4, glyph: 8, screen: 320 } }, 'race.finish-flow');

// The label of a racer that finished 1st, 2nd or 3rd: its text and the row of both, or null for the later places.
export function labelOf(place) {
  const L = FLOW().label;
  return place >= 1 && place <= L.places ? { text: L.texts[place - 1], textX: L.textX, pictureX: L.pictureX, y: L.firstY + L.step * (place - 1) } : null; // @math the places count from 1
}
export const labelCount = () => FLOW().label.places;

// The points of the places 1 to 3 for a class (1 to 3), 0 for the later places and the time trial.
export function pointsOf(cls, place) {
  const P = FLOW().points[cls];
  return P && place >= 1 && place <= P.length ? P[place - 1] : 0; // @math the places count from 1
}

// The message of stage 1 for the human's place and the race of the cup (1 to 5), or null: the box's text and its column.
export function messageOf(cls, place, race) {
  const F = FLOW(), B = F.box, trial = cls === Object.keys(F.points).length + 1; // @math the class after the three points classes is the time trial
  const text = trial ? F.trialMessage : place >= 1 && place <= F.messages.length ? F.messages[place - 1][race - 1] : null; // @math the places and the races count from 1
  return text === null ? null : { text, x: Math.floor(Math.abs(B.screen - B.glyph * text.length) / 2), y: B.y }; // @math the column is half of what the text leaves of the screen
}
export const messageBox = () => FLOW().box;

// Counts of the 136 Hz counter between stage 1 and stage 2.
export const stageDelay = () => FLOW().delay;
