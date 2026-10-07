// Where the overlays go in a wide view (Stage 4, M8: docs/enhancements.md, Stage 4 as built). The overlays (the HUD, the overhead map, the
// labels, the messages, the menus) are drawn by the game's own code on the 320 x 200 grid; a wide view's HUD layer is refW x 200, and the
// world refW x 200 reference cells drawn at s x s output pixels each. 'centred' (RENDER.hudPlaces' first, the default) moves every overlay
// pixel right by the margin m, onto the original columns in the middle of the wide picture: exact (a pixel's neighbours stay its neighbours)
// and it cannot tear. 'edges' (the HUD's groups moved toward the picture's sides) is a later milestone (M9); until then every placement is
// drawn centred. At m = 0 a pixel stays where it is.
// hudPlaces(G) gives, for every pixel i = y 320 + x of the overlays' grid, `hud[i]`: its index in the HUD layer (refW x 200), and `world[i]`:
// the output pixel of the top left of its s x s block in the world (G.W x G.H), where 'picture' (the HUD in the picture) stamps it. Kept per
// geometry; read, never written.
import { models } from './models.js';

const places = new Map();
export function hudPlaces(G) {
  const known = places.get(G.key);
  if (known) return known;
  const F = models().floor, { s, m, refW, W } = G, hud = new Int32Array(F.width * F.height), world = new Int32Array(F.width * F.height);
  for (let y = 0, i = 0; y < F.height; y++) for (let x = 0; x < F.width; x++, i++) { hud[i] = y * refW + x + m; world[i] = s * y * W + s * (x + m); }
  const out = { hud, world };
  places.set(G.key, out);
  return out;
}
