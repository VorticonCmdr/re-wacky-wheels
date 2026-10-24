// Artistic light energies in linear RGB. Sunny is the balanced default.
export const LIGHTING_PRESETS = Object.freeze({
  soft: Object.freeze({ label: 'Soft', sun: .65, sky: .85, ao: .35, gloss: .02, exposure: 1.05, shadow: .25, penumbra: 1.5 }),
  sunny: Object.freeze({ label: 'Sunny', sun: 1.25, sky: .60, ao: .55, gloss: .05, exposure: 1.10, shadow: .40, penumbra: 1.0 }),
  toy: Object.freeze({ label: 'Toy-like', sun: 1.45, sky: .75, ao: .72, gloss: .16, exposure: 1.15, shadow: .48, penumbra: .7 }),
});
export const lightingPreset = name => LIGHTING_PRESETS[name] ?? LIGHTING_PRESETS.toy;
