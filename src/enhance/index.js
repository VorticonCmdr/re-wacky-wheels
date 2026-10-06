// The Enhanced presentation of the race screens (docs/enhancements.md, first milestone): smooth motion between the simulation's ticks,
// contact shadows, surface particles and distance fog, over the original artwork at the original resolution. The page keeps drawing
// through the reference renderer whenever every effect is off. This module reads the race state and never writes it: what it keeps
// (the snapshots of the last two ticks, the particles) is its own and is dropped on every reset.
import { frameMs } from '../game/clock.js';
import { carsBySeat, swapSeat } from '../game/versus.js';
import { LAYOUT } from '../game/versus-rules.js';
import { composeSplit, flipViewport } from '../render/versus.js';
import { EFFECTS, FOG, SHADOW, TIMING_FRAMES } from './config.js';
import { loadSettings, saveSettings, normalize, anyEffect } from './settings.js';
import { createMotion, present } from './motion.js';
import { createParticles } from './particles.js';
import { createLayers, renderEnhancedScene, LAYER_KEYS } from './scene.js';
import { createMarks } from './marks.js';
import { composite, overlayMask, fogColor, fogRamp, SENTINEL } from './composite.js';
import { models } from './models.js';

export function createEnhancer({ storage = globalThis.localStorage } = {}) {
  const F = models().floor, size = F.width * F.height;
  let settings = loadSettings(storage), ramps = new WeakMap();
  const motion = createMotion(), particles = createParticles(), marks = createMarks(), timing = { sum: 0, count: 0, last: 0 };
  const L = createLayers(size), LA = createLayers(size), LB = createLayers(size), sceneA = new Uint8Array(size), sceneB = new Uint8Array(size), mask = new Uint8Array(size), sentinel = new Uint16Array(size);

  const opts = fine => ({ subPixel: settings.smooth, shadows: settings.shadows, sceneryShadows: settings.sceneryShadows, sunShadows: settings.sunShadows, sunAngle: settings.sunAngle, band: SHADOW.bottomBand, marks: settings.skidMarks ? marks : null, now: fine.time });
  const rampOf = world => { let r = ramps.get(world); if (!r) { r = fogRamp(world, settings.fogStrength); ramps.set(world, r); } return r; };
  const effectsOf = (world, cap) => ({ shadow: settings.shadows || settings.sceneryShadows || settings.sunShadows ? settings.shadowStrength : 0, fog: settings.fog ? { color: fogColor(world), ramp: rampOf(world), horizon: FOG.horizon * settings.fogStrength } : null, cap });
  const view = (state, alpha) => { const fine = motion.view(state, settings.smooth ? alpha : 1, frameMs()); return { fine, P: present(state, fine) }; };
  const overlaid = (P, overlays, index) => { overlays(P, index); sentinel.fill(SENTINEL); overlays(P, sentinel); overlayMask(sentinel, mask); };
  const timed = (fn) => { const t0 = performance.now(), out = fn(); timing.last = performance.now() - t0; timing.sum += timing.last; timing.count++; return out; };
  const composeLayers = () => { for (const k of LAYER_KEYS) composeSplit(LA[k], LB[k], L[k]); };

  const api = {
    get settings() { return settings; },
    active: () => anyEffect(settings),
    // New settings, kept in this browser; a switch that changed starts a new scene (no snapshot or particle of the old mode is kept).
    configure(next) {
      const before = settings; settings = normalize(next); saveSettings(settings, storage); ramps = new WeakMap();
      if (EFFECTS.some(k => before[k] !== settings[k])) api.reset();
      return settings;
    },
    // A new scene (a race start, a restart, a round, a mode change): no snapshot, no particle survives it.
    reset() { motion.reset(); particles.clear(); marks.clear(); },
    // After every completed tick of the race; `sounds` are the tick's sounds when the page has already taken them out of the state.
    afterTick(state, { sounds = state.sounds } = {}) {
      if (!anyEffect(settings)) return;
      const { prev, cur } = motion.tick(state, frameMs(), sounds);
      if (settings.particles) particles.emit(state, prev, cur, settings.particleAmount);
      if (settings.skidMarks) marks.emit(prev, cur);
    },

    // One full-screen view. `seat` 1 draws the second human of a link race; `overlays(P, fb)` draws everything over the world into fb from
    // the present state P (it runs twice: into the picture and into the sentinel buffer); `out` the RGBA bytes; `cap` the demo's fade.
    drawSingle(state, alpha, { index, out, palette, mode, sky = null, overlays, seat = 0, cap = 255 }) { // @math the brightest 8-bit component
      return timed(() => {
        const { fine, P } = view(state, alpha);
        if (seat === 1) swapSeat(P); // @math the second player's seat
        const camera = renderEnhancedScene(P, fine, seat, index, L, mode, sky, opts(fine));
        overlaid(P, overlays, index);
        const splats = settings.particles ? particles.splats(P.world, camera, fine.time).map(s => ({ ...s, map: y => y })) : [];
        composite(out, { index, mask, L, palette, width: F.width, effects: effectsOf(P.world, cap), splats });
        return P;
      });
    },

    // The split screen of the two player modes (versus.layout): each viewer's world drawn and cut into its half, the layers with it, the
    // overlays (the strips, the HUD, the flips of an inverted car, the message, the menu) over both.
    drawSplit(state, alpha, { index, out, palette, mode, overlays, cap = 255 }) { // @math the brightest 8-bit component
      return timed(() => {
        const { fine, P } = view(state, alpha), Y = LAYOUT(), first = P.versus.viewer, cams = [];
        cams[first] = renderEnhancedScene(P, fine, first, first === 0 ? sceneA : sceneB, first === 0 ? LA : LB, mode, null, opts(fine));
        swapSeat(P); cams[1 - first] = renderEnhancedScene(P, fine, 1 - first, first === 0 ? sceneB : sceneA, first === 0 ? LB : LA, mode, null, opts(fine)); swapSeat(P);
        composeSplit(sceneA, sceneB, index); composeLayers();
        overlaid(P, overlays, index);
        const flipped = carsBySeat(P).map(c => c.inverted !== 0);
        flipped.forEach((f, n) => { if (f) for (const k of LAYER_KEYS) flipViewport(L[k], n); });
        const rowOf = (n, y) => { // a row of a viewer's picture to the screen (composeSplit, then the flip)
          if (y < Y.viewRow || y >= F.height) return -1;
          const row = y - (n === 0 ? 0 : Y.shift), top = n === 0 ? Y.flip.first : Y.flip.first - Y.shift; // @math the first viewer keeps its rows
          return flipped[n] && row >= top && row < top + Y.flip.rows ? top + Y.flip.rows - 1 - (row - top) : row; // @math the mirrored row
        };
        const splats = settings.particles ? [0, 1].flatMap(n => particles.splats(P.world, cams[n], fine.time).map(s => ({ ...s, map: y => rowOf(n, y) }))).sort((a, b) => b.depth - a.depth) : []; // @math the two viewers
        composite(out, { index, mask, L, palette, width: F.width, effects: effectsOf(P.world, cap), splats });
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
