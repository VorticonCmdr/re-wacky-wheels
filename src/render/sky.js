// The sky and the horizon strip above the floor (sky.model): the sky is a fixed picture, the strip a window of the track's .PAR file.
import { K } from '../evidence/k.js';

const MODEL = () => K({ width: 320, skyRows: 110, horizonRow: 110, horizonRows: 20, parRowPixels: 1280, pixelsPerByte: 4, parBytes: 25600, offsetMax: 160, observedFrom: 52 }, 'sky.model');

// Rows 0 to 109 of the 320 x 200 picture `sky` (palette indexes) go to the same rows of fb.
export function renderSky(sky, fb) {
  const S = MODEL();
  fb.set(sky.subarray(0, S.skyRows * S.width), 0);
  return fb;
}

// The 20 rows from row 110: the pixel of column c in row j is the file byte rowPixels x j + pixelsPerByte x offset + c.
export function renderHorizon(par, offset, fb) {
  const S = MODEL();
  if (par.length !== S.parBytes) throw new Error(`.PAR file of ${par.length} bytes, expected ${S.parBytes}`);
  if (offset < 0 || offset > S.offsetMax) throw new Error(`horizon offset ${offset} is outside 0 to ${S.offsetMax}`);
  for (let j = 0; j < S.horizonRows; j++) {
    const from = S.parRowPixels * j + S.pixelsPerByte * offset;
    fb.set(par.subarray(from, from + S.width), (S.horizonRow + j) * S.width);
  }
  return fb;
}
