import { bytes } from './binary.js';
import { rawFrame } from './sprites.js';
import { toRgba } from './pcx.js';

// Export layout and allocation limits are viewer choices, not game-format claims.
export function spriteSheetLayout(length, width, height, offset = 0, columns = 0) {
  if (![length, width, height, offset, columns].every(Number.isSafeInteger) || length < 1 || width < 1 || height < 1 || offset < 0 || offset >= length || columns < 0) throw new Error('Invalid sprite sheet dimensions or offset.');
  const frameSize = width * height;
  const frames = Math.ceil((length - offset) / frameSize);
  const cols = Math.min(frames, columns || Math.max(1, Math.ceil(Math.sqrt(frames * height / width))));
  const rows = Math.ceil(frames / cols), sheetWidth = cols * width, sheetHeight = rows * height;
  if (frameSize > 4e6 || sheetWidth > 16384 || sheetHeight > 16384 || sheetWidth * sheetHeight > 16e6) throw new Error('Sprite sheet is too large. Choose Auto columns, or adjust frame dimensions or byte offset.');
  return { frames, columns: cols, rows, width: sheetWidth, height: sheetHeight, partialFrame: (length - offset) % frameSize !== 0 };
}

export function spriteSheet(data, width, height, palette, { offset = 0, columns = 0, columnMajor = true, transparent = -1 } = {}) {
  const source = bytes(data), layout = spriteSheetLayout(source.length, width, height, offset, columns);
  if (!palette || palette.length < 768) throw new Error('Sprite sheet needs a 256-color palette.');
  // Unused cells stay transparent, including when index 0 in actual frames is opaque.
  const rgba = new Uint8ClampedArray(layout.width * layout.height * 4);
  for (let frame = 0; frame < layout.frames; frame++) {
    const image = rawFrame(source, width, height, frame, offset, columnMajor);
    const pixels = toRgba(image.indices, palette, transparent);
    const x = frame % layout.columns * width, y = Math.floor(frame / layout.columns) * height;
    for (let row = 0; row < height; row++) rgba.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), ((y + row) * layout.width + x) * 4);
  }
  return { ...layout, rgba };
}
