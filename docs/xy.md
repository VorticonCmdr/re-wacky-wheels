# XY — MAP.XY minimap lookup

map.xy is a 4096-byte precomputed minimap table, associated with 64×64 tiles. Changes shift player markers; zero values reportedly place all markers at screen (0,60). Encoding beyond these observations is undocumented.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`, claim `static.layout`): `MAP.XY` is exactly 0x1000 bytes.
- [PROVEN] (observed, `static.read`): the loader reads it as two 0x800-byte blocks, to obj2+0x202cc and obj2+0x1faca, and both equal the file's halves (CRC-32 equal) at run time.
- [UNKNOWN] what the table means (the wiki's minimap lookup; zero values reportedly place all markers at (0, 60)): `UNKNOWN_STATIC_TABLE_MEANING`.

## Sources

- [Wacky Wheels](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels)

Read on 2026-10-02. [Format index](README.md).
