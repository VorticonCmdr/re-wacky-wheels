# SPW — object placement

UINT16LE count; 12-byte records:

`UINT16LE objectid,unknown1,x,y,unknown2; INT16LE unknown3`

objectid indexes [ATR](atr.md); coordinates span 0–2048. Unknowns normally zero.

## Verification notes

Tags as in [evidence.md](evidence.md). Parser: `parseSpw` in `src/formats/track-files.js` (raw words); the legacy `parseSpawns` in `src/tracks.js` still names the fields for the editor.

- [PROVEN] (`track-files`, claim `spw.layout`): all 42 `.SPW` members are a 2-byte count plus exactly count records of 12 bytes (six uint16 words). A 10- or 14-byte record, or a big-endian count, fails.
- [PROVEN] (observed in the running game, `spw.read`): the loader (`FUN_00021490`) reads the count into a word and the records into a table; in memory the words at +0, +4, +6 and +8 are the file's, with 0x0400 added to +4 and +6, in every record of track 2 (18 records), and the word at +2 is cleared to 0. The file holds 0 in the words at +2 and +0x0a of every record; after loading the game writes non-zero values there in some records. Two paused-race recordings of the same track disagreed about which: the first showed 0xFFFF at +2 in one record and values at +0x0a in four, the second (`race-3`) 0xFFFF at +2 in five consecutive records (indices 12 to 16) and 3, 4, 3 at +0x0a in the last three of them. Record-index and object-id are not a predictor (those five records hold sprite ids 4, 18, 19, 21, 20, and record 17, id 10, is untouched). Treat both words as run-time state, not file data; the check proves only that some records are rewritten.
- [STATIC] (`atr.kind-effects`): the word +2 that the loader clears is set to 0xffff when the player car takes the object (kinds 1 to 7); the pickup test is in `FUN_00022bf4`.
- [STATIC] (`spw.frame`): the routine that prepares objects for drawing (obj1+0x4398) uses word +8 as a tick counter and word +0x0a as the frame index of the object's sprite: frame address = sprite buffer + frame × (catalogue width × height). That explains why the game writes +0x0a while running and why the values seen (3, 4, 3) are small; it was not compared with a running frame.
- The 0x0400 added to x and y is the same map-to-world origin (map pixels plus 0x400; see [rd.md](rd.md) and `terrain.lookup`).
- [UNKNOWN] what the words mean beyond where the loader puts them: `UNKNOWN_SPW_FIELDS`. The wiki's names (objectid, unknown1, x, y, unknown2, unknown3) remain leads: the object id is a sprite-catalogue index (proven: the sprites the game loads for a track are exactly the catalogue entries some record names, see [atr.md](atr.md)), and the loader's biases agree with +4 and +6 being coordinates.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
