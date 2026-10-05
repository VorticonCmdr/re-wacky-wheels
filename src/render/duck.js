// The screens around the duck game (duck.flow): the zone chooser's picture, and the intro and end screens over ORDER.PCX with the large and small fonts, the two ducks and the big score digits.
import { decodePcxMember } from '../formats/pcx.js';
import { drawText } from './text.js';
import { blitFlat } from './sprites.js';
import { drawBig, loadTrialArt } from './trial.js';
import { PICTURES, FLOW } from '../game/duck-rules.js';

// The pictures the duck screens need beyond the time trial's art (ORDER.PCX, the large font, OFONT.SP): the chooser's two pictures, DIGGER.SP and LAP.SP.
export function loadDuckArt(members) {
  const trial = loadTrialArt(members), C = FLOW().chooser;
  return { ...trial, choosers: C.pictures.map(name => decodePcxMember(members.get(name))), digger: members.get(PICTURES().member), lap: members.get('LAP.SP') };
}

// The zone chooser: the picture of the regular or bonus pack zones; returns its palette (the caller darkens the bars, game/duckflow.js).
export function renderChooser(fb, art, bonus) {
  const picture = art.choosers[bonus ? 1 : 0]; // @math the second picture is the bonus pack's
  fb.set(picture.indices);
  return picture.vga;
}

// The intro or end screen of a layout (duckflow.introLayout, endLayout) over ORDER.PCX; returns the background's palette.
export function renderDuckScreen(fb, art, layout) {
  const P = PICTURES(), E = FLOW().end.score;
  fb.set(art.background.indices);
  for (const l of layout.lines) (l.font === 'big' ? drawBig(fb, art.tiles, l.text, l.x, l.y) : drawText(fb, art.ofont, l.text, l.x, l.y));
  for (const d of layout.ducks) {
    const at = ((d.helmeted ? P.helmeted : P.plain) + d.frame) * P.frameBytes;
    blitFlat(fb, { bytes: art.digger.subarray(at, at + P.frameBytes), width: P.width, height: P.height, x: d.x, y: d.y });
  }
  if (layout.digits) [...layout.digits.text].forEach((ch, k) => {
    const at = E.at + E.frameBytes * Number(ch);
    blitFlat(fb, { bytes: art.lap.subarray(at, at + E.frameBytes), width: E.width, height: E.height, x: layout.digits.x + E.advance * k, y: layout.digits.y });
  });
  return art.background.vga;
}
