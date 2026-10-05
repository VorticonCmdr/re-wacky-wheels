// The leaderboard after a race (race.leaderboard, STATIC): the racers sorted by points and where each row's name, points and picture go.
import { K } from '../evidence/k.js';
import { driverName } from './drivers.js';

const BOARD = () => K({ routine: 0x1bff0, drawer: 0x1b270, sortAt: 0x1c0f2, background: 'ORDER.PCX', titleParts: [' LEADER BOARD AFTER ', ' '], raceNames: { race: 'RACE ', final: 'FINAL', bonus: 'BONUS' }, final: 5, header: 'POINTS', titleY: 4, tileAdvance: 11, screen: 320, pointsAt: [[55, 34], [223, 34]], firstY: 50, rowStep: 38, perColumn: 4, columns: [2, 170], nameWidth: 8, glyph: 8, pointsGap: 8, pictureGap: 8, picture: [38, 28], animation: { frames: 8, counts: 12 }, song: 'ASHES' }, 'race.leaderboard');

export const boardBackground = () => BOARD().background;

// The racers sorted by points, highest first, by the routine's exchange sort (which does not keep equal points in order). `totals[n]` are the points of racer n, `slots[n]` its driver.
export function boardRows(totals, slots) {
  const rows = totals.map((points, n) => ({ racer: n, slot: slots[n], points }));
  for (let i = 0; i < rows.length - 1; i++) for (let j = i + 1; j < rows.length; j++) if (rows[i].points < rows[j].points) { const t = rows[i]; rows[i] = rows[j]; rows[j] = t; }
  return rows;
}

// The title: the parts around the race's name (RACE n, FINAL or BONUS).
export function titleOf(race, bonus = false) {
  const B = BOARD(), name = bonus ? B.raceNames.bonus : race === B.final ? B.raceNames.final : `${B.raceNames.race}${race}`;
  return `${B.titleParts[0]}${name}${B.titleParts[1]}`;
}

// What the screen holds: the title and its column, the header texts and the rows with their columns (x of the name, the points and the picture) and rows. `humanSlot` is a driver slot or a list of them: in the two player race both humans' pictures animate (a grab of the running game, frame 5 for both).
export function boardLayout(rows, humanSlot, race, bonus = false) {
  const B = BOARD(), title = titleOf(race, bonus);
  const titleX = Math.floor(Math.abs(B.screen - B.tileAdvance * title.length) / 2); // @math the title is centred: half of what its width leaves of the screen
  return {
    title, titleX, titleY: B.titleY, header: B.header, headerAt: B.pointsAt,
    rows: rows.map((r, k) => {
      const x = B.columns[Math.floor(k / B.perColumn)], y = B.firstY + B.rowStep * (k % B.perColumn);
      const name = ` ${driverName(r.slot)}`.padEnd(B.nameWidth, ' '), points = String(r.points).padStart(2, '0'); // @math a leading 0 for one digit
      const pointsX = x + B.glyph * name.length + B.pointsGap;
      return { ...r, x, y, name, points, pointsX, pictureX: pointsX + B.glyph * points.length + B.pictureGap, human: [humanSlot].flat().includes(r.slot) };
    }),
  };
}

// The slot frame the human's picture shows after `counts` counts of the 136 Hz counter on the board.
export const humanFrame = counts => { const A = BOARD().animation; return Math.floor(counts / A.counts) % A.frames; };
export const boardPicture = () => BOARD().picture;
export const boardSong = () => BOARD().song;
