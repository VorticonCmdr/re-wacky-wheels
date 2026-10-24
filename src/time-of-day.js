export const TIME_CHOICES = { random: 'Random', track: 'Track settings', day: 'Day', dusk: 'Dusk', night: 'Night', now: 'Now (local time)' };
const KEY = 'wacky.timeOfDay';
export const normalizeTime = value => Object.hasOwn(TIME_CHOICES, value) ? value : 'random';
export function loadTime(storage) {
  try { return normalizeTime((storage ?? globalThis.localStorage)?.getItem(KEY)); } catch { return 'random'; }
}
export function saveTime(value, storage) {
  try { (storage ?? globalThis.localStorage)?.setItem(KEY, normalizeTime(value)); } catch { /* Optional storage. */ }
}
export const randomTime = (rng = Math.random) => ['day', 'dusk', 'night'][Math.min(2, Math.floor(rng() * 3))];
export function timeAtmosphere(base, choice, date = new Date(), raceTime = 'day') {
  let mode = normalizeTime(choice);
  if (mode === 'random') mode = raceTime;
  if (mode === 'track') return base;
  if (mode === 'now') {
    const hour = date.getHours() + date.getMinutes() / 60;
    mode = hour < 6 || hour >= 20 ? 'night' : hour < 8 ? 'dawn' : hour >= 18 ? 'dusk' : 'day';
  }
  const sun = { day: [.4, .75], dawn: [.15, .12], dusk: [.65, .12], night: [.8, .35] }[mode];
  return { ...base, grade: mode === 'day' ? 'none' : mode, gradeStrength: 1, sunAngle: sun[0], sunHeight: sun[1] };
}

// Voxel illumination follows the same atmosphere choice as the sprite grade.
// Keep enough sky fill for racing at night; emissive effects remain readable.
const LOOKS = {
  none: { tint: [1,1,1], skyColor: [.57,.73,.84], sun: 1, sky: 1 },
  dawn: { tint: [1,.8,.7], skyColor: [.7,.42,.38], sun: .65, sky: .8 },
  sunset: { tint: [1,.72,.55], skyColor: [.65,.3,.22], sun: .65, sky: .75 },
  dusk: { tint: [.85,.7,.95], skyColor: [.28,.16,.38], sun: .4, sky: .65 },
  night: { tint: [.55,.65,.95], skyColor: [.025,.035,.09], sun: .15, sky: .45 },
  overcast: { tint: [.85,.9,1], skyColor: [.42,.47,.55], sun: .45, sky: .85 },
};
export function atmosphereLight(atmosphere) {
  const base = LOOKS.none, look = LOOKS[atmosphere?.grade] ?? base;
  const strength = Math.max(0, Math.min(1, atmosphere?.gradeStrength ?? 1));
  const mix = (a,b) => a + (b-a)*strength;
  return { tint: base.tint.map((v,i)=>mix(v,look.tint[i])), skyColor: base.skyColor.map((v,i)=>mix(v,look.skyColor[i])), sun: mix(base.sun,look.sun), sky: mix(base.sky,look.sky) };
}
