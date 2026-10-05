// The cup of five races and the loading card in front of each (race.cup-flow, STATIC).
import { K } from '../evidence/k.js';

const FLOW = () => K({ loop: 0xfff3, card: 0x7928, selectAt: 0x7a6b, table: 0x7910, races: 5, bannerY: 92, banner: { border: 0x26, fill: 0x2c, height: 16, margin: 4, glyph: 8, screen: 320 }, parts: { loading: ' LOADING', race: ' RACE ', final: ' FINAL ', bonus: ' BONUS! ', space: ' ' }, cupOffsets: [0, 5, 10, 21, 26, 31], bonusTrack: 7, preview: { prefix: 'SHRINK', suffix: '.PCX' }, fade: { step: 4, max: 63 }, cups: ['BRONZE', 'SILVER', 'GOLD'], bonusPack: 3 }, 'race.cup-flow');

export const racesInCup = () => FLOW().races;
export const cupNames = () => FLOW().cups;

// A new cup: the cup (1 Bronze, 2 Silver, 3 Gold), the bonus pack (0 or 3) and the first race.
export const startCup = (cup = 1, bonusPack = false) => ({ cup, bonus: bonusPack ? FLOW().bonusPack : 0, race: 1, bonusRace: false });

// The track of the cup's race (obj1+0x7a6b to +0x7b57).
export function trackOf(c) {
  const F = FLOW(), index = c.cup + c.bonus - 1; // @math the cup index counts from 0, the cup from 1
  return c.bonusRace && index === 0 ? F.bonusTrack : c.race + F.cupOffsets[index]; // @math the Bronze cup's bonus race is the track 7
}

// The text of the loading banner for the cup's race.
export function cardText(c) {
  const P = FLOW().parts, name = c.bonusRace ? P.bonus : c.race === FLOW().races ? P.final : `${P.race}${c.race}${P.space}`;
  return `${P.loading}${name}`;
}

export function previewName(track) { const P = FLOW().preview; return `${P.prefix}${track}${P.suffix}`; }

// The banner's box and text position: 8 per character plus 8 wide, centred, at the card's row.
export function bannerOf(text) {
  const F = FLOW(), B = F.banner, width = B.glyph * text.length + B.glyph;
  return { x: Math.floor((B.screen - width) / 2), y: F.bannerY, width, height: B.height, margin: B.margin, border: B.border, fill: B.fill }; // @math centred
}

// The palette of the preview after `step` calls of the fade: every entry rises by 4 a call to its value (obj1+0x22cf8).
export const fadeLevel = step => { const F = FLOW().fade; return Math.min(F.step * step, F.max + 1); }; // @math the fade ends at the full 6-bit value
export const fadeSteps = () => { const F = FLOW().fade; return Math.ceil((F.max + 1) / F.step); }; // @math 64 levels

// The bonus notice (race.bonus-notice): shown after the final leaderboard of a champion class regular Bronze cup when the human stands on the podium, once; it leads to the bonus race (track 7).
const BONUS = () => K({ gate: 0x1c82b, routine: 0x1a268, lines: [' YOU HAVE WON THE RIGHT TO ENTER ', ' THE BONUS TRACK! THIS GIVES YOU ', ' THE CHANCE TO GET MORE POINTS!! '], ticks: 0x220, class: 3, cup: 1, box: { border: 0x26, fill: 0x2c, advance: 8, extra: 8, lineStep: 9, margin: 4, screen: [0x140, 0xc8] }, track: 7 }, 'race.bonus-notice');
export const bonusOffered = (c, cls, playerGroup) => playerGroup !== 0 && cls === BONUS().class && c.cup === BONUS().cup && c.bonus === 0 && !c.bonusRace;
export const noticeTicks = () => BONUS().ticks;
export const startBonusRace = c => ({ ...c, race: FLOW().races, bonusRace: true }); // the loop makes it the race 5 again (obj1+0x1c8b8)

// The notice's box and lines (obj1+0x1a268): centred on the screen, the lines 4 in from its corner and 9 rows apart.
export function noticeLayout(lines = BONUS().lines) {
  const B = BONUS(), X = B.box, width = X.advance * lines[0].length + X.extra, height = X.lineStep * lines.length + X.extra;
  const x = Math.floor(Math.abs(X.screen[0] - width) / 2), y = Math.floor(Math.abs(X.screen[1] - height) / 2); // @math centred, the difference halved
  return { x, y, width, height, border: X.border, fill: X.fill, lines: lines.map((text, i) => ({ text, x: x + X.margin, y: y + X.margin + X.lineStep * i })) };
}

// The kid mode's explanation (menu.kid-notice): nine lines in the same box, until a key.
export const kidNoticeLines = () => K({ lines: [' THIS MODE IS FOR YOUNG CHILDREN ', ' WHO MAY EXPERIENCE DIFFICULTY   ', ' CONTROLLING THE CARS.           ', '                                 ', ' THE CHILD ONLY HAS TO STEER THE ', ' VEHICLE IN THIS MODE AND DOES   ', ' NOT NEED TO ACCELERATE AS THE   ', ' COMPUTER FIXES THE SPEED OF THE ', ' CAR.                            '], wait: 'key' }, 'menu.kid-notice').lines;
