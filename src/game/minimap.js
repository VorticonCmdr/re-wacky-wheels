// The overhead map of the race screen (hud.minimap-draw, STATIC; the dots are hud.minimap-observed, PROVEN): the picture of the cup's race, the rectangle kept from the first frame and
// the racers' dots. The game draws it when the OVERHEAD MAP word is on.
import { K } from '../evidence/k.js';
import { switchOf } from './menus.js';

const MM = () => K({ routine: 0x1a4ac, panel: 0x2f80, gateSwitch: 0x175d0, gateWord: 0x28ca0, rect: [0, 60, 78, 50], pictureBytes: 3900, pictures: 5, files: ['BRONZEM.SP', 'SILVERM.SP', 'GOLDM.SP', 'BONUSB.SP', 'BONUSS.SP', 'BONUSG.SP'], classWord: 0x28bb6, raceWord: 0x28b88, bias: 0x400, limit: 0x7ff, playerColour: 255, otherColour: 90, rowOrigin: 60, tableBytes: 2048 }, 'hud.minimap-draw');

export const minimapRect = () => MM().rect;
export const minimapFiles = () => MM().files;

// Whether the overhead map is on: the OVERHEAD MAP switch of the race screen options.
export const minimapOn = settings => settings.switches[switchOf(MM().gateSwitch)] === 1;

// The picture of a race: the file of the cup (the class word less 1: the cup and the bonus pack's 3) and the race's picture in it, from the archive's members; null where the file is absent.
export function minimapPicture(members, { cup, bonus, race }) {
  const M = MM(), data = members.get(M.files[cup + bonus - 1]); // @math the class word counts from 1
  if (!data) return null;
  const at = Math.min(Math.max(race - 1, 0), M.pictures - 1) * M.pictureBytes; // @math the race counts from 1; the loader reads the race number's picture
  return data.subarray(at, at + M.pictureBytes);
}

// The dots of the racers (obj1+0x1a529 to +0x1a5f0), in the order the drawer plots them: [{ x, y, colour }] for the world positions `at` ([{ x, y }], racer 0 first) and the tables of MAP.XY.
export function minimapDots(at, mapxy) {
  const M = MM(), clamp = v => Math.min(Math.max(v - M.bias, 0), M.limit);
  return at.map((p, n) => ({ x: mapxy.first[clamp(p.x)], y: M.rowOrigin + mapxy.second[clamp(p.y)], colour: n === 0 ? M.playerColour : M.otherColour }));
}

// The cup record (cup, bonus pack, race) that picks the picture: a cup race's own (the Bronze cup's bonus race reads the second picture of the Silver cup's file), a demo's, or for the page's free
// race (which the game does not have) the Bronze cup's picture of the track's place in its five (`known` is false). The time trial and the kid mode have a cup record too.
export function minimapRace({ cup, demo, track }) {
  const M = MM();
  if (cup) return cup.bonusRace && cup.cup + cup.bonus === 1 ? { cup: 2, bonus: 0, race: 2, known: true } : { cup: cup.cup, bonus: cup.bonus, race: cup.race, known: true }; // @math the bonus race is the Bronze cup's (its class word 1); the loader forces the race 2 in the Silver file (obj1+0x7aaf to +0x7ad5, +0x17a37)
  if (demo) return { cup: demo.cup, bonus: 0, race: demo.race, known: true };
  return { cup: 1, bonus: 0, race: ((Number(track) - 1) % M.pictures) + 1, known: false }; // @math the free race has no cup; tracks count from 1
}

// Whether the race set-up leaves the gate set (obj1+0x1fe14 to +0x1fe44): not in the duck game's timed mode or the slide show demos (the split screen and the shoot-out have their own screens).
export const minimapAllowed = ({ duck, demo, slides }) => !duck && !(demo && demo.mode === slides);
