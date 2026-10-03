# The player's driving model, as read from `WW.EXE`

What is known about how a frame of the race works, assembled from the claims in `src/evidence/claims/`. Every line carries its tag ([evidence.md](evidence.md)): **[PROVEN]** is re-executed by a check, **[STATIC]** is read from disassembly with citations and has not been run. Nothing here is a game rule until its claim says so; this page is the map for the driving prototype, not a specification.

All offsets are `obj2+0x…` data words unless written `obj1+0x…` (code). The player car record is the 0x68-byte-like record pointed to by the dword `obj2+0x1d5b0`; its word offsets below are `+0x…`.

## One frame

- [STATIC] `race.frame-calls`: the race frame routine (`obj1+0x1fd8c`) draws the floor, then the objects and the cars, with the terrain lookup, progress and the AI after. Order of the calls, not a trace.
- [STATIC] `view.setup`: the view is a fan of 320 TRIG entries (the heading ± 160 of 1920) reaching 1122 world units, the largest NDIST dword; it also forms a bounding box of the visible points.
- [STATIC] `floor.render-loop`: the floor is 320 columns of 70 steps. Column *c* uses the TRIG entry at heading − 160 + *c*; step *k* takes the NDIST dword for that column and step, adds `(TRIG × NDIST) >> 16` to the camera words `obj2+0x28b0a`/`+0x28b0e`, looks the world point up in the 128×128 tile-pointer table and copies the tile pixel one scan line up. Never compared with a frame.

## Axes and angles

- [PROVEN] `rd.derived-words`: TRIG index 0 is +x (the column direction), index 480 is +y (the row direction, down the map), one turn is 1920. An `.RD` record's angle word is the TRIG index along its segment, its length word the segment length (within 1), its compass word the angle's octant (`(floor((angle + 120) / 240) + 6) mod 8`).
- [PROVEN] `ndist.layout`, `trig.layout`: NDIST holds 320 runs of 70 increasing integer distances (115 to 1122); TRIG holds 1920 unit vectors in 16.16.
- [PROVEN] `terrain.lookup`, `terrain.clamp`: the terrain lookup takes a world column and row, clamps each to 0..0xfff, and returns the `.SIN` dword chosen by the tile's mask pixel; the map occupies world 0x400..0xbff.

## Speed and throttle

- [STATIC] `car.speed-model`: the car's throttle word `+0x42` rises by 10 a call while the accelerate flag (`obj2+0x28b40`) is set (6 in some modes), falls by 4 otherwise and by 8 while the brake flag (`obj2+0x28b44`) is set, capped at 100; the speed word `+0x26` is `VEL.TAB[throttle]` (read from the copy at `obj2+0x1e730`). A terrain-2 strip sets the throttle to 160 for 16 calls.
- [STATIC] `race.class-setup`: at the race start the active speed table is filled from the `VEL2.TAB` buffer when the word `obj2+0x1ea58` is 2 and from `VEL.TAB` otherwise; where that word is set is not read.
- [PROVEN] `ai.race-speeds`: the computer racers' speed words are the same `VEL.TAB` entries.

## Moving and colliding

- [STATIC] `race.class-setup`: the heading changes by 40, 36 or 32 of 1920 per call while a steering key is held (by the word `obj2+0x28c20`, 1 to 3; 36 in some modes), half of that in the hop state; the input routine (`FUN_000224ec`) applies these amounts, hop and drift states are not described here.

- [STATIC] `car.move-step`: steering subtracts the word `obj2+0x28b92` from, or adds `obj2+0x28b90` to, the heading (mod 1920); the car moves `speed` units along the heading vector, `(vector × distance + 0x8000) >> 16`, as a line walk from the old to the new position.
- [STATIC] `car.collision-test`: at each step of the walk, terrain 3 is a wall (code 1), terrain 10 a pit the car falls into (code 4), a static object within a Manhattan distance of 14 is code 2 (the object's `.SPW` word `+2` becomes 1) and another racer within 14 is code 3. When a move is blocked the car is thrown back 0x20 units, its throttle is cleared, and it is turned 0x12 of 1920 away from whichever side probe (heading ± 0x12, 0x7c ahead) sees terrain 3.
- [STATIC] `car.move-step`: terrain 6 and 0xf start a special car state; the car record keeps the surface value at `+0x56` and the `WACKY.SDX` record's fields at `+0x36`/`+0x3a`.
- [PROVEN] `terrain.sdx-index`: the terrain value selects the `WACKY.SDX` record (0x12e bytes) whose dword `+0x120` is copied to the car record's `+0x36`.
- [STATIC] `ai.surface-slowdown`: the computer racers' speeds are lowered by that dword as a 16.16 fraction.

- [STATIC] `car.steer-states`: the input routine turns the two key flags into the heading changes; with a throttle of 100 a steering key held for N calls (N is the surface's SDX word `+0x124`, 0 meaning at once) starts a slide, and a hop turns the car by 120 per call for up to 16 calls; a spin turn (a separate key word) turns by 120 per call for 5 calls; the surface's SDX dword `+0x120` also slows the player's speed every call, as it does the computer racers'. Read, not run.

## Objects

- [STATIC] `atr.kind-effects`: each static object's sprite has a catalogue *kind* (0 to 7): kind 0 is an obstacle that wrecks a fast car, 1 a one-off pickup, 2 a counter pickup that adds 4 (to 99), 3 to 7 a held item taken only when none is held; a taken pickup sets its `.SPW` word `+2` to 0xffff.
- [PROVEN] `atr.derived-words`: the catalogue's other words follow from width and height (three shapes: 28×28, 14×28, 32×24) and a constant 10.

## What is not known

The input handling beyond the steering amounts (which keys or devices set the accelerate, brake and steering flags; many mode-specific routines write them) and what the keys are called, the car state words (`+0x44`, `+0x18` and the animation machine), the AI step (`FUN_00028cac`, `ai.step-rules`), lap counting beyond the ranking keys (`pos.progress`), the minimap and HUD, and every sound the routines trigger by number. See [TODO.md](TODO.md).
