# SDX — WACKY.SDX particle data

The overview describes UINT16LE count=30 followed by 30 records of 302 bytes. Internal fields remain unknown; modifying early record bytes affects wheel particles.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `WACKY.SDX` is a 2-byte little-endian count (30) followed by exactly count records of 0x12e = 302 bytes (9062 = 2 + 30 x 302), as the wiki says.
- [PROVEN] (observed, `static.read`): the loader reads the count into a word (then decrements it: 29) and the records to obj2+0x141f8. At run time the first 294 bytes of every record equal the file's; the last 8 bytes (offsets 294 to 301) differ from the file in some records and not in others, so the game writes that tail while running (the record holds one CRC per record tail; five of 30 differed in the recordings taken so far). Treat the tail as run-time state, not file data.
- [PROVEN] (observed, `obs-surface`, `terrain.sdx-index`): the terrain property a car is on (the value `terrain.lookup` returns, 4 and 5 in the samples) indexes the SDX records: record = table + value × 0x12e. The game copies the dword at record +0x120 and the word at +0x124 into the car record and keeps the record's address there, in every one of 24 samples. So the SDX is **per-surface data** (30 records), not a particle table as the wiki says for the whole file; what its fields are is not established, and the tail the game rewrites (offsets 0x126 to 0x12d) is separate from these two fields.
- [STATIC] (`ai.surface-slowdown`): the dword at record +0x120 is a 16.16 fraction (below 1 in all 30 records: 0 for 13 of them, 0.1 to 0.7 for the others); the game lowers the computer racers' looked-up speeds by that fraction (`speed - (speed x dword >> 16)`), so it reads as a per-surface slowdown. No scaled value was seen. The word at +0x124 is still unexplained.
- [UNKNOWN] what the records mean: `UNKNOWN_STATIC_TABLE_MEANING`.

## Sources

- [Wacky Wheels](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels)

Read on 2026-10-02. [Format index](README.md).
