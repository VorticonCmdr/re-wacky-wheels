// The class and the engine of a race: the computer racers' level and catch-up threshold, the speed table choice and the kid mode (race.class-levels, STATIC).
import { K } from '../evidence/k.js';

const LEVELS = () => K({ routine: 0x9db8, table: 0x9da8, classWord: 0x28bb2, engineWord: 0x1ee5a, levelWord: 0x28b84, thresholdWord: 0x1ece0, childWord: 0x1edb0, classes: { 1: { threshold: 8, levels: [0x59, 0x5a] }, 2: { threshold: 4, levels: [0x5e, 0x5c] }, 3: { threshold: 1, levels: [0x63, 0x5e] }, 4: { threshold: 0x14, levels: [0x54, 0x54] } }, kid: { class: 1, item: 5, throttle: 0x36, slowdown: 12, floor: 4 } }, 'race.class-levels');

// The menu's class item (1 AMATEUR, 2 PRO, 3 CHAMPION, 4 TIME TRIAL, 5 KID MODE) as the game's class word and child flag.
export function classOf(item) {
  const L = LEVELS();
  return item === L.kid.item ? { class: L.kid.class, child: true } : { class: item, child: false };
}

// The level and the catch-up threshold of a class for an engine (1 the 12 horsepower engines, 2 the 6 horsepower ones).
export function classSetup(cls, engine) {
  const c = LEVELS().classes[cls], first = 1; // @math the engine word 1 picks the first level
  return { threshold: c.threshold, level: c.levels[engine === first ? 0 : 1], trial: cls === Object.keys(LEVELS().classes).length }; // @math the last class is the time trial
}

export const kid = () => LEVELS().kid;

// The setup items the class forces (setup.forced-items): the menus of the sequence that are skipped, and the laps and engine the class sets without them.
const FORCED = () => K({ trial: { item: 4, skip: ['laps'], laps: 6 }, kid: { item: 5, skip: ['laps', 'engine'], laps: 3, engine: 2 } }, 'setup.forced-items');
// The notice a class item shows before the setup goes on ('kid': the explanation of the kid mode, menu.kid-notice), or null.
export const noticeOf = item => (item === FORCED().kid.item ? 'kid' : null);
export function forcedOf(item) {
  const F = FORCED(), c = item === F.trial.item ? F.trial : item === F.kid.item ? F.kid : null;
  return { skip: c ? c.skip : [], laps: c ? c.laps : null, engine: c && c.engine ? c.engine : null };
}
