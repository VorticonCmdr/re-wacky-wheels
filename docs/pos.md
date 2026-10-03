# POS — wrong-way grid

64×64 16-bit progress values. Moving toward smaller values triggers wrong-way warnings.

## Verification notes

Tags as in [evidence.md](evidence.md). Parser: `parsePos` in `src/formats/track-files.js`.

- [PROVEN] (`obs-laps`, claim `pos.lap-observed`, track 1, 500 pauses): the lap word of an AI racer rises by exactly 1 in the sample where its stored grid value goes from the trailer (27 on track 1) to 1, and never otherwise; six racers ran four laps each (lap 2 to 6); the player's own crossing was not observed (the car was parked).
- [PROVEN] (`track-files`, claim `pos.layout`): all 42 `.POS` members are 8194 bytes: 4096 uint16 cells, then an int16 that equals the largest cell. **The two extra bytes are that trailer.** The largest cell in the whole archive is 71, below 256, so the relation also holds if both are byte-swapped; the grid is little-endian because the trailer is (a mixed order fails), which settles the endianness the wiki left open.
- [PROVEN] (observed in the running game, `pos.read`): the loader reads the 8192 grid bytes as they are (CRC-32 equal to the file's) into a buffer, then the 2-byte trailer into a signed word at obj2+0x28ba2 (45 for track 2) and stores that value divided by 4, truncating toward zero, at obj2+0x28ba0 (11).
- [STATIC] (`pos.progress`): the progress lookup returns the grid's uint16 at row `(y - 0x400) >> 5`, column `(x - 0x400) >> 5` (0 outside the map, and 0 means off the course); the per-racer update counts a lap when a racer's previous value is the trailer (the highest progress value) and the new value is 1, and ranks racers by `progress + trailer * laps`. Both were read in full in disassembly; not observed at run time. So the grid is a per-map-cell progress number, 1 to the trailer around the course.
- [PROVEN] (observed, `obs-progress`, `pos.progress-live`): in 24 pauses of an attract-mode demo race (track 2, 8 racers, all on lap 2) every racer's stored grid value equalled the cell at its world position, `(x - 0x400) >> 5` for the column and row of 64 columns (0 off the course), and its ranking keys were `lap × 1024 + value` and `value + trailer × lap`. This confirms the lookup and the key formulas; the lap counting and the flag-word branch above stay [STATIC].
- [STATIC] (`pos.quarter-unreferenced`): the trailer's quarter stored at obj2+0x28ba0 has no reader by direct address (stamped negative finding in the claim). The wiki's wrong-way warning ("moving toward smaller values") was not located in the code read.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
