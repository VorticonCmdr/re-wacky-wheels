# NDIST — projection table

Wiki: INT16LE table; plotting 70 values/row yields parabola-like columns. Values influence object placement by viewing angle.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `NDIST` is exactly 0x15e00 = 89600 bytes.
- [PROVEN] (observed, `static.read`): the loader reads the whole member into a buffer (address in the dword at obj2+0x1d660), and it equals the file at run time.
- [UNKNOWN] the schema and meaning (the wiki's INT16 projection table; the first bytes `85 00 00 00 86 00 00 00` also resemble 32-bit values): `UNKNOWN_STATIC_TABLE_MEANING`.

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
