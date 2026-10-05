# XY — MAP.XY minimap lookup

map.xy is a 4096-byte precomputed minimap table, associated with 64×64 tiles. Changes shift player markers; zero values reportedly place all markers at screen (0,60). Encoding beyond these observations is undocumented.

## Verification notes

- [PROVEN] (`obs-minimap`, claims `mapxy.use` and `hud.minimap-observed`): the first 2048 bytes are the column table (loaded at obj2+0x202cc) and the second 2048 the row table (obj2+0x1faca); for a racer at world (x, y) the dot is at the screen column `t[c(x)]` and row `60 + u[c(y)]`, c(v) = v - 0x400 limited to 0..0x7ff; seen in two frames of a race, the eight dots exactly the eight computed ones.

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`, claim `static.layout`): `MAP.XY` is exactly 0x1000 bytes.
- [PROVEN] (observed, `static.read`): the loader reads it as two 0x800-byte blocks, to obj2+0x202cc and obj2+0x1faca, and both equal the file's halves (CRC-32 equal) at run time.
- [PROVEN] (`mapxy.use`, `hud.minimap-draw`, resolves `UNKNOWN_STATIC_TABLE_MEANING`): the table is the minimap's world to picture lookup: the first byte table gives a racer's x, the second its y, and the dots are drawn from them at the picture's origin (the port draws the minimap with it).

## Sources

- [Wacky Wheels](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels)

Read on 2026-10-02. [Format index](README.md).
