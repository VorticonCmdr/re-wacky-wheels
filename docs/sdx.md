# SDX — WACKY.SDX particle data

The overview describes UINT16LE count=30 followed by 30 records of 302 bytes. Internal fields remain unknown; modifying early record bytes affects wheel particles.

## Verification notes

Tags as in [evidence.md](evidence.md); the loader is `FUN_00028180` (obj1+0x18180, read in full), the parsers are in `src/formats/static-tables.js`. "Observed" is record `race-3` (the running game under dosbox-automation 0.84.0-vc1, cross-validated by `obs-race`).

- [PROVEN] (`static-tables`): `WACKY.SDX` is a 2-byte little-endian count (30) followed by exactly count records of 0x12e = 302 bytes (9062 = 2 + 30 x 302), as the wiki says.
- [PROVEN] (observed, `static.read`): the loader reads the count into a word (then decrements it: 29) and the records to obj2+0x141f8. At run time the first 294 bytes of every record equal the file's; the last 8 bytes (offsets 294 to 301) differ from the file in some records and not in others, so the game writes that tail while running (the record holds one CRC per record tail; five of 30 differed in the recordings taken so far). Treat the tail as run-time state, not file data.
- [PROVEN] (observed, `obs-surface`, `terrain.sdx-index`): the terrain property a car is on (the value `terrain.lookup` returns, 4 and 5 in the samples) indexes the SDX records: record = table + value × 0x12e. The game copies the dword at record +0x120 and the word at +0x124 into the car record and keeps the record's address there, in every one of 24 samples. So the SDX is **per-surface data** (30 records), not a particle table as the wiki says for the whole file; what its fields are is not established, and the tail the game rewrites (offsets 0x126 to 0x12d) is separate from these two fields.
- [STATIC] (`ai.surface-slowdown`): the dword at record +0x120 is a 16.16 fraction (below 1 in all 30 records: 0 for 13 of them, 0.1 to 0.7 for the others); the game lowers the computer racers' looked-up speeds by that fraction (`speed - (speed x dword >> 16)`), so it reads as a per-surface slowdown. No scaled value was seen. The word at +0x124 is still unexplained.
- [STATIC] (`car.move-step`): the player's per-frame move stores the terrain value in car word +0x56 and the SDX dword +0x120 and word +0x124 in +0x36 and +0x3a; the values 6 and 0xf start a special car state that copies SDX dwords +0x126 and +0x12a; 3 is the wall the collision probes look for and 2 is a boost strip (`car.speed-model`). Read, not run.
- [STATIC] (`car.collision-test`): terrain value 10 is a pit the car falls into (collision code 4) and 3 the wall (code 1); static objects within 14 units give code 2 and other racers code 3.
- [STATIC] (`car.steer-states`): the word `+0x124` is how many calls a steering key must be held at full throttle before the car slides (0 hops at once) and the dword `+0x120` slows the player's speed every call; both are copied into the car record when it enters the surface. Read, not run.
- [STATIC] (`static.table-meanings`, `terrain.sdx-index`, `effects.ground-dust`, resolves `UNKNOWN_STATIC_TABLE_MEANING`): one record per surface value. The dword +0x120 is the fraction of the speed the surface takes away, +0x124 the number of steering calls before a slide, the flag bytes at +0 and +0x80 (a byte a track) say whether the track has the surface's first and second wheel picture, the dwords +0x100 and +0x104 are the offsets of those pictures in `EFFECTS.SP` with their strides, sizes and frame counts from +0x108, and the last 8 bytes (+0x126, +0x12a) are rewritten by the effects loader with the buffer addresses of the pictures it loaded for the track. The wiki's "particle data" is the wheel dust and splash pictures.

## Sources

- [Wacky Wheels](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels)

Read on 2026-10-02. [Format index](README.md).

- [PROVEN] (`obs-terreffects`, claim `terrain.effects-observed`, 27 records): with the whole map set to one surface value v (the loaded `.SIN` table written in a run), the car word +0x56 is v, +0x36 is the SDX record v's dword +0x120 and +0x3a its dword +0x124; the only other effects are the wall (3), the pit (10), the special state (6, 15) and one call of throttle 140 (12, 15).

- [PROVEN] (`obs-aislow`, claim `ai.surface-slowdown-observed`): the computer racers' speed words are lowered once, at the race start, by the fraction of the surface under the player's car (state-1 step 36 becomes 20 with the fraction 30146); a surface written into the loaded table later changes nothing.
