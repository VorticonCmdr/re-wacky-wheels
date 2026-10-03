# SP — raw sprites

Headerless indexed 8bpp pixels using the track palette. Dimensions and frame boundaries are external; map objects use [ATR](atr.md). Raw-image import requires 90° clockwise rotation, then horizontal flipping. Some files contain differently sized images.

## Verification notes

Tags as in [evidence.md](evidence.md). `CARS.SP` and the per-object sprite files.

- [PROVEN] (`static-tables`): `CARS.SP` is exactly 0x18f00 = 102144 bytes.
- [PROVEN] (observed, `static.read`): the startup loader reads the whole member into a buffer (address in the dword at obj2+0x1d708), and it equals the file at run time. The wiki's remarks about rotation and flipping, and the frame layout, are leads only.


- [PROVEN] (`atr-sprites`, observed `sp.read`): every catalogue sprite's `.SP` member is exactly width x height x frames bytes, and the game loads those bytes unchanged (see [atr.md](atr.md)).
- [STATIC] (`sp.draw`): the sprite blitter `FUN_00036fd0` reads a frame column by column (an outer loop of catalogue word +4 columns, an inner loop of word +6 bytes), skips index 0 and writes the rest down the screen, so a frame is column-major with word +4 as the width; this agrees with the viewer's column-major default. No screen pixel was compared with a frame yet. The wiki's "rotate 90 degrees clockwise then flip" is the same thing described differently (a lead). Dimensions the viewer infers for files without catalogue entries (driver sprites, fonts, screens) remain estimates.
- [PROVEN] (`cars-frames`, `cars.frames`): `CARS.SP` is 102144 bytes = 8 slots of 12 frames of 38 x 28 (0x428 bytes), and each driver's own file (AJ, PUF, SHARK, ELE, DIGGER, CAMEL, RINGO, MOOSE, PELICAN, TIGER, PANDA) is a whole number of such frames (4, 4, 16, 16, 16, 20, 20, 24, 24, 17, 18). SPRITE.ATR has no entry of this size.
- [PROVEN] (`obs-cars`, `cars.slot-records`): in a paused race the buffer at the dword `obj2+0x1d708` holds `CARS.SP` whole, and the eight 0x98-byte records at `obj2+0x13c08` each start with that slot's twelve frame pointers (buffer + slot x 0x31e0 + frame x 0x428); the slots still held `CARS.SP`'s own frames, so the per-driver read of `cars.slots` had not run in the attract race.
- [STATIC] (`cars.slots`): the game uses the `CARS.SP` buffer as 8 driver slots; a routine reads the first 8 frames (0x2140 bytes) of a driver's file into a slot and keeps eight frame pointers 0x428 apart. The last 4 frames of a slot are not filled by that read. Not observed running.

- [PROVEN] (`sp-loaders`, `sp.loader-sizes`): 14 sprite files (`GIGGLES`, `DOPE`, `WFONT1`, `AJ`, `PUF`, `HANDLE`, `LAP`, `HOGMIS`, `SPARK`, `CRACK`, `GENEF`, `ICONS`, `CARS`, `ACTION`) are loaded by code that passes the exact member size (`mov eax, name` then `mov edx, size`). The sizes do not give frame dimensions.
- [STATIC] (read 2026-10-03, no claim yet): the start-up code at `obj1+0x3d60` cuts the `HOGMIS.SP` buffer into frame pointers in steps of `0xea` = 234 = 18 x 13 bytes (and blocks of `0x2be` = 3 frames and `0x3a8` = 4 frames), which agrees with the viewer's curated 18 x 13; the projectile record that uses it keeps `0xea` in its word +0x12 (`obj1+0x161cd`). The other curated sizes of `spriteLayout` (`ACTION` 251 x 6, the six medal files 78 x 50, `WFONT1` 15 x 13, `HANDLE` 160 x 23, `GIGGLES` 133 x 44, `SPARK` 12 x 10) divide their file sizes exactly (1506 = 251 x 6, 19500 = 78 x 50 x 5, 8190 = 15 x 13 x 42, 3680 = 160 x 23, 46816 = 133 x 44 x 8, 360 = 12 x 10 x 3) but are not yet traced to code.

## Sources

- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
