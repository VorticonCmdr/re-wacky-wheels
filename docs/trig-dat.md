# TRIG.DAT — circular lookup

1920 `(INT32LE x,INT32LE y)` pairs, radius 65535: first 960 top-half, remaining 960 bottom-half. Scaling affects vehicle size/perspective.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `TRIG.DAT` is exactly 0x3c00 = 15360 bytes, which is 1920 x 8 as the wiki says.
- [PROVEN] (`rd-derived`, `rd.derived-words`): entry 480 is the +y (row) direction and entry 0 the +x (column) direction: the TRIG entry an `.RD` record's angle word names points along that segment, with dword 0 as the column and dword 1 as the row component.
- [STATIC] (`floor.render-loop`): the floor drawing routine casts 320 columns, each at the next TRIG entry from the view angle minus 160, and takes 70 NDIST distances per column (see `docs/ndist.md`).
- [PROVEN] (observed, `static.read`): the loader reads the whole member into a buffer (address in the dword at obj2+0x1d6a0), and it equals the file at run time.
- [PROVEN] (`trig-ndist`, `trig.layout`): the file is 1920 entries of two signed 32-bit values, each a unit vector in 16.16 fixed point (length 65536 within 1.34), turning once around the circle; entries 0, 480, 960 and 1440 are on the four axes (worst miss 152), so a full turn is 1920 entries. Entry 1351 repeats entry 1350 (a quirk of the shipped table); every other step turns on by 0.995 to 1.007 of an entry.
- [STATIC] (`floor.table-use`): the floor renderer indexes it by a view angle (8 bytes per angle, 0x780 added on one branch to wrap) and multiplies the vector by NDIST factors shifted right by 16; the same table gives the terrain lookup's two inputs (`obj2+0x1d7a4`, `+0x1d7a8`). Not observed running.
- [UNKNOWN] the pair layout and meaning (the wiki's circular lookup of INT32 x,y pairs): `UNKNOWN_STATIC_TABLE_MEANING`.

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
