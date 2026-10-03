# GAM — track configuration

ASCII, CRLF; 25 or 28 lines.

| Lines | Meaning |
| --- | --- |
| 1–2 | Primary/secondary tilesets |
| 3–4 | Property-mask files |
| 5 | Sky PCX |
| 6–8 | Unknown; 1250,1500,1 |
| 9–10 | Start X,Y |
| 11–24 | Unknown |
| 25 | Palette-cycling flag |
| 26–28 | Cycling delays |

Lines 1–4 omit `a_`; line 5 does not. Cycling uses beach.pcx; delays cover step/restart for 148,161–164 and step for 168–175.

## Verification notes


Tags as in [evidence.md](evidence.md); citations are against the user's WW.EXE ([binaries.md](binaries.md)). Parser: `parseGam` in `src/formats/gam.js` (strict; integers returned as read); `parseGam` in `src/tracks.js`, which the viewer and editor use, reads through it first and falls back to a lenient reader for files in another shape (for example LF-only line endings, which the game itself would misread).

- [PROVEN] (observed in the running game, `gam.read`): for track 2 the parser `FUN_0002717c` left lines 1 and 2 in the tileset name slots and lines 3 and 4 in the mask slots, each rewritten as `A_` plus the line (case kept), line 5 in its own buffer, the first tileset's name upper-cased as the palette source, lines 26 to 28 as three words, and the first coordinate pair (lines 9 and 10) in the word tables with 0x03e0 added. The tile buffer then holds the split tilesets from lines 1-2 followed by the masks from lines 3-4 (`tiles.buffer`).
- [STATIC] (`gam.read-rest`): lines 6 and 7 are converted (+0x0400), line 8 is dropped, pairs 2 to 8 go into the tables (+0x03e0) and line 25 is stored, set to 1 when non-zero. The game rewrites these after loading, so they were not seen as loaded: the value words differ from the file lines, the table holds a derived start grid (x stepping by 20 from the first pair, y equal) and the flag word reads 2.
- [PROVEN] (experiment, `obs-gamtext`, `gam.line-reader`, `gam.atoi`): lines end at a CR and the byte after it is swallowed whatever it is (an LF inside a line does not end it); numbers are read by a converter that skips leading white space (the game's class bit 0x02: tab, LF, VT, FF, CR, space), accepts one sign, reads decimal digits and ignores everything after them (`"9xyz"` → 9, `"0x10"` → 0, `"- 5"` → 0, `"5-3"` → 5, `"++5"` → 0), and the result is stored in a 16-bit word (`"-5"` → 65531, `"70000"` → 4464). Shown by planting lines in a copy of the archive and reading the words the game stored (records `gamtext-1` to `gamtext-4`, see `docs/binaries.md`), so the viewer's and editor's `.GAM` handling should not rely on any other number syntax.
- [PROVEN] (observed, `obs-start`, `racer.start-grid`): in a demo race right after loading, the eight start-table entries are a line of positions built from the first coordinate pair (line 9 and 10 plus 0x03e0): y is the pair's y for all eight and x is the pair's x plus 0x50, 0x3c, 0x28, 0x14 and 0 at indices 4, 3, 2, 1, 0, then minus 0x14, 0x28 and 0x3c at indices 7, 6, 5. Racers 0 to 7 start there. The file's other seven pairs (lines 11 to 24) are overwritten in this branch.
- [STATIC] (`gam.line-reader-tail`): the reader writes a NUL over the CR, keeps trailing spaces and has no end-of-file test.
- [PROVEN] (experiment, `obs-gamslot`, `gam.trailing-space`): a trailing space on a name line is kept: with line 5 of `2.GAM` edited to `back2.pcx ` the game's stored copy is `BACK2.PCX ` followed by a NUL. Such a name does not match its archive member (see `docs/dat.md`), so a `.GAM` with trailing spaces on name lines loads wrong data silently.
- [PROVEN] (`gam-files`, claims `gam.layout` and `tiles.mask-values`): all 42 `.GAM` members are CRLF text with five name lines, two integer lines, one more line, sixteen integer lines, a 0/1 flag, and three more integers exactly when the flag is 1; later lines are blank. `A_` plus each of lines 1 to 4 (upper-cased) and line 5 (upper-cased) are PCX members of the archive. In the 16 mask sheets the 54 used tile slots hold only 0 and 1 (both occur) and everything else is 255. Wrong prefix, swapped tile/mask roles, 7 or 9 coordinate pairs, a bare-LF separator and 53 or 55 used slots all fail.
- **Differences from the wiki lead.** Lines 11 to 24 are not "unknown": the game reads them as seven more coordinate pairs alongside the first, which the wiki calls the start position (though in the running game only the first pair survives as a start position). "25 or 28 lines" holds for the data lines, but five files carry blank trailing lines (26 or 29 lines). Lines 1 to 4 omit `a_` in the file, as the wiki says, because the parser adds it.
- [UNKNOWN] the meaning of the numeric lines and flag: `UNKNOWN_GAM_NUMBERS`.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
