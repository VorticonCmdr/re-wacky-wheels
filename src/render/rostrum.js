// THE ROSTRUM screen (race.rostrum): the plain ORDER.PCX background with the title text first, then WIN.PCX with what a pass draws on it.
import { decodePcxMember } from '../formats/pcx.js';
import { drawText } from './text.js';
import { blitFlat } from './sprites.js';
import { rostrumFiles, rostrumText, rostrumGeometry } from '../game/rostrum.js';
import { driverFile } from '../game/drivers.js';
import { drawBox } from './finish.js';
import { noticeLayout } from '../game/cup.js';

export function loadRostrumArt(members, humanSlot) {
  const F = rostrumFiles();
  return { background: decodePcxMember(members.get(F.background)), picture: decodePcxMember(members.get(F.picture)), puffs: members.get(F.puffs), genef: members.get('GENEF.SP'), cars: members.get('CARS.SP'), driver: members.get(driverFile(humanSlot)), ofont: members.get('OFONT.SP') };
}

// The title screen: the background with THE ROSTRUM centred. Returns the palette of the background.
export function renderRostrumText(fb, art) {
  const T = rostrumText();
  fb.set(art.background.indices);
  drawText(fb, art.ofont, T.string, Math.floor(Math.abs(T.screen - T.glyph * T.string.length) / 2), T.y); // @math centred
  return art.background.vga;
}

// The picture and the draws of a pass. Returns the palette of WIN.PCX.
export function renderRostrum(fb, art, draws) {
  const G = rostrumGeometry();
  fb.set(art.picture.indices);
  for (const d of draws) {
    if (d.kind === 'puff') blitFlat(fb, { bytes: art.puffs.subarray(d.frame * G.puffBytes, (d.frame + 1) * G.puffBytes), width: G.size[0], height: G.size[1], x: d.x, y: d.y });
    else if (d.kind === 'car') { const data = d.picture.file === 'cars' ? art.cars : art.driver, at = d.picture.index * G.puffBytes; blitFlat(fb, { bytes: data.subarray(at, at + G.puffBytes), width: G.size[0], height: G.size[1], x: d.x, y: d.y }); } // the car frames are as large as the puffs: 38 x 28
    else if (d.kind === 'wheel') blitFlat(fb, { bytes: art.genef.subarray(d.piece * G.wheelBytes, (d.piece + 1) * G.wheelBytes), width: G.wheel[0], height: G.wheel[1], x: d.x, y: d.y });
    else if (d.kind === 'cup') { const at = G.cupFirst + d.picture * G.cupBytes; blitFlat(fb, { bytes: art.genef.subarray(at, at + G.cupBytes), width: G.cup[0], height: G.cup[1], x: d.x, y: d.y }); }
  }
  return art.picture.vga;
}

// A notice over `base` (the frame's indices): the box and its lines (cup.noticeLayout). Returns nothing; the palette is the base's.
export function renderNotice(fb, art, base, lines) {
  const N = noticeLayout(lines);
  fb.set(base);
  drawBox(fb, N.x, N.y, N.width, N.height, N.border, N.fill);
  for (const l of N.lines) drawText(fb, art.ofont, l.text, l.x, l.y);
}
