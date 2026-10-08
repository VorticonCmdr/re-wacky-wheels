// The Enhanced presentation of the race screens (docs/enhancements.md, first milestone): smooth motion between the simulation's ticks,
// contact shadows, surface particles and distance fog, over the original artwork at the original resolution. The page keeps drawing
// through the reference renderer whenever every effect is off and every rendering choice is at its default (settings.js enhancedOn). This
// module reads the race state and never writes it: what it keeps (the snapshots of the last two ticks, the particles) is its own and is
// dropped on every reset.
//
// Stage 4 (docs/enhancements.md, Stage 4 as built): a frame may be drawn at a geometry G (geometry.js: a whole scale s, m margin columns a
// side). At the reference geometry (IDENTITY) the enhancer draws as it always did, into the page's 320 x 200 index and canvas, calling the
// very functions it always called. At any other geometry the world is drawn into the buffers of that geometry (buffersFor: the world's
// indices, its layers, its RGBA picture, a HUD layer; allocated on the first frame there, released when the geometry changes or a frame is
// drawn at the reference geometry), and the page's 320 x 200 index holds the world's reference samples (G.sample), so the overlays, the
// overhead map's first-frame capture, wackyDebug and the checks read what they always read. The world is composed under the overlays (compositeAt, no mask); the page's canvas is the reference
// view, the overlays' pixels from the palette and the others the world's pixel of their sample; the world and the HUD reach the screen as the
// layers of `layers()`. The geometry comes from the settings' scale (RENDER: RESOLUTION) where the caller can show a world of another size
// (the frame context's `worldReady`), or from the frame context's `geometry` (the checks, scripts/spike-2x.mjs). Above 1x the soft layers
// are kept on the reference grid (config.js HD.look 'reference', scene.js createSoftLayers) unless the enhancer is made with look 'full'.
// The wide view (RENDER: VIEW WIDE, M8) adds m margin columns a side (geometry.js viewMargin for the display's shape and the world): the
// margins' records come from wide.js (aimed probes of the game's draw list), and the overlays are moved by m into the refW x 200 HUD layer
// (hud-place.js: 'centred'), or with VIEW WIDE EDGES (RENDER.hudPlace 'edges', M9) by their groups toward the picture's sides where the caller
// hands the frame its HUD's group map (the frame context's `edges`). Smooth sprite sizes (RENDER: SPRITE SIZES SMOOTH, M7) draw the records at sizes between the game's classes on
// the floor's own rows (up to the row table's last row) at any geometry, the reference one included (scene.js placeSmooth, the opts'
// `sizes`), and stand the particles on those rows too (geometry.js rowLaw).
import { frameMs } from '../game/clock.js';
import { carsBySeat, swapSeat } from '../game/versus.js';
import { composeSplit, flipViewport } from '../render/versus.js';
import { EFFECTS, LOOK_EFFECTS, FOG, SHADOW, CLOUDS, TIMING_FRAMES, HD } from './config.js';
import { loadSettings, saveSettings, normalize, enhancedOn } from './settings.js';
import { createMotion, present } from './motion.js';
import { createParticles } from './particles.js';
import { createLayers, createCollect, renderEnhancedScene, LAYER_KEYS, SOFT_KEYS, OUTPUT_KEYS, createSoftLayers } from './scene.js';
import { KIND } from './project.js';
import { createMarks } from './marks.js';
import { composite, compositeAt, overlayMask, fogColor, fogRamp, SENTINEL } from './composite.js';
import { IDENTITY, geometryOf, viewMargin, rowLaw } from './geometry.js';
import { createWide } from './wide.js';
import { hudPlaces, placeFrame, createPlaceScratch } from './hud-place.js';
import { composeSplitAt, flipViewportAt, splitSample } from './split.js';
import { models } from './models.js';
import { loadAtmospheres, normalizeAtmosphere, sunAngleOf, sunLengthOf, fogTintOf } from './atmosphere.js';
import { coverClouds, skyRowColours, stripSkyIndices } from './clouds.js';
import { gradeOf } from './grade.js';
import { coverRange, rangeColours } from './ranges.js';
import { liquidsOf, waterColours } from './water.js';
import { groundRelief, sunVector } from './relief.js';
import { createArtLayers } from './art.js';
import { LAYOUT } from '../game/versus-rules.js';

// An RGBA picture's pixels as 32-bit words (the same bytes), kept per array; the pictures handed to the enhancer start on a whole pixel.
const wordViews = new WeakMap();
function words(rgba) {
  let w = wordViews.get(rgba);
  if (w) return w;
  if (rgba.byteOffset % Uint32Array.BYTES_PER_ELEMENT || rgba.length % Uint32Array.BYTES_PER_ELEMENT) throw new Error('an RGBA picture must start and end on a whole pixel');
  w = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.length / Uint32Array.BYTES_PER_ELEMENT);
  wordViews.set(rgba, w);
  return w;
}

// `storage` keeps the settings and holds the tracks' atmospheres (atmosphere.js); `atmosphere(name)`, when given, is asked for a track's
// atmosphere instead (the track editor's preview of the values being edited, the viewer's of the stored ones). `relief` gives the player's
// own relief maps (relief-store.js createReliefProvider: tiles(member) and frame(bytes)), or null for the generated ones only. `force`
// ({ caster, blit, composite, slow, pipeline }, for the checks: scripts/check-enhance.js section 6) draws through the general paths of Stage 4
// at the reference geometry (caster.js, blit.js, composite.js compositeAt; `slow` without compositeAt's sky-band fast path; `pipeline` the
// draw of any other geometry: its own buffers, the decimation, the split screen's general cut and flip, the world composed under the
// overlays, the canvas and the HUD built from it), which must give the very same frame as the functions the enhancer calls there by default.
// `stages` makes stats() report the mean time of each stage of the draw (the page's readout, scripts/spike-2x.mjs). `look` is where the soft
// layers are kept above 1x (config.js HD.look: 'reference', the default, or 'full', for the comparisons of the checks and the spike).
// `probes` false leaves the wide view's margins without their records (wide.js; the checks' comparison of the reference fan alone), and
// `trace` makes inspect() report the records drawn with their shadows' boxes and the skid marks' boxes (scene.js opts.trace) and the frame's
// particle discs (the checks' exclusions of the wide view).
// `art` (Stage 4, the artwork packs: art.js createArtProvider) gives the player's packs; they are drawn while the settings' artwork is on
// (RENDER.art: ARTWORK ON) and the provider has art that may change the world's draw (artFor below). Then the frame is drawn as a frame of a
// geometry, the reference one included (the general caster, blit and compositeAt, which the forced paths of check:enhance section 6 prove
// equal to the dispatched functions), with the art layers (art.js createArtLayers) allocated while art is drawn. With the artwork off, or no
// pack stored, nothing of this runs: the frame is today's. `blits` (the checks' region recorder) is told every picture drawn (scene.js).
// The provider's kart angle sets (M4: angles.js) are drawn with the art, their index picked by the settings' `angles` (RENDER.angles: locked,
// free or off); `angleLog` (the checks' recorder) is told each record drawn from a set (scene.js opts.angleLog).
export function createEnhancer({ storage = undefined, atmosphere = null, relief = null, force = null, stages = false, look = HD.look, probes = true, trace = false, art = null, blits = null, angleLog = null } = {}) { // undefined: the browser's storage, looked up where it is read (settings.js, atmosphere.js)
  const F = models().floor, size = F.width * F.height;
  let settings = loadSettings(storage), ramps = new WeakMap(), stored = atmosphere ? null : loadAtmospheres(storage);
  const atmosphereOf = world => normalizeAtmosphere((atmosphere ? atmosphere(world.name) : stored[world.name]) ?? {});
  if (look !== 'reference' && look !== 'full') throw new Error(`no look '${look}': 'reference' or 'full'`);
  const motion = createMotion(), particles = createParticles(), marks = createMarks(), wide = createWide(), timing = { sum: 0, count: 0, last: 0, window: null };
  let traced = null, splatted = []; // the last frame's trace and particle discs (`trace`)
  const L = createLayers(size), LA = createLayers(size), LB = createLayers(size), sceneA = new Uint8Array(size), sceneB = new Uint8Array(size), mask = new Uint8Array(size), sentinel = new Uint16Array(size), under = new Uint8Array(size), none = new Uint8Array(size);
  const collect = createCollect(); // the pixels of the picture being drawn, for its relief (scene.js): this enhancer's own, grown to the largest picture drawn
  const forced = { caster: Boolean(force?.caster), blit: Boolean(force?.blit), composite: Boolean(force?.composite), slow: Boolean(force?.slow), pipeline: Boolean(force?.pipeline) }, rowFlags = new Uint8Array(F.height); // the rows the general blit wrote at the reference geometry when it is forced (compositeAt's sky-band fast path); every other geometry has its own in its buffers (buffersFor)
  // The stage times (`stages`): the time since the stage before, summed per stage over the frames since stats() last reset them.
  const clock = stages ? (() => { const c = { sums: {}, frames: 0, t: 0, start() { c.t = performance.now(); c.frames++; }, mark: name => { const now = performance.now(); c.sums[name] = (c.sums[name] ?? 0) + now - c.t; c.t = now; } }; return c; })() : null;
  const mark = clock ? clock.mark : null, fastRows = clock ? { fast: 0 } : null;

  // The buffers of the geometry drawn at away from the dispatched reference path: the world's indices `fb` and layers `L`, the blit's row flags,
  // the RGBA world, the HUD layer (refW x 200, the overlays moved by m), the reference samples' kinds (the overlays' sky rule), a slide's page,
  // the covers of the clouds and the far range at refW x the sky's rows, the soft layers of the reference look above 1x (`R`, refW x 200, or
  // null) and the split screen's (`split`, made on its first frame). One set, made on the first frame at a geometry, replaced when the geometry
  // changes and released by a frame at the reference geometry.
  let set = null;
  const S = models().sky;
  const buffersFor = G => {
    if (set?.G === G) return set;
    const n = G.W * G.H, sky = G.refW * S.skyRows, range = G.refW * (S.skyRows + S.horizonRows);
    set = { G, fb: new Uint8Array(n), L: createLayers(n), rows: new Uint8Array(G.H), world: new Uint8ClampedArray(n * 4), hud: new Uint8ClampedArray(G.refW * F.height * 4), kind: new Uint8Array(size), page: new Uint8Array(size), clouds: CLOUDS.layers.map(() => ({ alpha: new Float32Array(sky), light: new Float32Array(sky) })), range: { alpha: new Uint8Array(range), tone: new Float32Array(range), snow: new Uint8Array(range) }, R: look === 'reference' && G.s > 1 ? createSoftLayers(G.refW * F.height) : null, split: null }; // @math four bytes a colour
    return set;
  };
  const splitOf = B => (B.split ??= { A: new Uint8Array(B.fb.length), B: new Uint8Array(B.fb.length), LA: createLayers(B.fb.length), LB: createLayers(B.fb.length), rowsA: new Uint8Array(B.G.H), rowsB: new Uint8Array(B.G.H), RA: B.R ? createSoftLayers(B.R.shade.length) : null, RB: B.R ? createSoftLayers(B.R.shade.length) : null });
  // The art layers of a set of buffers while art is drawn (made on the first frame with art, kept with the buffers), else none: the blits and
  // the composite then never touch them.
  const ART_KEYS = ['px', 'direct', 'beneath', 'through'];
  const artLayersOf = (B, on) => {
    const n = B.fb.length;
    B.L.art = on ? (B.artLayers ??= createArtLayers(n)) : null;
    if (B.split) { B.split.LA.art = on ? (B.split.artA ??= createArtLayers(n)) : null; B.split.LB.art = on ? (B.split.artB ??= createArtLayers(n)) : null; }
  };
  const identityArt = {}; // the reference geometry's art layers (L's, and the split screen's LA and LB), made on the first frame with art
  const artLayersAtIdentity = on => { L.art = on ? (identityArt.L ??= createArtLayers(size)) : null; LA.art = on ? (identityArt.LA ??= createArtLayers(size)) : null; LB.art = on ? (identityArt.LB ??= createArtLayers(size)) : null; };
  // The packs' art for a world's frame: null with the artwork off or no pack that may change the world's draw, else { provider, sky, strip }:
  // the pack sky of the sky the frame draws (the split screen's background picture, LAYOUT's, else the .GAM's sky) and the world's strip.
  const artFor = (world, split = false) => {
    if (!settings.art || !art || !art.active(world)) return null;
    const own = art.forWorld(world);
    return { provider: art, sky: split ? art.sky(LAYOUT().background) : own.sky, strip: own.strip, stripSky: own.stripSky };
  };
  // Whether the settings draw through the enhanced path: the artwork counts only while a pack is stored (ARTWORK with no pack draws nothing).
  const enhancedNow = s => enhancedOn(s.art && !(art?.size > 0) ? { ...s, art: false } : s);
  // The geometry of a frame (Stage 4): the frame context's `geometry` when it gives one (the checks, scripts/spike-2x.mjs), else the settings'
  // scale and view where the caller can show a world of another size (`worldReady`: the page's display.worldReady(), true for the previews and
  // the checks, which show the RGBA world themselves) and 1x in the standard view where it cannot (the stored choices are kept for when it
  // can). The wide view's margin is viewMargin's for the display's shape (`aspect`) and the world (0 for a world whose strip or VIEW words do
  // not allow one), and 0 where the screen may not be wide (`wideAllowed` false: a link race, which gives both players the same sight, a
  // slides demo; the split screen never asks).
  const geometryFor = (geometry, worldReady, world = null, aspect = null, wideAllowed = false) => geometry ?? (worldReady ? geometryOf({ s: settings.scale, m: wideAllowed && settings.view === 'wide' ? viewMargin(settings.view, aspect, world) : 0 }) : IDENTITY);
  // Where the frame's overlay pixels go in its HUD layer and its world (hud-place.js): centred (moved by m: hudPlaces' `hud` and `world`), or with
  // the settings' HUD place 'edges', a margin and the frame context's `edges` ({ groups: hud-place.js hudGroups' map, base(P, fb): the overlays
  // without the forced ones (the frame's own overlays when not given), forced(P, fb): the overlays that stay centred, or none }) in `layers`, each
  // { mask, values, hud, world }: the base placed by its groups (placeFrame), then the forced overlays centred over it. Both are drawn into
  // sentinel buffers after the frame's own overlays (so the overhead map's rectangle is kept already), and their pixels that only put back the
  // track's sky are left out as the frame's are (overlaid). A guard centres the frame whole (`guards` counts them).
  const placeScratch = createPlaceScratch(), partSentinels = [new Uint16Array(size), new Uint16Array(size)], partMasks = [new Uint8Array(size), new Uint8Array(size)], guards = { tear: 0, collision: 0 };
  const partOf = (k, draw, P, trackSky, kinds) => {
    const values = partSentinels[k], m = partMasks[k];
    values.fill(SENTINEL); draw(P, values);
    for (let i = 0; i < size; i++) m[i] = values[i] !== SENTINEL && !(trackSky && kinds[i] === KIND.sky && values[i] === under[i]) ? 1 : 0;
    return { mask: m, values };
  };
  const placeOf = (G, P, edges, overlays, trackSky, kinds) => {
    const centred = { place: 'centred', guard: null, ...hudPlaces(G) };
    if (!edges?.groups || settings.hudPlace !== 'edges' || G.m === 0) return centred;
    const base = partOf(0, edges.base ?? overlays, P, trackSky, kinds), forcedPart = edges.forced ? partOf(1, edges.forced, P, trackSky, kinds) : null;
    const r = placeFrame(G, edges.groups, base.mask, placeScratch);
    if (r.guard) { guards[r.guard]++; return { ...centred, guard: r.guard }; }
    return { place: 'edges', guard: null, layers: [{ ...base, hud: r.hud, world: r.world }, ...(forcedPart ? [{ ...forcedPart, ...hudPlaces(G) }] : [])] };
  };
  let shown = null; // what the last frame drew: { G, out, layers (the caller's), B (the buffers away from the reference path) }
  const over = { world: new Uint8ClampedArray(0), hud: new Uint8ClampedArray(0) }; // drawOver's layers over a kept frame

  // The relief of a world when the track lighting shows it (the switch, the track's relief above 0): the ground's heights, the sun.
  const reliefOf = (world, atmo) => {
    if (!settings.lighting || !(atmo.relief > 0)) return null;
    const length = sunLengthOf(atmo);
    return { ground: groundRelief(world, relief?.tiles ?? null), sun: sunVector(world, sunAngleOf(atmo, settings.sunAngle), length), length, strength: atmo.relief, frameHeights: relief?.frame ?? null };
  };
  const opts = (fine, atmo, liquids, lit = null, B = null, rows = B?.rows, soft = B?.R ?? null, from = 0, packs = null) => ({ art: packs, blits, angles: settings.angles, angleLog, subPixel: settings.smooth, shadows: settings.shadows, sceneryShadows: settings.sceneryShadows, sunShadows: settings.sunShadows, sunAngle: sunAngleOf(atmo, settings.sunAngle), sunLength: sunLengthOf(atmo), band: SHADOW.bottomBand, marks: settings.skidMarks ? marks : null, now: fine.time, sizes: settings.sizes, water: liquids ? { liquids, strength: atmo.water, beach: Boolean(liquids.beach) } : null, relief: lit, collect, force: forced, rows: B ? rows : rowFlags, page: B?.page, soft, from, clock: mark, wide: probes ? wide : null, trace: trace ? (traced = { records: [], marks: [] }) : null });
  // The liquids of a world when its water moves (the switch, the track's water above 0, a liquid on its map), else null.
  const liquidsOn = (world, atmo) => { if (!settings.water || !(atmo.water > 0)) return null; const l = liquidsOf(world); return l.any ? { ...l, beach: world.beach !== null && world.beach !== undefined } : null; };
  const rampOf = (world, strength) => { // the fog's table of a world at a strength (the game setting's times the track's)
    let byStrength = ramps.get(world); if (!byStrength) { byStrength = new Map(); ramps.set(world, byStrength); }
    let r = byStrength.get(strength); if (!r) { r = fogRamp(world, strength); byStrength.set(strength, r); }
    return r;
  };
  const effectsOf = (world, cap, atmo) => ({ shadow: settings.shadows || settings.sceneryShadows || settings.sunShadows ? settings.shadowStrength : 0, fog: settings.fog ? { color: fogTintOf(atmo, fogColor(world)), ramp: rampOf(world, settings.fogStrength * atmo.fog), horizon: FOG.horizon * settings.fogStrength * atmo.fog } : null, cap });
  const view = (state, alpha) => { const fine = motion.view(state, settings.smooth ? alpha : 1, frameMs()); return { fine, P: present(state, fine) }; };
  // The overlays over the world, and their mask. In a single view of the track's own sky (`trackSky`), an overlay pixel that only puts back the
  // sky's own index (the overhead map's rectangle, which the game takes from the race's first frame, sky and all) stays sky: the clouds and
  // the lighting reach it as they reach the sky around it. Not in the split screen (its strips are drawn over the strips' picture) nor over a
  // demo's slide. `kinds` are the kinds of the reference pixels (the world's own at the reference geometry, its samples' at any other).
  const overlaid = (P, overlays, index, trackSky = false, kinds = L.kind) => {
    under.set(index); overlays(P, index); sentinel.fill(SENTINEL); overlays(P, sentinel); overlayMask(sentinel, mask);
    if (trackSky) for (let i = 0; i < mask.length; i++) if (mask[i] && kinds[i] === KIND.sky && index[i] === under[i]) mask[i] = 0;
  };
  // The frame's composite. With `layers` (the display's HUD layer) the world is composed everywhere, the overlays' pixels too, into
  // `layers.world` from the picture before the overlays (`under`), and `out` is that world with the overlays' pixels put back from the
  // palette: the same picture as without layers, since the effects of a pixel depend only on its world index and its layers.
  // With `forced.composite` compositeAt composes at IDENTITY (`rows`: the rows the general blit wrote, or null where they are not known).
  const compose = (out, index, layers, args, rows = null) => {
    const at = forced.composite || L.art ? { ...args, G: IDENTITY, rows: forced.blit ? rows : null, slow: forced.slow } : null; // (with the artwork packs' layers: compositeAt, which draws their colours)
    if (!layers) { if (at) compositeAt(out, { ...at, fb: index, mask }); else composite(out, { ...args, index, mask }); return; }
    if (at) compositeAt(layers.world, { ...at, fb: under, mask: null }); else composite(layers.world, { ...args, index: under, mask: none });
    const { world, hud } = layers, palette = args.palette;
    for (let i = 0, o = 0; i < size; i++, o += 4) { // @math four bytes a colour
      if (mask[i]) { const p = index[i] * 4; for (let k = 0; k < 3; k++) { out[o + k] = palette[p + k]; hud[o + k] = palette[p + k]; } out[o + 3] = 0xff; hud[o + 3] = 0xff; } // @math four bytes a colour, three components; opaque
      else { for (let k = 0; k < 4; k++) out[o + k] = world[o + k]; hud[o] = 0; hud[o + 1] = 0; hud[o + 2] = 0; hud[o + 3] = 0; } // @math four bytes a colour; no overlay (premultiplied)
    }
  };
  // The page's index at a geometry: each reference pixel's sample of the world (G.sample, top-left), and its kind.
  const decimate = (B, index) => { const { fb, kind } = B, k = B.L.kind, at = B.G.sample; for (let i = 0; i < size; i++) { const o = at[i]; index[i] = fb[o]; kind[i] = k[o]; } };
  // The frame's composite at a geometry (or at IDENTITY with `forced.pipeline`): the world composed everywhere into B.world from B.fb (the
  // world before the overlays: they draw on the reference index only), then the page's canvas `out` (the overlays' pixels from the palette, the
  // others the world's pixel of their sample `canvas`, G.sample or the split screen's mirrored map), and the HUD: with `layers` (the display's
  // HUD layer) the overlays' pixels into B.hud at their place (`place`: placeOf's, moved by m or by their groups; and into the caller's 320 x 200
  // layers, with the world's samples), else stamped into the world as s x s blocks there, so the world layer is the whole picture.
  // Every pixel is moved as one 32-bit word (its four bytes, whatever their order): `paint` holds the palette's colours made opaque.
  const paintBytes = new Uint8ClampedArray(256 * 4), paint = new Uint32Array(paintBytes.buffer); // @math 256 colours of four bytes
  const paintOf = palette => { for (let p = 0; p < paintBytes.length; p += 4) { paintBytes[p] = palette[p]; paintBytes[p + 1] = palette[p + 1]; paintBytes[p + 2] = palette[p + 2]; paintBytes[p + 3] = 0xff; } return paint; }; // @math four bytes a colour, three components; opaque
  // The opaque pixels of a HUD layer (refW x 200 words) stamped into a world of s times its rows and columns as s x s blocks.
  const stampHud = (world32, hud32, s, W, refW) => { for (let y = 0, i = 0; y < F.height; y++) for (let x = 0; x < refW; x++, i++) { const c = hud32[i]; if (c === 0) continue; for (let q = 0, w = s * y * W + s * x; q < s; q++, w += W) for (let r = 0; r < s; r++) world32[w + r] = c; } }; // (an opaque colour is never the word 0: its alpha byte is 0xff)
  const composeAt = (B, out, index, layers, args, canvas, place = hudPlaces(B.G)) => {
    const { G, world, hud } = B, { s } = G, palette = args.palette;
    if (forced.composite || !G.identity || B.L.art) compositeAt(world, { ...args, fb: B.fb, mask: null, G, rows: G.identity && !forced.blit ? null : B.rows, slow: forced.slow, count: fastRows, soft: B.R }); else composite(world, { ...args, width: F.width, index: B.fb, mask: none });
    mark?.('composite');
    paintOf(palette);
    const out32 = words(out), world32 = words(world), hud32 = words(hud), lw32 = layers ? words(layers.world) : null, lh32 = layers ? words(layers.hud) : null;
    if (place.place === 'edges') { // the HUD's base by its groups, then the forced overlays centred over it (placeOf): a pixel's block may be another pixel's sample, so the canvas is taken whole first
      for (let i = 0; i < size; i++) {
        if (mask[i]) { const c = paint[index[i]]; out32[i] = c; if (layers) { lh32[i] = c; lw32[i] = world32[canvas[i]]; } }
        else { const v = world32[canvas[i]]; out32[i] = v; if (layers) { lw32[i] = v; lh32[i] = 0; } } // no overlay (premultiplied)
      }
      if (layers) hud32.fill(0);
      for (const part of place.layers) for (let i = 0; i < size; i++) {
        if (!part.mask[i]) continue;
        const c = paint[part.values[i]];
        if (layers) hud32[part.hud[i]] = c; else for (let q = 0, w = part.world[i]; q < s; q++, w += G.W) for (let r = 0; r < s; r++) world32[w + r] = c;
      }
    } else if (layers) {
      hud32.fill(0);
      for (let i = 0; i < size; i++) {
        if (mask[i]) { const c = paint[index[i]]; out32[i] = c; hud32[place.hud[i]] = c; lh32[i] = c; lw32[i] = world32[canvas[i]]; }
        else { const v = world32[canvas[i]]; out32[i] = v; lw32[i] = v; lh32[i] = 0; } // no overlay (premultiplied)
      }
    } else for (let i = 0; i < size; i++) { // the overlays in the picture: each pixel a block of the world at its place (hud-place.js); a block is never another pixel's sample, so the order does not matter
      if (!mask[i]) { out32[i] = world32[canvas[i]]; continue; }
      const c = paint[index[i]];
      out32[i] = c;
      for (let q = 0, w = place.world[i]; q < s; q++, w += G.W) for (let r = 0; r < s; r++) world32[w + r] = c;
    }
    mark?.('hud');
  };
  const timed = (fn) => { // the draw's time; every TIMING_FRAMES frames the window's mean is kept and the next window begins
    const t0 = performance.now(), out = fn(); timing.last = performance.now() - t0; timing.sum += timing.last; timing.count++;
    if (timing.count >= TIMING_FRAMES) { timing.window = timing.sum / timing.count; timing.sum = 0; timing.count = 0; }
    return out;
  };
  const composeLayers = () => { for (const k of LAYER_KEYS) composeSplit(LA[k], LB[k], L[k]); if (L.art) for (const k of ART_KEYS) composeSplit(LA.art[k], LB.art[k], L.art[k]); };
  const cloudCover = CLOUDS.layers.map(() => ({ alpha: new Float32Array(S.width * S.skyRows), light: new Float32Array(S.width * S.skyRows) }));
  const rangeSize = S.width * (S.skyRows + S.horizonRows), rangeCover = { alpha: new Uint8Array(rangeSize), tone: new Float32Array(rangeSize), snow: new Uint8Array(rangeSize) };
  const rowsMixed = (rows, toward, t, cap) => rows.map((v, i) => Math.min(v + ((toward ? toward[i] : 0xff) - v) * t, cap)); // @math toward white when no colour is given
  const litRows = (rows, light, cap) => rows.map((v, i) => { const k = i - (i % 3), grey = (rows[k] + rows[k + 1] + rows[k + 2]) / 3 / 0xff; return Math.min(v + (0xff - v) * light * Math.min(Math.max(grey / CLOUDS.brightSky, CLOUDS.dimLight), 1), cap); }); // @math the row's three components; 8-bit to 0 to 1
  // The look of the frame: the lighting grade of the track's atmosphere; over the track's sky (`trackSky`: a single view of a race, not a
  // demo's slide, not the split screen) the grade's gradient, the far range and the clouds, which turn with the viewer's horizon strip; the
  // water's colours when `liquids` move. `B` the buffers of a geometry (their covers, at refW columns from the reference column -m) or null.
  const lookOf = (world, atmo, fine, seat, trackSky, cap, liquids, B = null) => {
    const grade = settings.lighting ? gradeOf(atmo.grade, atmo.gradeStrength) : null, clouds = settings.clouds && atmo.clouds > 0, range = settings.clouds && atmo.range > 0;
    const haze = fogTintOf(atmo, fogColor(world)), scroll = (fine.seats[seat]?.sky ?? 0) * S.pixelsPerByte;
    const covers = B ? { clouds: B.clouds, range: B.range, span: { width: B.G.refW, x0: -B.G.m } } : { clouds: cloudCover, range: rangeCover, span: {} };
    let sky = null, water = null;
    if (liquids) { // the water mirrors the haze, toward the lighting's sky at the horizon as the sky goes
      const g = grade?.sky, k = (S.skyRows - 1) * 3, mirror = g ? haze.map((v, j) => v + (g.colours[k + j] - v) * g.amount) : haze; // @math the sky's last row, three components
      water = waterColours(world, mirror, cap, atmo.water, liquids.beach);
    }
    if (trackSky && (grade || clouds || range)) {
      const base = skyRowColours(world).map(v => Math.min(v, cap)), tint = grade ? { colours: grade.sky.colours.map(v => Math.min(v, cap)), amount: grade.sky.amount } : null, under = tint ? rowsMixed(base, tint.colours, tint.amount, cap) : base; // all within the demo's fade
      const layers = [], far = range && coverRange(covers.range, { height: atmo.range, shape: atmo.rangeShape, scroll, ...covers.span }) ? { cover: covers.range, colours: rangeColours(under, haze.map(v => Math.min(v, cap)), cap) } : null;
      if (clouds) {
        coverClouds(covers.clouds, { amount: atmo.clouds, speed: atmo.cloudSpeed, scroll, time: fine.time, ...covers.span });
        CLOUDS.layers.forEach((layer, n) => { // a bank's lit colour is the sky of its row toward white; its shaded base between that and the sky
          const lit = litRows(under, grade ? layer.light + (grade.cloudLight - layer.light) * grade.strength : layer.light, cap);
          layers.push({ ...covers.clouds[n], lit, shade: lit.map((v, i) => v + (under[i] - v) * layer.shade) });
        });
      }
      sky = { rows: S.skyRows, stripRows: S.horizonRows, strip: tint || far ? stripSkyIndices(world) : null, tint, range: far, clouds: layers };
    }
    mark?.('covers');
    return { sky, water, grade: grade ? { ...grade, trackSky } : null };
  };

  const api = {
    get settings() { return settings; },
    active: () => enhancedNow(settings),
    // New settings, kept in this browser; a switch that changed starts a new scene (no snapshot or particle of the old mode is kept). The
    // rendering choices (RENDER) only change how the scene is drawn: they keep it, unless the enhanced path comes on or goes off with them.
    configure(next) {
      const before = settings; settings = normalize(next); saveSettings(settings, storage);
      if (before.scale !== settings.scale) { timing.sum = 0; timing.count = 0; timing.window = null; } // another resolution: its own times
      if (EFFECTS.some(k => !LOOK_EFFECTS.includes(k) && before[k] !== settings[k]) || enhancedNow(before) !== enhancedNow(settings)) api.reset(); // the sky's layers, the lighting and the water only colour the picture, but with the enhanced path off no snapshot was taken
      return settings;
    },
    // A new scene (a race start, a restart, a round, a mode change): no snapshot, no particle survives it. The stored atmospheres are read
    // again (the track editor may have changed them in another tab).
    reset() { motion.reset(); particles.clear(); marks.clear(); wide.reset(); if (!atmosphere) stored = loadAtmospheres(storage); },
    // The atmosphere a world is drawn with.
    atmosphereOf,
    // After every completed tick of the race; `sounds` are the tick's sounds when the page has already taken them out of the state.
    afterTick(state, { sounds = state.sounds } = {}) {
      if (!enhancedNow(settings)) return;
      const { prev, cur } = motion.tick(state, frameMs(), sounds);
      if (settings.particles) particles.emit(state, prev, cur, settings.particleAmount);
      if (settings.skidMarks) marks.emit(prev, cur);
    },

    // One full-screen view. `seat` 1 draws the second human of a link race; `overlays(P, fb)` draws everything over the world into fb from
    // the present state P (it runs twice: into the picture and into the sentinel buffer); `out` the RGBA bytes; `cap` the demo's fade.
    // The frame context (Stage 4): `worldReady` whether the caller shows the world at another size than 320 x 200 (the page: its display's
    // worldReady(), WebGL 2 drawing; the previews and the checks: true), `aspect` the display's shape and `wideAllowed` whether the screen may be
    // wide (not a link race, not a slides demo), both for the wide view (M8: the margin for that shape); `geometry` (the checks' and
    // scripts/spike-2x.mjs's) overrides the settings' geometry (geometryFor above). Returns the present state; layers() then has the frame's
    // world and HUD.
    // `useArt` false draws the frame without the artwork packs whatever the settings (the garage's comparisons). `edges` ({ groups, base, forced }:
    // placeOf above; M9) lets the settings' HUD place 'edges' move the overlays by their groups in a wide frame; without it they are centred.
    drawSingle(state, alpha, { index, out, palette, mode, sky = null, overlays, seat = 0, cap = 255, layers = null, worldReady = false, aspect = null, wideAllowed = true, geometry = null, useArt = true, edges = null }) { // @math the brightest 8-bit component
      return timed(() => {
        clock?.start();
        const { fine, P } = view(state, alpha), G = geometryFor(geometry, worldReady, state.world, aspect, wideAllowed);
        if (seat === 1) swapSeat(P); // @math the second player's seat
        const atmo = atmosphereOf(P.world), liquids = liquidsOn(P.world, atmo), lit = reliefOf(P.world, atmo), packs = useArt ? artFor(P.world) : null;
        if (G.identity && !forced.pipeline) { // (with the artwork packs too: their art layers beside L, the general caster and blit, compositeAt)
          artLayersAtIdentity(Boolean(packs));
          const camera = renderEnhancedScene(P, fine, seat, index, L, mode, sky, opts(fine, atmo, liquids, lit, null, undefined, null, 0, packs));
          overlaid(P, overlays, index, !sky); mark?.('overlays');
          const splats = settings.particles ? particles.splats(P.world, camera, fine.time, null, rowLaw(P.world, settings.sizes)).map(s => ({ ...s, map: y => y })) : []; mark?.('particles');
          if (trace) splatted = splats;
          const look = lookOf(P.world, atmo, fine, seat, !sky, cap, liquids);
          compose(out, index, layers, { L, palette, width: F.width, effects: { ...effectsOf(P.world, cap, atmo), ...look, relief: Boolean(lit) }, splats }, rowFlags); mark?.('composite');
          shown = { G: IDENTITY, out, layers, B: null }; set = null; // back at the reference geometry: the buffers of another are released
          return P;
        }
        artLayersAtIdentity(false);
        const B = buffersFor(G);
        artLayersOf(B, Boolean(packs));
        const camera = renderEnhancedScene(P, fine, seat, B.fb, B.L, mode, sky, opts(fine, atmo, liquids, lit, B, B.rows, B.R, 0, packs), G);
        decimate(B, index); mark?.('decimate');
        overlaid(P, overlays, index, !sky, B.kind);
        const place = placeOf(G, P, edges, overlays, !sky, B.kind); mark?.('overlays');
        const splats = settings.particles ? particles.splats(P.world, camera, fine.time, G, rowLaw(P.world, settings.sizes)).map(s => ({ ...s, map: y => y })) : []; mark?.('particles');
        if (trace) splatted = splats;
        const look = lookOf(P.world, atmo, fine, seat, !sky, cap, liquids, B);
        composeAt(B, out, index, layers, { L: B.L, palette, effects: { ...effectsOf(P.world, cap, atmo), ...look, relief: Boolean(lit) }, splats }, G.sample, place);
        shown = { G, out, layers, B, placed: place };
        return P;
      });
    },

    // The split screen of the two player modes (versus.layout): each viewer's world drawn and cut into its half, the layers with it, the
    // overlays (the strips, the HUD, the flips of an inverted car, the message, the menu) over both. At a geometry (the frame context's, as
    // drawSingle's; never wide) each viewer is drawn from s times its first row (LAYOUT's viewRow: the rows above it are cut away), the halves
    // are cut at s times LAYOUT's rows (split.js), the soft layers of the reference look at its rows on the reference grid, the page's index
    // takes the world's samples before the overlays flip an upside-down viewer's half of it, and the world is mirrored at its own rows
    // afterwards: the canvas then reads row s y + s - 1 inside a mirrored band (geometry.js bandSample), the mirror of the sample row the
    // overlays' own mirror put at y.
    drawSplit(state, alpha, { index, out, palette, mode, overlays, cap = 255, layers = null, worldReady = false, geometry = null, useArt = true }) { // @math the brightest 8-bit component
      return timed(() => {
        clock?.start();
        const { fine, P } = view(state, alpha), Y = LAYOUT(), first = P.versus.viewer, cams = [], atmo = atmosphereOf(P.world), liquids = liquidsOn(P.world, atmo), lit = reliefOf(P.world, atmo), G = geometryFor(geometry, worldReady), packs = useArt ? artFor(P.world, true) : null;
        if (G.identity && !forced.pipeline) {
          artLayersAtIdentity(Boolean(packs));
          cams[first] = renderEnhancedScene(P, fine, first, first === 0 ? sceneA : sceneB, first === 0 ? LA : LB, mode, null, opts(fine, atmo, liquids, lit, null, undefined, null, 0, packs));
          swapSeat(P); cams[1 - first] = renderEnhancedScene(P, fine, 1 - first, first === 0 ? sceneB : sceneA, first === 0 ? LB : LA, mode, null, opts(fine, atmo, liquids, lit, null, undefined, null, 0, packs)); swapSeat(P);
          composeSplit(sceneA, sceneB, index); composeLayers();
          overlaid(P, overlays, index);
          const flipped = carsBySeat(P).map(c => c.inverted !== 0);
          flipped.forEach((f, n) => { if (f) { for (const k of LAYER_KEYS) flipViewport(L[k], n); if (L.art) for (const k of ART_KEYS) flipViewport(L.art[k], n); if (layers) flipViewport(under, n); } }); // the world before the overlays flipped as they flip the picture
          mark?.('overlays');
          const rowOf = (n, y) => { // a row of a viewer's picture to the screen (composeSplit, then the flip)
            if (y < Y.viewRow || y >= F.height) return -1;
            const row = y - (n === 0 ? 0 : Y.shift), top = n === 0 ? Y.flip.first : Y.flip.first - Y.shift; // @math the first viewer keeps its rows
            return flipped[n] && row >= top && row < top + Y.flip.rows ? top + Y.flip.rows - 1 - (row - top) : row; // @math the mirrored row
          };
          const splats = settings.particles ? [0, 1].flatMap(n => particles.splats(P.world, cams[n], fine.time, null, rowLaw(P.world, settings.sizes)).map(s => ({ ...s, map: y => rowOf(n, y) }))).sort((a, b) => b.depth - a.depth) : []; // @math the two viewers
          mark?.('particles');
          const look = lookOf(P.world, atmo, fine, first, false, cap, liquids);
          compose(out, index, layers, { L, palette, width: F.width, effects: { ...effectsOf(P.world, cap, atmo), ...look, relief: Boolean(lit) }, splats }); mark?.('composite');
          shown = { G: IDENTITY, out, layers, B: null }; set = null; // back at the reference geometry: the buffers of another are released
          return P;
        }
        if (G.m !== 0) throw new Error('the split screen is never wide: it has no margin');
        artLayersAtIdentity(false);
        const B = buffersFor(G), X = splitOf(B), s = G.s, force = forced.pipeline && G.identity, keys = B.R ? OUTPUT_KEYS : LAYER_KEYS; // the reference look's output layers; its soft ones are cut on the reference grid
        artLayersOf(B, Boolean(packs));
        const viewer = (n, scene, layered, flags, soft) => renderEnhancedScene(P, fine, n, scene, layered, mode, null, opts(fine, atmo, liquids, lit, B, flags, soft, Y.viewRow, packs), G);
        cams[first] = first === 0 ? viewer(first, X.A, X.LA, X.rowsA, X.RA) : viewer(first, X.B, X.LB, X.rowsB, X.RB);
        swapSeat(P); cams[1 - first] = first === 0 ? viewer(1 - first, X.B, X.LB, X.rowsB, X.RB) : viewer(1 - first, X.A, X.LA, X.rowsA, X.RA); swapSeat(P);
        composeSplitAt(X.A, X.B, B.fb, G, G.W, force); for (const k of keys) composeSplitAt(X.LA[k], X.LB[k], B.L[k], G, G.W, force); composeSplitAt(X.rowsA, X.rowsB, B.rows, G, 1);
        if (packs) for (const k of ART_KEYS) composeSplitAt(X.LA.art[k], X.LB.art[k], B.L.art[k], G, G.W, force); // the art layers cut with the others
        if (B.R) for (const k of SOFT_KEYS) composeSplitAt(X.RA[k], X.RB[k], B.R[k], IDENTITY, G.refW); // the reference grid's cut (render/versus.js composeSplit)
        decimate(B, index); mark?.('decimate'); // the reference samples, before the overlays mirror an upside-down viewer's half of the index
        overlaid(P, overlays, index, false, B.kind);
        const flipped = carsBySeat(P).map(c => c.inverted !== 0);
        flipped.forEach((f, n) => { if (f) { flipViewportAt(B.fb, n, G, G.W, force); for (const k of keys) flipViewportAt(B.L[k], n, G, G.W, force); flipViewportAt(B.rows, n, G, 1); if (B.R) for (const k of SOFT_KEYS) flipViewportAt(B.R[k], n, IDENTITY, G.refW); if (packs) for (const k of ART_KEYS) flipViewportAt(B.L.art[k], n, G, G.W, force); } }); // the world mirrored as the overlays mirror the index
        mark?.('overlays');
        const rowOf = (n, y) => { // an output row of a viewer's picture to the screen's (composeSplitAt, then the mirror)
          if (y < s * Y.viewRow || y >= G.H) return -1;
          const row = y - (n === 0 ? 0 : s * Y.shift), top = s * (n === 0 ? Y.flip.first : Y.flip.first - Y.shift), rows = s * Y.flip.rows; // @math the first viewer keeps its rows
          return flipped[n] && row >= top && row < top + rows ? top + rows - 1 - (row - top) : row; // @math the mirrored row
        };
        const splats = settings.particles ? [0, 1].flatMap(n => particles.splats(P.world, cams[n], fine.time, G, rowLaw(P.world, settings.sizes)).map(sp => ({ ...sp, map: y => rowOf(n, y) }))).sort((a, b) => b.depth - a.depth) : []; // @math the two viewers
        mark?.('particles');
        const look = lookOf(P.world, atmo, fine, first, false, cap, liquids, B);
        composeAt(B, out, index, layers, { L: B.L, palette, effects: { ...effectsOf(P.world, cap, atmo), ...look, relief: Boolean(lit) }, splats }, splitSample(G, flipped));
        shown = { G, out, layers, B };
        return P;
      });
    },

    // An overlay over a picture already composed (the menu of a lost race over its last frame, the loading card's banner): the caller has drawn
    // `overlay(fb)` into `index`, and it runs here into the sentinel buffer; its pixels come from the palette, the others from `base`. With
    // `kept` (keepLayers: the layers of that frame drawn above the reference geometry) it also returns the layers the display shows, the
    // world kept at its own size with the overlay's pixels over it: in the HUD layer (`hudLayer`, over the HUD the frame had), else stamped into
    // the world as s x s blocks (and the frame's own HUD layer with them). The overlay is centred (moved by m) as the forced overlays of a frame
    // are (it is a menu or a card's banner over the whole picture), whatever the HUD place; the kept frame's HUD keeps its places (M9's edges
    // too). Without `kept` it returns `out`.
    drawOver({ out, base, index, palette, overlay, kept = null, hudLayer = false }) {
      sentinel.fill(SENTINEL); overlay(sentinel); overlayMask(sentinel, mask);
      for (let i = 0; i < mask.length; i++) { const o = i * 4, p = index[i] * 4; for (let k = 0; k < 4; k++) out[o + k] = mask[i] ? palette[p + k] : base[o + k]; } // @math four bytes a colour
      if (!kept) return out;
      const { world, hud, logical } = kept, s = world.h / F.height, m = (logical.w - F.width) / 2, hudSize = logical.w * F.height * 4, place = hudPlaces(geometryOf({ s, m })); // @math the margins on either side; four bytes a colour
      if (over.world.length !== world.data.length) over.world = new Uint8ClampedArray(world.data.length);
      if (over.hud.length !== hudSize) over.hud = new Uint8ClampedArray(hudSize);
      over.world.set(world.data); if (hud) over.hud.set(hud.data); else over.hud.fill(0);
      const hud32 = words(over.hud), colours = paintOf(palette);
      for (let i = 0; i < size; i++) if (mask[i]) hud32[place.hud[i]] = colours[index[i]]; // the overlay at its place in the HUD layer (hud-place.js)
      if (hudLayer) return { world: { data: over.world, w: world.w, h: world.h }, hud: { data: over.hud, w: logical.w, h: F.height }, logical: { ...logical } };
      stampHud(words(over.world), hud32, s, world.w, logical.w);
      return { world: { data: over.world, w: world.w, h: world.h }, hud: null, logical: { ...logical } };
    },

    // A copy of the last frame's layers when it was drawn above the reference geometry (the page keeps it for the screens that show the race's
    // last frame: the menu of a lost race, the loading card; the enhancer's own buffers are drawn over by the next frame), else null (at the
    // reference geometry the canvas is the picture).
    keepLayers() {
      const l = shown?.B ? api.layers() : null;
      return l ? { world: { data: l.world.data.slice(), w: l.world.w, h: l.world.h }, hud: l.hud ? { data: l.hud.data.slice(), w: l.hud.w, h: l.hud.h } : null, logical: { ...l.logical } } : null;
    },

    // The last frame's layers for the display (Stage 4): { world: { data, w, h }, hud: { data, w, h } or null, logical: { w, h } }. Away from the
    // reference geometry the world is the geometry's RGBA picture (G.W x G.H; with the overlays stamped in when the frame had no HUD layer) and
    // the HUD its refW x 200 layer; at the reference geometry they are the caller's: its world and HUD layers, or the canvas alone. The logical
    // size is the reference grid's, refW x 200. Null before the first frame.
    layers() {
      if (!shown) return null;
      const { G, out, layers, B } = shown, logical = { w: G.refW, h: F.height };
      if (!B) return { world: { data: layers ? layers.world : out, w: F.width, h: F.height }, hud: layers ? { data: layers.hud, w: F.width, h: F.height } : null, logical };
      return { world: { data: B.world, w: G.W, h: G.H }, hud: layers ? { data: B.hud, w: G.refW, h: F.height } : null, logical };
    },

    // The last frame's layers, its overlay mask, its geometry, the kinds of its reference samples, its world's indices before the overlays
    // (`fb`: the geometry's own, or at the reference geometry the page's index as it was before the overlays drew), the soft layers of the
    // reference look (refW x 200, or null), the probes the wide view has taken since the enhancer was made, and with `trace` the frame's trace
    // (scene.js opts.trace; the split screen's is its last viewer's) and particle discs, for the checks (scripts/check-enhance.js). `hud` is the
    // placement of the last single view drawn away from the reference geometry (M9, placeOf's: its `place`, 'centred' or 'edges', the guard that
    // centred it or null, and centred `hud` and `world`, or the edges' `layers`, the base and the forced overlays, each { mask, values, hud, world },
    // only their pixels' entries the frame's), or null, with the frames the guards have centred since the enhancer was made (`guards`).
    inspect: () => ({ ...(shown?.B ? { L: shown.B.L, mask, G: shown.G, kind: shown.B.kind, fb: shown.B.fb, R: shown.B.R } : { L, mask, G: IDENTITY, kind: L.kind, fb: under, R: null }), art: Boolean((shown?.B ? shown.B.L : L).art), probes: wide.probes, trace: traced, splats: splatted, hud: shown?.B && shown.placed ? shown.placed : null, guards: { ...guards } }),

    // The readout: the delay smooth motion adds (mean since the last call), the particles alive, the mean time of a frame's draw (`ms`, over the
    // frames of the window being counted, or the last window's before its first frame), the mean over the last whole window of TIMING_FRAMES
    // frames (`window`, null before one is complete: the page's budget hint) and the last frame's; with `stages` the mean time of each stage of
    // a frame and the mean count of the sky rows the composite took on its fast path (both since the last call).
    stats() {
      const ms = timing.count ? timing.sum / timing.count : timing.window ?? 0;
      const out = { delay: motion.takeDelay(), particles: particles.count, marks: marks.count, ms, window: timing.window, last: timing.last };
      if (clock) { out.stages = Object.fromEntries(Object.entries(clock.sums).map(([k, v]) => [k, clock.frames ? v / clock.frames : 0])); out.fastRows = clock.frames ? fastRows.fast / clock.frames : 0; clock.sums = {}; clock.frames = 0; fastRows.fast = 0; }
      return out;
    },
  };
  return api;
}
