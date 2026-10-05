<!-- WF: output of a subagent's read of the disassembly on 2026-10-04; a lead, not evidence. The maintainer has not re-read it. Citations are obj1 offsets of the instructions read (analysis/ww/obj1.asm) and obj2 offsets of data (analysis/ww/obj2.bin); no `npm run cite` fingerprints were produced. Nothing here was run in the game. -->

# Computer racers: pictures, hit and crash states, contact, finish, class level, drivers (WF lead, 2026-10-04)

Everything below is **WF**: read from `analysis/ww/obj1.asm`, `obj1.bin`, `obj2.bin` and the user's `WACKY.DAT`; nothing was observed except where an existing claim is named. "(obj1+0x...)" names the instructions read; a range "+0x12d88 to +0x12ef3" means the whole stretch was read. Existing claims used as given: `racer.frames`, `racer.frame-observed`, `racer.init`, `racer.start-grid`, `ai.rules`, `ai.step-rules`, `ai.step-helpers`, `ai.speed-setup`, `ai.race-speeds`, `ai.surface-slowdown`, `ai.motion-observed`, `car.racer-hit-observed`, `item.racer-hit-observed`, `item.mine-hit-observed`, `item.mine-types-observed`, `race.idle-observed`, `race.start-observed`, `race.start-rules`, `cars.slots`, `cars.slot-records`, `tick.rate`.

## 0. Conventions

* Racer n is the 0x68-byte record at obj2+0xaa90 + 0x68 n, n = 0 .. word obj2+0x28c40 (the racer count word; see section 9). Racer 0 is the human; in a one-screen road race racers 1 to 7 are the computer racers.
* A "frame" is one pass of the race frame routine; it is counted by the dword obj2+0x1ec64, incremented once per pass (obj1+0x2114c). At the default period of `tick.rate` a frame is 12/136 s = 88.2 ms, so "33 frames" is about 2.9 s. Every duration below is in frames.
* The viewer index is the word obj2+0x28b7e (0 in a one-screen race). Words that exist once per viewer sit at +w (viewer 0) and +w+2 (viewer 1); this section only states the viewer 0 word.
* The car record is the one the dword obj2+0x1d5b0 points to (obj2+0x8410 + 0x104 n, `car.speed-model`); "car +0x7c" means the word at that offset of the human's car record.

### Racer record words (those this lead reads; offsets from the record start)

| word | use | cite |
| --- | --- | --- |
| +0x00 | lateral mode: 0 none, 3 offset subtracted, 4 offset added (ai.rules) | obj1+0x18e07 to +0x18e37 |
| +0x02 | state: 0 normal, 1 "touching the human" (set by contact, cleared every frame), 2 wreck / crash animation | obj1+0x19005 to +0x1900a; obj1+0x162c5 to +0x162cc; obj1+0x13547 to +0x1354d |
| +0x04 | AI state 0..3 (ai.step-rules) | obj1+0x18d42 |
| +0x12 | shots of this racer in flight (decremented when a shot ends; only the humans fire) | obj1+0x161a4 |
| +0x1e | cup points, `+=` the points of the finishing place after a race | obj1+0x21cf9 to +0x21d0f |
| +0x20 | finishing order number 1..8, 0 until the racer has finished | obj1+0x2efe to +0x2f15 (see 7.2); obj1+0x2e3c to +0x2e53 |
| +0x22 | lap word, +0x24 stored grid value | obj1+0x2ed7 to +0x2ee4; obj1+0x2f4a |
| +0x26 | slot word: which CARS.SP slot (0..7) the racer is drawn from and which driver voice it has | obj1+0x7273 to +0x7283; obj1+0x157f6 to +0x15800; obj1+0x12e24 to +0x12e2d |
| +0x28 (+0x2a) | blink animation phase 0..3 (section 2.3) | obj1+0x130f5; obj1+0x13183 to +0x131cf |
| +0x2c (+0x2e) | blink animation kind: 4 or 5 | obj1+0x12f02, +0x12f1f; obj1+0x13100 |
| +0x30 (+0x32) | "blink may start" flag | obj1+0x18933, +0x18953, +0x18960; obj1+0x12d88 |
| +0x34 (+0x36) | blink animation picture index 0..3 | obj1+0x12f09, +0x12f26; obj1+0x13147 |
| +0x38 (+0x3a) | compass frame word (racer.frames) | obj1+0x188e8 to +0x188ef |
| +0x3c (+0x40) | dword: frame counter when the blink reached its top | obj1+0x131a3 |
| +0x4c | dword: frame counter at the moment of a hit | obj1+0x11b32; obj1+0x11b54; obj1+0x18a9c |
| +0x50 | dword heading of a human racer (the camera heading, `[0xaae0] = [0x1d5d4]` for racer 0) | obj1+0x225d4 to +0x225d9; obj1+0x1876c to +0x187e2 |
| +0x54 | free-running counter 0..3, one step a frame | obj1+0x162d2 to +0x162df |
| +0x56 | crash picture index 0..3 (4 = no longer drawn) | obj1+0x13547; obj1+0x162a5; obj1+0x157bb to +0x157ca |
| +0x58 | hit state 0 none, 1 stunned (33 frames), 2 or 3 frozen by ice (50 frames) | obj1+0x189ec to +0x18a16 |
| +0x5a | picture index while stunned (section 2.4) | obj1+0x11b28; obj1+0x162b2 to +0x162bd; obj1+0x15809 to +0x15817 |
| +0x5c | only ever cleared (obj1+0x11bdb, +0x18acf) and tested (obj1+0x12daa, +0x1894c); no writer of a non-zero value found | (search of `+0x5c]` operands, obj1, 2026-10-04) |
| +0x5e | dword route pointer; +0x10 points left; +0x14 lateral offset; +0x16/+0x18 x/y; +0x1a compass; +0x1c route entry | ai.rules, obj1+0x18eff to +0x18f84 |
| +0x62 | counter, raised once each time +0x54 wraps while it is not 0; no reader for a computer racer found | obj1+0x162e5 to +0x162ec |
| +0x64/+0x66 | duck-shoot hit points and a flicker flag | obj1+0xbf36; obj1+0x11ad9 to +0x11ae7; obj1+0x154f5 to +0x15510 |

## 1. Per-frame order of the racer code

Read from the call sites; the order inside one frame is the order of the calls.

1. Draw group (obj1+0x208b3 to +0x208f2): the compass frame routine `obj1+0x187ec`; the racer draw routine `obj1+0x155d4` (builds the draw records); `obj1+0x15a78` (not read); the player's car `obj1+0x16a3c`; the starter `obj1+0x166a8` when the starter word obj2+0x28c38 is not 0; the shots' draw `obj1+0x1632c`; the sort and blit `obj1+0x153d8`, which runs the object pass `obj1+0x12bf4` on the sorted list (call at obj1+0x15486) before drawing; `obj1+0x18668` (not read); the HUD `obj1+0x1a92c`; and last the animation counters `obj1+0x161fc` (call at obj1+0x208f2).
2. Logic group (obj1+0x22593 to +0x227a5): the human's input `obj1+0x1d6d0`, the car step `obj1+0x190a0`, the fire routine `obj1+0x14364`; then, only when the race mode word obj2+0x28c44 is 2, the computer racers' step `obj1+0x18cac` (call at obj1+0x2278d, and at obj1+0x2277c in the two-player path); then the progress / lap / ranking routine `obj1+0x2b44` (call at obj1+0x2279b; skipped when obj2+0x1ec74 is not 0); then the shots `obj1+0x1602c` (call at obj1+0x227a0); then `jmp obj1+0x21021`, the loop head.
3. The computer racers' step is never gated by the finish flag obj2+0x28c3c (the flag is only used inside the loop to skip the contact test and the child-mode slowdown, 5.2 and 8.3). The writes of the mode word obj2+0x28c44 are obj1+0x166e5 (2, the starter), +0x20172 (2, no countdown), +0x2015e (0, race load with a countdown), +0x20e7a (1, countdown) and +0x20884 (0, the branch with obj2+0x28ca8 not 0); no write of a value other than 2 was found on the finish path (obj1+0x21609 to +0x21d1e). So the computer racers keep running after the human has finished.

## 2. Pictures of a computer racer

### 2.1 Which picture the draw routine picks (obj1+0x155d4)

The draw routine loops over racers 0 .. count, skipping the viewer (obj1+0x155f8 to +0x1560f), clips by the box words, the cone test and the distance range 0x50 to 0x462 (obj1+0x15664 to +0x1576c), and takes the size class `(distance - 0x7c) / 0x46`, 0 when negative, at most 9 (obj1+0x15772 to +0x15795). The pointer of the picture it queues (draw record +0xc) is chosen in this order (obj1+0x157b4 to +0x1581e):

1. racer word +2 equal 2: the dword at obj2+0x1c7f0 + 4 x (word +0x56); when +0x56 is above 3 the racer is not drawn at all (obj1+0x157bb to +0x157c0).
2. else word +0x58 equal 1 (stunned): the dword at obj2+0x13c08 + 0x98 x (slot word +0x26) + 4 x (word +0x5a) (obj1+0x157d3 to +0x157df, +0x15809 to +0x15817).
3. else (+0x58 is 0, 2 or 3): the dword at the same slot record + 4 x (compass frame word +0x38) (obj1+0x157e1 to +0x15807).
4. In the two-player and shootout modes a human racer with the car word +0x44 not 0 and +0x7e equal 0 is drawn from the car record instead (obj1+0x15823 to +0x1587d); not a computer racer's path.

The draw record also stores the racer's word +2 at its +0x1c and the racer index at +0x18 (obj1+0x159e6 to +0x159ea), which the object pass reads (2.3, 5.4).

### 2.2 Compass frame and the "blink" flag (obj1+0x187ec)

* The compass frame is `racer.frames`: frame word = word at obj2+0x106a0 + 16 x (camera sector) + 2 x (compass word +0x1a), i.e. (6 - sector + compass) mod 8 (obj1+0x188c7 to +0x188ef). For the human racers (two-player, shootout) the compass word is first rebuilt from the racer's heading dword +0x50 by `obj1+0x1876c`: sector = the heading / 0xf0 rounded as for the camera, then the word at obj2+0x1d328 + 2 x sector (obj1+0x1876c to +0x187e2, called at obj1+0x188bc).
* In the same loop (only when the word +0x28 is 0, obj1+0x188f3): in a normal race the flag word +0x30 is set to 1 when the frame word is 4 and word +0x5c is 0, else cleared (obj1+0x1893c to +0x18960). So the flag means "this racer is seen exactly from behind".
* Duck shoot (dword obj2+0x1ec74 not 0): for racers 1.. the flag is set instead when the frame word is 0, 2, 4 or 6 (obj1+0x188fe to +0x1893a).

### 2.3 The "revving" / idle pictures (frames 8 to 11 of the slot): where they come from

This is the object pass `obj1+0x12bf4` (called from the sort routine, once a frame), in the stretch for draw records of the type word +0x24 above 0 (a racer; obj1+0x12d55). It does not touch the frame word +0x38 (which is why `race.idle-observed` saw +0x38 stay 4); it only replaces the frame pointer of the draw record (record +0xc).

**Zones.** Before the loop the pass finds the player's own record (type 0) and takes its bottom row (top + height - 1) and its centre column (left + width/2 - 1) (obj1+0x12c34 to +0x12c68). For every record it then sets (obj1+0x12ccb to +0x12d4a):

* word +0x1e: 2 when the record's bottom row is below the player's (nearer than the player's car row), 3 when equal, 1 when above (farther);
* word +0x20: 3 when the record's centre column is within 4 of the player's centre column, 5 when it is more than 4 to the right of it, 4 otherwise (left of it).

**Trigger** (obj1+0x12d88 to +0x12ef3). The blink starts for a racer when all hold: the flag +0x30 is not 0; the record's size class (word +0x1a) is at most 2; word +0x58 is 0; word +0x5c is 0; the human car's word +0x7e is 0 (not wrecked); racer word +2 is not 2; zone +0x1e is 3 or 1. Then:

* only when the race mode word obj2+0x28c44 is 2 (obj1+0x12df1): the racer's driver voice is played, sound number = the racer's slot word +0x26 (0..7), unless that sound is already playing (is-playing `obj1+0x1bbc`, play `obj1+0x1c04`; obj1+0x12e32 to +0x12eb0). When that sound's play counter (dword at obj2+0x1a9dc + 0x18 x slot) is 4 or more, the extra voice routines `obj1+0xc50` / `obj1+0xc90` decide first (obj1+0x12e56 to +0x12eae; not read);
* the flag +0x30 is cleared and, when obj2+0x1ec74 is 0, the phase +0x28 is set to 1 (obj1+0x12ed4 to +0x12ee3);
* if zone +0x20 is 4: kind +0x2c = 5 and picture index +0x34 = 2; otherwise (zone 3 or 5): +0x2c = 4 and +0x34 = 0 (obj1+0x12eee to +0x12f26).

**Animation** (obj1+0x13100 to +0x131d0), every pass while the phase +0x28 is not 0. The kind gives the first index s and the last index e: kind 4 is s = 0, e = 1; kind 5 is s = 2, e = 3 (obj1+0x13100 to +0x13121). The record's frame pointer is set to the slot record's dword at obj2+0x13c28 + 0x98 x slot + 4 x (+0x34), that is frame 8 + (+0x34) of the slot, before the phase moves (obj1+0x13129 to +0x13160). Then the phase moves:

* phase 1: +0x34 goes up by 1; when it equals e the phase becomes 2 and the dword at +0x3c takes the frame counter (obj1+0x13183 to +0x131a6);
* phase 2: when the frame counter less the dword at +0x3c is 3 or more, phase 3 (obj1+0x131a8 to +0x131be);
* phase 3: +0x34 goes down by 1; when it is below s, phase 0 (obj1+0x131c0 to +0x131cf).

While the phase is 0 nothing is replaced, and the flag +0x30 (set again at the start of the next frame, 2.2) starts the cycle again as long as the trigger holds.

**Result.** Per cycle the picture indices are s, e, e, e, e, s (6 frames), then the next cycle begins at once: frames 8, 9, 9, 9, 9, 8 (kind 4) or 10, 11, 11, 11, 11, 10 (kind 5), with a = 0 on two consecutive frames and 1 on four, period 6. This is the rule of `race.idle-observed` ("8 + 2b + a", period 6, a = 0 when (counter + 1) mod 6 is 0 or 1) and the "10, 11, 11, 11, 11, 10" of racer 4 at the counter values 35 to 40. The b of that claim is the zone +0x20: b = 1 is zone 4 (kind 5, frames 10 and 11), the racers to the left of the player's column on the screen, which at the start are the racers whose mode word +0 is 4; zone 3 or 5 gives frames 8 and 9. (Correction from later grabs of demo races on the tracks 2 to 5: the side is not the mode word but the kind word +0x2c that the glance state of the racer holds at the start, 5 for a racer whose picture stands left of the player's car and 4 otherwise; the port derives it from the draw records of the first frame, `waitsLeft` in `src/game/blink.js`. A racer whose mode word is 4 and whose picture is right of the player's car shows 8 and 9, which the mode word alone does not give.) Start 6's first rows with racers 1 and 2 at b = 0 are not explained here (the zone words depend on the player's draw record of the same frame).

**Why it ends.** The trigger needs the size class at most 2, i.e. a distance below 0x7c + 3 x 0x46 = 334 units from the camera (obj1+0x12d94, size class of 2.1). After the first racing frame the racers leave that range (the words +0xc of ai.speed-setup give 25, 35, ... 85 route points a frame in state 0); the cycle that is running finishes (at most 5 more frames), and no new cycle starts. In start-4 and start-5 the observed phase is that of cycles that start at the counter values 0, 6, 12, ... (a = 0 where (counter + 1) mod 6 is 0 or 1), which is what a cycle that began at the first frame of the race and repeats every sixth frame gives; in start-6 some racers are a step off, which fits cycles that began on another frame. With cycles starting at multiples of 6 the idle ends at the first multiple of 6 at which the racer is out of range. A rough check (not a simulation: grid x values of `racer.start-grid`, route points taken as 0.98 units, lateral decay ignored, camera at (1216, 1476)): racers 3 to 7 are in range until the counters 36 to 38, the last cycle starts at 36 and the idle ends after 41; racer 2 (in range until about 40) the same; racer 1 (25 points a frame) stays in range until about 42, so a cycle starts at 42 and the idle lasts until 47. That is what `race.idle-observed` reports (normal frame 4 at 42, racer 1 idle to 47). The racers' own state words +0x28, +0x2a, +0x30, +0x32 are cleared by the race start (obj1+0x7148 to +0x7168).

The player's own idle pictures (CARS.SP frames 92 and 93) are not made here: the player's draw record has the type 0 and does not enter this stretch; they come from the car record's state machine (obj1+0x16a3c, pointer tables at obj2+0x1b2d8 to +0x1b518), which was not read.

### 2.4 The stun picture (+0x58 equal 1)

Every frame, in `obj1+0x161fc`, for a racer whose word +2 is not 2 and whose +0x58 is 1: word +0x5a goes up by 1 and is set to 0 when it passes 7 (obj1+0x162ab to +0x162bd). It starts at the frame word the racer had when it was hit (obj1+0x11b1d to +0x11b28). The draw routine shows slot frame +0x5a (2.1, item 2), so a stunned racer spins through the 8 compass frames of its slot, one every frame, for 33 frames (about 4 turns). The frozen-by-ice states 2 and 3 use the normal picture (2.1, item 3).

### 2.5 The crash animation (+2 equal 2)

* The four pictures are the dwords obj2+0x1c7f0, +0x1c7f4, +0x1c7f8, +0x1c7fc, written by the GENEF.SP cut code as the pieces of 0x428 bytes (38 x 28) that follow the three starter frames: GENEF.SP offsets 7641, 8705, 9769 and 10833 (obj1+0x408c to +0x40aa; the base is the buffer dword obj2+0x1eb50, loaded with the name obj2+0x318 "GENEF.SP", size 0x3964 = 14692, obj1+0x3bd0 to +0x3bef; the pieces are cut in sequence from obj1+0x4014). The starter frames at 4449, 5513, 6577 are `race.start-observed`'s. The four pictures have 872, 841, 770 and 411 non-zero pixels in the user's archive (a cloud that thins out; checked by a byte count of those ranges).
* Word +0x56 goes up by 1 a frame while +2 is 2 and +0x56 is not above 3, but only when obj2+0x28be2 and obj2+0x28bdc are both 0 (obj1+0x16288 to +0x162a9); in the two-player and shootout modes it stays at 0 for the computer racers. At +0x56 above 3 the racer is no longer drawn (obj1+0x157bb to +0x157c0). So a crashed racer shows 4 pictures of 1 frame each and then vanishes.
* The racer does not stop: in a normal race the step loop skips a racer with +2 equal 2 only when obj2+0x1ec74 is not 0 (obj1+0x18cf1 to +0x18d08). A crashed computer racer therefore keeps walking its route invisibly and keeps counting laps (section 7). Word +2 is only left at 2 by the code at obj1+0x162c5 (it clears every other value to 0 each frame); the contact code of the step loop writes 1 over it (obj1+0x1900a), which would end the crash if the invisible racer came within 0xe of the human (read, not observed).
* How a computer racer gets +2 equal 2 in a normal race: only the head-on contact of 5.4. Other writers: the duck-shoot code (3.5) and the human-wreck code for racers 0 and 1 (obj1+0x11be4, obj1+0x13682).

## 3. Hit and stun state machine (word +0x58)

### 3.1 What sets it (obj1+0x118a4 to +0x11dc3)

The routine at obj1+0x118a4 is the shots' collision test: it is called from the shots' line walker obj1+0x12230 (calls at obj1+0x12296, +0x122f3, +0x12328; the walker from obj1+0x15fd6, inside the shot move), while the human's own walk uses obj1+0x116a0 (`car.collision-test`). After the wall (terrain 3) and the `.SPW` objects it loops over the racers (obj1+0x11964 to +0x11dd3) with the shot's point in the dwords obj2+0x1d7a4 / +0x1d7a8 and the shot record in the dword obj2+0x1d874: for a racer whose +2 is not 2 (obj1+0x11985) and whose car record's word +0xa (offset 0x841a + 0x104 n) is 0 (obj1+0x11990 to +0x119a1), the Manhattan distance between the racer's x/y and the point is below 0x12 (18) (obj1+0x119a7 to +0x119d4).

* Owner immunity: when the racer is the shot's owner (record word +0) and overlaps it, there is no hit while the shot's word +8 is not 0 or the shot type (word +2) is 0 or 5; the types 1 to 4 can hit their owner once word +8 has been cleared, which happens in a frame in which the shot does not overlap the owner (obj1+0x119d9 to +0x11a0c).
* A racer whose +2 is 2 is skipped (the shot passes through it, obj1+0x11985 to +0x1198a); a racer whose +0x58 is not 0 absorbs the shot with no effect (result 3, obj1+0x11a15 to +0x11a1f and +0x11db6).
* The shot's x/y are overwritten with the racer's (obj1+0x11a30 to +0x11a42).
* A "computer racer" for this test is racer index above 1 in the two-player / shootout words, otherwise any index but 0 (obj1+0x11a4b to +0x11a75). In the shootout word obj2+0x28be2 or the duck shoot, type 5 is treated as type 0 (obj1+0x11a7f to +0x11a98).
* Types 0 to 4 (hedgehog, fireball, devils, bomb, oil, inverted hog; the six sprite kinds of `item.shots-observed`): sound `0x11` (not in the duck shoot), +0x58 = 1, +0x5a = the viewer's frame word, +0x4c = the frame counter (obj1+0x11aee to +0x11b35). `item.mine-hit-observed`, `item.mine-types-observed` and `item.racer-hit-observed` observed the 33 frames and that the types cannot be told apart by their effect on a racer.
* Type 5 (ice): +0x58 = 2, +0x4c = the frame counter, sound `0x19` when it is not already playing (obj1+0x11b43 to +0x11b86; also obj1+0x11c7a to +0x11cbd, the same code for a human).
* A computer racer can therefore only be stunned by the human's shots and mines, never by another computer racer (no computer racer fires, 3.6). The human's own body walking into a racer does not stun it (that is the contact of 5.3).

### 3.2 The state while stunned (obj1+0x189ec, called from the step loop instead of the step)

The step loop calls this routine for any racer whose +0x58 is not 0, before anything else (obj1+0x18ce0 to +0x18ce7), so a stunned racer does not walk, its counters +6 and +0xe and its state +4 stand still, and it does not test contact with the human (the contact test is inside the walk, section 5.2).

* Limit: 0x21 (33) frames when +0x58 is 1, else 0x32 (50); 4 when obj2+0x1ec74 is not 0 (obj1+0x189ec to +0x18a16).
* Ice (limit 0x32): if the sound `0x19` (state 2) or `0x18` (state 3) is not playing, +0x58 switches between 2 and 3 and the sound of the new state is played when it is not playing (obj1+0x18a1f to +0x18a8c). The 2/3 switches of `item.racer-hit-observed` (ticks 49, 55, 68, 74) are driven by these sounds ending; the two states look the same and move the same (both skip the step, both use the normal picture).
* Recovery: when `obj2+0x1ec64 - (dword +0x4c)` reaches the limit, +0x58 is set to 0 (obj1+0x18a91 to +0x18aa5). Nothing else is reset, so the racer resumes in the state and with the counters it had (a racer stunned in state 3 resumes in state 3).
* Pictures: 2.4 and 2.1.

### 3.3 Sounds (numbers only)

The sound numbers are the order of the name list at obj1+0x10 + 0xc k, which is also the order of the VOC members of WACKY.DAT (UNO.VOC, SULTAN.VOC, ..., checked against the archive directory): 0 to 7 the eight driver voices (UNO, SULTAN, MORRIS, PEGGLES, RAZER, RINGO, BLOMBO, TIGI), 8 PASS, 9 BELL, 0xa START, 0xb GLASS, 0xc WARP, 0xd BOOM, 0xe HORN, 0xf SPLASH, 0x10 PLIP, 0x11 SKID, 0x12 PUF, 0x13 FLAME, 0x14 HOG, 0x15 CLANG, 0x16 SWIPE, 0x17 DROP, 0x18 BACKFIRE, 0x19 STALL1, 0x1a NO (obj1+0x10 to +0x14b read from obj1.bin; the loader's loop that walks the list was not read, the correspondence is by order and by the numbers the code uses: START is played as 10 by the starter, `race.start-rules`). In the bank sound modes the records 0 to 7 alias record 20 (`audio.alias`), so the driver voices exist only with the digital sound mode.

### 3.4 Not hit-able states

A racer is not hit while +0x58 is not 0, while +2 is 2, or while the car record's word +0xa (obj2+0x8410 + 0x104 n + 0xa) is not 0. For a computer racer that word stays 0: the "current car" pointers obj2+0x1d5b0 / +0x1d5bc / +0x1d5c0 are only ever set to the two human records (obj1+0x1fe64 to +0x1fe8c, obj1+0x11cf8, obj1+0x22763), and the writers of +0xa work on the current car (not read exhaustively).

### 3.5 Duck shoot differences (dword obj2+0x1ec74 not 0)

Stun limit 4; at its end the racer gets +0x56 = 0, +0x58 = 0, +0x5c = 0, +2 = 2 (the crash animation), the sound `0xd`, and the score dword obj2+0x1edb4 goes up by 2 when the racer's slot equals the dword obj2+0x1ec6c, else by 1, capped at 0x63 (obj1+0x18aab to +0x18b09). Racers whose slot equals obj2+0x1ec6c have +0x64 = 1 and take one absorbed hit before the effect (obj1+0x11ac5 to +0x11aee, obj1+0xbf36). When racers 1 .. count are all in the crash state with +0x56 equal 4, the count goes up by 2 (at most 0x12), the round dword obj2+0x1eca4 by 1 and the racers are placed again (obj1+0x6eac to +0x6f12). Not further read.

### 3.6 Negative: computer racers never fire

The shot spawner `obj1+0x1d548` is called only from the fire routine `obj1+0x14364` (nine call sites, obj1+0x14550 to +0x147a1), and the fire routine only from the two human frame paths (obj1+0x225de, obj1+0x22718). Technique: all `call` and `jmp` operands to these addresses in obj1.asm, 2026-10-04; indirect transfers are not excluded.

### 3.7 Effect on a human (for completeness; not a computer racer)

Types 0 to 3: the spin-out (sound `0x11`, car +0x1a = 7, +0x3c = 0, +0x20 = 1, +0x18 = 1, +0x1e = 0, +0x32 = the frame counter; obj1+0x11cbe to +0x11d78). Type 4: car +0x14 = 1 and +0x8a = the frame counter (obj1+0x11d86 to +0x11db0). In the shootout word, types 0 to 2 wreck the human outright (sound `0xd`, +2 = 2, car +0x7e = 1; obj1+0x11bc0 to +0x11c65). A human already wrecked (car +0x7e) is not hit (obj1+0x11b87 to +0x11b9a).

## 4. The pass-by glance of the player (the object pass, not a racer state)

For every racer record in zone +0x1e equal 3 or 2 (the same row as the player's car or nearer than it), when the car's word +0 is 0 and +0x44 is 0 (obj1+0x12f2d to +0x12f5e): in race mode 2 the sound `8` (PASS) is played unless it is already playing (obj1+0x12faa to +0x12fd1; in the duck shoot the same test first, obj1+0x12f6c to +0x12fa5); a second branch on the play counter of that sound (dword obj2+0x1aa9c above 4, obj1+0x12fd6 to +0x13044) goes through the voice routines `obj1+0xc50`, `obj1+0xc90` with the human's slot word and was not read. Then, when the car's word +0xa is 0 (obj1+0x1305a): car +0x32 = the frame counter, car +0 = 1, and the car's picture state +0x18 / frame word +0x1a become 6 / 1 when the zone +0x20 is 3 or 4, else 7 / 3, with the car's draw record's frame pointer replaced (obj1+0x13065 to +0x130de). The car's word +0 is cleared at the race load (obj1+0x20df7). The pictures of the states 6 and 7 and what ends them were not read. This is the player's reaction to a racer that is level with or ahead in the draw order of its car; it does not depend on a contact.

## 5. Contact

### 5.1 Between computer racers: the "push" (known; exact conditions)

In the step loop (obj1+0x18e3c to +0x18eb4): when the racer's mode word +0 is 0, its state +4 is 2 and obj2+0x1ec74 is 0, the racer's current x/y are compared with the current x/y of racers 7 down to 1 (not racer 0, not itself): the first with a Manhattan distance below 0x14 (20) adds 0x3c (60) to the number of route points N of this frame. Nothing else happens to either racer: no bump, no slowdown, no stop. Both racers of a close pair evaluate it, each against the other's current position.

### 5.2 Racer touches the human, inside the walk (obj1+0x18fa9 to +0x19024)

After every route point of the walk (the check is inside the loop of the N points), for the human racer 0 (and racer 1 too when obj2+0x28bdc or obj2+0x28be2 is not 0): when the human's car word +0xa is 0 and +0x7e is 0 and the finish flag obj2+0x28c3c is 0, and the Manhattan distance of the computer racer's x/y from the human's x/y (obj2+0xaaa6/+0xaaa8, which hold the car point 0x7c ahead of the camera, obj1+0x225c2 to +0x225d4) is below 0xe (14): the racer's word +2 is set to 1 and the human's car +0x7c to 1 (obj1+0x19005 to +0x19010). The racer's own motion is not changed by this.

### 5.3 Human touches a racer, inside the human's walk

`car.collision-test`: a racer with +2 not 2 within 14 of the walk point sets the collision word 3, car +0x7c = 1 and the racer's +2 = 1 (obj1+0x11866 to +0x1188b). The racer is not moved.

### 5.4 The response, in the object pass and the contact routine

Word +2 is copied to the draw record's +0x1c (2.1). Car +0x7c is cleared at the end of the animation routine each frame (obj1+0x162fe to +0x16307: the two flags obj2+0x848c and +0x8590). In the object pass, for a draw record with +0x1c not 0 while car +0x7c is not 0 (obj1+0x131d5 to +0x131f6) and the type word +0x24 above 0 (a racer; obj1+0x13445 to +0x13469):

* flags: obj2+0x28bf4 = 1 (contact), obj2+0x28bf6 = 1 (it is a racer) (obj1+0x13460, +0x13479);
* **head-on wreck** (obj1+0x13482 to +0x13599): when the car's throttle +0x42 is at least 0x64 and +0x7e is 0; the racer index is 0 or 1 when obj2+0x28be2 or obj2+0x28bdc is not 0; obj2+0x1ec74 and obj2+0x1edb0 are 0; the racer's compass frame word is 0, 1 or 7 (it faces the camera); the car's +0x44 and +0xa are 0: sound `0xd`; the racer gets +0x56 = 0, +2 = 2, +0x58 = 0 (the crash animation, 2.5); the car gets +0x20 = 0, +0x3c = 0, +0x18 = 0, +0x42 = 0, +0x7e = 1 (the wreck of `car.crash-observed`), and, outside the two-player, shootout and duck-shoot words, obj2+0x28c42 = 1, obj2+0x28c32 = 0 and obj2+0x28c1a from the record (obj1+0x135b5 to +0x135fb). In those modes both human cars are wrecked and racers 0 and 1 get +2 = 2 (obj1+0x13600 to +0x1369c);
* **bump** (every other contact, objects included; obj1+0x1369f to +0x13772): car +0x3c and +0x20, when not 0, are cleared with the throttle +0x42 (obj1+0x136b2 to +0x136dd); sound `0x16` for a racer (`0x15` for an object; obj1+0x136eb to +0x13701); the car's spark animation words are set: +0x4a = the dword obj2+0x1eb38 (a pointer), +0x48 = 0, +0x46 = 3 for the zones +0x20 equal 3 or 4 and 4 for 5, and the zones go to obj2+0x28bfc (= +0x1e) and obj2+0x28bfe (= +0x20) (obj1+0x13706 to +0x1376e). The spark pictures (SPARK.SP, 360 bytes, 4 frames of 90) are drawn for 4 frames at obj1+0x1559f to +0x155c7 (read, not studied);
* the contact routine `obj1+0x1d3fc` (called from the frame code at obj1+0x1f7a5 and obj1+0x1fa2c; it does nothing unless obj2+0x28bf4 is 1, obj1+0x1d3fc to +0x1d404, and clears the flag at its end, obj1+0x1d4f2) then moves the camera: the heading dword obj2+0x1d5d4 goes down by 0x12 when the zone obj2+0x28bfe is 5, else up by 0x12 (wrapping at 0x780), and the camera is moved one unit along the new heading (obj1+0x1d40a to +0x1d492, the result of `car.racer-hit-observed`: turn 18, move 1); when obj2+0x28bfc is 2 (the racer is drawn nearer than the car row, i.e. between the camera and the car, which I read as behind it) and it is a racer, the throttle goes up by 0x28 to at most 0xbe; when obj2+0x28bfc is 1 (the racer is ahead) it goes down by 0x28 to at least 0 (obj1+0x1d499 to +0x1d4f2). So a bump from behind pushes the human forward and a bump into the back of a racer slows it.

Not done to a computer racer by any of this: no slowdown, no stop, no push, no stun; the racer keeps its route.

## 6. Surfaces and terrain

* No terrain, SDX or pit lookup is made for a computer racer after the race has started. The terrain lookup `obj1+0x27b04` is called only at obj1+0x116cf and +0x118c0 (the collision test, for the human's walk and the shots), +0x13a34, +0x13aa1, +0x13efc, +0x13f69, +0x1417d (the human's probes), +0x20b14 (the human's per-frame lookup) and +0x20c36 (the race start); the step loop, the stun routine and the catch-up helper (obj1+0x18cac to +0x19062, +0x189ec to +0x18b0c, +0x18b20 to +0x18c9b) contain no call or table read of the terrain words (technique: all `call 0x27b04` operands in obj1.asm and a full read of those routines, 2026-10-04). The computer racers walk the route's points, so there is no wall, pit, boost or grass for them.
* The only surface effect is the one-time scaling at the race start (`ai.surface-slowdown`, obj1+0x20d44 to +0x20d7b): the words +8 and +0xa of racers 1 to 7 (after their replacement by VEL.TAB values, obj1+0x20d18 to +0x20d3d) are each lowered by `(v x f) >> 16` with f the dword car +0x36 of the human's car record, which obj1+0x20c70 to +0x20c80 has just set from the SDX record (0x12e bytes at obj2+0x141f8, field +0x120) of the surface the lookup at the human's start point returned (the dword obj2+0x1e568, obj1+0x20c36 to +0x20c70). The word +0xc (state 0) and the state 3 value (the table word at obj2+0x1e730 + 2 x level plus the racer's bonus, obj1+0x18bbb to +0x18bf8) are not scaled.
* The same start code also stores each computer racer's grid value in +0x24 (obj1+0x20cf2 to +0x20d11).

## 7. After the race has started: laps, finishing, place, points

### 7.1 Laps (from `ai.rules`, with the finish gate read)

The progress update of racers 1 to 7 (obj1+0x2e86 to +0x2f57) counts a lap when the grid value is 1 and the stored value is the trailer, only while the lap word +0x22 is below laps + 1 (obj1+0x2ec0 to +0x2ee4); the word then stops at laps + 1 and the racer keeps its route cursor (nothing in the step loop reads the lap word or the finish flag, 1.3). The keys are updated every frame (obj1+0x2f2a to +0x2f51), so after a racer has finished its keys keep changing with its grid value.

### 7.2 Finishing order and the banners

When a racer's lap word equals laps + 1 and its word +0x20 is 0, the counter word obj2+0x28c60 goes up by 1 and becomes the racer's +0x20 (obj1+0x2efe to +0x2f15; the same code for the human at obj1+0x2e3c to +0x2e53); for the numbers 1 to 3 the banner routine `obj1+0x2770` is called with the racer index (obj1+0x2f1c to +0x2f25). The counter is cleared at the race start (obj1+0x201db). The banner draws, unless the two-player word obj2+0x28bdc, the dword obj2+0x1d998 or class 4 (time trial) is set (obj1+0x2779 to +0x2794), the racer's slot frame 0 (the slot record's first pointer, 38 x 28, obj1+0x281c to +0x282f) at column 0x10e and row 4 + 0x1c x (place - 1) on both pages (obj1+0x283f to +0x287a), and a label with the 4-byte text at obj2+0x26c ("1ST"), +0x270 ("2ND") or +0x274 ("3RD") copied to the stack and drawn by `obj1+0x48f4` at column 0xf0 and the same row (obj1+0x27a2 to +0x2817, +0x287f to +0x288b; the strings are the bytes `1ST\0 2ND\0 3RD\0` of obj2.bin at 0x26c). That is the "1ST and a picture of the driver at the top right" of `car.finish-observed`, and it applies to every racer that finishes in the first three, not only to the human.
After the human has finished (+0x20 not 0), the human's place word (obj2+0x84bc) is no longer the live ranking but +0x20 clamped to 1..8 (1 in class 4) (obj1+0x2ae2 to +0x2b36, the tail of the ranking routine obj1+0x28a4). The live ranking itself (`ai.rules`) keeps being computed; the helper's player-place bonus (8.3) reads the car word +0xac, which is that place word, so from then on it reads the finishing order.

### 7.3 Cup points

After the human has finished (flag obj2+0x28c3c equal 1) and the counter obj2+0x28c60 has reached 3 (or the class is 4), the flag goes to 2 and a per-racer points list is built from the racers' +0x20: 1st, 2nd and 3rd place take the dwords obj2+0x1ed58, +0x1ed54, +0x1ed50, other places none; these three are set from the class word obj2+0x28bb2: class 1 gives 9, 6, 3; class 2 gives 12, 9, 6; class 3 gives 15, 12, 9 (obj1+0x217fb to +0x218a9; the three values are written at obj1+0x21781 to +0x217f9). After a delay of 0x320 ticks of the 136 Hz counter (obj1+0x21919 to +0x2192c), when the human's place +0x20 is 3 or better the points are added to the racers' words +0x1e and the cup goes on (obj1+0x2193d, obj1+0x21cf0 to +0x21d1e); otherwise the human loses a life (the car word +0x6c) and the points are added only when the race number obj2+0x28b88 is 5 or the dword obj2+0x1ec80 is not 0 and the lives are used up (obj1+0x2194b to +0x21989; the lives are 3 at the race load, obj1+0x1fe86). The racers' +0x1e words are cleared at the start of a cup (obj1+0xe545 to +0xe55a for racers 0 to 3, the rest alongside). The standings screen and what follows were not read in full.

### 7.4 What the computer racers do after finishing

Nothing different: they continue to walk the route with the same N, state and push rules, are drawn, can be hit and stunned, and their lap words stay at laps + 1 (7.1). The step loop skips the contact test once the finish flag is not 0 (obj1+0x18fc4 to +0x18fcc), so a computer racer no longer bumps the human. The only inputs that change for them are the ones that read the human's words: the human's place word (7.2) and the human's keys, which keep following the human's grid value. The race ends only when the frame loop is left from the post-finish screens (obj1+0x21813 to +0x21d1e and on, not read in full).

## 8. Level and catch-up by class

### 8.1 The class word obj2+0x28bb2 and the engine word obj2+0x1ee5a

The class word is the result of the class menu: 1 AMATEUR, 2 PRO, 3 CHAMPION, 4 TIME TRIAL (the menu strings obj2+0x96c, +0x980, +0x994, +0x9a8; `lap.rules`: 4 is the time trial) (obj1+0x9f7e to +0x9f8c). The fifth menu item (the child mode, text obj2+0xa60 to +0xaf0 "THE CHILD ONLY HAS TO STEER ... THE COMPUTER FIXES THE SPEED") sets the class to 1 and the dword obj2+0x1edb0 to 1 (obj1+0xa054 to +0xa05d); obj1+0x9eb8 clears obj2+0x1edb0 on every other path. The engine word obj2+0x1ee5a is 1 (12 horsepower, VEL.TAB) or 2 (6 horsepower, VEL2.TAB) (`setup.race-options`; the active table is chosen at obj1+0x6d0b to +0x6d59).

### 8.2 The level word obj2+0x28b84 and the catch-up threshold obj2+0x1ece0

Every race load calls `obj1+0x9db8` (call at obj1+0x2039e, right after the racer count word obj2+0x1ecb0 is set to 7 and before racer.init, obj1+0x20394 to +0x203a3). It sets from the class word (jump table obj1+0x9da8: class 1 to obj1+0x9e02, class 2 to +0x9e37, class 3 to +0x9e6f, class 4 to +0x9dde; any other value leaves both words as they were, obj1+0x9dc8 to +0x9dcd):

| class | obj2+0x1ece0 | level, engine 1 | level, engine 2 | cite |
| --- | --- | --- | --- | --- |
| 1 AMATEUR | 8 | 0x59 = 89 | 0x5a = 90 | obj1+0x9e02 to +0x9e2c |
| 2 PRO | 4 | 0x5e = 94 | 0x5c = 92 | obj1+0x9e37 to +0x9e64 |
| 3 CHAMPION | 1 | 0x63 = 99 | 0x5e = 94 | obj1+0x9e6f to +0x9e9e |
| 4 TIME TRIAL | 0x14 = 20 | 0x54 = 84 | 0x54 = 84 | obj1+0x9dde to +0x9df7 |

(The level is `0x59 + (engine != 1)` in class 1; 0x5e or 0x5c in class 2; 0x63 or 0x5e in class 3.) The same routine copies the class name text into obj2+0xaa40 (obj2+0x94c, +0x958, +0x960 for the classes 1 to 3; one byte from obj2+0xac for class 4). The 89 of `ai.rules` and `ai.speed-setup` is class 1 with engine 1 (the attract demo also stores 0x59 at obj1+0xe501 and class 1 at obj1+0xe532); racer.init builds the words +8, +0xa and +0xc from it at obj1+0x72f4 to +0x73b6.

### 8.3 What the level and threshold do

With L the level (the words of `ai.speed-setup` and `ai.race-speeds`; v and v2 are VEL.TAB and VEL2.TAB read from the user's archive, 200 words each): racer n (1..7) moves, in route points a frame, N = L - 4 - 10 (7 - n) in state 0 (24 frames, raw index, not a table value), v[L + 60 - 10 (7 - n)] in state 1 (for 28, 30, 34, 40, 50, 58, 60 frames for n = 1..7, the counters of `ai.speed-setup`), v[L] in state 2 (all racers), always lowered in states 1 and 2 by the start surface fraction of section 6; plus the push (+60), the human-place bonus and state 3 below.

| engine, class | L | state 0 N for n=1..7 | state 1 N for n=1..7 | state 2 N | state 3 N, racers 4..7 | t for racers 4..7 |
| --- | --- | --- | --- | --- | --- | --- |
| 1, AMATEUR | 89 | 25 35 45 55 65 75 85 | 36 40 44 48 52 56 60 | 36 | 52 64 72 76 | 11 10 9 8 |
| 1, PRO | 94 | 30 40 50 60 70 80 90 | 38 42 46 50 54 58 62 | 38 | 54 66 74 78 | 7 6 5 4 |
| 1, CHAMPION | 99 | 35 45 55 65 75 85 95 | 40 44 48 52 56 60 64 | 40 | 56 68 76 80 | 4 3 2 1 |
| 2, AMATEUR | 90 | 26 36 46 56 66 76 86 | 25 28 31 34 36 39 42 | 25 | 41 53 61 65 | 11 10 9 8 |
| 2, PRO | 92 | 28 38 48 58 68 78 88 | 26 29 32 34 37 40 43 | 26 | 42 54 62 66 | 7 6 5 4 |
| 2, CHAMPION | 94 | 30 40 50 60 70 80 90 | 27 29 32 35 38 41 43 | 27 | 43 55 63 67 | 4 3 2 1 |

The state 1 and 2 columns are before the start-surface scaling (`ai.surface-slowdown`); state 3 values are the table word v[L] plus 0x10, 0x1c, 0x24, 0x28 for the racers 4, 5, 6, 7 (jump table obj1+0x18b10, adds at obj1+0x18bd0 to +0x18bdf), unscaled. The state 0 column is the raw `+0xc` index (never replaced). The values 36, 40, ..., 60 of state 1 at class 1 / engine 1 are those of `ai.race-speeds`; the other rows are computed from the formulas and the archive's tables, not observed.

The threshold: in state 2 the helper (obj1+0x18b20; racers 4..7 only; nothing changes in the child mode obj2+0x1edb0, the shootout / two-player word obj2+0x28bdc, or the duck shoot, obj1+0x18b2d to +0x18b4f) forms d = (the human's second key obj2+0x843e) less the racer's second key (lap x trailer + grid value, obj1+0x18b64 to +0x18b70) and t = 7 - n + obj2+0x1ece0 (obj1+0x18b98 to +0x18b9f). Exact inequalities: the racer enters state 3 when `t <= d` (the branch at obj1+0x18ba5 jumps when t > d), with the counter +0xe = 0x7d00 (obj1+0x18be8 to +0x18bf4); in state 3 the step loop keeps it there while d > t and the counter is above 0 and drops it to state 2 otherwise (obj1+0x18dec to +0x18df5). The human is the leader when d is positive; so t is the number of progress steps the human must be ahead of racer n before it boosts: 11 to 8 (AMATEUR), 7 to 4 (PRO), 4 to 1 (CHAMPION), 23 to 20 (class 4), for n = 4 to 7. The human-place bonus for racers 5 to 7 (`ai.rules`) is applied only on state 2 frames, in the same helper (obj1+0x18c0b to +0x18c8e).

## 9. How many computer racers, and which driver each is

### 9.1 Counts (racer count word obj2+0x28c40, set at the race load, obj1+0x1fe96 to +0x1ff12)

7 (racers 0..7) by default; 1 when the shootout word obj2+0x28be2 is not 0; with the two-player word obj2+0x28bdc not 0: 7 when it is 2, else 1; 0 in class 4 when obj2+0x28be2 and the dword obj2+0x1d998 are 0 (time trial: only the human); 7 in the duck shoot (obj2+0x1ec74 not 0, then raised by the round code). So a one-screen road race has 7 computer racers, racers 1 to 7; the two-player race with computers (obj2+0x28bdc = 2) has racer 1 as the second human and 6 computer racers; the time trial has none. What the value 1 of obj2+0x28bdc means (a human-only race) is not established here.

### 9.2 The eight drivers

The driver index d (0..7) is both the CARS.SP slot, the driver file, the voice and the name:

| d | name (obj2 string; table copy) | driver file (name copy) | voice sound number |
| --- | --- | --- | --- |
| 0 | UNO (obj2+0x5ac; copy obj1+0x6aae to +0x6abd into obj2+0x1d228) | PANDA.SP (obj2+0x1ad8) | 0 UNO.VOC |
| 1 | SULTAN (+0x5b0 into +0x1d234) | CAMEL.SP (+0x1ae4) | 1 |
| 2 | MORRIS (+0x5b8 into +0x1d240) | MOOSE.SP (+0x1af0) | 2 |
| 3 | PEGGLES (+0x5c0 into +0x1d24c) | PELICAN.SP (+0x1afc) | 3 |
| 4 | RAZER (+0x5c8 into +0x1d258) | SHARK.SP (+0x1b08) | 4 |
| 5 | RINGO (+0x5d0 into +0x1d264) | RINGO.SP (+0x1b14) | 5 |
| 6 | BLOMBO (+0x5d8 into +0x1d270) | ELE.SP (+0x1b20) | 6 |
| 7 | TIGI (+0x5e0 into +0x1d27c) | TIGER.SP (+0x1b28) | 7 |

Cites: the names are copied into a table of 0xc-byte entries at obj2+0x1d228 by obj1+0x6aac to +0x6b13; the file names into 0xc-byte entries at obj2+0x1bba0 by obj1+0x228dd to +0x22945 (PANDA at +0x1bba0, CAMEL +0x1bbac, MOOSE +0x1bbb8, PELICAN +0x1bbc4, SHARK +0x1bbd0, RINGO +0x1bbdc, ELE +0x1bbe8, TIGER +0x1bbf4); the voices are the first eight names of the list at obj1+0x10 (3.3). That the slot k of CARS.SP is the driver k: the per-slot record initialiser obj1+0x2299f to +0x22a2f stores counts A, B at +0x90 and +0x92 of each 0x98-byte slot record, and 12 + A + B is the number of 0x428-byte frames of the driver file of the same index in the user's archive: slot 0 has A 4, B 2 = 18 (PANDA.SP 18 frames), slot 1 4, 4 = 20 (CAMEL 20), slot 2 4, 8 = 24 (MOOSE 24), slot 3 4, 8 = 24 (PELICAN 24), slot 4 2, 2 = 16 (SHARK 16), slot 5 1, 7 = 20 (RINGO 20), slot 6 2, 2 = 16 (ELE 16), slot 7 1, 4 = 17 (TIGER 17) (`cars.frames` frame counts). The slot 7 is also the one `car.player-frames-observed` saw for the human as Tigi (CARS.SP frame 88 = slot 7 frame 4 and TIGER.SP).

The human's own driver file is read by obj1+0x73f5 to +0x7441 (name at obj2+0x1bba0 + 0xc x the driver word obj2+0x28b96); only the player's driver file is loaded. The computer racers are drawn from CARS.SP only (12 frames a slot: 8 compass frames 0..7 and the four blink frames 8..11; the pointers of the record, obj1+0x2295b to +0x2298d).

### 9.3 Which driver each racer is (the slot assignment)

* The word table obj2+0x10720 (8 words) is built by the routine `obj1+0xbe3c` (calls at obj1+0xffee, skipped when the word obj2+0x28c98 is not 0, which keeps the old order on a retry, obj1+0x21a14 sets that word in the retry path; and at obj1+0x102c9 and obj1+0xe5b9, whose flows (shootout and attract, by `menus.md`) were not read). It seeds the generator with the larger of the 10 Hz timer dword obj2+0x1e71c and 8 (obj1+0xbe3f to +0xbe4e), sets all eight words to -1, sets word 0 to the human's driver word obj2+0x28b96 and, in the two-player / shootout words, word 1 to the second driver obj2+0x28c6a (obj1+0xbe53 to +0xbea1). Each further word takes a random value: the generator is the library LCG `x = x x 0x41c64e6d + 0x3039`, result `(x >> 16) & 0x7fff` (obj1+0x33088 to +0x330a5; the state sits at obj2+0x4008, obj1+0x33082), repeated until the result is in 0..7, then plus 1 mod 8, and rejected (a new draw) when that value is already in the table (obj1+0xbeae to +0xbef9). In the two-player word obj2+0x28bdc the generator is not called and the free values are taken in ascending order (obj1+0xbeae to +0xbeca). So racer n's slot is word n: a uniform random permutation of the 8 drivers with racer 0 fixed as the human's driver.
* Racer n gets `+0x26` = table word n (obj1+0x7249 to +0x7283, in racer.init's grid branch). In `race.start-observed` the slots 7, 3, 2, 1, 6, 4, 0, 5 are such a permutation with the human on 7 (Tigi). The speed of a computer racer comes from its racer index (section 8), not from its driver: racer 7 is the fastest of the seven whatever driver it is.
* The slot decides the racer's pictures (CARS.SP slot of 12 frames, obj2+0x13c08 + 0x98 x slot) and its voice (section 2.3). I found no use of a computer racer's slot word as an index into the name table obj2+0x1d228: its readers take the human drivers' words (obj2+0x28b96, +0x28c6a; obj1+0x2ff4 to +0x3064, +0x3222 to +0x3243, +0x212de to +0x212e8, +0x21355 to +0x2135f) or an index passed in by the caller (obj1+0x1b3e0, obj1+0x1bcfe; callers not traced).
* The leaderboard name BINGO: the string does not occur in obj1, obj2, WACKY.DAT or any file in `game/` (byte search 2026-10-04); RINGO is driver 5. BINGO is therefore not a driver name the game contains; where it came from is not established (possibly a name typed by the player).

### 9.4 DIGGER.SP and the two spare slots (the "two slots filled from the driver files" of `racer.frames`)

`obj1+0x227e0` is called only from the duck-shoot flow (obj1+0x10490, inside the code that sets obj2+0x1ec74 to 1 at obj1+0x10422 and back to 0 at obj1+0x10590). With p the human's driver word obj2+0x28b96 it picks A = the lowest d not equal to p and B = the lowest d equal to neither p nor A (obj1+0x227e5 to +0x22820; B is stored in obj2+0x1ec6c, A in obj2+0x1ec70), opens "DIGGER.SP" (the name obj2+0x1acc, 17024 bytes = 16 frames of 0x428) and reads 0x2140 bytes (8 frames) into the CARS.SP slot A and the next 0x2140 into the slot B (obj1+0x22822 to +0x228c3; frame pointers rewritten for both slots). So the first 8 frames of those two slots show DIGGER during the duck shoot (the targets; the first `[0x1eca4] + 1` targets, at most 0x15, take slot B, the others slot A, obj1+0xbf00 to +0xbf71), and the code at obj1+0x10513 to +0x1055c re-reads CARS.SP and re-runs the record initialiser (obj1+0x228d4) afterwards. In a normal race the slots hold CARS.SP's own frames, so no computer racer is drawn from DIGGER.SP. (DIGGER.SP is the ninth driver file of `cars.frames`; its name string is not in the driver name table.)

## 10. What the port lacks (checklist, no code)

* The compass flag and the blink / revving pictures and the driver voice (2.3), including the trigger zones.
* The stun spin (2.4), the ice states and their durations (3.2), the hit test on racers by shots and mines (3.1).
* The crash animation, its four GENEF.SP pictures, the invisible walk afterwards and the head-on trigger (2.5, 5.4).
* The player's response to contact (5.4), the PASS glance (4) and the AI's contact flags (5.2).
* The finishing order, the top-three banners and the cup points (7).
* The class and engine levels, the thresholds t, and the child mode (8).
* The random slot permutation (9.3) and the voice per slot.

## Uncertain / not read

* The player's own idle pictures at the start (CARS.SP frames 92 and 93): car-record machinery at obj1+0x16a3c and the pointer tables obj2+0x1b2d8 to +0x1b518 (run-time filled) was only skimmed.
* The voice limiter (obj1+0xc50, +0xc90; the dwords obj2+0x1ecf8, +0x1b0f8 to +0x1b104 and the play counters at obj2+0x1a9dc + 0x18 k) and the condition under which the driver voice is repeated; only the unconditional first play was read.
* The podium routine `obj1+0x1d264`, the cup standings screens, and the retry / exit code after obj1+0x21989.
* The routines at obj1+0x15a78 and obj1+0x18668 (called in the draw group): not read; if they draw anything per racer (a shadow, a number) it is not in this lead.
* The shots' line walker obj1+0x12230 and shot move obj1+0x15e6c were not read (only the collision test obj1+0x118a4 they call).
* The car-side consumers of +0x46, +0x48, +0x4a (spark animation) beyond the address range obj1+0x1559f to +0x155c7, and the car states 6 and 7 of the glance.
* The values 1 and 2 of obj2+0x28bdc, the dword obj2+0x1d998, obj2+0x1ecd0, and obj2+0x28bf4's other readers.
* The loader loop that walks the sound name list at obj1+0x10 (the order is inferred from the VOC member order and the sound numbers the code uses).
* Whether the idle end times of 2.3 hold in a real simulation: only a hand estimate was made (distances from the grid x values and the +0xc speeds); the cycle phase rule (cycles start at multiples of 6 counter values) fits the three records but was not simulated through the port's racers.
* Racer words +0x54 (0..3 counter), +0x62 and +0x5c: no reader or non-zero writer was found for a computer racer (searched `+0x54]`, `+0x62]`, `+0x5c]` operands and the absolute forms 0xaae4, 0xaaf2, 0xaaec in obj1, 2026-10-04); the only reader of +0x54 and +0x62 is the human car's wheel drawing at obj1+0x15042 to +0x15086 (for the viewer's own record).
* BINGO (9.3): absent from every file searched; origin unknown.
* The helper and state 3, the push, and the contact with the human were not observed running (`ai.motion-observed` lists them as not observed); the quantities in section 8's table other than class 1 / engine 1 are computed, not observed.
* A crashed racer that is later touched by the human flips +2 from 2 to 1 (obj1+0x1900a): read from the code, never seen; whether it reappears in the game is not known.
