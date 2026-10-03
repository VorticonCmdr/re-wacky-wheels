# RD — computer-driver route

UINT16LE count; 14-byte records, all UINT16LE:

`x1,y1,x2,y2,angle,compass_direction,distance`

Connect consecutive endpoints to avoid teleporting. Angle: `atan2(dy,dx)*960/pi`, normalized modulo 1920. Compass: `int(angle/240.0+6.5)%8`. Distance: truncated Euclidean length. Angle/distance appear unused.

## Verification notes

Tags as in [evidence.md](evidence.md). Parser: `parseRoute` in `src/formats/track-files.js` (raw words); the legacy `parseRoute` in `src/tracks.js` still names the fields for the editor.

- [PROVEN] (`track-files`, claim `rd.layout`): all 42 `.RD` members are a 2-byte count plus exactly count records of 14 bytes (seven uint16 words). A 12- or 16-byte record, or a big-endian count, fails.
- [PROVEN] (observed in the running game, `rd.read`): for a 58-record file the loader's count word reads 57 (it decrements the count), the record buffer holds exactly the file's last 14-byte record, the route table (stride 8) holds the file's word at +0x0a in its word at +6 for every record, and the first record's words at +0 and +2 are stored with 0x0400 added. That agrees with the wiki's "angle/distance appear unused" for the words at +0x08 and +0x0c.
- The 0x0400 added to the route coordinates is the map origin in world pixels: world coordinates are map pixels plus 0x400 because the 64 x 64 map starts at cell 32 of the 128 x 128 pointer table (32 x 32 pixels per cell). The terrain lookup works in these world coordinates (`terrain.lookup`).
- [PROVEN] (observed in the running game, `rd.route`): the loader takes the words at +0, +2, +4, +6 as x1, y1, x2, y2 (each with 0x0400 added) and rasterises every segment with a Bresenham walk (`FUN_00021554`, reproduced by `src/formats/route.js`) into a contiguous array of (x, y) word pairs; the route table holds, per segment, the start pointer (+0), the point count (+4) and the file's compass word (+6). The live points, counts and compass words of all 58 segments of track 2 equal the rasterisation of the archive's `.RD`, so the wiki's x1,y1,x2,y2 order is confirmed and the wiki's "connect consecutive endpoints" is done by the game's own line drawing.
- [STATIC] (`rd.unused-words`): the loader never reads the words at +0x08 and +0x0c (the wiki's angle and distance); the table does not depend on them. What the AI does with the route and the compass word is unknown (`UNKNOWN_RD_FIELD_USE`).
- [PROVEN] (observed, `obs-route`, `ai.route-follow`): in a demo race on track 2, every one of 24 samples shows racers 1 to 7 standing exactly on a point of the rasterised route (about 9300 points) and racer 0 never on one. The computer racers are moved by walking the route's point array, not by physics.
- [STATIC] (`ai.step-rules`, `route.placement`, `racer.init`): the update loop `FUN_00028cac` advances each computer racer a number of route points per frame chosen by a four-state machine (speed words +0xc, +0xa, +8, +0xa), adds a rubber-band against racer 0's ranking key, pushes racers that get closer than 0x14 apart, and sets a contact flag within 0xe of racer 0. The route entry's compass word is copied into the racer's heading word. Read in full, not observed beyond the first point.
- [PROVEN] (observed, `obs-aistart`, `ai.speed-setup`): right after racer initialisation in a demo race, with L the word at obj2+0x28b84 (89), racer n of 0 to 7 is in state 0 with first-phase counter 24, speed words +8 = L, +0xa = L + 60 - 10 x (7 - n) and +0xc = L - 4 - 10 x (7 - n), and second-phase counter 22, 28, 30, 34, 40, 50, 58, 60. So each computer racer starts slowest, and the higher its number the faster it is.
- [PROVEN] (observed, `obs-aistate`, `ai.state-machine`, `ai.race-speeds`): over 30 pauses the computer racers go through states 0, 1, 2 exactly as `ai.step-rules` says (all together out of state 0 after 24 frames, then out of state 1 one after another in counter order), the counters obey the per-state relations, and the speed words that `ai.speed-setup` writes are indices into a copy of `VEL.TAB` that are replaced once, shortly after the race begins, by the table values (36, 40, 44, ..., 60 for racers 1 to 7). State 3 was never seen.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
