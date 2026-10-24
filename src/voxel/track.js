export { sceneryMesh } from './scenery.js';
import { rgbaPalette } from '../game/track-data.js';

// The original map's 64 x 64 cells are 32 world units wide, starting at 1024.
export function trackTexture(world) {
  const palette = rgbaPalette(world.palette), pixels = new Uint8Array(2048 * 2048 * 4);
  for (let y = 0; y < 2048; y++) for (let x = 0; x < 2048; x++) {
    const id = world.tiles[(y >> 5) * 64 + (x >> 5)];
    const index = world.sheets[Math.floor(id / 54)][(id % 54) * 1024 + (y & 31) * 32 + (x & 31)];
    pixels.set(palette.subarray(index * 4, index * 4 + 4), (y * 2048 + x) * 4);
  }
  return pixels;
}

export function spritePixels(world, sprite, frame = 0) {
  const palette = rgbaPalette(world.palette), pixels = new Uint8Array(sprite.width * sprite.height * 4);
  const start = (frame % sprite.frames) * sprite.width * sprite.height;
  for (let x = 0; x < sprite.width; x++) for (let y = 0; y < sprite.height; y++) {
    const index = sprite.data[start + x * sprite.height + y], at = (y * sprite.width + x) * 4;
    if (index) pixels.set(palette.subarray(index * 4, index * 4 + 4), at);
  }
  return pixels;
}
