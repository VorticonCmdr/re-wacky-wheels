# M — track surface

4096 bytes: row-major 64×64 tile indices. Tiles are 32×32 pixels; two tilesets provide 54 tiles each.

## Verification notes

Tags as in [evidence.md](evidence.md); citations are against the user's WW.EXE ([binaries.md](binaries.md)). Parser: `parseMap` in `src/formats/track-files.js`; the legacy `composeTrack` in `src/tracks.js` still serves the viewer and editor.

- [PROVEN] (`track-files`, claim `m.layout`): all 42 `.M` members are exactly 4096 bytes (64 rows of 64 ids) and the largest tile id in the archive is exactly 107, i.e. 2 x 54 - 1, so both sheets are used. A maximum of 106 fails.
- [PROVEN] (observed in the running game, `m.read`, `tiles.buffer`): the loader builds a table of 128 x 128 dword pointers; map cell (r, c) sits at row 32 + r, column 32 + c and holds `tileBase + id * 0x400` for all 4096 cells (CRC-32 equal), and the 12,288 padding cells around the map all hold `tileBase`, the address of tile 0. The tile buffer is 0x36000 bytes: the 54 tiles of the first sheet, the 54 of the second, then the masks. So ids 0 to 53 come from the first (primary) sheet and 54 to 107 from the second; the sheets are the images named by `.GAM` lines 1 and 2 (see [gam.md](gam.md)).
- World coordinates are map pixels plus 0x400 (the map starts at table cell 32); the terrain lookup (`terrain.lookup`) turns a world position into a cell, its tile id and a mask pixel, and reads the `.SIN` property for them (see [sin.md](sin.md)).
- Resolves the wiki discrepancy noted earlier (secondary indices 54-106 versus 54-107): 107 occurs, and the loader's buffer arithmetic allows ids up to 107.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
