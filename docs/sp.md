# SP — raw sprites

Headerless indexed 8bpp pixels using the track palette. Dimensions and frame boundaries are external; map objects use [ATR](atr.md). Raw-image import requires 90° clockwise rotation, then horizontal flipping. Some files contain differently sized images.

## Verification notes

Tags as in [evidence.md](evidence.md). `CARS.SP` and the per-object sprite files.

- [PROVEN] (`static-tables`): `CARS.SP` is exactly 0x18f00 = 102144 bytes.
- [PROVEN] (observed, `static.read`): the startup loader reads the whole member into a buffer (address in the dword at obj2+0x1d708), and it equals the file at run time. The wiki's remarks about rotation and flipping, and the frame layout, are leads only.


- [PROVEN] (`atr-sprites`, observed `sp.read`): every catalogue sprite's `.SP` member is exactly width x height x frames bytes, and the game loads those bytes unchanged (see [atr.md](atr.md)).
- [STATIC] (`sp.draw`): the sprite blitter `FUN_00036fd0` reads a frame column by column (an outer loop of catalogue word +4 columns, an inner loop of word +6 bytes), skips index 0 and writes the rest down the screen, so a frame is column-major with word +4 as the width; this agrees with the viewer's column-major default. No screen pixel was compared with a frame yet. The wiki's "rotate 90 degrees clockwise then flip" is the same thing described differently (a lead). Dimensions the viewer infers for files without catalogue entries (driver sprites, fonts, screens) remain estimates.

## Sources

- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
