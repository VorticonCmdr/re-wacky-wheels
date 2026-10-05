// The cup board in front of a cup (race.cup-board, STATIC): which cup is selected, which palette entries of the three cup bars and the race labels are shown, and the blinking.
import { K } from '../evidence/k.js';

const BOARD = () => K({ routine: 0x832c, helper: 0x82d0, boardNames: { prefixes: ['', 'B'], base: 'SB', suffix: '.PCX', paletteFrom: 1 }, cups: 3, barEntries: [0xe9, 0xec, 0xef], labelEntries: [5, 9], pass: 8, keyPause: 20, blinkPasses: 13, fade: { step: 4, max: 63 }, sound: 0x12 }, 'race.cup-board');

export const boardPass = () => BOARD().pass; // counts of the 136 Hz counter a pass of the loop waits
export const boardSound = () => BOARD().sound;

// The names of the three board pictures and of the one the palette comes from.
export function boardFiles(bonusPack) {
  const B = BOARD().boardNames, prefix = B.prefixes[bonusPack ? 1 : 0]; // @math the bonus pack picks the second prefix
  return { pictures: Array.from({ length: BOARD().cups }, (_, k) => `${prefix}${B.base}${k + 1}${B.suffix}`), palette: `${prefix}${B.base}${B.paletteFrom}${B.suffix}` }; // @math the cups count from 1
}

// The board on entry for `cup` (1 to 3): the palette with the three bars and the labels hidden and the selected bar shown (obj1+0x86ab to +0x875c). `palette` is the 6-bit palette of the first board.
// In the time trial a race chosen before (`lastRace`, 1 to 5, or null) has its label shown at once (obj1+0x8770 to +0x87d0).
export function enterBoard(palette, cup, lastRace = null) {
  const B = BOARD(), working = Uint8Array.from(palette);
  for (const e of B.barEntries) hide(working, e);
  show(working, palette, B.barEntries[cup - 1]); // @math the cups count from 1
  for (let e = B.labelEntries[0]; e <= B.labelEntries[1]; e++) hide(working, e);
  if (lastRace !== null) show(working, palette, labelEntry(lastRace));
  return { cup, palette: working, original: palette, blinkCounter: 0, blinkHidden: 0, pending: null, wait: 0, chosen: null, mode: 'cup', race: lastRace ?? 1 }; // @math the race counts from 1
}

// The palette entry of a race's label: the race plus 4 (the labels are the entries 5 to 9).
const labelEntry = race => BOARD().labelEntries[0] + race - 1; // @math the race counts from 1

// The helper obj1+0x82d0: an entry takes the colour of the entry 0 (hidden) or its original colour (shown).
function hide(palette, entry) { palette.copyWithin(entry * 3, 0, 3); } // @math three components an entry
function show(palette, original, entry) { palette.set(original.subarray(entry * 3, entry * 3 + 3), entry * 3); } // @math three components an entry

// What the rest of a pass does once the key wait is over (obj1+0x8cbd to +0x9369): the blink, then Enter or Space leaves with the cup, Up or Down changes it, Esc leaves to the menu.
function act(b0, keys, trial) {
  const B = BOARD(), b = { ...b0 };
  b.blinkCounter += 1;
  if (b.blinkCounter > B.blinkPasses - 1) { // every 13th pass the selected bar blinks
    b.palette = Uint8Array.from(b.palette);
    const entry = B.barEntries[b.cup - 1]; // @math the cups count from 1
    if (b.blinkHidden === 0) { hide(b.palette, entry); b.blinkHidden = 1; } else { show(b.palette, b.original, entry); b.blinkHidden = 0; }
    b.blinkCounter = 0;
  }
  if (keys.fire) {
    if (!trial) return { board: { ...b, chosen: b.cup }, leave: 'cup' };
    b.palette = Uint8Array.from(b.palette); show(b.palette, b.original, B.barEntries[b.cup - 1]); show(b.palette, b.original, labelEntry(b.race)); // the time trial: the bar stays lit and the track choice starts (obj1+0x8df1 to +0x8e92)
    return { board: { ...b, mode: 'track', blinkHidden: 0, blinkCounter: 0 }, leave: null };
  }
  if (keys.down || keys.up) { // the cup changes by one with wrapping, and its bar is shown again
    b.cup = keys.up ? (b.cup === 1 ? B.cups : b.cup - 1) : (b.cup === B.cups ? 1 : b.cup + 1); // @math the cups wrap from 3 to 1 and back
    b.palette = Uint8Array.from(b.palette); show(b.palette, b.original, B.barEntries[b.cup - 1]); // @math the cups count from 1
  }
  return { board: b, leave: keys.escape ? 'menu' : null };
}

// One pass of the loop (8 counts): `keys` are { up, down, fire, escape }. Up, Down and Esc make the loop wait 20 counts from the key before the rest of the pass.
export function stepBoard(b0, keys, trial = false) {
  const B = BOARD(), b = { ...b0 };
  if (b.pending) {
    b.wait -= B.pass;
    if (b.wait > 0) return { board: b, leave: null };
    const keysNow = b.pending; b.pending = null;
    return b.mode === 'track' ? actTrack(b, keysNow) : act(b, keysNow, trial);
  }
  if (b.mode === 'track') {
    if (keys.up || keys.down || keys.left || keys.right || keys.fire || keys.escape) { b.pending = keys; b.wait = B.keyPause; }
    return { board: b, leave: null };
  }
  if (keys.up || keys.down || keys.escape) { b.pending = keys; b.wait = B.keyPause; return { board: b, leave: null }; }
  return act(b, keys, trial);
}

// The track choice of the time trial (obj1+0x9021 to +0x9260): Up and Left the previous race, Down and Right the next (wrapping over the five), the label of the race lit; fire shows the hall of
// fame of the race; Esc hides the label and goes back to the cup choice.
const RACES = 5; // @math five races to a cup
function actTrack(b0, keys) {
  const B = BOARD(), b = { ...b0 };
  b.palette = Uint8Array.from(b.palette);
  if (keys.fire) return { board: b, leave: 'hall' };
  if (keys.escape) { hide(b.palette, labelEntry(b.race)); return { board: { ...b, mode: 'cup' }, leave: null }; }
  const previous = keys.up || keys.left, next = keys.down || keys.right;
  if (previous || next) hide(b.palette, labelEntry(b.race));
  if (previous) b.race = b.race === 1 ? RACES : b.race - 1; // @math the race wraps from 1 to the last of five
  if (next) b.race = b.race === RACES ? 1 : b.race + 1; // @math and from the last back to 1
  if (previous || next) show(b.palette, b.original, labelEntry(b.race));
  return { board: b, leave: null };
}
