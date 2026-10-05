# SIN — tile properties

12-byte records associate property choices with mask indices 0/1. Listed fields: UINT16LE active0,active1; UINT32LE property0; UINT16LE property1.

## Verification notes

Tags as in [evidence.md](evidence.md). Parser: `parseSin` in `src/formats/track-files.js` (raw `skipped`/`kept` slices; field meanings stay unnamed).

- [PROVEN] (`track-files`, claim `sin.layout`): all 42 `.SIN` members are 1296 bytes = 108 records of 12 bytes.
- [PROVEN] (`track-ranges`, `track.value-ranges`): across the 42 tracks every terrain value (both kept dwords) is in 0 to 27, so below the 30 `WACKY.SDX` records they index.
- [PROVEN] (`terrain.sdx-index`): the value `terrain.lookup` returns from a `.SIN` record is an index into the 30 `WACKY.SDX` records (the car record receives the SDX record's address and two of its fields). Other code compares the value with 2, 3, 6, 0xa and 0xf (not read), so the values are surface kinds, not speeds.
- [PROVEN] (observed in the running game, `sin.read`): the 864-byte table at obj2+0x1ad88 equals the **last 8 bytes of each of the 108 records**, in order (CRC-32 equal); a table built from the first 8 bytes differs. So the loader stores 8 bytes per record and drops the first 4. This accounts for the wiki discrepancy: its list of fields (active0/active1, property0, property1) sums to 10 bytes but records are 12.
- [PROVEN] (observed in the running game, `terrain.lookup`): the terrain lookup indexes that table with `tile id * 8` and returns the entry's **first dword when the mask pixel is 0 and the second dword otherwise**: 60 live samples at 60 positions over 13 tile ids and both mask values match the prediction from the archive. So the kept 8 bytes are two 32-bit properties, one per mask value (the wiki's "mask indices 0/1"), the second read as a whole dword, not the wiki's UINT16 plus two unlisted bytes. The values seen in track 2 are 4, 5 and 7; what they mean as surfaces is not established (`UNKNOWN_SIN_KEPT_FIELDS`). The lookup never reads the discarded first 4 bytes (the wiki's active0/active1); another reader of the file is not ruled out.
- [PROVEN] (`sin-active`, claim `sin.active-flags`, resolves part of `UNKNOWN_SIN_KEPT_FIELDS`): the dropped first 4 bytes are the wiki's `active0` and `active1`, two words that are 0 or 1 and say whether the tile's mask sheet holds a pixel of the value 0 and of the value 1; this holds for 4520 of the 4536 tiles of the 42 tracks (the 16 exceptions are the same 8 tiles in the tracks 17 and 41). The game never reads them.
- [STATIC] (`terrain.special-values`, resolves the rest of `UNKNOWN_SIN_KEPT_FIELDS`): the values the game code treats specially are 2 (boost), 3 (wall), 5 (a stopped car drawn 4 lines shorter), 6 and 0xf (the pit state) and 10 (the pit fall); no direct compare with another value was found (compares through a register were not traced); the others act through their `WACKY.SDX` record.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
