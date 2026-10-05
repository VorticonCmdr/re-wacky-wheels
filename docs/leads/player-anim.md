<!-- WF: output of a subagent's read of the disassembly on 2026-10-04; a lead, not evidence. The maintainer has not re-read it. Citations are obj1 offsets of the instructions read (analysis/ww/obj1.asm) and obj2 offsets of data (analysis/ww/obj2.bin); no `npm run cite` fingerprints were produced. Nothing here was run in the game. -->

# The player's car: control, input, movement states and pictures (WF lead, 2026-10-04)

Everything below is **WF**: read from `analysis/ww/obj1.asm`, `obj1.bin`, `obj2.bin` and the user's `WACKY.DAT` (directory and member sizes, `VEL.TAB`); nothing was run in the game. "(obj1+0x...)" names the instructions read; a range "(obj1+0x190a0 to +0x19e0a)" means the whole stretch was read. Existing claims are used as given where named (`car.speed-model`, `car.move-step`, `car.collision-test`, `car.steer-states`, `car.boost-gate`, `car.turn-move`, `race.class-setup`, `view.player-car-draw`, and the `*-observed` claims); where this reading differs from a claim the difference is listed in section 17.

## 0. Conventions

* The car record is the structure the dword obj2+0x1d5b0 points to. A normal race has one human car; the same code is run for a second human (split screen / two player) by the routine at obj1+0x225e3 to +0x226cf, which sets obj2+0x1d5b0 to the second record (obj2+0x8410 + 0x104, records are 0x104 bytes, `car.speed-model`), the viewer word obj2+0x28b7e to 1 and calls the control routine again (obj1+0x226cf). Everything below says "car" for the record in use and p for the viewer word obj2+0x28b7e (0 or 1). The racer record of the human is the 0x68-byte record at obj2+0xaa90 + 0x68 p (see `docs/leads/racer-states.md`).
* A "frame" is one pass of the race frame routine; it increments the tick dword obj2+0x1ec64 once (obj1+0x2114c, after the frame limiter loop obj1+0x21108 to +0x21122). The control routine runs once a frame per human (obj1+0x225b7 for player 1, obj1+0x226cf for player 2), after the key sampler obj1+0x1d6d0 (obj1+0x225b2). `docs/leads/racer-states.md` section 0 gives 88.2 ms for the default frame period (a lead, not re-derived here). Every duration below is counted in frames; "the tick advanced" always means "a frame has passed since the stamp".
* The stamp word +0x32 of the car is the tick of the last animation step. A state routine runs only when `tick - [car+0x32] >= 1` (obj1+0x198a2 to +0x198ad; the helper obj1+0x2490 returns `[0x1ec64] - eax`), and the exception is state 5 (the lean), which runs every call (obj1+0x198af to +0x198ba).
* Sound numbers are passed to the play routine obj1+0x1c04; the routine obj1+0x1bbc sets obj2+0x28c62 to 1 when the sound is still playing (obj1+0x1bbc to +0x1bf5). Sound ids 0 to 7 are the driver voices, the word obj2+0x28b96 picks the human's (`docs/leads/pickups.md` section 2).
* "Table" below means rows of 8 bytes (two dwords, one per viewer: the viewer p uses the dword at row x 8 + p x 4) unless it says 4-byte rows. The dword in a table row is a pointer to a 38 x 28 picture (0x428 bytes), the frame address that the draw routine puts in the draw record (section 13).
* `[0x...]` is an obj2 offset. Heading, TRIG and the 1920-unit turn are as in `car.move-step` (1920 = 360 degrees, 480 = 90 degrees, 120 = 22.5 degrees).

## 1. The car record words this lead reads

| word | use | cite |
| --- | --- | --- |
| +0x00 | bump flag: 1 from the start of a bump animation (states 6 to 9) until the car is back in the straight pose (0) | obj1+0x13074; obj1+0x19271, +0x199f6, +0x19a81, +0x19bb6, +0x19c14, +0x19dac |
| +0x02 | bump hold stamp: tick at which the bump frame reached its last row | obj1+0x19aed to +0x19af3; obj1+0x19b55 to +0x19b5b |
| +0x06 | forced turn: 0 none, 1 left, 2 right | obj1+0x1974e |
| +0x08 | forced turn call counter | obj1+0x19738; obj1+0x12554 |
| +0x0a | jump state ("pit"): 0 on the road, 1 rising, 2 falling, 3 landed | obj1+0x11715; obj1+0x192e2; obj1+0x14cad; obj1+0x153c5 |
| +0x0c | jump countdown, set to 8 | obj1+0x1172a; obj1+0x192cd |
| +0x0e | jump height limit, set to 0x28 | obj1+0x14c7c |
| +0x10 | jump height in screen rows, set to 8 at the start, +8 a draw while rising, -8 while falling | obj1+0x14c73; obj1+0x14c95 |
| +0x14 | inverted steering flag (set by a type 4 shot, cleared 300 ticks later) | obj1+0x11da7; obj1+0x1fbd6 to +0x1fc1d; read at obj1+0x1934a |
| +0x16 | held item; +0x6a ammo counter (`atr.kind-effects`) | |
| +0x18 | animation state (section 4) | |
| +0x1a | frame step (row of the picture table of the state) | |
| +0x1c | lean target row (state 5) | |
| +0x1e | hop-ended flag: 0 when a hop starts, 1 when it ends | obj1+0x1280b; obj1+0x125d9 |
| +0x20 | hop: 0 none, 1 left, 2 right | obj1+0x127fc; obj1+0x1286f; obj1+0x12ab4; obj1+0x12b9e |
| +0x22, +0x24 | frames the left / right key has been held in a row | obj1+0x19448; obj1+0x1948a |
| +0x26 | speed (the VEL.TAB entry of the throttle, then slowed by the surface) | obj1+0x196c9 to +0x196d5 |
| +0x32 | animation stamp (tick) | see section 0 |
| +0x36 (dword) | surface slowdown fraction (SDX dword +0x120) | obj1+0x141b7 to +0x141bd |
| +0x3a | N, the SDX word +0x124 of the surface (frames a steering key must be held for a slide) | obj1+0x141c6 to +0x141cd |
| +0x3c | drift: 0 none, 1 left, 2 right (also set by the hand brake turn) | |
| +0x3e | 2 N, the drift to hop threshold, recomputed each call of the drift branch | obj1+0x12702 to +0x12715 |
| +0x40 | drift timer, 0x78 at the start | obj1+0x12a5f |
| +0x42 | throttle, 0 to 0x64 (0xa0 in a boost) | `car.speed-model` |
| +0x44 | special surface state (terrain 6 or 0xf) | section 11 |
| +0x46, +0x48, +0x4a | scrape sparks: side (3 left, 4 right), frame counter, picture buffer (dword obj2+0x1eb38) | obj1+0x13b0d to +0x13b30 |
| +0x4e | pointer to the table slot whose dword is the car's picture | section 13 |
| +0x52, +0x54 | steering "wheel" counters, 0 to 4 (0x10 during the forced turn), used for the horizon scroll word obj2+0x1d860 | obj1+0x13c7b to +0x13c95; obj1+0x13d95 to +0x13dba; obj1+0x14834 to +0x148a9 |
| +0x56 | terrain value under the car | obj1+0x141a5 |
| +0x5a, +0x5c | splash overlay of the special surface: +0x5a 0 none, 1 entering, 2 leaving; +0x5c its frame 0..3 | obj1+0x14258; obj1+0x14d02 to +0x14dc2 |
| +0x5e | frame 0..7 of the special-surface body picture | obj1+0x16afa to +0x16b34 |
| +0x60, +0x64 | copies of the SDX record dwords +0x126 and +0x12a | obj1+0x1427f to +0x1428e |
| +0x68 | bobbing toggle of the draw | obj1+0x16dab to +0x16dbb |
| +0x76 | pointer to the SDX record of the terrain | obj1+0x141ae to +0x141b4 |
| +0x7c | contact flag set by the walk | `car.collision-test` |
| +0x7e | crash (wreck) flag | `car.crash-observed` |
| +0xaa | cleared at the start of the move, set to 1 when the move is blocked or +0x3c is not 0 | obj1+0x137ee; obj1+0x13915 |
| +0xb4, +0xb6 | boost flag and its frame counter | section 10 |
| +0xe0 | driver ability bits (0x01 boost, 0x02 hop; `docs/leads/pickups.md`) | obj1+0x1d851; obj1+0x1d8cb |

At the start of a race the routines at obj1+0x203c4 to +0x20440 and obj1+0x20ddf to +0x20ede set for each human record: +0x1a = 2, +0 = 0, +0x18 = 0, +0x1c = 2 and +0x4e = the dword slot of row 2 of table 0x1b518 for the viewer (obj1+0x203ed to +0x20432, obj1+0x20e03 to +0x20e39), then clear +0x68, +0x22, +0x24, +0x3a, +0x36, +0x3c, +0x20, +0x26, +0x54, +0x52 and +0x42 (obj1+0x204bf to +0x204f0) and put the VEL.TAB entry 0 in +0x26 (obj1+0x204f9 to +0x20506).

## 2. The frame order around the control routine

Per human, in the race frame routine: the key sampler (obj1+0x1d6d0), the control routine (obj1+0x190a0), then the car's position words are copied to the racer record (`[0x28b68]`, `[0x28b6a]` to obj2+0xaaa6, +0xaaa8, the heading dword to obj2+0xaae0) and obj1+0x14364 runs (the fire / item routine, `docs/leads/pickups.md`; obj1+0x225b2 to +0x225de). The draw side later calls the player draw routine obj1+0x16a3c (obj1+0x208c2) and the draw-list blitter obj1+0x14bcc, which also moves the jump height of section 8.

## 3. The control routine obj1+0x190a0 to +0x19e0a

In pseudo-code (p = the viewer, `car` = obj2+0x1d5b0). The jump table of the 14 dispatch targets is at obj1+0x19068 (the code at obj1+0x19068 as printed in the disassembly is data). The routine starts at obj1+0x190a0 with `push ebx; push ecx; push edx` (bytes 53 51 52 in obj1.bin; the listing merges them with the table, its first instruction is obj1+0x190a2) and ends with `ret` at obj1+0x19e0a.

```
control():
  [0x28b92] = [0x28b90] = 0                                   // steering amounts of this call (obj1+0x190a9, +0x190b2)
  if [0x28c42] == 1:  camera roll-back (section 12); return    // obj1+0x190c9 to +0x191df
  if [0x28c42] != 0:  return                                   // obj1+0x190d1
  if car.+0xa != 0:   jump-branch (section 8) then goto MOVE    // obj1+0x191e2
  keys, lean, held counts (section 5)
  brake, throttle, boost count-down, speed (section 6)
  hand brake turn start (section 7)
  if car.+0xa == 0 and [0x1e568] != 10:  input()               // obj1+0x197b3 to +0x197c9
MOVE:
  [0x28b94] = car.+0x26 ; [0x1d678] = heading ; move()          // obj1+0x197ce to +0x197e8
  terrain-2 boost (section 10)                                 // obj1+0x197f3 to +0x1986b
  if car.+0xa != 0: return                                     // obj1+0x19873
  if [0x28c3c] != 0: car.+0x18 = [0x28c36]                     // finish pose (section 14), obj1+0x1987e to +0x1988f
  state machine (section 4)
```

The state test: with the state s = car.+0x18, `s != 0` and `tick - car.+0x32 >= 1`, or s == 5, run the routine for s; the dispatch is `bx = s - 1; if bx > 13 return; jmp [obj1+0x19068 + 4 bx]`, so s = 0 and s > 14 do nothing (obj1+0x1989b to +0x198e3). Before the routine runs `car.+0x32` is set to the tick (obj1+0x198c6 to +0x198cc).

The 14 dispatch targets (table at obj1+0x19068, obj1 offsets as stored in obj1.bin): state 1 +0x198eb, 2 +0x1996e, 3 +0x199ca, 4 +0x19a55, 5 +0x19c59, 6 +0x19ae0, 7 +0x19b43, 8 +0x19bab, 9 +0x19c09, 10 +0x19cb6, 11 +0x19e01, 12 +0x19e01, 13 +0x19d3d, 14 +0x19d8b. The targets of states 11 and 12 are the common exit: they do nothing, and no read code sets state 11 or 12.

## 4. The animation states (the machine on +0x18)

All row numbers are rows of the tables of section 13; "straight" means the reset `+0 = 0, +0x18 = 0, +0x1a = 2, +0x1c = 2` and the frame pointer to row 2 of table 0x1b518 (the same reset is the helper obj1+0x12334, used at the hop end).

| state | what | what sets it | what it shows | how it ends |
| --- | --- | --- | --- | --- |
| 0 | straight / lean arrived | the resets | `+0x1a` row of table 0x1b518 (set by state 5) | |
| 1 | left hop remainder | hop start: `+0x18 = 1, +0x1a = 7, +0x20 = 1` (obj1+0x12818; obj1+0x127e0 to +0x12820; obj1+0x12ab4 to +0x12ae5; the shot hit obj1+0x11d16 to +0x11d56) | while `+0x20 != 0` the input routine owns the picture (section 16.3) and this routine returns (obj1+0x198eb to +0x198f0); when `+0x20 == 0` it decrements `+0x1a` and shows row `+0x1a` of table 0x1b448 only when `+0x1a > 6`, else straight (obj1+0x198f6 to +0x1993a) | immediately after a wall bounce cleared `+0x20` |
| 2 | right hop remainder | `+0x18 = 2, +0x1a = 9, +0x20 = 2` (obj1+0x1288b; obj1+0x12844 to +0x12893; obj1+0x12bcf) | like state 1 with `+0x1a` incremented and shown while `< 6`, which a value of 9 or more never is, so it ends at once (obj1+0x1996e to +0x199c9) | |
| 3 | left drift / left hand brake turn | `+0x18 = 3, +0x1a = 0, +0x3c = 1` (obj1+0x12a4d; obj1+0x1976f) | waits while `+0x3c != 0` showing row 0 of table 0x1b4d8; then `+0x1a` goes 1, 2 (rows of 0x1b4d8) and at 3 it ends in straight (obj1+0x199ca to +0x19a4b) | 2 frames after the drift / turn ends |
| 4 | right drift / right hand brake turn | `+0x18 = 4, +0x1a = 6, +0x3c = 2` (obj1+0x12b3b; obj1+0x19797) | waits while `+0x3c != 0` showing row 6 of 0x1b4d8; then `+0x1a` goes 5, 4 and at 3 ends in straight (obj1+0x19a55 to +0x19ad6) | 2 frames after |
| 5 | lean | a steering key or no key, state 0 or 5 (section 5) | row `+0x1a` of table 0x1b518, `+0x1a` moving one step toward the target `+0x1c` each call; at `+0x1a == +0x1c` the state becomes 0 (obj1+0x19c59 to +0x19cb5) | arrival |
| 6 | bump, other car on the left or centre | contact with a racer (section 9) | see section 9 | into state 8 after the hold |
| 7 | bump, other car on the right | | | into state 9 |
| 8 | bump recovery (from 6) | | | straight |
| 9 | bump recovery (from 7) | | | straight |
| 10 | finish pose, places 1 to 3 | the finish routine (section 14) | 4-byte table 0x1b378 | not left |
| 11, 12 | none | no read writer | | |
| 13 | finish wobble, other places | the finish routine | table 0x1b238 | not left |
| 14 | jump (pit) spin | `+0x18 = 0xe, +0x1a = 0` (obj1+0x19233; the helper obj1+0x12494 to +0x124e7, whose store is at obj1+0x124de) | rows 1 to 7 of table 0x1b448 (section 8) | at `+0x1a >= 8` straight |

Rows per state are listed in section 13 and the picture of each row in section 15.

### 4.1 State 5, the lean (the only state that runs every call)

`if +0x1a < +0x1c: +0x1a++; elif +0x1a > +0x1c: +0x1a--; if +0x1a == +0x1c: state = 0; show row +0x1a of table 0x1b518` (obj1+0x19c59 to +0x19cb5). The keys set the target in section 5 (`+0x1c` = 0 left, 4 right, 2 none; 1 and 3 at a standstill under the mode of section 5). Observed in `car.lean-observed` (334 pairs).

### 4.2 States 6 to 9, the bump pictures

State 6 (obj1+0x19ae0 to +0x19b42): if `+0x1a != 0`: `+0x1a--` and when it reaches 0 `+2 = tick`; else, when `tick - +2 >= 3`, the state becomes 8; the picture is row `+0x1a` of table 0x1b418. State 7 (obj1+0x19b43 to +0x19baa) mirrors it: `+0x1a` goes up to 4 (`+2 = tick` on arrival), holds while `tick - +2 < 3`, then state 9. State 8 (obj1+0x19bab to +0x19c04): `+0x1a++`, shown while `< 2`, else straight. State 9 (obj1+0x19c09 to +0x19c58): `+0x1a--`, shown while `> 2`, else straight.

Timeline of a left bump from the hit frame f (the start sets `+0 = 1`, state 6, `+0x1a = 1`, picture row 1, stamp = tick, obj1+0x13074 to +0x130cd): row 1 at f, row 0 from f+1 to f+4, state 8 at f+4, row 1 at f+5, straight at f+6. A right bump: row 3 at f, row 4 from f+1 to f+4 (state 9 at f+4), row 3 at f+5, straight at f+6.

### 4.3 States 3 and 4 and the hand brake turn

The forced turn of section 7 uses the same states: the car shows row 0 (state 3) or row 6 (state 4) of table 0x1b4d8 while `+0x3c != 0`, which the forced turn clears after its fourth call.

### 4.4 State 14 (obj1+0x19d8b to +0x19dfe)

`+0x1a++; if +0x1a >= 8: straight; else row +0x1a of table 0x1b448`. It runs through the state machine only when `+0xa == 0`; while `+0xa != 0` the same step is done inline by the jump branch (section 8).

## 5. The keys, the lean and the held counts (obj1+0x192ed to +0x194db)

The steering key bytes are obj2+0x28cd5 (left) and obj2+0x28cdd (right) (`input.steer-flags`); the words they feed are obj2+0x28b8c (left) and obj2+0x28b98 (right).

1. No steering key (both bytes 0): when the state is 0 or 5 and `+0x1a != 2`, state = 5 and `+0x1c = 2` (obj1+0x192ed to +0x1931c).
2. `[0x28b98] = (byte [0x28cdd] != 0)`, `[0x28b8c] = (byte [0x28cd5] != 0)` (obj1+0x19322 to +0x19344).
3. Inverted steering, `+0x14 != 0`: when the left word is set it becomes 0 and the right word 1; else when the right word is set the left word becomes 1 and the right word 0 (obj1+0x1934a to +0x19383). With both keys down the result is the right word.
4. When `+0xa != 0` both words are 0 (obj1+0x19383 to +0x19393; the jump branch has already cleared them, obj1+0x192b9 to +0x192c2).
5. When the mode dword obj2+0x1d998 is not 0 and the speed `+0x26` is 0, a set right word is cleared and (state 0 or 5) `+0x1c = 3`, state 5; a set left word is cleared and `+0x1c = 1`, state 5 (obj1+0x1939c to +0x1940f). So in that mode a car at a standstill can only lean half way and cannot steer. In the normal race this mode word is 0 (steering at a standstill was observed, `car.steer-step-observed`); what the values of obj2+0x1d998 mean is not established here (it is also compared with 3 in obj1+0x14844, which only lets the horizon scroll run for 0 and 3).
6. Left word set: `+0x24 = 0; +0x22++`; state 0 or 5: `+0x1c = 0`, state 5 (obj1+0x19415 to +0x19468). Left word clear: `+0x22 = 0` (obj1+0x1946a to +0x19474). Right word set: `+0x22 = 0; +0x24++`; state 0 or 5: `+0x1c = 4`, state 5 (obj1+0x1947a to +0x194aa). Right word clear: `+0x24 = 0` (obj1+0x194ac). So with both down the right side wins (counts, lean and steering).
7. The counter obj2+0x1ed24 counts the calls of "left held, speed 0, obj2+0x28c38 not 0" (the countdown) and is cleared by the accelerate button (obj1+0x1941f to +0x19442; obj1+0x194b2 to +0x194bc). With the brake word set and obj2+0x28c38 not 0, in a one-screen race (obj2+0x28be2, +0x28bdc, +0x1ec74 all 0), `[0x1ed40] == 0` and `[0x1ed24] >= 0x36`: `[0x1ed40] = 1` and the routine obj1+0x3780 runs (it opens the members named at obj2+0x2b0 and obj2+0x2b8, "DOPE.SP" and "BELCH.VOC", size 0x2e77 and 0xd99; obj1+0x19502 to +0x19541, obj1+0x3780 to +0x37dd). That is a hidden trigger (hold left through 54 frames of the countdown, then brake); nothing else was read.

### 5.1 The key sampler's lock (obj1+0x1d6ce to +0x1d822)

Before the control routine the sampler clears every input: the steering bytes obj2+0x28cd3, +0x28cd5, +0x28cdd and the button words obj2+0x28b40 (accelerate), +0x28b42 (button 2, fire), +0x28b44 (brake), +0x28b46 (hand brake) when any of these holds: the car's hop `+0x20 != 0`, the finish word obj2+0x28c3c, the crash `+0x7e`, the forced turn `+0x6 != 0`, or the human's racer word +0x58 (obj2+0xaae8 for p = 0; set while a shot has hit the racer, `docs/leads/racer-states.md` 3.2: 33 frames, or 50 for the other types) (obj1+0x1d7bf to +0x1d822). So during a hop, a forced turn, a wreck, the finish and a stun the car cannot steer, accelerate or brake: the throttle falls by 4 a call (section 6). When the race mode word obj2+0x28c44 is not 2 (the countdown) the sampler clears only the buttons 2, 3 and 4 (obj1+0x1d6d1 to +0x1d6ed), so the accelerate button still works in the countdown (`car.drive-observed`).

## 6. Brake, throttle, boost count-down and speed (obj1+0x19553 to +0x196d5)

`car.speed-model` and `car.step-observed` give the numbers; the order of the code is:

1. Brake: when the brake word obj2+0x28b44 is set and the throttle `+0x42 > 0`: `[0x28b40] = 0` (accelerate cleared), sound 0x11 when it is not playing, `+0x42 -= 8` (minimum 0), `+0x26 = VEL[+0x42]` (obj1+0x19553 to +0x195bd).
2. When `[0x28b40] == 0`: the racer word +0x62 (obj2+0xaaf2 for p = 0) is set to 0 when it is above 2 (obj1+0x195c7 to +0x195e5); the mode dword obj2+0x1edb0 not 0 with `[0x28c3c] == 0` forces `[0x28b40] = 1` (obj1+0x195ee to +0x19601); the same dword makes the accelerate step set the throttle to 0x36 and stops objects from wrecking the car (obj1+0x13397). Its setter (obj1+0xa05d) also sets the race type word obj2+0x28bb2 to 1; which mode that is was not identified (probably a demo).
3. Accelerate word 0 and boost word `+0xb4 == 0` (obj1+0x1960a to +0x1961e): coast, `+0x42 -= 4`, minimum 0 (obj1+0x196b7 to +0x196c3). Otherwise with `+0xb4 == 0`: `+0x42 += 10` (6 when obj2+0x28be2 or obj2+0x1ec74 is not 0; set to 0x36 when obj2+0x1edb0 is not 0), at most 0x64; and the racer word +0x62 goes 0 to 1 with the racer word +0x54 set to 0 (obj1+0x19624 to +0x19699). With `+0xb4 != 0` the throttle is left alone and `+0xb6--`; at 0 or below `+0xb4 = 0` (obj1+0x1969b to +0x196b5). When the accelerate word is set while `+0xb4 != 0` it is cleared (obj1+0x194c6 to +0x194d2).
4. `+0x26 = VEL[+0x42]` (obj1+0x196c9 to +0x196d5).

The surface slowdown of `+0x26` is done later, in the input routine (sections 16.3 to 16.5): `speed -= (speed * +0x36) >> 16`, minimum 0 (obj1+0x12940 to +0x12969; the hop and drift branches do the same, obj1+0x12680 to +0x1269c and obj1+0x128c2 to +0x128e3); the forced turn branch (obj1+0x1251f to +0x1256f) and the jump branch do not.

## 7. The hand brake turn start (obj1+0x196d9 to +0x197b0)

When `+0xa == 0`, `+0x3c == 0`, `+0x20 == 0`, `+0x42 != 0`, the button word obj2+0x28b46 is set and `+6 == 0`: sound 0x11 (always played), `+8 = 1`, `+6 = 1` (left) when the right word `[0x28b98]` is 0, else 2 (right), `+0x32 = tick`; for left: `+0x3c = 1`, state 3, `+0x1a = 0`, the frame pointer = row 0 of table 0x1b4d8; for right: `+0x1a = 6`, state 4, `+0x3c = 2`, the frame pointer = row 6 of table 0x1b4d8 (obj1+0x19720 to +0x197b0). With no key it turns left. The input routine then (section 16.2) turns the heading by 0x78 = 120 on each of **four** calls, 480 = exactly 90 degrees: `+8` starts at 1 and the routine adds 1 and clears `+6` and `+0x3c` when `+8 > 4`, i.e. after the call in which it became 5 (obj1+0x1254f to +0x1256f); the trigger call is the first of the four (the start runs before the input call in the same pass). During the turn the speed is not slowed by the surface and no key is read (section 5.1), so the throttle falls by 4 a call.

## 8. The jump ("pit"): `+0xa`, `+0xc`, `+0xe`, `+0x10` and the jump branch of the control routine

**Start.** Two read starts set the same words: terrain value 10 under the walk with `+0xa == 0` (obj1+0x116d4 to +0x1173f, `car.collision-test`: it clears `+0x44`, `+0x5a` and the racer word +0x5c first) and the item hop, a driver with the ability bit 0x02 in `+0xe0` pressing brake and accelerate with `+0xa == 0`, `+0x44` cleared first, in the mode obj2+0x1d998 == 0 (obj1+0x1d8aa to +0x1d930, which consumes the two button words). Both set `+0xa = 1`, sound 0xc, `+0xc = 8`, `+0x10 = 8`, `+0xe = 0x28` and the collision word obj2+0x28bae = 4. The helper obj1+0x14298 to +0x142fa has the same body and no caller (section 17).

**Per call, while `+0xa != 0`** (obj1+0x191e2 to +0x192e8, `jump branch`):

```
speed = word [0x1e85c]                       // the VEL entry 150, VEL.TAB 60, VEL2.TAB 42 (obj1+0x191ed to +0x191f4)
if +0xc in 5..6 and state != 14:             // start of the spin
    +0x1a = 0; state = 14; pointer = row 0 of table 0x1b448; +0x32 = tick   (obj1+0x191f8 to +0x1923e)
if state == 14:
    +0x1a++
    if +0x1a >= 8: straight  (+0x1a = 2, +0 = 0, state = 0, +0x1c = 2)       (obj1+0x19250 to +0x19292)
    else pointer = row +0x1a of table 0x1b448
[0x28b8c] = [0x28b98] = 0
+0xc--
if +0xc <= 4: +0xa = 2                        // falling
goto MOVE                                     // no input, no throttle change
```

The speed is read from the word obj2+0x1e85c = the active speed table entry 150 (obj2+0x1e730 + 2 x 150); the table is the `VEL.TAB` copy filled at the race start (`race.class-setup`), where entry 150 is 60 (checked in the archive: VEL.TAB[150] = 60, VEL.TAB[160] = 64, VEL2.TAB[150] = 42). The throttle word, the steering and the heading are not touched, and the jump branch skips the input routine and the throttle code, so the car flies straight ahead at that speed. The movement routine still runs; while `+0xa != 0` a blocked move of the wall type (code 1) sets `+0xa = 0` (the jump ends), and any other collision code is reset to 0 (obj1+0x138d8 to +0x138f1; the wall bounce of that call still happens).

**Height.** In the draw-list blitter (obj1+0x14c61 to +0x14ce0), once per pass for the player's own record: `+0xa == 1`: `+0x10 += 8`, limited to `+0xe`; `+0xa != 1`: `+0x10 -= 8` and at 0 or below `+0x10 = 0`, `+0xa = 3`, sound 0x17; the car (and its shadow) are drawn `+0x10` rows higher; at the end of the pass `+0xa == 3` becomes 0 (obj1+0x153be to +0x153c5). Timeline from the frame f of the start (collision at the end of the control call of frame f, blitter in the same frame; checked against `car.pit-observed`):

| frame | f | f+1 | f+2 | f+3 | f+4 | f+5 | f+6 | f+7 | f+8 | f+9 | f+10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `+0xc` after the call | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 | | |
| `+0xa` after the frame | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 0 (3 then 0) | 0 | 0 |
| `+0x10` after the blitter | 16 | 24 | 32 | 40 | 32 | 24 | 16 | 8 | 0 | | |
| `+0x1a` (state 14) | | | | 1 | 2 | 3 | 4 | 5 | 6 | 7 (state machine) | 8 = straight |

The row of `+0x1a` is shown on the next draw; rows 1 to 7 of table 0x1b448 are shown, row 0 is set and replaced in the same call. The control routine runs the jump branch in the 8 calls f+1 to f+8 (`+0xa == 0` again from f+9), the car is drawn raised in the 9 frames f to f+8, and the spin ends at f+10 (the state machine takes over for f+9 and f+10). `car.pit-observed` has the same ladders (`+0xc` 8 to 1, `+0x10` 16 24 32 40 32 24 16 8 0, `+0x1a` 1 to 7, speed 60).

The input routine is not called in a call whose previous lookup gave terrain 10 (`[0x1e568] == 10`, obj1+0x197c0).

## 9. Contact with racers and objects: the bump pictures and the wreck

The object pass obj1+0x12bf4 (`atr.kind-effects`, `docs/leads/racer-states.md` 5.4) is run over the draw list built each frame, including the player's own record (index `[0x28c12]`), and decides (obj1+0x12c40 to +0x12d55):

* the zone word +0x1e of each other record: 2 when its bottom row (`+2 + +6 - 1`) is below the player's bottom row, 3 when equal, 1 when above (obj1+0x12ce9 to +0x12d08), and the horizontal zone +0x20: 3 when the centre columns differ by at most 4, 5 when the record's centre is right of the player's, 4 otherwise (obj1+0x12d08 to +0x12d50).
* the **bump pictures** (obj1+0x12f2d to +0x130de): when the car word `+0 == 0` and `+0x44 == 0` and the zone +0x1e is 3 or 2, sound 0x8 is played when the race mode word obj2+0x28c44 is 2 and the sound is not already playing (obj1+0x12f5e to +0x12fd1; the other racer's sounds in the mode obj2+0x1ec74 are not read), and, whether or not the sound played, when `+0xa == 0`: `+0x32 = tick`, `+0 = 1`, and state 6 with `+0x1a = 1` when the record's zone +0x20 is 3 or 4, else state 7 with `+0x1a = 3`; the frame pointer is row `+0x1a` of table 0x1b418 and the dword is also written into the player's draw record (obj1+0x13047 to +0x130de). The animation is state 6/7 then 8/9 (section 4.2). This runs for a **racer** record (type word +0x24 above 0) in zone 2 or 3.
* the **wreck** (kind 0 object at speed, or a head-on racer at speed): `car.crash-observed`, `atr.kind-effects` and `docs/leads/racer-states.md` 5.4 give the conditions; the effects on the car are sound 0xd, `+0x7e = 1`, `+0x20 = 0`, `+0x3c = 0`, `+0x18 = 0` (the straight state; the picture pointer is not reset here), `+0x42 = 0`, `+0x44 = 0` (obj1+0x133af to +0x13412; obj1+0x13538 to +0x13576) and, in a one-screen race (obj2+0x28be2, +0x28bdc, +0x1ec74 all 0), obj2+0x28c42 = 1, obj2+0x28c32 = 0, obj2+0x28c1a = the top row word (+6) of the player's own draw record (obj1+0x13418 to +0x1343b; obj1+0x135d2 to +0x135f5). In the other modes the wreck uses the hit pictures (section 13.3).
* any contact (obj1+0x1369f to +0x1376e): `+0x3c != 0`: `+0x3c = 0` and `+0x42 = 0`; `+0x20 != 0`: `+0x20 = 0` and `+0x42 = 0`; sound 0x15 (object) or 0x16 (racer); the spark words `+0x4a = [0x1eb38]`, `+0x48 = 0`, `+0x46` = 3 (zones 3 and 4) or 4 (zone 5). A contact therefore always ends a drift and a hop.
* the response in obj1+0x1d3fc (called from obj1+0x1f7a5 and obj1+0x1fa2c): heading -0x12 (zone 5) or +0x12, the camera moved one unit along the new heading, and for a racer record in zone 2 the throttle +0x28 (limit 0xbe), in zone 1 -0x28 (obj1+0x1d40a to +0x1d4f2; observed `car.racer-hit-observed`). This is the only code read that adds to the throttle above 0x64 besides the boost; `terrain.effects-observed` records a throttle of 140 = 100 + 0x28 for the terrain values 12 and 15 at the first call after the green light; no terrain-dependent throttle write exists in obj1+0x190a0 to +0x19e0a or obj1+0x137e4 to +0x14296, so the 140 probably comes from this rule through a contact with a racer at the start grid (not shown).

A shot that hits the human (`docs/leads/racer-states.md` 3.7, obj1+0x11cbe to +0x11d78): sound 0x11, state 1, `+0x1a = 7`, `+0x20 = 1` and `+0x1e = 0` (the left hop of section 16.3, 8 pictures) or, for a type 4 shot, `+0x14 = 1` (inverted steering for 300 ticks, obj1+0x1fbd6 to +0x1fc1d).

## 10. The boost: `+0xb4`, `+0xb6` (obj1+0x197f3 to +0x19862, obj1+0x1d838 to +0x1d896)

* Terrain: when the terrain value `[0x1e568]` (after the move) is 2 and `+0xb4 == 0`: `+0xb4 = 1` is stored first, then the gate obj1+0x25bc is called and its result (0 or 1) stored in `+0xb4`; with 1: sound 0xc, throttle 0xa0, `+0xb6 = 0x10`, `+0x26 = VEL[0xa0]` (64 in VEL.TAB) (obj1+0x197f3 to +0x19857). When the terrain is not 2 or `+0xb4 != 0`, a throttle of 0 or below clears `+0xb4` (obj1+0x19859 to +0x19862).
* The gate (obj1+0x25bc to +0x2609): because the control routine has already set `+0xb4 = 1` (obj1+0x19808) when it calls the gate (the only call, obj1+0x19811), the gate always takes the branch for `+0xb4 != 0`: the result is 1 when the heading dword obj2+0x1d5d4 lies in `[obj2+0x1ebc8, obj2+0x1ec44]` (obj1+0x25ce to +0x25e3). The branch for `+0xb4 == 0` (the car word `+0xa != 0` and the heading in `[obj2+0x1ebc4, obj2+0x1ec40]`, obj1+0x25e5 to +0x25ff) is not reached from this caller. The range words are set by obj1+0x24e8 (called at obj1+0x2020f) from the track number obj2+0x1e728: tracks 6, 10, 13, 15, 25: 0x348 to 0x438; tracks 3, 4, 9 and 24, 29, 35: 0x528 to 0x618 (for 3, 4, 9 the other pair is also set to that range); every other track leaves both words 0, so only heading 0 opens the gate (obj1+0x24e8 to +0x25ba; checked against the compare chain).
* Per call with `+0xb4 != 0`: the accelerate word is cleared, the throttle is left at 0xa0, `+0xb6--`, and at `+0xb6 <= 0` `+0xb4 = 0` (section 6 item 3); the speed is `VEL[0xa0]` each call. With `+0xb6` = 0x10 the boost lasts through the control calls 1 to 16 after the start (the move of call 16 still uses VEL[0xa0]); the next call the throttle is brought back by the accelerate step to at most 0x64 (`car.boost-observed`: timer 15 down to 2, throttle 160, then 100).
* Item boost (a driver with the ability bit 0x01 in `+0xe0`, brake plus button 2, mode obj2+0x1d998 == 0, no gate): `+0xb4 = 1`, throttle 0xa0, `+0xb6 = 0x10`, `+0x26 = VEL[0xa0]`, sound 0xc, and the buttons 3 and 4 cleared (obj1+0x1d838 to +0x1d8a9; the same lines are the routine obj1+0x142fc, which has no caller).

## 11. The special surface state `+0x44` (terrain value 6 or 0xf)

* Start (obj1+0x141d1 to +0x1428e, `car.move-step`): when the terrain value at the end of the move is 6 or 0xf and `+0xa == 0`, `+0x44 == 0`, `+0x7e == 0`: sound 0xf, the word obj2+0x28bd8 = the terrain value, the racer word +0x5c (obj2+0xaaec) = 1 and the racer words +0x28, +0x2a (obj2+0xaab8, +0xaaba) = 0, `+0x5a = 1`, `+0x5c = 0`, `+0x5e = 0`, `+0x44 = 1`, `+0x60` and `+0x64` = the SDX record dwords +0x126 and +0x12a.
* While `+0x44 != 0` (the draw routine each call, obj1+0x16ac7 to +0x16b89): sound 0xe is played when it is not already playing (obj1+0x16ad2 to +0x16aeb); the car's own picture is replaced by the picture at `[+0x64] + [+0x5e] x 0x300`, `+0x5e` going 0 to 7 and back to 0 each call (8 frames of 0x300 bytes, `+0x5e` incremented after use; obj1+0x16afa to +0x16b34), with the size record taken from the first dword of the table at obj2+0xe560 instead of the table at obj2+0xe470 (obj1+0x16af0 to +0x16af5). The car is not drawn bobbing and not clipped (obj1+0x16dd6 to +0x16ddb).
* Effects on the driving: with `+0x44 != 0` the car cannot start a drift or a hop (obj1+0x12975), cannot be wrecked by an object or a racer and gets no bump picture (the checks are at obj1+0x13363, obj1+0x13522 and obj1+0x12f3c), and the jump start clears it. The surface slowdown applies as for any surface (`terrain.effects-observed`).
* End: when the terrain value under the car `+0x56` is neither 3 nor the stored value obj2+0x28bd8, the draw routine ends it: racer +0x5c = 0, `+0x44 = 0`, `+0x5c = 0`, `+0x5a = 2` and sound 0xf (obj1+0x16b40 to +0x16b89). A wreck also clears it (obj1+0x16d23 to +0x16d29; obj1+0x13412).
* Overlay: the blitter plays a 4-frame overlay of 38 x 28 pictures at the screen position (0x8d, 0xa8) (0xa8 minus the second viewer's offset) while `+0x5a != 0` and the car is not wrecked: the frame is the picture `[+0x60] + [+0x5c] x 0x428`, `+0x5c` is incremented after each draw, and at 4 `+0x5a = 0` (obj1+0x14cec to +0x14dc2). It starts with `+0x5a = 1` (entering) and again with 2 (leaving). With `+0x5a == 1` the blitter does not draw the car body while `+0x5c < 2` and draws it from `+0x5c == 2` (obj1+0x14d09 to +0x14d37); with `+0x5a == 2` it draws it throughout (obj1+0x14d22 to +0x14d32) (`docs/leads/effects.md` 2.4 reads the same). The two SDX pointers are filled at the race load by the loader around obj1+0x17614 to +0x17794 (a record loads the members named by its fields +0xf8 and +0xfc with the sizes of its fields +0x108 x +0x112 and +0x114 x +0x11e; the second one only when the byte `[track + record x 0x12e + 0x14277]` is 1); which members those are was not read.

## 12. The crash camera word obj2+0x28c42 (control and draw routines)

States: 0 normal, 1 flight, 2 hold, 3 fall, 4 gone. Set to 1 only by the wreck of section 9 in a one-screen race (obj1+0x13422, obj1+0x135dc), advanced only by the draw routine (obj1+0x16c34, +0x16c80, +0x16ce2) and set to 0 at the race start (obj1+0x20206); the read code never sets it back during a race (as the crash claim says). `docs/leads/effects.md` section 4 (written in parallel, not re-read here) reports that in state 4, 13 frames after the stamp obj2+0x1e72c, the main loop takes a life (car word +0x6c) and shows the lap or continue screen (obj1+0x214a2 to +0x21507).

**Control routine, state 1** (obj1+0x190d7 to +0x191d6): the camera words obj2+0x28b0a and +0x28b0e are moved back along the heading by `-((V x 0x40 + 0x8000) >> 16)` per axis, V being the TRIG entry of the heading dword obj2+0x1d5d4 (the routine obj1+0x27bb1 with the distance word obj2+0x1d608 = 0x40; the result words are negated, obj1+0x1911f to +0x19138), then each word is limited to the range 0x400 to 0xbfe (signed compares, obj1+0x19145 to +0x19198) and the car record's lookup point obj2+0x28b68, +0x28b6a is recomputed as the camera plus the offset of 0x7c along the heading (obj1+0x191a1 to +0x191d6). Nothing else runs (no throttle, no input, no move). In states 2, 3, 4 the control routine returns at once (obj1+0x190d1). The roll-back is 9 calls (one per draw call of state 1), `car.crash-observed` (63 then 64 a call).

**Draw routine, the flight** (obj1+0x16baf to +0x16ceb; `[0x28c32]` is the picture index, `[0x28c1a]` the top row of the picture):

* state 1: picture = table 0x1b328 (4-byte rows) row `[0x28c32]` (0 to 7 and back to 0: shown first, then incremented, wrapped at 8; the picture dword goes to `car.+0x4e`); `[0x28c1a] -= 6`; when `[0x28c1a] <= 0x72` it is set to 0x72, the state becomes 2, `car.+0x4e` = the address of row 0 of the 4-byte table 0x1b2d8, `[0x28c32] = 0` and the stamp obj2+0x1e72c = tick (obj1+0x16be3 to +0x16c52). From a top row of 164 or 165 that is 9 draw calls (the 9th shows row 0 of table 0x1b2d8).
* state 2: picture = row `[0x28c32]` (0) of table 0x1b2d8; when `tick - [0x1e72c] >= 0xb` the state becomes 3 (obj1+0x16c57 to +0x16c89): the hold is 11 frames.
* state 3: `[0x28c32]++` wrapped at the count word obj2+0x28c4e (the A of the driver, section 15), picture = row `[0x28c32]` of table 0x1b2d8, `[0x28c1a] += 4`; when `[0x28c1a] > 0xc7` it is set to 0xc7, the state becomes 4 and the stamp is the tick (obj1+0x16c8b to +0x16ceb). From 0x72 that is 22 draw calls. The picture is clipped at the screen row 0xc7: when `top + height - 1 > 0xc7`, the height is reduced by the excess and the skip word is 4 x the excess (obj1+0x16deb to +0x16e29).
* state 4: the player's car is not drawn (obj1+0x16a47).
* The left column is `0xa0 - width/2`; the picture of the states 1 to 3 is drawn at the top row `[0x28c1a]` (obj1+0x16deb to +0x16e29), without the bobbing.
* Special modes (obj2+0x28be2, +0x28bdc or +0x1ec74 not 0): there is no flight; when `+0x7e != 0` and `[0x28c42] == 0` the picture is the hit picture `[racer +0x56]` of the table obj2+0x1c7f0 (section 13.3), the racer word +0x56 (obj2+0xaae6 for p = 0) going up by 1 each draw, and when it is above 3 the car is not drawn and the word keeps counting (obj1+0x16a63 to +0x16aa7; obj1+0x16d06 to +0x16d52).
* The draw routine returns without drawing when `[0x28ca8] != 0` (obj1+0x16a55; what sets it was not read).

## 13. The picture tables and the draw routine

### 13.1 What the player draw routine does (obj1+0x16a3c to +0x16eb6)

After the cases of section 11 and 12, the normal case is: `picture = *( [car+0x4e] )` (the dword in the table slot; obj1+0x16cf0 to +0x16d01), the size record is the pointer at obj2+0xe470 (size class 0), the width is its word 0 and the height its word 2, the bottom row is the word obj2+0xbdf8 (193, `view.player-car-draw`), the top row = bottom - height (obj1+0x16d58 to +0x16d85). While the speed `+0x26 > 0`, `+0x44 == 0`, `+0x7e == 0` and `[0x28c44] == 2`, the car bobs: `+0x68` toggles each draw and when it was 1 the top row is one less (164 against 165; obj1+0x16d8c to +0x16dbb, `car.player-frames-observed`). With the speed 0 and the terrain value `+0x56` equal to 5 (and `[0x28c42] == 0`) the car is drawn 4 rows lower, 4 rows shorter, with the skip word 0x10 (obj1+0x16e2b to +0x16e4a). The record appended to the draw list is as `view.player-car-draw` states: width +0, height +2, left +4 (0xa0 - width/2), top +6, pixel pointer +8 (the size record + 4), frame address +0xc (the picture dword, obj2+0x1d704), skip +0x14, distance +0x10 = 0x7c, racer index +0x18 = p, type +0x24 = 0 (obj1+0x16e4d to +0x16eb3).

### 13.2 The tables, how they are filled, and their rows (the loader obj1+0x73c4 to +0x7862)

The loader is called for the human (and once more for the second human) after the driver is chosen (obj1+0x7d91, +0x7d98, +0x7db9); the slot of the driver is the word obj2+0x28b96 (the second human: obj2+0x28c6a), the slot record is the 0x98-byte record at obj2+0x13c08 + 0x98 slot. The record has 38 dwords (section 15). The table rows (entry numbers refer to that record) are:

| table | rows | row = entry | cite |
| --- | --- | --- | --- |
| 0x1b518 lean / straight (rows 0 to 4) | 5 | 0 = entry 12, 1 = 13, 2 = 4, 3 = 14, 4 = 15 | obj1+0x7661 to +0x76ab |
| 0x1b4d8 drift / hand brake (rows 0 to 6) | 7 | 0 = entry 3, 1 = 12, 2 = 13, 3 = 4, 4 = 14, 5 = 15, 6 = 5 | obj1+0x76b2 to +0x770e |
| 0x1b448 spin (rows 0 to 16) | 17 | row r = entry (4 + r) mod 8: entries 4,5,6,7,0,1,2,3,4,5,6,7,0,1,2,3,4 | obj1+0x7715 to +0x7753 |
| 0x1b418 bump (rows 0 to 4) | 5 | 0 = entry 9, 1 = 8, 2 = 4, 3 = 10, 4 = 11 | obj1+0x775e to +0x779f |
| 0x1b238 finish wobble (rows 0 to 7) | 8 | entries 8, 9, 8, 4, 10, 11, 10, 4 | obj1+0x77a6 to +0x7810 |
| 0x1b328 flight (4-byte rows 0 to 7) | 8 | entries 16 to 23 | obj1+0x7588 to +0x75a4 |
| 0x1b2d8 fall (4-byte rows 0 to A-1) | A | entries 24 to 23 + A | obj1+0x75bf to +0x75e2 |
| 0x1b378 finish pose (4-byte rows 0 to 4 + B) | 5 + B | 0 = entry 4, 1 = 3, 2 = 2, 3 = 1, 4 = 0, then 5 + j = entry 28 + j for j < B | obj1+0x7603 to +0x765f |

The words obj2+0x28c4e = A and obj2+0x28c52 = B + 5 (the second is the row count of the table 0x1b378, `+5` at obj1+0x7706) are loaded from the slot record words +0x90 and +0x92 (obj1+0x75a6 to +0x75b2, obj1+0x75f2 to +0x75fb). The 8-byte-row tables have the viewer offset p x 4 (the loader writes them at `eax*4 + base`, with eax the viewer word: 0x1b518, 0x1b4d8, 0x1b448, 0x1b418, 0x1b238) and the code that reads them adds p x 4, except state 13, which reads 0x1b238 without p (obj1+0x19d63 to +0x19d6a; the finish routine also sets the pointer without p, obj1+0x2174a), so state 13 shows viewer 0's table for both humans. The three 4-byte-row tables 0x1b328, 0x1b2d8 and 0x1b378 have no viewer offset at all; the loader writes them again for the second human, so the last load wins (the entries of every slot point into the same driver buffer, section 15).

The pictures the states use (derived from the two lists above; the pictures of CARS.SP frame 12 slot + k are "car k", the driver file frames are "drv n"):

| table | pictures by row |
| --- | --- |
| lean 0x1b518 | drv 0, drv 1, car 4, drv 2, drv 3 (matches `car.player-frames-observed`: frame word order TIGER 0, TIGER 1, CARS 88 = slot 7 frame 4, TIGER 2, TIGER 3) |
| drift 0x1b4d8 | car 3 (CARS 87 for slot 7), drv 0, drv 1, car 4, drv 2, drv 3, car 5 |
| spin 0x1b448 | car 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4 |
| bump 0x1b418 | car 9, car 8, car 4, car 10, car 11 |
| wobble 0x1b238 | car 8, 9, 8, 4, 10, 11, 10, 4 |
| flight 0x1b328 | drv 4 to drv 11 |
| fall 0x1b2d8 | drv 12 to drv 11 + A |
| finish pose 0x1b378 | car 4, car 3, car 2, car 1, car 0, then drv 12 + A to drv 11 + A + B |

Which rows each state shows: lean rows 0 to 4 (state 5); the straight pose is row 2 of the lean table; hop left rows 7 down to 0 and hop right rows 9 up to 16 of the spin table (section 16.3); jump spin rows 1 to 7 (section 8); drift left row 0 then 1, 2 (end at 3), drift right row 6 then 5, 4 (end at 3) of the drift table (section 4); bump rows of the bump table (section 4.2). The state 13 and state 10 rows are in section 14.

The routine for the second human (obj1+0x7446 to +0x74f5) reads only the first 0x10a0 bytes (four frames) of its driver file into the buffer after the first four frames of obj2+0x1d6c8, saves the slot record entries 12 to 15 (obj2+0x14190 to +0x1419c), points the entries 12 to 15 of its slot at those four frames for the table building and restores the entries afterwards (obj1+0x7817 to +0x784f).

### 13.3 The hit pictures (obj2+0x1c7f0)

The four dwords obj2+0x1c7f0 to +0x1c7fc are the 38 x 28 frames at the GENEF.SP offsets 7641, 8705, 9769 and 10833 (the file is 14692 = 0x3964 bytes, loaded at obj1+0x3bd0 to +0x3bef; the base chain is cut at obj1+0x4014 to +0x40aa; `docs/leads/racer-states.md` 2.5). The player's car shows them (frame index = racer word +0x56, 0 to 3) when it is wrecked in the two-player, shootout and duck-shoot modes (section 12). The same buffer holds the car's shadow (the picture at obj2+0x1c528, 28 x 11, drawn by the blitter at obj1+0x14a9c to +0x14af8 and the passes at obj1+0x14ac4, +0x14e2c) and the spark pictures.

### 13.4 Frames and steps per animation (a summary; every number is derived in the section named)

| animation | pictures | steps | duration |
| --- | --- | --- | --- |
| lean (4.1) | 5 rows of table 0x1b518 | 1 row a call toward the target | 2 calls from centre to full lean, 1 from half |
| hop left (16.3) | 8: rows 7 to 0 of the spin table | 7 steered steps of 120 after the start call (8 when entered from a drift) | 9 calls from the start to the end call |
| hop right (16.3) | 8: rows 9 to 16 | 7 steered steps (8 from a drift) | 9 calls |
| drift (16.5) | 1 (row 0 of the drift table) | half-rate steering while a key is held | 13 calls after the start, then 2 calls of the recovery pictures |
| hand brake turn (7) | 1, then the 2 recovery pictures | 4 calls of 120 = 480 = 90 degrees | 4 calls, then 2 |
| jump spin (8) | 7: rows 1 to 7 of the spin table | 1 row a call | 7 calls, f+3 to f+9; the jump branch runs f+1 to f+8 |
| bump (4.2) | 2 distinct (car 8, car 9, car 8 or car 10, car 11, car 10) | | 6 calls to straight |
| wreck flight (12) | 8 tumbling pictures, then drv 12 | 6 rows a draw call up from the top row to row 0x72 | 9 draw calls |
| wreck hold (12) | drv 12 (row 0 of table 0x1b2d8) | | 11 frames |
| wreck fall (12) | the A fall pictures cycling | 4 rows a draw call down to row 0xc7 | 22 draw calls, then the car is gone |
| special surface (11) | 8 body pictures of 0x300 bytes cycling; a 4-picture overlay of 0x428 bytes | 1 picture a draw | while the terrain value is unchanged |
| boost (10) | none (the picture does not change) | | 16 calls |
| finish pose, places 1 to 3 (14) | 5 + B | 1 row a frame (the first 4 rows once, rows 5 to B + 4 repeating) | until the race is left |
| finish wobble (14) | 8 | 1 row a frame | until the race is left |

## 14. The finish poses (obj1+0x216d3 to +0x21756, state 10 at obj1+0x19cb6, state 13 at obj1+0x19d3d)

The finish routine runs when the car's lap word `+0xb2` equals the laps word obj2+0x28b9c plus 1 and obj2+0x28c3c, obj2+0x28c42 and obj2+0x28bdc are 0 (obj1+0x21609 to +0x21641). It sets the finish word obj2+0x28c3c = 1, clears `+0x44`, `+0x24`, `+0x22`, `+0x3c`, `+0x20`, `+0xb4`, the racer word +0x5c (obj2+0xaaec) and, by the place word obj2+0xaab0 (the human's racer record word +0x20), chooses (obj1+0x216a7 to +0x21756):

* place 1, 2 or 3: `[0x28c5c] = 0`, `[0x28c36] = 0xa`, `car.+0x4e` = the address of row 0 of table 0x1b378, sound 0x11, `[0x28c9c] = 0`;
* any other place: `[0x28c5a] = 0`, `[0x28c36] = 0xd`, `car.+0x4e` = the address of row 0 of table 0x1b238;

then `car.+0x18 = [0x28c36]`, `[0x28c3a] = 0`, `+0x32 = tick`. From then on the control routine forces `car.+0x18 = [0x28c36]` every call (obj1+0x1987e to +0x1988f), the key sampler ignores every key (section 5.1), the throttle coasts down by 4 a call, and:

* **state 10** (obj1+0x19cb6 to +0x19d3c): each run (once a frame): while the count `[0x28c9c] <= 3` and the sound `[0x28b96]` (the driver's voice) is not playing it is played and `[0x28c9c]++`; `[0x28c5c]++`; when it equals `[0x28c52]` (= B + 5) it is set to 5 and `[0x28c3a]++`; the picture is row `[0x28c5c]` of table 0x1b378. So the pictures after the finish are: row 0 (car 4, straight) until the first run, then rows 1 to 4 (car 3, 2, 1, 0, one a frame), then rows 5 to B + 4 (the B finish frames of the driver file, drv 12 + A onwards) repeating; `[0x28c3a]` counts the repeats.
* **state 13** (obj1+0x19d3d to +0x19d8a): `[0x28c5a]++`; at `[0x28c50]` (= 8, set at obj1+0x7807) it is set to 0 and `[0x28c3a]++`; the picture is row `[0x28c5a]` of table 0x1b238 (car 8, 9, 8, 4, 10, 11, 10, 4).

`car.finish-observed` has the victory pose "from about the fourth call", which fits rows 1 to 4 and then the B frames of the driver. obj2+0x28c3c becomes 2 at obj1+0x218a0 (inside the race-end code that also reads obj2+0x28c60 and obj2+0x28bb2; not read further). What `[0x28c3a]` is used for was not read.

## 15. The slot record (38 dwords) and the loaders

The record of slot s is at obj2+0x13c08 + 0x98 s (152 bytes = 38 dwords). Built by the routine obj1+0x228d4 to +0x22b10 (called at obj1+0x1055c and obj1+0x26775; it first copies the eight driver file names into the 0xc-byte entries at obj2+0x1bba0, from the names at obj2+0x1ad8, +0x1ae4, +0x1af0, +0x1afc, +0x1b08, +0x1b14, +0x1b20, +0x1b28 = PANDA.SP, CAMEL.SP, MOOSE.SP, PELICAN.SP, SHARK.SP, RINGO.SP, ELE.SP, TIGER.SP: slots 0 to 7 in that order, obj1+0x228dd to +0x22945; the name at obj2+0x1acc is DIGGER.SP, used by the duck-shoot loader obj1+0x227e0, `docs/leads/racer-states.md` 9.4):

| entry | content | cite |
| --- | --- | --- |
| 0 to 7 | pointers to the CARS.SP frames 12 s + 0 to 12 s + 7 (the 8 compass frames), 0x428 bytes apart in the buffer at the dword obj2+0x1d708 (CARS.SP, 102144 bytes = 96 frames; slot stride 0x31e0) | obj1+0x2294d to +0x22971 |
| 8 to 11 | CARS.SP frames 12 s + 8 to 12 s + 11 | obj1+0x22973 to +0x2298d |
| 12, 13 | driver file frames 0, 1 | obj1+0x22a63 to +0x22a77 |
| 14, 15 | driver file frames 2, 3 | obj1+0x22a79 to +0x22a8b |
| 16 to 23 | driver file frames 4 to 11 | obj1+0x22a8d to +0x22aa2 |
| 24 to 24 + A - 1 | driver file frames 12 to 11 + A (at most 4 entries, 24 to 27) | obj1+0x22aa4 to +0x22ac4 |
| 28 to 28 + B - 1 | driver file frames 12 + A to 11 + A + B (at most 8 entries, 28 to 35) | obj1+0x22ac6 to +0x22ae6 |
| 36 | two words: A (low) and B (high) | obj1+0x2299f to +0x22a2f; read at obj1+0x22a3d, +0x22a44 |
| 37 | the byte count to read from the driver file, (12 + A + B) x 0x428 | obj1+0x22a4b to +0x22a5d; used at obj1+0x7425 |

The driver-file pointers all point into the buffer obj2+0x1d6c8, the same base for every slot (obj1+0x22a56); only the human's driver file is read into it (obj1+0x73c4 to +0x7441, reading `(12 + A + B) x 0x428` bytes of the file named at obj2+0x1bba0 + 0xc slot). Entries 24 and above stay 0 for entries beyond A or B.

The words (A, B) per slot are set by obj1+0x2299f to +0x22a2f: slot 0 (4, 2), 1 (4, 4), 2 (4, 8), 3 (4, 8), 4 (2, 2), 5 (1, 7), 6 (2, 2), 7 (1, 4), and `12 + A + B` is the frame count of the driver file in the user's archive, checked against the directory of WACKY.DAT: PANDA.SP 19152 bytes = 18 frames, CAMEL.SP 21280 = 20, MOOSE.SP 25536 = 24, PELICAN.SP 25536 = 24, SHARK.SP 17024 = 16, RINGO.SP 21280 = 20, ELE.SP 17024 = 16, TIGER.SP 18088 = 17 (each 1064 bytes per frame).

**The mapping for the port**, for the human's slot s with A and B from the table above:

```
entry k  (0 <= k <= 11)        -> CARS.SP frame 12 s + k
entry 12 + i (0 <= i <= 3)     -> driver file frame i          (lean, drift, bump)
entry 16 + i (0 <= i <= 7)     -> driver file frame 4 + i      (crash flight)
entry 24 + i (0 <= i < A)      -> driver file frame 12 + i     (crash fall)
entry 28 + j (0 <= j < B)      -> driver file frame 12 + A + j (finish pose)
```

For TIGER (slot 7, A = 1, B = 4): the crash fall picture is drv 12, the finish frames are drv 13 to drv 16, the straight car is CARS.SP frame 88, the hand brake picture CARS.SP frame 87 and the right drift picture CARS.SP frame 89.

Other uses of the loader at obj1+0x7500 to +0x7560: the six dwords at the table obj2+0x10660 (player 1; obj2+0xe728 for player 2, from the word obj2+0x1d87c) are the slot entries 1, 2, 3, 5, 6, 7 (rows 0 to 5, 8 bytes a row), and the words at +4 of rows 0 to 5 are set to 0x11, 0xa, 0, 0x12, 8 and 1 (obj1+0x7500 to +0x7588). `docs/leads/effects.md` section 2.3 (written in parallel, not re-read here) says the blitter compares the draw record's frame pointer with these six dwords (obj1+0x14e9c to +0x14ed7) to choose the tyre-effect pictures drawn over the player's car; so the six dwords are the pictures that carry an effect, and the words are the x offsets of the effect.

## 16. Input routine obj1+0x124ec to +0x12bf2 (the steering, forced turn, hop, drift)

It does nothing unless the racer word +0x58 of the human (obj2+0xaae8 for p = 0) is 0 and the race mode word obj2+0x28c44 is 2 (obj1+0x124fe to +0x12514). It is called only when `+0xa == 0` and `[0x1e568] != 10` (obj1+0x197b3 to +0x197c9). The order is: the forced turn, the hop, the drift, the normal branch.

### 16.1 Steering rates

* Normal rate R = obj2+0x28c7c: 0x28 (40) for the detail word obj2+0x28c20 = 1, 0x24 (36) for 2, 0x20 (32) for 3, and 0x24 when obj2+0x28be2 or obj2+0x1ec74 is not 0 (obj1+0x6ca2 to +0x6cf0, `race.class-setup`). The drift (half) rate obj2+0x28c7a = R >> 1 (arithmetic), 20 / 18 / 16 (obj1+0x6cf9 to +0x6d12). The hop rate obj2+0x28c54 = 0x78 (obj1+0x6d00), the forced turn amount 0x78 is an immediate (obj1+0x1252d, +0x1253f). If the detail word is not 1, 2 or 3 the word keeps its earlier value (0 in the program image). The routine obj1+0x6ca0 is called once from the race frame routine (`race.class-setup`).
* The amounts are applied by the movement routine: the heading dword obj2+0x1d5d4 goes down by `[0x28b92]` and up by `[0x28b90]` (each only when positive), wrapped by 0x780, around the pivot of `car.turn-move` (obj1+0x13c4f to +0x13e8e).

### 16.2 Forced turn (`+6 != 0`, obj1+0x1251f to +0x1256f)

`+6 == 1`: `[0x28b92] = 0x78, [0x28b90] = 0`; `+6 == 2`: `[0x28b90] = 0x78, [0x28b92] = 0`; then `+8++` and when `+8 > 4`: `+6 = 0, +0x3c = 0`; the routine returns: no slowdown, no keys. Started at the control routine (section 7). 4 calls x 120 = 480.

### 16.3 Hop (`+0x20 != 0`, obj1+0x12574 to +0x126f6)

```
[0x28b92] = [0x28b90] = 0
if tick - +0x32 >= 1:
    +0x32 = tick
    if +0x20 == 1:   +0x1a--;  [0x28b92] = [0x28c54];   if +0x1a < 0:  END
    else:            +0x1a++;  [0x28b90] = [0x28c54];   if +0x1a > 0x10: END
    if not END: pointer = row +0x1a of table 0x1b448
    END: +0x1e = 1; +0x20 = 0; +0x22 = 0; +0x24 = 0; both steering words = 0; throttle +0x42 = 0; straight pose (obj1+0x12334)
speed slowdown by +0x36 (as in section 6)
if speed <= 0 and +0x1e != 0: END again (obj1+0x126a5 to +0x126eb)
```

(obj1+0x1257f to +0x12660.) The left hop shows the rows 7, 6, 5, 4, 3, 2, 1, 0 of the spin table (car 3, 2, 1, 0, 7, 6, 5, 4: the car turns through all 8 compass pictures and ends on car 4) and steers left by 120 on each of the 7 steps from `+0x1a = 6` to 0; the call after (`+0x1a = -1`) ends it. The right hop shows rows 9 to 16 (car 5, 6, 7, 0, 1, 2, 3, 4) and steers right by 120 for `+0x1a = 10 .. 16`. Entered from a drift (section 16.5) the start call also steers 120 (obj1+0x1282c to +0x12838, obj1+0x1289f to +0x128ab) and the speed is zero in that call (section 16.5), so the heading changes by 8 x 120 = 960 = 180 degrees in 8 calls; entered at once because N = 0 (section 16.4) the start call does not steer and the total is 7 x 120 = 840. The hop ends with the throttle 0. The test `speed <= 0 and +0x1e != 0` is never true in a hop that was started by any code read, since all starters set `+0x1e = 0` (obj1+0x1280b, +0x1287e, +0x12acb, +0x12bb5, +0x11d41, +0x12427). A hop is also cleared by any contact (section 9) or wall bounce (`car.bounce-rules`), after which state 1/2 ends the animation (section 4).

### 16.4 Normal branch (`+0x20 == 0` and `+0x3c == 0`, obj1+0x12940 to +0x12bec)

1. Surface slowdown of the speed (section 6; the speed is cleared when the result is negative, obj1+0x12945 to +0x12965).
2. `allow = 1` when the throttle is at least 0x64, `+0x44 == 0`, obj2+0x28be2 == 0, obj2+0x1ec74 == 0 and the terrain value `[0x1e568]` is not 2 (obj1+0x1296e to +0x12998).
3. Steering: `[0x28b92] = R` when the left word is set, else 0; the right word set: `[0x28b92] = 0, [0x28b90] = R`, else 0 (obj1+0x1299d to +0x129e8).
4. `+0x3c = 0`, `+0x20 = 0`; return when `allow == 0` (obj1+0x129e8 to +0x129fc).
5. Slide start: if `+0x22 >= +0x3a` (left held for N frames): sound 0x11 and both amounts 0, then `[0x28b92] = R/2` when the left word is set, `+0x3c = 1`, state 3, `+0x1a = 0`, `+0x32 = tick`, `+0x40 = 0x78`, `+0x24 = 0`, `+0x22 = 0`, the pointer = row 0 of table 0x1b4d8 (obj1+0x12a02 to +0x12a88); if N is 0 this becomes a left hop at once: sound 0x11, `+0x3c = 0`, `[0x28b90] = 0`, `+0x20 = 1`, `+0x1a = 7`, `+0x1e = 0`, state 1, row 7 of the spin table, `[0x28b92] = 0`, `+0x32 = tick` (obj1+0x12a8b to +0x12be9). Else if `+0x24 >= +0x3a` (right held N frames): the same mirrored: `[0x28b90] = R/2` when the right word is set, `+0x3c = 2`, state 4, `+0x1a = 6`, row 6 of the drift table (obj1+0x12af0 to +0x12b79); N = 0 gives a right hop (`+0x20 = 2`, `+0x1a = 9`, state 2; obj1+0x12b80 to +0x12bd5). Because the left test comes first, a surface with N = 0 starts a left hop at full throttle whatever the keys (the counts are 0 and `0 >= 0`).
6. The held counts are the control routine's (section 5); both reset to 0 at the slide start. With the normal surfaces N is 18 (`terrain.effects-observed`): the slide starts at the 18th call the key is down at full throttle.

### 16.5 Drift (`+0x3c != 0`, `+6 == 0`, obj1+0x126f7 to +0x12940)

```
+0x3e = (+0x3a != 0) ? 2 * +0x3a : 0
[0x28b92] = [0x28b90] = 0
if left word:   [0x28b92] = R/2
                if +0x3c == 2:  [0x28b92] = 0;  if +0x22 >= 2 and +0x3a != 0:  +0x3c = 0; return
if right word:  [0x28b90] = R/2
                if +0x3c == 1:  [0x28b90] = 0;  if +0x24 >= 2 and +0x3a != 0:  +0x3c = 0; return
if +0x3c == 1:  if +0x22 >= +0x3e:  -> left hop:  sound 0x11, +0x1a = 7, +0x3c = 0, +0x20 = 1, +0x1e = 0, state 1,
                                        pointer = row 7 of the spin table, +0x32 = tick, [0x28b92] = [0x28c54]
else:           if +0x24 >= +0x3e:  -> right hop: sound 0x11, +0x1a = 9, +0x3c = 0, +0x20 = 2, +0x1e = 0, state 2, row 9,
                                        +0x32 = tick, [0x28b90] = [0x28c54]
+0x40 -= 10; if +0x40 < 0: +0x3c = 0
surface slowdown of the speed
if speed > 0 and +0x3c != 0: return                   // the drift goes on
else: if +0x20 == 0: both amounts = 0;  +0x22 = +0x24 = +0x3c = 0;  speed +0x26 = 0;  return
```

(obj1+0x12702 to +0x1293f.) So in a drift the car steers at the half rate only toward the key that is down, an opposite key held for two calls (when N is not 0) ends it, the drift timer 0x78 falls by 10 a call and ends the drift in the 13th call after the start (+0x40 = 0x78, 0x6e, ..., 0, then -10), and the end call zeroes both steering amounts and the speed word (the next control call recomputes the speed from the throttle, so the car loses one move). A drift that turns into a hop (the held count reaching 2 N, which needs 2 N more calls after the start, so on a road with N = 18 the 13 call timer always ends first; it can happen on surfaces with N of 6 or less) also zeroes the speed word in that call, because `+0x3c` is then 0.

### 16.6 The movement routine obj1+0x137e4 to +0x14296 (what it does to the car words; the claims hold the detail)

* Start: `+0xaa = 0`; when the race mode word obj2+0x28c44 is not 2 the speed word obj2+0x28b94 is set to 0 (so the car cannot move in the countdown whatever the throttle); the probe offsets obj2+0x28b68, +0x28b6a are the 0x7c vector of the working heading (obj1+0x137e9 to +0x1384a); the candidate point is the camera words obj2+0x28b0a, +0x28b0e plus `(TRIG x speed + 0x8000) >> 16` per axis (obj1+0x13862 to +0x138a6); the walk obj1+0x11de0 (called at obj1+0x138ac) sets the collision word obj2+0x28bae and leaves the new camera words (obj1+0x138b1 to +0x138c3); `+0xaa = 1` when the collision word or `+0x3c` is not 0 (obj1+0x138fa to +0x13915).
* Blocked move (collision word 1; `car.bounce-rules`): `+0x3c` cleared with the throttle, `+0x20` cleared with the throttle (obj1+0x13933 to +0x1395d), a working heading turned by 0x3c0 and the camera moved 0x20 along it (obj1+0x13963 to +0x139cf), two wall probes 0x7c ahead of the headings 0x12 either side (obj1+0x139cf to +0x13aa1), the heading changed by 0x12 away from the wall seen by a probe with the camera moved one unit (obj1+0x13b33 to +0x13c38) and the sparks `+0x46` = 4 when the probe on the larger-heading side (the right) saw the wall, 3 for the other, with sound 0x15 once (obj1+0x13b03 to +0x13b30, +0x13bab to +0x13bd3), the throttle cleared at the end (obj1+0x13c3f). No steering is applied in that call.
* Otherwise the steering (obj1+0x13c4f to +0x13e8e, `car.turn-move`): for `[0x28b92] > 0` (left): the pivot offset of the old heading (obj1+0x27a21), `+0x52 = 0x10` when `+6 != 0` else `+0x52` up by 1 to at most 4, the heading down by the amount (wrapped by 0x780), the pivot offset of the new heading, the camera moved by old minus new, and the horizon scroll step obj1+0x14834 (left); with no left amount `+0x52` falls by 1 to 0. The right side is the same with `[0x28b90]`, `+0x54` and the other direction (obj1+0x13d6e to +0x13e8e). Then the two wall probes are made again and the heading is nudged by 0x12 away from a wall one probe sees (obj1+0x13e8e to +0x14100; with a wall on both sides the two nudges cancel, explicitly in the bounce branch at obj1+0x13ab9 to +0x13aec).
* End: the terrain value is looked up 0x7c ahead of the camera along the new heading and stored in obj2+0x1e568 and `+0x56`; the car's lookup point `[0x28b68]`, `[0x28b6a]` is that point; `+0x76` = the SDX record of the terrain, `+0x36` = its dword +0x120, `+0x3a` = its word +0x124 (obj1+0x14107 to +0x141cd); the special surface start for the terrain values 6 and 0xf (section 11) closes the routine (obj1+0x141d1 to +0x14291).

## 17. Corrections to and gaps in the existing claims, and dead code

* `car.steer-states` says the forced turn is five calls of 0x78; the code (obj1+0x19738, obj1+0x1254f to +0x1256f) starts `+8` at 1 and ends the turn in the call where it becomes 5: four calls, 480 = 90 degrees.
* `car.boost-gate` says a terrain boost starts only for a car with `+0xa != 0`. The only call of the gate is at obj1+0x19811, after `+0xb4 = 1` was stored at obj1+0x19808, so the gate takes the `+0xb4 != 0` branch and tests only the heading against `[0x1ebc8, 0x1ec44]` (section 10). The `boost-observed` experiments wrote both range words, so they do not tell the two readings apart.
* `view.player-car-draw` and `car.speed-model` leave the state machine unread; it is section 4 here.
* Never called (no `call`/`jmp` rel32 to them in obj1, no dword equal to the offset in obj1 or obj2, no fixup with the offset as target; indirect calls through a computed register are not excluded): obj1+0x12390 (the full car reset), obj1+0x1241c (start a spin), obj1+0x12494 (start the jump spin), obj1+0x14298 (the pit start) and obj1+0x142fc (the boost start). Their bodies match code that is inline elsewhere (obj1+0x116d4 to +0x1173f; obj1+0x1d838 to +0x1d896; the spin starters of obj1+0x127d6 and +0x12844).

## 18. Uncertain / not read

* The meaning of the mode words obj2+0x1d998 (compared with 0, 1, 2, 3 in many places; section 5 item 5 is the standstill steering lock for a non-zero value, the item abilities of section 8 and 10 need 0, and the horizon scroll of obj1+0x14834 runs only for 0 and 3), obj2+0x28be2 and obj2+0x28bdc (non-zero: a second human car runs through the same routines, obj1+0x225e3 to +0x226cf; which is split screen and which is the shootout was not established here), obj2+0x1ec74, obj2+0x1edb0 (self-driving throttle 0x36 and forced accelerate), obj2+0x28bb2 (race type 1 to 4), obj2+0x28c38 (set at the start of a normal race, 1 during the countdown, cleared at obj1+0x166ba, which was not read), obj2+0x28ca8, obj2+0x28be0, obj2+0x28c60.
* Which compass picture of a slot is "behind view": the player's straight picture is entry 4, while `racer.frames` gives frame (6 - r + c) mod 8, which is 6 for a racer with the camera's heading. How entries 4 and 6 relate was not examined (no picture was looked at).
* The sprite members of the special surface (the SDX records' pointers +0x126 and +0x12a), their sizes (the body picture frames are 0x300 bytes, the overlay frames 0x428), the size record at obj2+0xe560, and the files named by the SDX fields +0xf8 and +0xfc. The exact words of the tables at obj2+0x10660 and obj2+0xe728 are not interpreted here (section 15; `docs/leads/effects.md` 2.3 has the reading).
* The exact conditions of the player bump zone logic at obj1+0x12d55 to +0x12f2d (the part that animates the *other* racer's blink) and the meaning of racer words +0x28 to +0x34 there; the racer loop that calls the stun timeout obj1+0x189ec for the human's racer (the limits 33 and 50 are from `docs/leads/racer-states.md`).
* Why the terrain values 12 and 15 gave throttle 140 in `terrain.effects-observed` (section 9 gives a candidate, not shown).
* What obj2+0x28c3a (finish repeat counter) is used for, what obj2+0x28c9c's sound-count means for the voice beyond "played up to four times", and the exit of the finish states (they are never left by the code read).
* The skid / contact word `+0xaa` is read at obj1+0x2d11 and +0x2d5f through an address of the form `[ebx + 0x84ba]`, which is the car record word +0xaa of record 0 but may be a HUD record word of the same address (the HUD record is at obj2+0x8426 + 0x104 n, `docs/leads/hud.md`); not resolved.
* The units of the tick (`tick.rate`) are those of `docs/leads/racer-states.md`; not re-derived. All times here are in frames.
* Not run: every statement is from the disassembly. The ones also seen in observation records are marked (`car.pit-observed`, `car.lean-observed`, `car.player-frames-observed`, `car.crash-observed`, `car.boost-observed`, `car.drive-observed`, `car.steer-step-observed`, `car.finish-observed`).
