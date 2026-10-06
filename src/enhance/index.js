// The Enhanced presentation of the race screens (docs/enhancements.md, first milestone): smooth motion between the simulation's ticks,
// contact shadows, surface particles and distance fog, over the original artwork at the original resolution. The page keeps drawing
// through the reference renderer whenever every effect is off. This module reads the race state and never writes it: what it keeps
// (the snapshots of the last two ticks, the particles) is its own and is dropped on every reset.
import { frameMs } from '../game/clock.js';
import { carsBySeat, swapSeat } from '../game/versus.js';
import { LAYOUT } from '../game/versus-rules.js';
import { composeSplit, flipViewport } from '../render/versus.js';
import { EFFECTS, LOOK_EFFECTS, FOG, SHADOW, CLOUDS, TIMING_FRAMES } from './config.js';
import { loadSettings, saveSettings, normalize, anyEffect } from './settings.js';
import { createMotion, present } from './motion.js';
import { createParticles } from './particles.js';
import { createLayers, renderEnhancedScene, LAYER_KEYS } from './scene.js';
import { KIND } from './project.js';
import { createMarks } from './marks.js';
import { composite, overlayMask, fogColor, fogRamp, SENTINEL } from './composite.js';
import { models } from './models.js';
import { loadAtmospheres, normalizeAtmosphere, sunAngleOf, sunLengthOf, fogTintOf } from './atmosphere.js';
import { coverClouds, skyRowColours, stripSkyIndices } from './clouds.js';
import { gradeOf } from './grade.js';
import { coverRange, rangeColours } from './ranges.js';
import { liquidsOf, waterColours } from './water.js';
import { groundRelief, sunVector } from './relief.js';

// `storage` keeps the settings and holds the tracks' atmospheres (atmosphere.js); `atmosphere(name)`, when given, is asked for a track's
// atmosphere instead (the track editor's preview of the values being edited, the viewer's of the stored ones). `relief` gives the player's
// own relief maps (relief-store.js createReliefProvider: tiles(member) and frame(bytes)), or null for the generated ones only.
export function createEnhancer({ storage = undefined, atmosphere = null, relief = null } = {}) { // undefined: the browser's storage, looked up where it is read (settings.js, atmosphere.js)
  const F = models().floor, size = F.width * F.height;
  let settings = loadSettings(storage), ramps = new WeakMap(), stored = atmosphere ? null : loadAtmospheres(storage);
  const atmosphereOf = world => normalizeAtmosphere((atmosphere ? atmosphere(world.name) : stored[world.name]) ?? {});
  const motion = createMotion(), particles = createParticles(), marks = createMarks(), timing = { sum: 0, count: 0, last: 0 };
  const L = createLayers(size), LA = createLayers(size), LB = createLayers(size), sceneA = new Uint8Array(size), sceneB = new Uint8Array(size), mask = new Uint8Array(size), sentinel = new Uint16Array(size), under = new Uint8Array(size), none = new Uint8Array(size);

  // The relief of a world when the track lighting shows it (the switch, the track's relief above 0): the ground's heights, the sun.
  const reliefOf = (world, atmo) => {
    if (!settings.lighting || !(atmo.relief > 0)) return null;
    const length = sunLengthOf(atmo);
    return { ground: groundRelief(world, relief?.tiles ?? null), sun: sunVector(world, sunAngleOf(atmo, settings.sunAngle), length), length, strength: atmo.relief, frameHeights: relief?.frame ?? null };
  };
  const opts = (fine, atmo, liquids, lit = null) => ({ subPixel: settings.smooth, shadows: settings.shadows, sceneryShadows: settings.sceneryShadows, sunShadows: settings.sunShadows, sunAngle: sunAngleOf(atmo, settings.sunAngle), sunLength: sunLengthOf(atmo), band: SHADOW.bottomBand, marks: settings.skidMarks ? marks : null, now: fine.time, water: liquids ? { liquids, strength: atmo.water, beach: Boolean(liquids.beach) } : null, relief: lit });
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
  // demo's slide.
  const overlaid = (P, overlays, index, trackSky = false) => {
    under.set(index); overlays(P, index); sentinel.fill(SENTINEL); overlays(P, sentinel); overlayMask(sentinel, mask);
    if (trackSky) for (let i = 0; i < mask.length; i++) if (mask[i] && L.kind[i] === KIND.sky && index[i] === under[i]) mask[i] = 0;
  };
  // The frame's composite. With `layers` (the display's HUD layer) the world is composed everywhere, the overlays' pixels too, into
  // `layers.world` from the picture before the overlays (`under`), and `out` is that world with the overlays' pixels put back from the
  // palette: the same picture as without layers, since the effects of a pixel depend only on its world index and its layers.
  const compose = (out, index, layers, args) => {
    if (!layers) { composite(out, { ...args, index, mask }); return; }
    composite(layers.world, { ...args, index: under, mask: none });
    const { world, hud } = layers, palette = args.palette;
    for (let i = 0, o = 0; i < size; i++, o += 4) { // @math four bytes a colour
      if (mask[i]) { const p = index[i] * 4; for (let k = 0; k < 3; k++) { out[o + k] = palette[p + k]; hud[o + k] = palette[p + k]; } out[o + 3] = 0xff; hud[o + 3] = 0xff; } // @math four bytes a colour, three components; opaque
      else { for (let k = 0; k < 4; k++) out[o + k] = world[o + k]; hud[o] = 0; hud[o + 1] = 0; hud[o + 2] = 0; hud[o + 3] = 0; } // @math four bytes a colour; no overlay (premultiplied)
    }
  };
  const timed = (fn) => { const t0 = performance.now(), out = fn(); timing.last = performance.now() - t0; timing.sum += timing.last; timing.count++; return out; };
  const composeLayers = () => { for (const k of LAYER_KEYS) composeSplit(LA[k], LB[k], L[k]); };
  const S = models().sky, cloudCover = CLOUDS.layers.map(() => ({ alpha: new Float32Array(S.width * S.skyRows), light: new Float32Array(S.width * S.skyRows) }));
  const rangeSize = S.width * (S.skyRows + S.horizonRows), rangeCover = { alpha: new Uint8Array(rangeSize), tone: new Float32Array(rangeSize), snow: new Uint8Array(rangeSize) };
  const rowsMixed = (rows, toward, t, cap) => rows.map((v, i) => Math.min(v + ((toward ? toward[i] : 0xff) - v) * t, cap)); // @math toward white when no colour is given
  const litRows = (rows, light, cap) => rows.map((v, i) => { const k = i - (i % 3), grey = (rows[k] + rows[k + 1] + rows[k + 2]) / 3 / 0xff; return Math.min(v + (0xff - v) * light * Math.min(Math.max(grey / CLOUDS.brightSky, CLOUDS.dimLight), 1), cap); }); // @math the row's three components; 8-bit to 0 to 1
  // The look of the frame: the lighting grade of the track's atmosphere; over the track's sky (`trackSky`: a single view of a race, not a
  // demo's slide, not the split screen) the grade's gradient, the far range and the clouds, which turn with the viewer's horizon strip; the
  // water's colours when `liquids` move.
  const lookOf = (world, atmo, fine, seat, trackSky, cap, liquids) => {
    const grade = settings.lighting ? gradeOf(atmo.grade, atmo.gradeStrength) : null, clouds = settings.clouds && atmo.clouds > 0, range = settings.clouds && atmo.range > 0;
    const haze = fogTintOf(atmo, fogColor(world)), scroll = (fine.seats[seat]?.sky ?? 0) * S.pixelsPerByte;
    let sky = null, water = null;
    if (liquids) { // the water mirrors the haze, toward the lighting's sky at the horizon as the sky goes
      const g = grade?.sky, k = (S.skyRows - 1) * 3, mirror = g ? haze.map((v, j) => v + (g.colours[k + j] - v) * g.amount) : haze; // @math the sky's last row, three components
      water = waterColours(world, mirror, cap, atmo.water, liquids.beach);
    }
    if (trackSky && (grade || clouds || range)) {
      const base = skyRowColours(world).map(v => Math.min(v, cap)), tint = grade ? { colours: grade.sky.colours.map(v => Math.min(v, cap)), amount: grade.sky.amount } : null, under = tint ? rowsMixed(base, tint.colours, tint.amount, cap) : base; // all within the demo's fade
      const layers = [], far = range && coverRange(rangeCover, { height: atmo.range, shape: atmo.rangeShape, scroll }) ? { cover: rangeCover, colours: rangeColours(under, haze.map(v => Math.min(v, cap)), cap) } : null;
      if (clouds) {
        coverClouds(cloudCover, { amount: atmo.clouds, speed: atmo.cloudSpeed, scroll, time: fine.time });
        CLOUDS.layers.forEach((layer, n) => { // a bank's lit colour is the sky of its row toward white; its shaded base between that and the sky
          const lit = litRows(under, grade ? layer.light + (grade.cloudLight - layer.light) * grade.strength : layer.light, cap);
          layers.push({ ...cloudCover[n], lit, shade: lit.map((v, i) => v + (under[i] - v) * layer.shade) });
        });
      }
      sky = { rows: S.skyRows, stripRows: S.horizonRows, strip: tint || far ? stripSkyIndices(world) : null, tint, range: far, clouds: layers };
    }
    return { sky, water, grade: grade ? { ...grade, trackSky } : null };
  };

  const api = {
    get settings() { return settings; },
    active: () => anyEffect(settings),
    // New settings, kept in this browser; a switch that changed starts a new scene (no snapshot or particle of the old mode is kept).
    configure(next) {
      const before = settings; settings = normalize(next); saveSettings(settings, storage);
      if (EFFECTS.some(k => !LOOK_EFFECTS.includes(k) && before[k] !== settings[k]) || anyEffect(before) !== anyEffect(settings)) api.reset(); // the sky's layers, the lighting and the water only colour the picture, but with every effect off no snapshot was taken
      return settings;
    },
    // A new scene (a race start, a restart, a round, a mode change): no snapshot, no particle survives it. The stored atmospheres are read
    // again (the track editor may have changed them in another tab).
    reset() { motion.reset(); particles.clear(); marks.clear(); if (!atmosphere) stored = loadAtmospheres(storage); },
    // The atmosphere a world is drawn with.
    atmosphereOf,
    // After every completed tick of the race; `sounds` are the tick's sounds when the page has already taken them out of the state.
    afterTick(state, { sounds = state.sounds } = {}) {
      if (!anyEffect(settings)) return;
      const { prev, cur } = motion.tick(state, frameMs(), sounds);
      if (settings.particles) particles.emit(state, prev, cur, settings.particleAmount);
      if (settings.skidMarks) marks.emit(prev, cur);
    },

    // One full-screen view. `seat` 1 draws the second human of a link race; `overlays(P, fb)` draws everything over the world into fb from
    // the present state P (it runs twice: into the picture and into the sentinel buffer); `out` the RGBA bytes; `cap` the demo's fade.
    drawSingle(state, alpha, { index, out, palette, mode, sky = null, overlays, seat = 0, cap = 255, layers = null }) { // @math the brightest 8-bit component
      return timed(() => {
        const { fine, P } = view(state, alpha);
        if (seat === 1) swapSeat(P); // @math the second player's seat
        const atmo = atmosphereOf(P.world), liquids = liquidsOn(P.world, atmo), lit = reliefOf(P.world, atmo), camera = renderEnhancedScene(P, fine, seat, index, L, mode, sky, opts(fine, atmo, liquids, lit));
        overlaid(P, overlays, index, !sky);
        const splats = settings.particles ? particles.splats(P.world, camera, fine.time).map(s => ({ ...s, map: y => y })) : [];
        compose(out, index, layers, { L, palette, width: F.width, effects: { ...effectsOf(P.world, cap, atmo), ...lookOf(P.world, atmo, fine, seat, !sky, cap, liquids), relief: Boolean(lit) }, splats });
        return P;
      });
    },

    // The split screen of the two player modes (versus.layout): each viewer's world drawn and cut into its half, the layers with it, the
    // overlays (the strips, the HUD, the flips of an inverted car, the message, the menu) over both.
    drawSplit(state, alpha, { index, out, palette, mode, overlays, cap = 255, layers = null }) { // @math the brightest 8-bit component
      return timed(() => {
        const { fine, P } = view(state, alpha), Y = LAYOUT(), first = P.versus.viewer, cams = [], atmo = atmosphereOf(P.world), liquids = liquidsOn(P.world, atmo), lit = reliefOf(P.world, atmo);
        cams[first] = renderEnhancedScene(P, fine, first, first === 0 ? sceneA : sceneB, first === 0 ? LA : LB, mode, null, opts(fine, atmo, liquids, lit));
        swapSeat(P); cams[1 - first] = renderEnhancedScene(P, fine, 1 - first, first === 0 ? sceneB : sceneA, first === 0 ? LB : LA, mode, null, opts(fine, atmo, liquids, lit)); swapSeat(P);
        composeSplit(sceneA, sceneB, index); composeLayers();
        overlaid(P, overlays, index);
        const flipped = carsBySeat(P).map(c => c.inverted !== 0);
        flipped.forEach((f, n) => { if (f) { for (const k of LAYER_KEYS) flipViewport(L[k], n); if (layers) flipViewport(under, n); } }); // the world before the overlays flipped as they flip the picture
        const rowOf = (n, y) => { // a row of a viewer's picture to the screen (composeSplit, then the flip)
          if (y < Y.viewRow || y >= F.height) return -1;
          const row = y - (n === 0 ? 0 : Y.shift), top = n === 0 ? Y.flip.first : Y.flip.first - Y.shift; // @math the first viewer keeps its rows
          return flipped[n] && row >= top && row < top + Y.flip.rows ? top + Y.flip.rows - 1 - (row - top) : row; // @math the mirrored row
        };
        const splats = settings.particles ? [0, 1].flatMap(n => particles.splats(P.world, cams[n], fine.time).map(s => ({ ...s, map: y => rowOf(n, y) }))).sort((a, b) => b.depth - a.depth) : []; // @math the two viewers
        compose(out, index, layers, { L, palette, width: F.width, effects: { ...effectsOf(P.world, cap, atmo), ...lookOf(P.world, atmo, fine, first, false, cap, liquids), relief: Boolean(lit) }, splats });
        return P;
      });
    },

    // An overlay over a picture already composed (the menu of a lost race over its last frame): `overlay(fb)` runs into `index` and into the
    // sentinel buffer; its pixels come from the palette, the others from `base`.
    drawOver({ out, base, index, palette, overlay }) {
      sentinel.fill(SENTINEL); overlay(sentinel); overlayMask(sentinel, mask);
      for (let i = 0; i < mask.length; i++) { const o = i * 4, p = index[i] * 4; for (let k = 0; k < 4; k++) out[o + k] = mask[i] ? palette[p + k] : base[o + k]; } // @math four bytes a colour
      return out;
    },

    // The last frame's layers and overlay mask, for the checks (scripts/check-enhance.js).
    inspect: () => ({ L, mask }),

    // The readout: the delay smooth motion adds (mean since the last call), the particles alive, the mean time of a frame's draw.
    stats() {
      const ms = timing.count ? timing.sum / timing.count : 0;
      if (timing.count >= TIMING_FRAMES) { timing.sum = 0; timing.count = 0; }
      return { delay: motion.takeDelay(), particles: particles.count, marks: marks.count, ms, last: timing.last };
    },
  };
  return api;
}
