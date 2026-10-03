# MOV — devil motion

gig.mov: UINT16LE N, followed by N+1 `(INT16LE x,INT16LE y)` records. Coordinates are relative; positive right/down. Approximately 0.1 seconds/position. Default N=80; increasing length may crash.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `GIG.MOV` is a 2-byte little-endian count (80) followed by count x 4 bytes plus 4 more bytes, 326 bytes in total: the wiki's N+1 four-byte records.
- [PROVEN] (observed, `static.read`): the loader reads the count into a word (kept as read: 80) and the count*4+4 bytes to obj2+0x1b548, and they equal the file's at run time.
- [UNKNOWN] what the entries mean (the wiki's relative devil motion): `UNKNOWN_STATIC_TABLE_MEANING`.

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
