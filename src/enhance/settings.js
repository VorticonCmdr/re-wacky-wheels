// The graphics settings of the page: the preset, the effect switches and the intensity levels, kept in this browser's storage apart from
// the game files, the track data and the game's own settings.
import { EFFECTS, PRESETS, LEVELS, LEVEL_STEPS, DEFAULTS, STORAGE_KEY, MENU } from './config.js';

const clampLevel = v => Math.round(Math.min(Math.max(Number(v), 0), 1) * LEVEL_STEPS) / LEVEL_STEPS;

// A settings object from anything (stored JSON, a form): unknown keys dropped, switches as booleans, levels within 0 to 1, the preset recomputed.
// A switch the input does not have (one added since the settings were stored) takes the value of the preset they were stored under, so a
// player of Enhanced keeps Enhanced.
export function normalize(input = {}) {
  const out = { ...DEFAULTS }, stored = typeof input?.preset === 'string' && Object.hasOwn(PRESETS, input.preset) ? PRESETS[input.preset] : null;
  for (const k of EFFECTS) { if (typeof input?.[k] === 'boolean') out[k] = input[k]; else if (stored) out[k] = stored[k]; }
  for (const k of Object.keys(LEVELS)) if (Number.isFinite(Number(input?.[k])) && input?.[k] !== null && input?.[k] !== '') out[k] = clampLevel(input[k]);
  out.preset = presetOf(out);
  return out;
}

// 'original' or 'enhanced' when the switches are exactly a preset's, else 'custom'.
export function presetOf(settings) {
  for (const [name, p] of Object.entries(PRESETS)) if (EFFECTS.every(k => settings[k] === p[k])) return name;
  return 'custom';
}

// The switches of a preset (the levels are kept).
export const applyPreset = (settings, name) => (PRESETS[name] ? normalize({ ...settings, ...PRESETS[name] }) : normalize(settings));

// One switch or level changed.
export const change = (settings, key, value) => normalize({ ...settings, [key]: value });

// Back to the defaults: the Original preset and full levels.
export const resetSettings = () => normalize(DEFAULTS);

// Whether the page draws through the enhanced path at all: with every switch off it draws the reference renderer.
export const anyEffect = settings => EFFECTS.some(k => settings[k]);

export function loadSettings(storage) { // `storage` defaults to the browser's, looked up inside the try (a browser may refuse it)
  try { const kept = (storage === undefined ? globalThis.localStorage : storage)?.getItem(STORAGE_KEY); if (kept) return normalize(JSON.parse(kept)); } catch { /* no storage or a broken entry: the defaults */ }
  return resetSettings();
}

export function saveSettings(settings, storage) {
  try { (storage === undefined ? globalThis.localStorage : storage)?.setItem(STORAGE_KEY, JSON.stringify(normalize(settings))); return true; } catch { return false; }
}

// The words the game menu shows for the settings (src/game/graphics-menu.js lays them out): the preset, the switches, and each level as a percentage (OFF at 0) or,
// for the sun, the side of the track map it shines from.
export function menuView(settings) {
  const s = normalize(settings), sun = MENU.sunNames.length, word = v => (v === 0 ? MENU.off : String(Math.round(v * MENU.percent)));
  return {
    preset: MENU.presets[s.preset],
    on: Object.fromEntries(EFFECTS.map(k => [k, s[k]])),
    levels: { shadowStrength: word(s.shadowStrength), fogStrength: word(s.fogStrength), particleAmount: word(s.particleAmount), sunAngle: MENU.sunNames[((Math.round(s.sunAngle * sun) % sun) + sun) % sun] },
  };
}

// What Enter on a menu line does: the preset goes from Original to Enhanced and from either other to Original, a switch flips, a strength goes up a quarter (from full
// to off), the sun goes on an eighth of a turn, DEFAULT LEVELS puts the levels back.
export const nextPreset = settings => applyPreset(settings, settings.preset === 'original' ? 'enhanced' : 'original');
export const toggle = (settings, key) => change(settings, key, !settings[key]);
export function cycleLevel(settings, key) {
  if (key === 'sunAngle') { const n = MENU.sunNames.length; return change(settings, key, ((Math.round(settings.sunAngle * n) + 1) % n) / n); }
  const steps = Math.round(1 / MENU.strengthStep), at = Math.floor(settings[key] * steps + 1e-9) + 1; // @math the next quarter above the level (a level between quarters goes to the next)
  return change(settings, key, at > steps ? 0 : at / steps);
}
export const defaultLevels = settings => normalize({ ...settings, ...LEVELS });
