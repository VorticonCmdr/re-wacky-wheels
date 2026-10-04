# MOV — devil motion

gig.mov: UINT16LE N, followed by N+1 `(INT16LE x,INT16LE y)` records. Coordinates are relative; positive right/down. Approximately 0.1 seconds/position. Default N=80; increasing length may crash.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `GIG.MOV` is a 2-byte little-endian count (80) followed by count x 4 bytes plus 4 more bytes, 326 bytes in total: the wiki's N+1 four-byte records.
- [PROVEN] (observed, `static.read`): the loader reads the count into a word (kept as read: 80) and the count*4+4 bytes to obj2+0x1b548, and they equal the file's at run time.
- [UNKNOWN] what the entries mean (the wiki's relative devil motion): `UNKNOWN_STATIC_TABLE_MEANING`.
- [STATIC] (`mov.use`): two drawing routines (around obj1+0x1a857 and +0x1abfe) read the entries as `(x, y)` word pairs by index: screen x is a constant (0xfa or 0x8d) plus the first word, screen y gets the second word added, then the sprite blitter draws. So the entries are relative screen offsets for one drawn sprite, as the wiki says; which sprite and what steps the index are unread. Not observed running.

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).

- [PROVEN] (`obs-devil`, claim `devil.draw-observed`): the entries are the screen offsets of the driver reaction figure (a red devil for driver 1): frame (driver - 1) x 4 + f of `GIGGLES.SP` (28 frames of 38 x 44, seven blocks of four) at the column 0xfa + x and row 0x78 + y of the entry one step behind the step word obj2+0x8508 (which runs on one per tick from the start value to the entry 76 and further, then the driver word obj2+0x84f4 returns to 0).

- [PROVEN] (`obs-devilfinish`, claim `devil.finish-observed`): the figure starts by itself when the player's lap word reaches the laps word (the finish): driver word 7, step 1 a tick, frame word = step mod 4 (record finish-1, lap word written to 9 of 10).
