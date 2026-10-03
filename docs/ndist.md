# NDIST — projection table

Wiki: INT16LE table; plotting 70 values/row yields parabola-like columns. Values influence object placement by viewing angle.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `NDIST` is exactly 0x15e00 = 89600 bytes.
- [STATIC] (`floor.render-loop`): `obj1+0x27e94` draws the floor column by column, 320 columns of 70 steps; each step takes the next NDIST dword as the distance along the column's TRIG vector, adds the camera words `obj2+0x28b0a`/`+0x28b0e`, looks the point up in the 128x128 tile-pointer table and copies the tile pixel to video memory one scan line above the last. So an NDIST run of 70 dwords is the 70 floor distances of one screen column; never run in the emulator, so the picture itself is not compared.
- [PROVEN] (observed, `static.read`): the loader reads the whole member into a buffer (address in the dword at obj2+0x1d660), and it equals the file at run time.
- [PROVEN] (`trig-ndist`, `ndist.layout`): the file is 22400 signed 32-bit values in 320 runs of 70: never decreasing inside a run, a drop at every one of the 319 run boundaries, all positive (115 to 1122); the run's first value falls slowly with the run number (133, 133, 132, ...) and its last falls by 2 per run (1122, 1120, ...).
- [STATIC] (`floor.table-use`): the floor-drawing loops multiply a TRIG vector component by successive NDIST values and shift right by 16 (see `trig-dat.md`); which of rows and columns of the 320 x 70 shape each loop walks is not traced.
- [UNKNOWN] the schema and meaning (the wiki's INT16 projection table; the first bytes `85 00 00 00 86 00 00 00` also resemble 32-bit values): `UNKNOWN_STATIC_TABLE_MEANING`.

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
