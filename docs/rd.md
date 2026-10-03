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

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
