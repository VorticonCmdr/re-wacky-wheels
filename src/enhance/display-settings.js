// The display settings of the page (src/enhance/display.js puts the picture on the screen with them): the shape, the scaling, the CRT look
// and its three levels, the HUD layer, kept in this browser's storage apart from the graphics settings, the game files and the game's own settings. Full
// screen is not a setting: the browser enters it only on a key or a click, so it is the document's state (`fullscreen` in displayView).
import { DISPLAY, DISPLAY_MENU, MENU } from './config.js';

const LEVELS = ['scanlines', 'glow', 'curvature'];
export const CRT_LEVELS = LEVELS;
const clampLevel = v => Math.round(Math.min(Math.max(Number(v), 0), 1) * DISPLAY.levelSteps) / DISPLAY.levelSteps;

// A settings object from anything (stored JSON, a form): unknown keys and values dropped, the levels within 0 to 1.
export function normalizeDisplay(input = {}) {
  const D = DISPLAY.defaults, out = { ...D };
  if (typeof input?.aspect === 'string' && Object.hasOwn(DISPLAY.aspects, input.aspect)) out.aspect = input.aspect;
  if (DISPLAY.scalings.includes(input?.scaling)) out.scaling = input.scaling;
  if (typeof input?.crt === 'boolean') out.crt = input.crt;
  if (DISPLAY.huds.includes(input?.hud)) out.hud = input.hud;
  for (const k of LEVELS) if (input?.[k] !== null && input?.[k] !== '' && Number.isFinite(Number(input?.[k]))) out[k] = clampLevel(input[k]);
  return out;
}

export const resetDisplay = () => normalizeDisplay(DISPLAY.defaults);
export const changeDisplay = (settings, key, value) => normalizeDisplay({ ...settings, [key]: value });

// Whether the settings are the page as it was (square pixels, fit, no CRT look, the HUD in the picture; not the defaults, which are 4:3): the
// page then shows its 320 x 200 canvas scaled by the browser as before.
export const isPlain = settings => { const s = normalizeDisplay(settings), P = DISPLAY.plain; return s.aspect === P.aspect && s.scaling === P.scaling && s.hud === P.hud && !s.crt; };

export function loadDisplay(storage) { // `storage` defaults to the browser's, looked up inside the try (a browser may refuse it)
  try { const kept = (storage === undefined ? globalThis.localStorage : storage)?.getItem(DISPLAY.storageKey); if (kept) return normalizeDisplay(JSON.parse(kept)); } catch { /* no storage or a broken entry: the defaults */ }
  return resetDisplay();
}

export function saveDisplay(settings, storage) {
  try { (storage === undefined ? globalThis.localStorage : storage)?.setItem(DISPLAY.storageKey, JSON.stringify(normalizeDisplay(settings))); return true; } catch { return false; }
}

// The words the game menu shows (src/game/display-menu.js lays them out): the shape, the scaling, full screen, the CRT switch, each level as a
// percentage (OFF at 0) and the HUD layer. `crtReady` is false where the browser has no WebGL 2: the CRT and HUD lines then say so.
export function displayView(settings, { fullscreen = false, crtReady = true } = {}) {
  const s = normalizeDisplay(settings), word = v => (v === 0 ? MENU.off : String(Math.round(v * MENU.percent)));
  return {
    aspect: DISPLAY_MENU.aspects[s.aspect], scaling: DISPLAY_MENU.scalings[s.scaling], hud: crtReady ? DISPLAY_MENU.huds[s.hud] : DISPLAY_MENU.huds.picture,
    on: { fullscreen, crt: s.crt && crtReady }, crtReady,
    levels: Object.fromEntries(LEVELS.map(k => [k, word(s[k])])),
  };
}

// What Enter on a menu line does: the shape and the scaling go to the next choice, the CRT look flips, a level goes up a quarter (from full to
// off), DEFAULT LEVELS puts the CRT levels back.
const next = (list, value) => list[(list.indexOf(value) + 1) % list.length];
export const nextAspect = settings => changeDisplay(settings, 'aspect', next(Object.keys(DISPLAY.aspects), settings.aspect));
export const nextScaling = settings => changeDisplay(settings, 'scaling', next(DISPLAY.scalings, settings.scaling));
export const nextHud = settings => changeDisplay(settings, 'hud', next(DISPLAY.huds, settings.hud));
export const toggleCrt = settings => changeDisplay(settings, 'crt', !settings.crt);
export function cycleCrtLevel(settings, key) {
  const steps = Math.round(1 / MENU.strengthStep), at = Math.floor(settings[key] * steps + 1e-9) + 1; // @math the next quarter above the level (a level between quarters goes to the next)
  return changeDisplay(settings, key, at > steps ? 0 : at / steps);
}
export const defaultCrtLevels = settings => normalizeDisplay({ ...settings, ...Object.fromEntries(LEVELS.map(k => [k, DISPLAY.defaults[k]])) });
