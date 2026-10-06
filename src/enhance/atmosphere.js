// The atmosphere of each track (docs/enhancements.md, Stage 3): the sun, the fog's colour and strength, the clouds, the far range, the
// water's movement and the lighting grade the Enhanced presentation draws a track with. Set in the track editor, kept in this browser by track number (ATMOSPHERE.storageKey),
// apart from the game files; a track with nothing stored has the defaults.
import { ATMOSPHERE, GRADES, RANGE, SUN } from './config.js';

const D = ATMOSPHERE.defaults;
const level = (v, max = 1) => Math.round(Math.min(Math.max(Number(v), 0), max) * ATMOSPHERE.steps) / ATMOSPHERE.steps;
const isNumber = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)); // a number or the text of one: not an array, a boolean or null
const HEX = /^#[0-9a-f]{6}$/i;

// An atmosphere from anything (stored JSON, a form): unknown keys and values of the wrong type dropped, the levels within their ranges, the
// two "game setting" values (the sun's angle and height) and the strip's fog colour as null.
export function normalizeAtmosphere(input = {}) {
  const out = { ...D }, a = input && typeof input === 'object' ? input : {};
  if (isNumber(a.sunAngle)) out.sunAngle = level(((Number(a.sunAngle) % 1) + 1) % 1) % 1; // a part of a turn: 1 is 0, -0.25 is 0.75
  if (isNumber(a.sunHeight)) out.sunHeight = level(a.sunHeight);
  if (typeof a.fogTint === 'string' && HEX.test(a.fogTint)) out.fogTint = a.fogTint.toLowerCase();
  if (isNumber(a.fog)) out.fog = level(a.fog, ATMOSPHERE.fogMax);
  for (const k of ['clouds', 'cloudSpeed', 'gradeStrength', 'range', 'water', 'relief']) if (isNumber(a[k])) out[k] = level(a[k]);
  if (typeof a.grade === 'string' && GRADES.names.includes(a.grade)) out.grade = a.grade;
  if (typeof a.rangeShape === 'string' && RANGE.names.includes(a.rangeShape)) out.rangeShape = a.rangeShape;
  return out;
}

export const defaultAtmosphere = () => ({ ...D });
export const isDefaultAtmosphere = a => { const n = normalizeAtmosphere(a); return Object.keys(D).every(k => n[k] === D[k]); };

// The stored atmospheres: { [track]: atmosphere }, only the tracks that differ from the defaults.
// `storage` defaults to the browser's, looked up inside the try: a browser that refuses its storage (blocked site data) gives the defaults.
export function loadAtmospheres(storage) {
  try {
    const s = storage === undefined ? globalThis.localStorage : storage, kept = JSON.parse(s?.getItem(ATMOSPHERE.storageKey) ?? 'null'), tracks = kept?.tracks;
    if (!tracks || typeof tracks !== 'object' || Array.isArray(tracks)) return {};
    return Object.fromEntries(Object.entries(tracks).filter(([name]) => /^\d+$/.test(name)).map(([name, a]) => [name, normalizeAtmosphere(a)]));
  } catch { return {}; } // no storage or a broken entry: every track has the defaults
}

// Stores one track's atmosphere (the defaults remove it); returns whether the browser kept it.
export function saveAtmosphere(track, atmosphere, storage) {
  return saveAtmospheres({ ...loadAtmospheres(storage), [String(track)]: atmosphere }, storage);
}
export function saveAtmospheres(all, storage) {
  const tracks = Object.fromEntries(Object.entries(all ?? {}).filter(([name, a]) => /^\d+$/.test(name) && !isDefaultAtmosphere(a)).map(([name, a]) => [name, normalizeAtmosphere(a)]));
  try {
    const s = storage === undefined ? globalThis.localStorage : storage;
    if (!s) return false;
    if (Object.keys(tracks).length) s.setItem(ATMOSPHERE.storageKey, JSON.stringify({ version: 1, tracks })); else s.removeItem(ATMOSPHERE.storageKey);
    return true;
  } catch { return false; }
}

// The sun of a track: the angle (the game setting's when the track has none) and the length of a shadow per unit of height.
export const sunAngleOf = (atmosphere, settingAngle) => atmosphere.sunAngle ?? settingAngle;
export function sunLengthOf(atmosphere) {
  if (atmosphere.sunHeight === null) return SUN.length;
  const [low, high] = ATMOSPHERE.sunElevation, degrees = low + (high - low) * atmosphere.sunHeight;
  return 1 / Math.tan((degrees * Math.PI) / 180); // @math the shadow of a unit height: the cotangent of the elevation (degrees to radians)
}

// The fog colour of a track: its own tint, or `strip` (the colour taken from its horizon strip) when it has none. '#rrggbb' to [r, g, b].
export function fogTintOf(atmosphere, strip) {
  if (!atmosphere.fogTint) return strip;
  const n = parseInt(atmosphere.fogTint.slice(1), 16); // @math the six hex digits after '#'
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; // @math the red, green and blue bytes
}
// A sentence on a track's atmosphere for the pages: what differs from the defaults, or that it has none.
const GRADE_WORDS = { dawn: 'dawn', sunset: 'sunset', dusk: 'dusk', night: 'night', overcast: 'overcast' };
export function describeAtmosphere(atmosphere) {
  const a = normalizeAtmosphere(atmosphere), parts = [], pct = v => `${Math.round(v * 100)}%`; // @math a level as a percentage
  if (a.grade !== D.grade) parts.push(`${GRADE_WORDS[a.grade]} lighting${a.gradeStrength < 1 ? ` at ${pct(a.gradeStrength)}` : ''}`);
  if (a.clouds !== D.clouds || a.cloudSpeed !== D.cloudSpeed) parts.push(a.clouds === 0 ? 'no clouds' : `clouds ${pct(a.clouds)}`);
  if (a.range !== D.range || a.rangeShape !== D.rangeShape) parts.push(a.range === 0 ? 'no far range' : `far ${a.rangeShape} ${pct(a.range)}`);
  if (a.water !== D.water) parts.push(a.water === 0 ? 'still water' : `water moving ${pct(a.water)}`);
  if (a.relief !== D.relief) parts.push(a.relief === 0 ? 'no relief' : `relief ${pct(a.relief)}`);
  if (a.sunAngle !== D.sunAngle || a.sunHeight !== D.sunHeight) parts.push('its own sun');
  if (a.fogTint !== D.fogTint || a.fog !== D.fog) parts.push('its own fog');
  return parts.length ? parts.join(', ') : 'the defaults';
}

export const hexOf = rgb => `#${rgb.map(v => Math.round(Math.min(Math.max(v, 0), 0xff)).toString(16).padStart(2, '0')).join('')}`; // @math two hex digits a byte
