# TRIG.DAT — circular lookup

1920 `(INT32LE x,INT32LE y)` pairs, radius 65535: first 960 top-half, remaining 960 bottom-half. Scaling affects vehicle size/perspective.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `TRIG.DAT` is exactly 0x3c00 = 15360 bytes, which is 1920 x 8 as the wiki says.
- [PROVEN] (observed, `static.read`): the loader reads the whole member into a buffer (address in the dword at obj2+0x1d6a0), and it equals the file at run time.
- [UNKNOWN] the pair layout and meaning (the wiki's circular lookup of INT32 x,y pairs): `UNKNOWN_STATIC_TABLE_MEANING`.

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
