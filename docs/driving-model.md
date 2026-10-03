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
- [PROVEN] `car.boost-observed`: on a terrain-2 strip a boost needs its gate open (the car word `+0xa` non-zero and the heading in the track's range); with it open the boost word `+0xb4` is 1, the throttle 160 (the `VEL.TAB` entry 64), the timer `+0xb6` counts down from 16 and the boost carries on past the strip for about 1000 world units; with the gate as track 1 sets it a terrain-2 strip does nothing.
- [STATIC] `car.boost-gate`: the gate routine `obj1+0x25bc` and the per-track heading ranges that `obj1+0x24e8` sets from the track number (west 840 to 1080 for tracks 6, 10, 13, 15, 25; north 1320 to 1560 for 24, 29, 35; 3, 4 and 9 both start and active range north), 0 for the other tracks; what sets the car word `+0xa` is unread.
- [PROVEN] `car.wall-observed`: a car driven into a wall strip (terrain 3, made in a run copy) never gets into it; at each bump the collision word is 1, the throttle 0 and the car rests 32 units before the wall, then the throttle climbs again by tens; with a wall square across both side probes the heading does not change.
- [PROVEN] `car.pit-observed`: a pit strip (terrain 10, made in a run copy) does not stop the car: the fall state `+0xa` becomes 1 (2 once the counter `+0xc`, 8 counting down, is 4 or less), the car's animation word `+0x18` is 14 for a hop of `+0x10` up to 40, the speed is 60 instead of 40, and the car keeps its throttle and drives on; `+0xa` is also what a boost's gate needs (`car.boost-gate`).
- [PROVEN] `car.object-observed`: a full-throttle car reaching a kind-0 obstacle (moved onto the road in a run copy) within 14 units sets the collision word 2, the car word `+0x7c` and the object's `.SPW` word `+2` to 1 for one call; then the throttle is 0, the heading turns by 18, the crash word `+0x7e` is 1 and the car is driven backwards at about 64 a call until it stops.
- [PROVEN] `pickup.kinds-observed`: a kind-2 pickup sets the object's consumed marker and adds 4 to the car's counter `+0x6a`; a kind-3 pickup sets the held word `+0x16` to 3; neither slows the car; the held item 3 shows as ICONS.SP frame 0 at (293, 178).
- [PROVEN] `item.fire-observed`: the fire key with the item 3 held uses it up and queues 3 shots in a fan (records in the list at obj2+0x1f2b0, 100 units a step, 10 sideways per 100), the racer word `obj2+0xaaa2` is 3 while they fly; with nothing held and no counter a press spawns nothing.
- [PROVEN] `item.shots-observed`: item 4 throws two records sideways (16 columns a call, turning at the road's sides), items 5, 6 and 7 drop one record each 10 rows behind the car that stays where it fell; each press uses the item up.
- [PROVEN] `car.player-frames-observed`: the player's car (Tigi) is drawn at column 141, top row 164 or 165, with CARS.SP frame 88 going straight, TIGER.SP frames 0 and 1 steering left and 3 and 2 steering right (the car word `+0x1a` runs 0, 1, 2, 3, 4 over TIGER 0, TIGER 1, CARS 88, TIGER 2, TIGER 3), CARS.SP frame 87 in a hand brake turn.
- [PROVEN] `item.hedgehog-observed`: with the counter above 0 and nothing held a press queues one type-0 record 20 rows ahead and spends one count; a shot stops 13 rows before an object it touches (collision word 2) and otherwise runs to the end of the road.
- [PROVEN] `item.mine-hit-observed`: an AI racer that reaches a dropped bomb stops on it for 33 ticks (its word `+0x58` is 1, `+0x4c` the start tick) and the record is gone 3 ticks later; the racers do not otherwise change.
- [PROVEN] `input.steer-observed`: left alone sets the left byte, word and amount (20 or 40) and lowers the heading, right alone the right ones and raises it (a quarter turn is 480 of 1920); after a hand brake turn the amount was 120.

- [PROVEN] `car.step-observed`: on the road, one tick at a time: the throttle rises by 10 to the cap 100 with the accelerate key, falls by 4 with no key and by 12 with the brake key (the brake's 8 and the coasting 4), the speed is the VEL.TAB entry of the new throttle and the car moves by `(TRIG vector x speed + 0x8000) >> 16` per axis along the heading, in that order inside a call (records steps-1 and steps-2, 51 one-tick pairs).

- [PROVEN] `car.steer-step-observed`: per tick the heading changes by the steering amount words, 40 left or right (also standing still), 120 in the hand brake turn, 0 without a key, modulo 1920 (record steps-3, 37 one-tick pairs); the movement while turning is not the straight step of `car.step-observed`.

## One frame

- [STATIC] `race.frame-calls`: the race frame routine (`obj1+0x1fd8c`) draws the floor, then the objects and the cars, with the terrain lookup, progress and the AI after. Order of the calls, not a trace.
- [PROVEN] `floor.render-observed`: two frames of a race (camera (1280, 1476) heading 480; (1337, 2101) heading 160) show exactly the floor the model of `floor.render-loop` predicts from the camera words, the heading, TRIG, NDIST, the `.M` map and the track's two tile sheets, in every column that is not under a car, an object or the speedometer.
- [STATIC] `view.setup`: the view is a fan of 320 TRIG entries (the heading ± 160 of 1920) reaching 1122 world units, the largest NDIST dword; it also forms a bounding box of the visible points.
- [STATIC] `floor.render-loop`: the floor is 320 columns of 70 steps. Column *c* uses the TRIG entry at heading − 160 + *c*; step *k* takes the NDIST dword for that column and step, adds `(TRIG × NDIST) >> 16` to the camera words `obj2+0x28b0a`/`+0x28b0e`, looks the world point up in the 128×128 tile-pointer table and copies the tile pixel one scan line up. Never compared with a frame.

## Axes and angles

- [PROVEN] `rd.derived-words`: TRIG index 0 is +x (the column direction), index 480 is +y (the row direction, down the map), one turn is 1920. An `.RD` record's angle word is the TRIG index along its segment, its length word the segment length (within 1), its compass word the angle's octant (`(floor((angle + 120) / 240) + 6) mod 8`).
- [PROVEN] `ndist.layout`, `trig.layout`: NDIST holds 320 runs of 70 increasing integer distances (115 to 1122); TRIG holds 1920 unit vectors in 16.16.
- [PROVEN] `terrain.lookup`, `terrain.clamp`: the terrain lookup takes a world column and row, clamps each to 0..0xfff, and returns the `.SIN` dword chosen by the tile's mask pixel; the map occupies world 0x400..0xbff.

## Speed and throttle

- [STATIC] `car.speed-model`: the car's throttle word `+0x42` rises by 10 a call while the accelerate flag (`obj2+0x28b40`) is set (6 in some modes), falls by 4 otherwise and by 8 while the brake flag (`obj2+0x28b44`) is set, capped at 100; the speed word `+0x26` is `VEL.TAB[throttle]` (read from the copy at `obj2+0x1e730`). A terrain-2 strip sets the throttle to 160 for 16 calls when its gate is open (`car.boost-gate`, `car.boost-observed`).
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
