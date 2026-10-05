// The Info menu's CREDITS (menu.credits): five pages of twelve lines over the menu picture; a car drives along the lines and the text appears behind it.
import { K } from '../evidence/k.js';
import { frameMs } from './clock.js';

const C = () => K({ routine: 0xefb0, textRoutine: 0xeee4, copy: 0x275cd, grab: 0x272c7, put: 0x273ee, sprite: 0x26fd0, table: 0x32f0, stride: 0x2c, pages: 5, perPage: 12, firstRow: 0x4c, rowStep: 0xa, glyph: 8, screen: 320, background: 'CHECK.PCX', car: { width: 0x26, height: 0x1c, above: 0xa, frames: 8, slots: 8, step: 8, overrun: 0x2e, leave: 0x10, slotBytes: 0x31e0, frameBytes: 0x428 }, waits: { stepAbove: 4, tailAbove: 12, tailMax: 0x88 }, lines: ['PROGRAMMING AND DESIGN', 'ANDREW EDWARDSON', '', 'ART AND DESIGN', 'SHAUN GADALLA', '', 'SOUND CODE', "JIM DOSE'", '', 'MUSIC', 'MARK KLEM', '', 'VERY SPECIAL', 'THANKS TO', '', 'JOHN @J.D.@ HAYNES', 'BOYD MILLER', 'TOM HALL', 'STEPHEN HORNBACK', 'JIM DRYBURGH', 'WILLIAM SCARBORO', 'STEVEN BLACKBURN', '', '', 'THE APOGEE BETA TEAM', 'THE BEST IN THE WORLD!', '', 'THE TECH SUPPORT CREW', '', 'STEVE QUARELLA', 'LEE JACKSON', 'JOE SELINSKE', 'JOE SIEGLER', 'KEVIN GREEN', 'MR D.FISH', '', 'GEORGE AND SCOTT', 'YOUR SUPPORT MADE IT', 'A REALITY', '', 'THANKS TO ALL AT APOGEE', 'THE KINGS OF ACTION', '', 'SOFTWARE CREATIONS', 'THE WACKY WHEELS', 'LIFELINE!', '', '', 'TO OUR CHILDREN', 'FOR BEING EXTRA SPECIAL', '', 'THEO', 'LAURA', 'GEORGIA', 'KATIE', '', 'AND TO THE PEOPLE', 'WHOSE LOVE MADE', 'IT HAPPEN', ''] }, 'menu.credits');

export const creditsModel = () => { const { lines, ...rest } = C(); return rest; };

// The text routine's record of a page's lines (obj1+0xeee4): per line its text, its first column (centred), its row and its last column (0 for a blank line).
export function pageLines(page) {
  const c = C(), first = (page - 1) * c.perPage; // @math pages count from 1
  return c.lines.slice(first, first + c.perPage).map((text, k) => {
    const x = text ? (c.screen - c.glyph * text.length) / 2 : 0; // @math centred
    return { text, x, y: c.firstRow + c.rowStep * k, end: text ? x + c.glyph * text.length - 1 : 0 }; // @math the last column of the text
  });
}

// The cell the car's step copies from the text (obj1+0xf07b to +0xf0cb): at the car's left edge going right, at its right edge going left.
const cellOf = (c, rows) => ({ x: c.dir ? c.x : c.x + C().car.width, y: rows[c.line - 1].y });

// A page's first state: the car at the first line's start, going right, the first cell copied.
export function startPage(page, slot) {
  const rows = pageLines(page), c = { page, line: 1, dir: 1, x: rows[0].x, slot, frame: 0, phase: 'run', counter: 0, cells: [] };
  return { ...c, cells: [cellOf(c, rows)] };
}
export const startCredits = () => startPage(1, 0); // @math the first page, the first slot

// How long the current state is shown: the routine waits until the 136 Hz counter is above a limit.
export function stepTicks(c) { const W = C().waits; return (c.phase === 'run' ? W.stepAbove : W.tailAbove) + 1; } // @math above the limit means limit + 1 ticks
export const stepMs = c => frameMs(stepTicks(c)); // counts of the 136 Hz counter

// The line the car goes to after the line `line` (obj1+0xf1b0 to +0xf264): the next one, or the one after a blank, or null when the page is done.
function nextLine(rows, line) {
  const per = C().perPage, end = n => (n > per ? 0 : rows[n - 1].end); // the table is zero after its twelve entries
  let n = line + 1; // @math the next line
  if (n > per) return null;
  if (end(n) === 0) n = line + 2; // @math one blank line is skipped
  if (n >= per && end(n) === 0) return null;
  return n;
}

// One step of the routine after the picture of `c` was shown and its wait is over; `input` is { escape, advance }. Returns { state } or { finished: true }.
export function stepCredits(c, input = {}) {
  const K_ = C(), car = K_.car, rows = pageLines(c.page), slotAfter = s => (s + 1 >= car.slots ? 0 : s + 1); // @math the next slot, wrapping
  const frameAfter = f => (f + 1 >= car.frames ? 0 : f + 1); // @math the next frame, wrapping
  if (c.phase === 'run') {
    if (input.escape) return { finished: true };
    const frame = frameAfter(c.frame), moved = { ...c, frame, x: c.x + (c.dir ? car.step : -car.step) }, row = rows[c.line - 1];
    if (c.dir ? moved.x <= row.end : moved.x > row.x - car.overrun) return { state: { ...moved, cells: [...c.cells, cellOf(moved, rows)] } };
    const n = nextLine(rows, c.line);
    if (n === null) return { state: { ...moved, phase: 'tail', counter: 0, x: moved.x + (c.dir ? car.leave : -car.leave) } };
    const dir = c.dir ? 0 : 1, to = rows[n - 1], next = { ...moved, line: n, dir, slot: slotAfter(c.slot), x: dir ? to.x : to.end - car.width };
    return { state: { ...next, cells: [...c.cells, cellOf(next, rows)] } };
  }
  const counter = c.counter + 1; // @math one more step
  if (counter > K_.waits.tailMax || input.advance) return c.page >= K_.pages ? { finished: true } : { state: startPage(c.page + 1, c.slot) };
  if (input.escape) return { finished: true };
  return { state: { ...c, counter, frame: frameAfter(c.frame) } };
}
