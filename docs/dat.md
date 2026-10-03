# DAT — WACKY.DAT archive

Most game assets reside in this uncompressed archive. It has no magic signature, encryption, or subdirectories.

## Layout

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | UINT16LE | File count N |
| 2 | Entry[N] | Directory |

Each directory entry occupies 22 bytes:

| Relative offset | Type | Meaning |
| --- | --- | --- |
| 0 | BYTE[14] | Null-padded DOS filename |
| 14 | UINT32LE | Payload size |
| 18 | UINT32LE | Stored offset |

The actual payload position is `stored_offset + 2`, relative to the archive start. Directory filenames use DOS 8.3 names, including the dot. Entries can theoretically share payloads; gaps can contain unreferenced data.

## Reading and editing

Check directory bounds, ASCII filenames, and payload ranges. Repack modified assets into WACKY.DAT: the game does not prefer loose files in its working directory. Recompute sizes and offsets when payload lengths change. The pre-release archive was called WACKY.LID.

## Verification notes

Tags as in [evidence.md](evidence.md); citations are against the user's WW.EXE ([binaries.md](binaries.md)). Parser: `src/formats/dat.js` (`parseDatDirectory`, strict, constants via `K`). The older `parseDat` in `src/archive.js` is untraced and still serves the viewer and editor until phase 2 moves them. "Observed" means a record in `src/evidence/obs/` taken from the running game under dosbox-automation 0.84.0-vc1 (`npm run observe`), cross-validated by `obs-race`.

- [PROVEN] (`dat-directory`, claim `dat.layout`): a 2-byte count at 0, then count 22-byte entries from offset 2, with member length at +0x0e and member offset at +0x12 measured from offset 2. In the supplied WACKY.DAT (577 entries) the members tile the archive exactly: sorted by offset each ends where the next begins, the last ends at EOF, and the first begins one entry (22 bytes) after the directory end. Strides 21 and 23, swapped size/offset fields, and biases 0, 1 and 3 all fail to tile.
- [PROVEN] (observed, `dat.directory-read`): in the running game the table at obj2+0x5080 holds exactly the entries after the count (CRC-32 equal), and the 22 bytes after it are zero, so the file's own 22-byte sentinel (`\0WREG.BIN`) is **not** loaded: the game reads only count*0x16 bytes.
- [PROVEN] (observed, `dat.entry-lookup`, `dat.entry-size`): by-name lookups are case-insensitive (the requested name is upper-cased in place), find the entry by its name at +0, and read the member at the dword at +0x12 plus 2, for every member the record covers; the image loader reads (member size - 0x380) bytes with the size from +0x0e.
- [PROVEN] (`obs-lookup`, `dat.entry-tail`): the lookup ignores whatever follows the first NUL of an entry's name. Of the 23 members the game demonstrably loaded in the recorded sessions, 22 have such leftover bytes in their directory entry (for example the entry of `2.GAM` holds `42.PCX` after its name) and were found anyway; a compare of the whole 14-byte field would miss them. The wiki's "null-padded names" is therefore wrong for 496 of the 577 entries.
- [PROVEN] (experiment, `obs-gamslot`, `dat.notfound-behavior`): a lookup by a name that matches no member (the sky name `back2.pcx ` with a trailing space) does not stop the game and does not move the file position: the sky read took the bytes that follow the previously read member (`2.SIN`) by one PCX header (inside `3.RD`) and used them as the picture. The compare is exact up to the NUL, so one extra character is enough to miss.
- [PROVEN] (`obs-miss`, `dat.entry-notfound`): an execute breakpoint on the lookup's not-found path (`obj1+0x41b2`) stopped once for the name `BACK2.PCX ` with the walk index at 577, the archive's entry count; the entry at that index starts with a 0 byte and the last real entry does not. A missing name therefore walks off the end of the loaded entries onto the zeroed one.
- [STATIC] (`dat.entry-notfound`, `dat.entry-compare`): a lookup ends as not-found at an entry whose first byte is 0 (never seen failing); the name compare is a NUL-terminated string compare (`FUN_00042df0`, read in full), so the stale bytes after a name's NUL are irrelevant to the game.
- **Refuted lead** ("Null-padded DOS filename", wiki, read 2026-10-02): the name is NUL-terminated, but bytes after the first NUL are not always zero. In the supplied archive 496 of 577 entries carry non-zero tail bytes inside the 14-byte field (e.g. `DOPE.SP\0F`, `WIN.PCX\0CX`, `DANCE.MID\0ID`). The parser ignores the tail, as the game's compare does. Evidence: direct byte inspection of the supplied WACKY.DAT, 2026-10-03; disassembly of the compare.
- [UNKNOWN] `UNKNOWN_DAT_SENTINEL_ENTRY`: whether the packer writes the sentinel on purpose. It does not matter to the game; `patchArchive` in `src/track-model.js` keeps it byte-for-byte.
- Wiki statements not yet checked here: that filenames are DOS 8.3 and ASCII (the supplied archive's names are 8-12 characters of A-Z, 0-9, `.` and `_`, an observation, not a claim), that entries may share payloads or leave gaps (neither occurs in the supplied archive), and that the pre-release archive was called WACKY.LID.

## Sources

- [DAT format](https://moddingwiki.shikadi.net/wiki/DAT_Format_(Wacky_Wheels))

Read on 2026-10-02. [Format index](README.md).
