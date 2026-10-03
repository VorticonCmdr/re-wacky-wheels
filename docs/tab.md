# TAB — acceleration curves

200 INT16LE speeds: vel.tab=12HP,vel2.tab=6HP. Last value sets maximum speed; negative speeds reverse travel. AI adapts competitively; speedometer caps at 99.

## Verification notes

Local observation: both files are 400 bytes.

## Verification notes

- [PROVEN] (`obs-buffers`, `small.read`): the game reads the archive member `VEL.TAB` and `VEL2.TAB` whole (400 bytes each bytes) into the buffer at obj2+0x1e8c4` and obj2+`0x1e584; in a running race the buffer equals the member (CRC-32 equal). What the values mean is not established (lead above).
- [PROVEN] (`obs-aistate`, `ai.race-speeds`): `VEL.TAB` is also copied to obj2+0x1e730 (the 400 bytes are equal), and that copy is the speed curve the computer racers use: the game looks up index 89 to get 36, 99 to get 40, ..., 149 to get 60 (about 0.4 per index); racer 0's indices are left unreplaced. `VEL2.TAB` (the slower curve) has no reader read yet.
- [STATIC] (`car.speed-model`): the player's speed word is the `VEL.TAB` entry (via the copy at `obj2+0x1e730`) for a throttle index that rises by 10 a frame when accelerating (6 in some modes), falls by 4 coasting and by 8 braking, and is set to 160 for 16 frames by a terrain-2 boost strip. Read, not run.
- [STATIC] (`race.class-setup`): at the race start the active table at `obj2+0x1e730` is filled from the `VEL2.TAB` buffer when the word `obj2+0x1ea58` is 2 and from the `VEL.TAB` buffer otherwise, and the steering rate per call is 40, 36 or 32 by the word `obj2+0x28c20` (1 to 3). Read, not run; where `obj2+0x1ea58` is set is not read.
- [STATIC] (`setup.race-options`): the word `obj2+0x1ea58` is `SETUP.EXE`'s engine choice: 1 is "12 Horsepower lawnmower engines" (`VEL.TAB`), 2 is "6 Horsepower lawnmower engines" (`VEL2.TAB`, the slower curve).

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
