// The graphics settings of the page: the preset, the effect switches, the intensity levels and how the race world is rendered (RENDER, Stage 4),
// kept in this browser's storage apart from the game files, the track data and the game's own settings.
import { EFFECTS, PRESETS, LEVELS, LEVEL_STEPS, DEFAULTS, STORAGE_KEY, MENU, RENDER, RENDER_MENU } from './config.js';

const clampLevel = v => Math.round(Math.min(Math.max(Number(v), 0), 1) * LEVEL_STEPS) / LEVEL_STEPS;
const RENDER_KEYS = Object.keys(RENDER.defaults);
// The values each rendering choice allows (a stored value outside its list takes the default).
const ALLOWED = { scale: RENDER.scales, view: Object.keys(RENDER.views), hudPlace: RENDER.hudPlaces, sizes: RENDER.sizes, angles: RENDER.angles, art: [false, true] };

// A settings object from anything (stored JSON, a form): unknown keys dropped, switches as booleans, levels within 0 to 1, each rendering choice
// one of its values, the preset recomputed. A switch the input does not have (one added since the settings were stored) takes the value of the
// preset they were stored under, so a player of Enhanced keeps Enhanced; a rendering choice it does not have takes its default, so settings
// stored before Stage 4 draw as they did.
export function normalize(input = {}) {
  const out = { ...DEFAULTS }, stored = typeof input?.preset === 'string' && Object.hasOwn(PRESETS, input.preset) ? PRESETS[input.preset] : null;
  for (const k of EFFECTS) { if (typeof input?.[k] === 'boolean') out[k] = input[k]; else if (stored) out[k] = stored[k]; }
  for (const k of Object.keys(LEVELS)) if (Number.isFinite(Number(input?.[k])) && input?.[k] !== null && input?.[k] !== '') out[k] = clampLevel(input[k]);
  for (const k of RENDER_KEYS) { const v = k === 'scale' && typeof input?.[k] === 'string' && input[k] !== '' ? Number(input[k]) : input?.[k]; if (ALLOWED[k].includes(v)) out[k] = v; } // a form's select gives the scale as text
  out.preset = presetOf(out);
  return out;
}

// Whether every rendering choice is at its default.
export const renderDefault = settings => RENDER_KEYS.every(k => settings[k] === RENDER.defaults[k]);

// 'original' when the switches are Original's and no rendering choice turns the enhanced path on (Original is the reference renderer at 320 x 200;
// the HUD place and the kart angles only refine the wide view and the artwork, so they do not count); 'enhanced' when the switches are Enhanced's,
// whatever the rendering choices; else 'custom' (Original's switches at twice the resolution, say).
export function presetOf(settings) {
  if (EFFECTS.every(k => settings[k] === PRESETS.original[k]) && !renderActive(settings)) return 'original';
  if (EFFECTS.every(k => settings[k] === PRESETS.enhanced[k])) return 'enhanced';
  return 'custom';
}

// The switches of a preset (the levels are kept): Original puts every rendering choice back to its default, Enhanced keeps them.
export const applyPreset = (settings, name) => (PRESETS[name] ? normalize({ ...settings, ...PRESETS[name], ...(name === 'original' ? RENDER.defaults : {}) }) : normalize(settings));

// One switch, level or rendering choice changed.
export const change = (settings, key, value) => normalize({ ...settings, [key]: value });

// Back to the defaults: the Original preset, full levels and the rendering choices' defaults.
export const resetSettings = () => normalize(DEFAULTS);

// Whether an effect is on.
export const anyEffect = settings => EFFECTS.some(k => settings[k]);

// Whether a rendering choice changes what is drawn by itself: a scale above 1, the wide view, smooth sizes or the artwork (the HUD place and the
// kart angles only refine those).
export const renderActive = settings => settings.scale !== RENDER.defaults.scale || settings.view !== RENDER.defaults.view || settings.sizes !== RENDER.defaults.sizes || settings.art === true;

// Whether the page draws the race through the enhanced path at all: with every switch off and every rendering choice at its default it draws
// the reference renderer.
export const enhancedOn = settings => anyEffect(settings) || renderActive(settings);

export function loadSettings(storage) { // `storage` defaults to the browser's, looked up inside the try (a browser may refuse it)
  try { const kept = (storage === undefined ? globalThis.localStorage : storage)?.getItem(STORAGE_KEY); if (kept) return normalize(JSON.parse(kept)); } catch { /* no storage or a broken entry: the defaults */ }
  return resetSettings();
}

export function saveSettings(settings, storage) {
  try { (storage === undefined ? globalThis.localStorage : storage)?.setItem(STORAGE_KEY, JSON.stringify(normalize(settings))); return true; } catch { return false; }
}

// The words the game menu shows for the settings (src/game/graphics-menu.js lays them out): the preset, the switches, each level as a percentage
// (OFF at 0) or, for the sun, the side of the track map it shines from; whether the enhanced path draws (`active`); and the rendering choices
// for the RENDERING list (`render`: the words of the resolution, the view, the sizes and the angles, the artwork switch and whether it can be
// shown, `artReady`, which the menu turns into the game's ON and OFF, or NONE). `worldReady` is whether the display can show a world of another
// size than 320 x 200 (WebGL 2), `packs` how many artwork packs are stored and `angleSets` how many of those have extra kart angles: a choice
// that cannot be shown says NONE.
export function menuView(settings, { worldReady = true, packs = 0, angleSets = 0 } = {}) {
  const s = normalize(settings), sun = MENU.sunNames.length, word = v => (v === 0 ? MENU.off : String(Math.round(v * MENU.percent))), R = RENDER_MENU;
  return {
    preset: MENU.presets[s.preset],
    on: Object.fromEntries(EFFECTS.map(k => [k, s[k]])),
    levels: { shadowStrength: word(s.shadowStrength), fogStrength: word(s.fogStrength), particleAmount: word(s.particleAmount), sunAngle: MENU.sunNames[((Math.round(s.sunAngle * sun) % sun) + sun) % sun] },
    active: enhancedOn(s),
    render: {
      scale: worldReady ? R.scales[s.scale] : R.none,
      view: worldReady ? R.views[s.view] : R.none, // the placement drawn: a stored 'edges' draws centred until M9 builds it, which brings back WIDE EDGES
      sizes: R.sizeNames[s.sizes],
      angles: angleSets > 0 ? R.angleNames[s.angles] : R.none,
      art: s.art,
      artReady: packs > 0,
    },
  };
}

// What Enter on a menu line does: the preset goes from Original to Enhanced and from either other to Original (which puts the rendering choices
// back), a switch flips, a strength goes up a quarter (from full to off), the sun goes on an eighth of a turn, DEFAULT LEVELS puts the levels back,
// a rendering choice (RENDERING: RESOLUTION, VIEW, SPRITE SIZES) goes to its next value.
export const nextPreset = settings => applyPreset(settings, settings.preset === 'original' ? 'enhanced' : 'original');
export const toggle = (settings, key) => change(settings, key, !settings[key]);
export function cycleLevel(settings, key) {
  if (key === 'sunAngle') { const n = MENU.sunNames.length; return change(settings, key, ((Math.round(settings.sunAngle * n) + 1) % n) / n); }
  const steps = Math.round(1 / MENU.strengthStep), at = Math.floor(settings[key] * steps + 1e-9) + 1; // @math the next quarter above the level (a level between quarters goes to the next)
  return change(settings, key, at > steps ? 0 : at / steps);
}
export const defaultLevels = settings => normalize({ ...settings, ...LEVELS });
// Whether a menu's { cycle } names a rendering choice (cycleRender) rather than a level (cycleLevel).
export const isRenderChoice = key => Object.hasOwn(ALLOWED, key) && key !== 'art';
export function cycleRender(settings, key) {
  if (!isRenderChoice(key)) throw new Error(`no rendering choice '${key}'`);
  const list = ALLOWED[key], at = list.indexOf(settings[key]);
  return change(settings, key, list[(at + 1) % list.length]);
}
