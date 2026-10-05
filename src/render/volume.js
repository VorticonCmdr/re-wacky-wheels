// The VOLUME LEVELS screen (menu.volume-screen): the menu picture, the title, the three labelled bars, the selection icon and the two hints.
import { volumeModel, layoutOf, iconAt } from '../game/volume.js';
import { drawText } from './text.js';
import { drawBox } from './finish.js';
import { blitFlat } from './sprites.js';

export const loadVolumeArt = (menuArt, members) => ({ picture: menuArt.title, ofont: members.get('OFONT.SP'), genef: members.get('GENEF.SP') });

// The picture for the state { volumes, cursor, wobble }: returns the palette of the picture.
export function renderVolume(fb, art, s) {
  const M = volumeModel(), centred = text => (M.screen - M.glyph * text.length) / 2; // @math centred
  fb.set(art.picture.indices);
  for (const line of [...M.hints, M.title]) drawText(fb, art.ofont, line.text, centred(line.text), line.y);
  for (const row of layoutOf(s.volumes)) {
    drawText(fb, art.ofont, row.label, row.labelX, row.y);
    drawBox(fb, row.bar.x, row.bar.y, row.bar.width, row.bar.height, M.bar.border, M.bar.fill);
  }
  const at = iconAt(s), I = M.icon;
  blitFlat(fb, { bytes: art.genef.subarray(I.offset, I.offset + I.width * I.height), width: I.width, height: I.height, x: at.x, y: at.y });
  return art.picture.vga;
}
