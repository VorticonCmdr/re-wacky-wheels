// The saved game of a single-player cup (race.save-game, STATIC): the record the game writes at each cup race start, kept as plain data, and what a restore sets from it.
import { K } from '../evidence/k.js';

const SAVE = () => K({ record: 0x174e4, bytes: 0x74, fields: { slot: 4, second: 8, laps: 0xc, class: 0x10, cup: 0x14, race: 0x18, points: 0x1c, slots: 0x3c, counter: 0x5c, held: 0x60 }, menu: ['RESTORE SAVED GAME', 'START NEW GAME'], settings: { engine: 0x175d6, pack: 0x175da } }, 'race.save-game');

export const restoreItems = () => SAVE().menu;

// The record at a cup race's start: the driver, the setup items of the menus (class, laps), the cup with its pack, the race, the points and driver slots of the eight racers, the pickup counter
// and the held item, and the engine.
export function makeSave({ humanSlot, flow, cup, totals, slots, carry, engine }) {
  return { slot: humanSlot, classItem: flow.class, lapsItem: flow.laps, cup: cup.cup, bonus: cup.bonus, race: cup.race, points: totals ? [...totals] : slots.map(() => 0), slots: [...slots], counter: carry?.counter ?? 0, held: carry?.held ?? 0, engine };
}

// What a restore sets (obj1+0xfd89 to +0xfede): the page's fields from a record.
export function restoreOf(record) {
  return { humanSlot: record.slot, flow: { class: record.classItem, laps: record.lapsItem, races: record.bonus ? 2 : 1, engine: record.engine }, cup: { cup: record.cup, bonus: record.bonus, race: record.race, bonusRace: false }, totals: [...record.points], slots: [...record.slots], carry: { counter: record.counter, held: record.held } }; // @math the race type item 2 is the bonus pack
}
