# The player's driving model, as read from `WW.EXE`

What is known about how a frame of the race works, assembled from the claims in `src/evidence/claims/`. Every line carries its tag ([evidence.md](evidence.md)): **[PROVEN]** is re-executed by a check, **[STATIC]** is read from disassembly with citations and has not been run. Nothing here is a game rule until its claim says so; this page is the map for the driving prototype, not a specification.

All offsets are `obj2+0x…` data words unless written `obj1+0x…` (code). The player car record is the 0x68-byte-like record pointed to by the dword `obj2+0x1d5b0`; its word offsets below are `+0x…`.

## Controls

- [PROVEN] `cfg.default-keys`: the key table in `WACKY.CFG` is six PC scancodes per player in the order steer left, steer right, button 1 to 4. Player 1 defaults: Left, Right, Alt (accelerate), Ctrl (fire), Down (brake), Space (hand brake turn); player 2: D, F, A, S, G, H.
- [STATIC] `input.buttons`: buttons 1 to 4 are the words `obj2+0x28b40`, `+0x28b42`, `+0x28b44`, `+0x28b46` (accelerate, fire, brake, hand brake turn), set from key table words 2 to 5 or from the joystick port 0x201.
- [STATIC] `input.key-handler`: the keyboard interrupt (vector 9, handler `obj1+0x30907`) writes 1 or 0 to the high byte of the key table word whose low byte equals the scancode; a code above 0x52 is a release. Up, Down, Enter, Space and F10 also set fixed flag bytes.
- [STATIC] `input.steer-flags`: the high bytes of key table words 0 and 1 (player 1) become the bytes `obj2+0x28cd5` (left) and `+0x28cdd` (right), then the words `+0x28b8c`/`+0x28b98`, then the heading amounts `+0x28b92` (subtracted) and `+0x28b90` (added); with both keys down right wins.
- [STATIC] `input.joystick`: with a stick selected the routine at `obj1+0x2784b` times the game port 0x201 and sets the same left, right, up and down bytes from calibrated thresholds, so the stick steers like the first two keys; up and down can also act as hand brake turn and brake.

- [PROVEN] `car.speed-observed`: in a played race the loaded speed table holds `VEL.TAB`'s entry for the throttle (0 to the cap 100), the car record holds the surface's SDX fraction, and the speed is the entry minus `(entry x fraction) >> 16` (54 of 58 samples; the other 4 have a throttle already cleared).
- [PROVEN] `input.steer-observed`: left alone sets the left byte, word and amount (20 or 40) and lowers the heading, right alone the right ones and raises it (a quarter turn is 480 of 1920); after a hand brake turn the amount was 120.

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
- [STATIC] `race.class-setup`: at the race start the active speed table is filled from the `VEL2.TAB` buffer when the engine choice (`obj2+0x1ea58`) is 2, the 6 horsepower engines, and from `VEL.TAB` otherwise (12 horsepower); `SETUP.EXE` writes the choice (`setup.race-options`).
- [PROVEN] `ai.race-speeds`: the computer racers' speed words are the same `VEL.TAB` entries.

## Moving and colliding

- [STATIC] `race.class-setup`: the heading changes by 40, 36 or 32 of 1920 per call while a steering key is held (by the full-screen detail level high, medium or low, `setup.race-options`; 36 in some modes), half of that in the hop state; the input routine (`FUN_000224ec`) applies these amounts, hop and drift states are not described here.

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

The player 2 and mode-specific input paths (other routines write the same flags), the car state words (`+0x44`, `+0x18` and the animation machine), the AI step (`FUN_00028cac`, `ai.step-rules`), lap counting beyond the ranking keys (`pos.progress`), the minimap and HUD, and every sound the routines trigger by number. See [TODO.md](TODO.md).
