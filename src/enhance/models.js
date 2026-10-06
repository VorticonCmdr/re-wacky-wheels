// The reconstructed values the Enhanced presentation shares with the game, read once from the modules that own them (each accessor
// validates its claim through K on every call, which the per-pixel and per-point paths here cannot afford).
import { viewModel } from '../game/view.js';
import { floorModel } from '../render/floor.js';
import { skyModel } from '../render/sky.js';
import { horizonBounds } from '../game/horizon.js';
import { specialSurfaces } from '../game/surface.js';
import { soundNumber } from '../game/sounds.js';

let cache = null;
export const models = () => (cache ??= { view: viewModel(), floor: floorModel(), sky: skyModel(), horizon: horizonBounds(), special: specialSurfaces(), skid: soundNumber('SKID') });
