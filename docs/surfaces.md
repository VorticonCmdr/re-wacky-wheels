# Surface values and their SDX fields

The terrain value under the car (the `.SIN` dword the terrain lookup returns, `terrain.lookup`) indexes the 30 records of `WACKY.SDX` (`terrain.sdx-index`). Two fields of the record matter for driving: the dword at `+0x120`, a 16.16 slowdown fraction that lowers the car's speed every call (`car.steer-states`, `ai.surface-slowdown`), and the word at `+0x124`, how many calls a steering key must be held at full throttle before the car slides, 0 meaning it hops at once (`car.steer-states`). The dwords at `+0x126` and `+0x12a`, which the special-state surfaces copy into the car record, are 0 in every record of the user's archive.

Values computed from the user's `WACKY.DAT` with the SDX and `.SIN` parsers (a script run, not pinned by a check; `track-ranges` proves only that every terrain value is in 0 to 27). The column of tracks counts the `.SIN` files whose terrain values include that surface. The meanings are [STATIC] readings of the code, not observations, and so is the use of the SDX fields:

| Value | Slowdown dword (`+0x120`) | As a fraction | Slide count (`+0x124`) | Tracks using it | Known meaning |
| --- | --- | --- | --- | --- | --- |
| 0 (0x0) | 0 | 0.000 | 18 | 42 | no slowdown; present in every track (the name of the surface is not read) |
| 1 (0x1) | 30146 | 0.460 | 18 | 9 | not read |
| 2 (0x2) | 0 | 0.000 | 20 | 19 | boost strip: sets the throttle to 160 for 16 calls (`car.speed-model`) |
| 3 (0x3) | 0 | 0.000 | 0 | 42 | wall: the collision probes look for it (`car.collision-test`, `car.move-step`); used in every track |
| 4 (0x4) | 0 | 0.000 | 14 | 6 | not read |
| 5 (0x5) | 6553 | 0.100 | 60 | 13 | a stopped car is drawn 4 lines shorter (`terrain.special-values`) |
| 6 (0x6) | 45875 | 0.700 | 18 | 12 | starts a special car state (`car.move-step`) |
| 7 (0x7) | 19660 | 0.300 | 16 | 6 | not read |
| 8 (0x8) | 10485 | 0.160 | 10 | 4 | not read |
| 9 (0x9) | 0 | 0.000 | 18 | 6 | not read |
| 10 (0xa) | 0 | 0.000 | 0 | 17 | pit: the car falls (`car.collision-test`) |
| 11 (0xb) | 0 | 0.000 | 14 | 6 | not read |
| 12 (0xc) | 23592 | 0.360 | 8 | 6 | not read |
| 13 (0xd) | 39321 | 0.600 | 4 | 15 | not read |
| 14 (0xe) | 0 | 0.000 | 60 | 6 | not read |
| 15 (0xf) | 23592 | 0.360 | 20 | 6 | starts a special car state (`car.move-step`) |
| 16 (0x10) | 0 | 0.000 | 8 | 6 | not read |
| 17 (0x11) | 39321 | 0.600 | 0 | 6 | not read |
| 18 (0x12) | 0 | 0.000 | 14 | 4 | not read |
| 19 (0x13) | 30146 | 0.460 | 8 | 18 | not read |
| 20 (0x14) | 6553 | 0.100 | 12 | 5 | not read |
| 21 (0x15) | 13107 | 0.200 | 8 | 5 | not read |
| 22 (0x16) | 32768 | 0.500 | 16 | 6 | not read |
| 23 (0x17) | 45875 | 0.700 | 18 | 6 | not read |
| 24 (0x18) | 0 | 0.000 | 0 | 0 | not read |
| 25 (0x19) | 0 | 0.000 | 0 | 6 | not read |
| 26 (0x1a) | 0 | 0.000 | 0 | 5 | not read |
| 27 (0x1b) | 0 | 0.000 | 4 | 6 | not read |
| 28 (0x1c) | 0 | 0.000 | 0 | 0 | not read |
| 29 (0x1d) | 0 | 0.000 | 0 | 0 | not read |

Reading the table: the surfaces with a zero fraction and a slide count of 0, 20 or less are the ones the car runs on freely; the highest fractions (0.6 to 0.7) are the surfaces that slow it most; surface 5, which shortens a stopped car's picture, slows by only 0.1 but needs 60 calls of held steering before the car slides, the largest count; surfaces 24, 28 and 29 occur in no track. Which values are grass, sand, water, ice and so on is not read: the game never names them in the code that was read.

See [driving-model.md](driving-model.md) for how these fields enter the move, [sdx.md](sdx.md) and [sin.md](sin.md) for the files, and [TODO.md](TODO.md) for what is unread.
