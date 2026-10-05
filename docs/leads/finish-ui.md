<!-- WF: output of a subagent's read of analysis/ww/obj1.asm, obj1.bin, obj2.bin and fixups.json on 2026-10-04; a lead, not evidence. The maintainer has not re-read it. Nothing was executed or observed; the sprites were identified by decoding archive members offline (column-major frames, palette of BACK1.PCX) and looking at them. Citations are `(obj1+0x...)` instruction offsets of analysis/ww/obj1.asm and `(obj2+0x...)` data offsets; none was produced by `npm run cite`, so none carries a fingerprint. -->

# What happens after the player finishes a race (read from the disassembly)

Scope: single player, cup races (classes 1 to 3), with short notes on time trial. Everything is the part of the race routine `obj1+0x1fd8c` (ends at `obj1+0x227b3`) after the lap rule of `lap.rules` has set the finish flag `obj2+0x28c3c`, plus the screens it calls. Tags: everything below is **STATIC** (read, not run) unless it says otherwise. Overlapping sibling leads, which agree with this one where they overlap: `docs/leads/player-anim.md` section 14 (the poses), `docs/leads/prerace-screens.md` sections 7 and 9 (cup loop, loading card, leaderboard, rostrum, name entry), `docs/leads/race-sound.md`.

## 0. Method warning: immediates in `obj1.asm` can point into obj1

`analysis/ww/obj1.asm` prints the pre-fixup immediate. Almost every pointer is an obj2 offset, but 1087 fixups in `analysis/ww/fixups.json` have `targetObject = 1`, so a constant such as `mov esi,0x184` can be an **obj1** offset. Found while reading this: `mov esi,0x184` at obj1+0xd71a (class titles, obj1+0x184), `mov esi,0x1fc` at obj1+0x2361b (song names, obj1+0x1fc), `mov esi,0x154` at obj1+0xc9aa (month names, obj1+0x154) and the jump tables obj1+0x7910 and obj1+0x19068. Every other constant cited below was checked against the fixup of its instruction (target object 2). obj2 strings quoted below were read from `analysis/ww/obj2.bin`; a few have 1 to 3 stray bytes in front of them in the file (initial image), the cited start offset is the real start.

## 1. Overview of the sequence

```
frame k      lap word = laps + 1 (set by obj1+0x2b44) and the racer's place word := ++finished (obj1+0x2e3c)
frame k+1    FINISH BLOCK (obj1+0x21609): flag obj2+0x28c3c := 1, final time stored, pose chosen by the place
             every frame from then: car state word forced to 10 (places 1-3) or 13 (places 4-8), keys ignored
until 3 racers have finished (obj2+0x28c60 >= 3):  flag stays 1
the call in which that holds: STAGE 1 (obj1+0x21813): per-race points computed, message chosen (places 1-3), flag := 2,
             tick stamp obj2+0x1ea6c := obj2+0x1e720
800 ticks (0x320) later: STAGE 2 (obj1+0x21919):
   place 1-3  -> points added to the 8 racers (obj1+0x21cf0) -> leaderboard obj1+0x1bff0 -> return to the cup loop
   place 4-8  -> one of the 3 tries is lost (obj1+0x21959), lives digit/GAME OVER, menu TRY AGAIN / LEAVE RACE / SAVE AND QUIT
cup loop (obj1+0xfff3 to +0x100c5): race 1-4 -> race++ -> loading card with the SHRINK<track>.PCX preview -> next race
             race 5 (FINAL) -> leaderboard, bonus notice or rostrum, name entry for the winner, FAMOUS DRIVERS board -> cup board
```

The time base `obj2+0x1e720` is the 136 Hz counter of `race.start-rules`; 0x320 ticks are 800/136 = 5.88 s (derived). The frame counter is `obj2+0x1ec64` (+1 per loop pass, obj1+0x2114c).

## 2. The finish block, obj1+0x21609 to +0x21773

Runs once per loop pass inside the race routine, before the stage code.

```
car = [0x1d5b0]                              // the player's car record (obj2+0x8410 for player 1), obj1+0x21609
if car.+0xb2 (lap) == word[0x28b9c] (laps) + 1      // obj1+0x2160e to +0x2161f
   && [0x28c3c] == 0 && [0x28c42] == 0 && [0x28bdc] == 0:   // obj1+0x21625, +0x21633, +0x21641
    if [0x28bb2] (class) == 4:                        // time trial, obj1+0x2164f to +0x21698
        [0x1eccc] = sum of the 6 dwords obj2+0x1d358 .. +0x1d36c   // uses [0x28c3c] as loop counter 0..5
    else [0x1eccc] = [0x1e71c]                         // final time = tick word, obj1+0x21693
    word[0xaaec + 0x68*[0x28b7e]] = 0                  // racer record +0x5c, obj1+0x2169d to +0x216a7
    car.+0x44 = car.+0x24 = car.+0x22 = car.+0x3c = car.+0x20 = 0   // obj1+0x216b5 to +0x216cd
    [0x28c3c] = 1                                       // the finish flag, obj1+0x216d3
    car.+0xb4 = 0                                       // obj1+0x216dc
    [0x1ea64] = [0x1e720]                               // written, never read (grep), obj1+0x216e5
    if 1 <= word[0xaab0] <= 3:                          // racer 0's place word, obj1+0x216f1 to +0x21703
        [0x28c5c] = 0; [0x28c36] = 10; car.+0x4e = obj2+0x1b378; [0x28c9c] = 0; sound(0x11)
                                                        // obj1+0x21705 to +0x2172c
    else:
        [0x28c5a] = 0; [0x28c36] = 13; car.+0x4e = obj2+0x1b238      // obj1+0x21733 to +0x2174a
    car.+0x18 = [0x28c36]; [0x28c3a] = 0; car.+0x32 = [0x1ec64]       // obj1+0x21751 to +0x21770
```

- `[0x28c42]` is the wreck state word of the player's car (1 to 4; set at obj1+0x13422, +0x135dc, +0x16c34, +0x16c80, +0x16ce2; its pictures are frames of the driver's file: state 1 plays the file frames 4 to 11, table obj2+0x1b328, states 2 and 3 the "A" frames, table obj2+0x1b2d8, obj1+0x16bd9 to +0x16cf0; section 4.3), so a wrecked car cannot finish in that pass.
- The place word of racer 0 is already final here: it was set in the pass before (section 3). Sound number 0x11 is played by obj1+0x1c04 (`audio.load`: the 26 AUDIOT.FX records); `docs/leads/pickups.md` lists the same number as the "hit by a shot" sound, whose file mapping is a guess there, so nothing is claimed about what it sounds like.
- Time trial: the final time is the sum of the six values at obj2+0x1d358 (the lap times, as the loop sums six dwords); other classes store the tick word at that moment (`car.finish-observed`: 18).

### 2.1 Everything else the flag does (the readers of obj2+0x28c3c)

| Site | Effect while the flag is not 0 |
| --- | --- |
| obj1+0x1987e to +0x1988f | the car state word `car.+0x18` is set to `[0x28c36]` (10 or 13) in every call of the car routine (human car only, `car.+0xa == 0`) |
| obj1+0x1d7c6 | the control routine zeroes the key words (`[0x28cd3]`, `[0x28cd5]`, `[0x28cdd]`, `[0x28b40]`, `[0x28b42]`...): `car.finish-observed` |
| obj1+0x195f7 | kid mode only (`[0x1edb0] != 0`): the accelerate word `[0x28b40] := 1` is forced only while the flag is 0 |
| obj1+0x18ec4 | kid mode only (`[0x1edb0]`): the computer racers' route-advance count `[0x28c24]` (`ai.step-rules`: the number of route points to advance) is lowered by 0xc a pass (not below 4) only while the flag is 0 |
| obj1+0x18fc4 | the computer racers' proximity test to the player (distance below 0xe) is skipped |
| obj1+0x12c8c | the player's part of the object pass obj1+0x12bf4 (`atr.kind-effects`: obstacles and pickups; the loop over the 0x28 byte draw-list records at obj2+0x19a50) is skipped (jump to obj1+0x1378e) |
| obj1+0x15042 | a per-racer draw call (obj1+0x14afc) is skipped; not identified |
| obj1+0x1a993 | the HUD timer shows `[0x1eccc]` (the final time) instead of `[0x1e71c]` |
| obj1+0x1b198 | the lap banner reads FINISHED! instead of LAST LAP! (`text.banner-observed`) |
| obj1+0x2212e | the Esc pause menu is not offered (it needs the flag to be 0) |

The HUD routine obj1+0x1a92c is called from the per-frame draw routine at obj1+0x1fb6e without a gate on the flag (the stretch obj1+0x1f794 to +0x1fa2c before it holds only the two-player skip at obj1+0x1f935 and the flyover state words, nothing on the flag or on obj2+0x175d2), so by this reading the timer is still drawn after the finish with the final time (when CLOCK DISPLAY `[0x175d2]` is on or the class is 4, obj1+0x1a9a9 to +0x1a9c9). The lap banner has two gates in front of the FINISHED! test: the word `[0x84b4]` (obj2+0x84b4 + 0x104 n) must not be 0 (obj1+0x1b17a to +0x1b182; it is set to 1 only by a counted lap that leaves the lap word not above the laps word, `lap.rules`, obj1+0x2c5b, and is zeroed at every race start and restart, obj1+0x202dd), and the reaction figure word `[0x84f4]` must be 0 (obj1+0x1b22b); only then FINISHED! (flag set, lap word at least the laps word) is drawn at (4, 164). The record finish-2 restarted the race through Esc and wrote the lap word to the laps word, so its only counted lap went 6 to 7, above the laps word, `[0x84b4]` stayed 0 and no lap text was drawn at all: the missing banner after the finish in the screen frames is an effect of how that record was made, not finish behaviour. A race played from the start has `[0x84b4] = 1` from the first lap on, and shows FINISHED! after the finish (by this reading). The timer is not explained the same way (section 14).

## 3. Place assignment and the 1ST / 2ND / 3RD labels

### 3.1 Place assignment (obj1+0x2e3c and obj1+0x2efe)

- The word `obj2+0x28c60` (finished count) is zeroed at the start of a race (obj1+0x201db).
- Player (inside the per-racer update obj1+0x2b44): when the HUD lap word `[ebx+0x84c2]` equals laps + 1 and the racer's place word `[esi+0xaab0]` (racer record obj2+0xaa90 + 0x68 n, word +0x20) is 0, the count is incremented and stored in the place word (obj1+0x2e30 to +0x2e53). Computer racers (the loop obj1+0x2e86 to +0x2f6a over the racers 1..`[0x28c40]`, skipping racer 0): the same rule on their own lap word `[ebx+0xaab2]`, which counts up when the racer crosses the line forward (`[ebx+0xaab4]` = trailer, obj1+0x2ec0 to +0x2f1c) and is capped at laps + 1.
- So a racer's place is the order in which racers reach lap word laps + 1, 1-based; ties cannot occur.
- When the place is 1 to 3 the label routine obj1+0x2770 is called with the racer index (obj1+0x2e5a to +0x2e63 for the player, obj1+0x2f1c to +0x2f25 for the others). Places 4 to 8 get no label.
- The ranking routine obj1+0x28a4 (called at the end of obj1+0x2b44) writes the HUD place digit word `[0x84bc]` from the sort of the progress keys; **but** from the second half of obj1+0x28a4 on, once racer 0 has a non-zero place word it is copied (clamped to 1..8, class 4: 1) into `[0x84bc]` (obj1+0x2ae0 to +0x2b22; only index 0 in single player, obj1+0x2ada). So after the finish the place box digit is the finishing place: the LAP.SP 22 x 29 frame `[obj2+0xe6ec + 4 * place]`, at (25, 12) (obj1+0x1aec8 to +0x1af50, `hud.layout`).

### 3.2 The label routine obj1+0x2770 to +0x28a1 (eax = racer index)

Gate: not split screen (`[0x28bdc] == 0`), `[0x1d998] == 0` (normal race), class `[0x28bb2] != 4` (obj1+0x2779 to +0x279c). So there are no labels in time trial.

```
place = racer[i].+0x20 (obj2+0xaab0 + 0x68*i)
text  = dword at obj2+0x26c ("1ST") / +0x270 ("2ND") / +0x274 ("3RD")  for place 1/2/3   // the 4 bytes are the NUL-terminated string
y     = 4 + 28*(place - 1)                                                // 4, 32, 60 (obj1+0x27e9 to +0x27fd)
saved = [0x28b24]
[0x28b24] = 0 (page 0):       text(240, y, mode 0) via obj1+0x48f4            // obj1+0x280e to +0x2817
sprite = word at racer.+0x26 (obj2+0xaab6; the driver slot 0..7) * 0x98 + obj2+0x13c08   // the slot record's first dword = CARS.SP slot frame 0
blit transparent 38 x 28 (0x26 x 0x1c) at x = 0x10e = 270, y             // obj1+0x281c to +0x286c, obj1+0x26fd0
[0x28b24] = 0x3e80 (page 1): the same blit (obj1+0x2871 to +0x287a), then the text again at (240, y) (obj1+0x287f to +0x288b)
[0x28b24] = saved
```

- It draws once, on **both** display pages, at the moment the racer finishes; nothing redraws it afterwards, which fits the labels staying at the top right (the strip at the top of the screen is not repainted by the floor renderer; inferred).
- Strings: obj2+0x26c "1ST", obj2+0x270 "2ND", obj2+0x274 "3RD" (read from obj2.bin). There are no strings or pictures for 4TH to 8TH.
- Text: the 8 x 8 font (OFONT.SP glyphs through obj2+0xa778, `text.char-map`), mode 0 (plain), at x = 240, so the three letters end at x = 264; the picture follows at x = 270 (38 wide, to x = 307).
- The picture is the driver's CARS.SP slot frame 0 (38 x 28 = 0x428 bytes at slot x 0x31e0 + 0): `cars.slot-records`. Decoding the archive offline, frame 0 of every slot (8 drivers) is the animal driver with both arms raised, without the kart (frames 1 to 4 of a slot move through to the rear view of the kart with the driver; frame 4 is the plain rear view). So the "driver picture with arms raised" is slot frame 0 [visual identification, not a check].
- The driver of racer i is the word `obj2+0x10720 + 2*i` (copied into racer word +0x26 at obj1+0x7273 to +0x7283; the table is filled by the opponent routine obj1+0xbe3c).
- Rows are 28 high and 28 apart: place 1 at y 4 to 31, place 2 at 32 to 59, place 3 at 60 to 87.

## 4. The player's pose after the finish

The car state routine is obj1+0x190a0 to +0x19e0a (jump table obj1+0x19068, 14 dwords, entry = state - 1; states 11 and 12 go to the end obj1+0x19e01). It is called once a loop pass (obj1+0x225b7) after the key routine obj1+0x1d6d0. In it, when the flag is set the state is forced to `[0x28c36]` (obj1+0x1987e to +0x1988f), and the routine only proceeds when at least 1 frame has passed since `car.+0x32` (obj1+0x198a2 to +0x198aa, helper obj1+0x2490 = frame counter minus the argument), then stamps `car.+0x32` with the frame counter (obj1+0x198c6 to +0x198cc): once a pass.

### 4.1 State 10, places 1 to 3: obj1+0x19cb6 to +0x19d3c

```
if [0x28c9c] <= 3:                                   // obj1+0x19cb6 to +0x19cbe
    is_playing(sound [0x28b96])  (obj1+0x1bbc sets [0x28c62])      // [0x28b96] = the player's driver slot 0..7
    if [0x28c62] == 0: play sound [0x28b96] (obj1+0x1c04); [0x28c9c]++
[0x28c5c]++                                          // obj1+0x19ce9
if [0x28c5c] == [0x28c52]: [0x28c5c] = 5; [0x28c3a]++      // obj1+0x19cfc to +0x19d0e
car.+0x4e = obj2+0x1b378 + 4*[0x28c5c]               // obj1+0x19d15 to +0x19d30; the car routine draws *(dword*)car.+0x4e (obj1+0x16cf5 to +0x16cf8)
```

So up to four starts of the driver's own voice sound (sound number = driver slot, `docs/leads/pickups.md` section 7) while the earlier one is not playing; the pose advances once a pass and never ends (until the race routine returns).

### 4.2 State 13, places 4 to 8: obj1+0x19d3d to +0x19d8a

```
[0x28c5a]++; if [0x28c5a] == [0x28c50] (= 8, set at obj1+0x7807): [0x28c5a] = 0; [0x28c3a]++     // obj1+0x19d3d to +0x19d5c
car.+0x4e = obj2+0x1b238 + 8*[0x28c5a]                                                           // obj1+0x19d63 to +0x19d7e
```

No sound.

### 4.3 The two tables (built when the driver is loaded: obj1+0x73c4 to +0x7862, once per race load for the player, `[0x28b7e] == 0`)

| Table | Rows | Content (frames as CARS.SP slot of the driver, "car n" = slot record dword 4n; "drv n" = the driver's own .SP file frame n) | Built at |
| --- | --- | --- | --- |
| obj2+0x1b378, 4 byte rows, count `[0x28c52]` = B + 5 | 5 + B | rows 0..4 = car 4, 3, 2, 1, 0 (slot record offsets 0x10, 0xc, 8, 4, 0); rows 5 + j = drv 12 + A + j for j < B (record offsets 0x70 + 4j) | obj1+0x7603 to +0x7661 (`mov [0x28c52]` at obj1+0x75fb, `add [0x28c52],5` at obj1+0x7706) |
| obj2+0x1b238, 8 byte rows (the +4 slot is the second human), count `[0x28c50]` = 8 | 8 | car 8, 9, 8, 4, 10, 11, 10, 4 (record offsets 0x20, 0x24, 0x20, 0x10, 0x28, 0x2c, 0x28, 0x10) | obj1+0x77a6 to +0x7810 |

- Frame order in time: the finish pass puts the pointer on row 0; the first run of state 10 increments to row 1, so the pictures are row 0 (car 4, the plain rear view) at the finish, then rows 1, 2, 3, 4 = car 3, 2, 1, 0 in the next four passes (car 0 = the arms-up portrait from the fourth pass, which is `car.finish-observed`'s "from about the fourth call"), then rows 5 to B + 4 (the driver's celebration frames) repeating without end. For the wobble: row 0 (car 8) at the finish, then rows 1.. = car 9, 8, 4, 10, 11, 10, 4, then 8, 9, ... repeating.
- Per driver (A and B are the words at slot record +0x90 and +0x92, set at obj1+0x2299f to +0x22a26; the frame count of the .SP file is 12 + A + B, `cars.frames`), driver slot k: its name obj2+0x1d228 + 12k, file name obj2+0x1bba0 + 12k (copied from obj2+0x1ad8.. at obj1+0x228dd to +0x22945):

| k | name | file (frames) | A | B | celebration frames (drv 12 + A ..) |
| - | - | - | - | - | - |
| 0 | UNO | PANDA.SP (18) | 4 | 2 | 16, 17 |
| 1 | SULTAN | CAMEL.SP (20) | 4 | 4 | 16 to 19 |
| 2 | MORRIS | MOOSE.SP (24) | 4 | 8 | 16 to 23 |
| 3 | PEGGLES | PELICAN.SP (24) | 4 | 8 | 16 to 23 |
| 4 | RAZER | SHARK.SP (16) | 2 | 2 | 14, 15 |
| 5 | RINGO | RINGO.SP (20) | 1 | 7 | 13 to 19 |
| 6 | BLOMBO | ELE.SP (16) | 2 | 2 | 14, 15 |
| 7 | TIGI | TIGER.SP (17) | 1 | 4 | 13 to 16 |

  (names from obj1+0x6aac to +0x6b16 copying obj2+0x5ac.. : UNO, SULTAN, MORRIS, PEGGLES, RAZER, RINGO, BLOMBO, TIGI, matching `hi.md`; the A, B values are the stores at the cited addresses read in order for the slots 0 to 7.) Decoding the files offline: the A frames (drv 12 .. 11 + A) are the animal tumbling without a kart (the second half of the wreck animation of `[0x28c42]`, table obj2+0x1b2d8, obj1+0x16c57 to +0x16ceb; the first half uses the file frames 4 to 11, table obj2+0x1b328, built at obj1+0x7588 to +0x75a4), the B frames show the animal in the kart with arms raised or antlers/wings waving [visual].
- The slot frames 8 to 11 are CARS.SP's own (the driver loader never overwrites them, `cars.slots`); decoded they are rear views of the kart with the driver in other postures [visual].
- The finish pose is drawn by the normal player-car blit (obj1+0x16cf0 to +0x16e4d): width and height from the shape table pointed to by `[0x1d838]` (obj1+0x16d58 to +0x16d85), x centred on 0xa0 = 160, bottom row `[0xbdf8]` (obj1+0x16b14, +0x16b94). Nothing else is special about it.

## 5. Stage 1: the points, the message and flag := 2 (obj1+0x21773 to +0x218ae)

```
if [0x28c3c] == 0: skip to obj1+0x218ae                          // obj1+0x21773
switch [0x28bb2] (class):                                          // obj1+0x21781 to +0x217f1
    1: [0x1ed58]=9;  [0x1ed54]=6;  [0x1ed50]=3                    // amateur
    2: [0x1ed58]=12; [0x1ed54]=9;  [0x1ed50]=6                    // pro
    3: [0x1ed58]=15; [0x1ed54]=12; [0x1ed50]=9                    // champion
    other (4): unchanged (obj2 initial 0)
if !( word[0x28c60] >= 3 || [0x28bb2] == 4 ): skip              // obj1+0x217fb to +0x2180d
if [0x28c3c] == 2: goto stage 2 (obj1+0x21919)                  // obj1+0x21813
for i = 0..7:                                                      // obj1+0x21821 to +0x21880
    switch racer[i].place (obj2+0xaab0 + 0x68*i):
        1: pts[i] = [0x1ed58]; 2: pts[i] = [0x1ed54]; 3: pts[i] = [0x1ed50]; other: pts[i] untouched
    // pts = 8 words on the stack at [esp+0x28], zeroed at the start of the race (obj1+0x2017b to +0x201a1)
if 1 <= word[0xaab0] <= 3: call 0x1d264 (message)               // obj1+0x21882 to +0x21896
[0x1ea6c] = [0x1e720]; [0x28c3c] = 2                             // obj1+0x2189b to +0x218a9
```

- So the stage fires in the pass in which the third racer has finished, the player included (a player in 1st place therefore waits for the second computer racer to arrive: the "about 40 s" of the record is how long that took in that race, not a constant). If the player finishes 4th or later, `[0x28c60]` is already at least 3, so stage 1 runs in the finish pass itself.
- Time trial skips the wait (class 4); the points words keep their old value (0) there.
- Points are 9/6/3 (amateur), 12/9/6 (pro), 15/12/9 (champion) for places 1/2/3; every other racer gets 0. The class word: 1 amateur, 2 pro, 3 champion, 4 time trial; KID MODE sets class 1 and `[0x1edb0] = 1` (obj1+0xa054, +0xa05d).

### 5.1 The message (obj1+0x1d264 to +0x1d3f9, called at obj1+0x21896)

```
[0x28c48] = 1                                                       // "message on", obj1+0x1d268
if class == 4: text = obj2+0x17b0 "TIMES HAVE BEEN RECORDED"       // obj1+0x1d271 to +0x1d28d
else:  place = racer[[0x28b7e]].place
       place 1: text = obj2+0x3d44 + 40*(race-1)                     // race = word [0x28b88], 1..5
       place 2: text = obj2+0x3e0c + 40*(race-1)
       place 3: text = obj2+0x3ed4 + 40*(race-1)
copy the string to obj2+0xaa18
[0x28b66] = abs(320 - 8*len) / 2    (sign-corrected halving, obj1+0x1d3c9 to +0x1d3ef)
```

(obj1+0x1d292 to +0x1d3c8.) The three tables are 5 strings of 40 bytes each:

| Race of the cup | 1st place (obj2+0x3d44) | 2nd place (obj2+0x3e0c) | 3rd place (obj2+0x3ed4) |
| - | - | - | - |
| 1 | GOOD DRIVING. KEEP IT UP! | WELL DONE! | THAT WAS CLOSE! |
| 2 | EXCELLENT SKILL! | WOW! WHAT A RACE! | YOU LIVE TOO CLOSE TO THE EDGE! |
| 3 | FANTASTIC PIECE OF DRIVING! | THESE GUYS DON'T KNOW WHAT HIT THEM! | KEEP DOING WHAT YOU'RE DOING! |
| 4 | BRILLIANT. NOW COMES THE BIG ONE! | GLORY IS A SMALL STEP AWAY! | GO FOR GLORY! |
| 5 (FINAL) | YOU ARE TOO GOOD! | THE FINAL WAS BREATHTAKING! | YOU DESERVED TO WIN! |

(addresses of the n-th string: base + 40 (n - 1); the strings were read from obj2.bin). Also in the routine: obj2+0x17cc "YOU ARE TOO GOOD! TRY A REAL RACE!" and obj2+0x17f0 "YOU ARE GOOD! TRY A REAL RACE!" are selected by place 1 or 2/3 when class is 4 and the race is not 5, but the class 4 test at obj1+0x1d271 sends class 4 to "TIMES HAVE BEEN RECORDED" first, so those two are not reachable from here (obj1+0x1d2c4 to +0x1d383).

**Drawing**: no timer, no delay. The HUD routine draws it every frame while `[0x28c48] != 0`:

```
text(x = word[0x28b66], y = 0x64 = 100, string obj2+0xaa18, mode 1)    // obj1+0x1aab9 to +0x1aad9, inside obj1+0x1a92c
```

mode 1 of obj1+0x48f4 first draws a box of 8 x len + 8 by 16 at (x - 4, y - 4) in the colours 0x26 and 0x2c, then the text (`text.char-map`, obj1+0x4929 to +0x496a). For 27 characters (FANTASTIC PIECE OF DRIVING!) x = 52 and the box spans x 48 to 271, y 96 to 111. The flag `[0x28c48]` is cleared only at the next race start (obj1+0x200f2), so the message stays until the race routine restarts or returns. It appears in the pass of stage 1, i.e. when the third racer finishes (the "much later" of the record), and only for the places 1 to 3 (the only caller is obj1+0x21896).

## 6. Stage 2 (flag = 2): obj1+0x21919 to +0x21ceb

```
if [0x1e720] - [0x1ea6c] < 0x320 (800 ticks, 5.88 s): skip                     // obj1+0x21919 to +0x2192c
if [0x28b24] != 0x3e80: skip      // only on the passes that draw into page 1   // obj1+0x2192e
if word[0xaab0] <= 3: goto 0x21cf0   (points, leaderboard)                     // obj1+0x2193d to +0x21945
else (place 4..8): see section 7
```

There is no key test: the screen after the finish changes by itself 800 ticks after the stage-1 pass, whatever the player presses (the keys are ignored by the control routine anyway, section 2.1).

### 6.1 Points added and hand-over to the leaderboard, obj1+0x21cf0 to +0x21e41

```
for i = 0..7: racer[i].+0x1e (obj2+0xaaae + 0x68*i) += pts[i]                 // obj1+0x21cf0 to +0x21d1e
[0x1ed5c] = (signed word) obj2+0xaaae (the player's cumulative points)         // obj1+0x21d29, +0x21d39
copy page 0 to page 1 (obj1+0x26f14: [0x28b1c] = 0, [0x28b1a] = 0x3e80), flip (obj1+0x27de0), [0x28b24] = 0x3e80, sound reset (obj1+0x1adc)   // obj1+0x21d20 to +0x21d7a
if class == 4: goto the time trial hall of fame (obj1+0x21e42)                  // obj1+0x21d7f
if [0x1ec80] != 0: [0x28b88] = 5; [0x1ec80] = 2                                 // after the bonus race, obj1+0x21d8d to +0x21da9
[0x28c08] = (race == 5) ? 0 : 3                                                // obj1+0x21da9 to +0x21dc7
copy 0x300 bytes (the palette) from [0x1d718] to [0x1d858]; [0x1d854] = [0x1d858]       // obj1+0x21dc7 to +0x21dfb
call obj1+0x1bff0                                                              // the leaderboard, obj1+0x21e01
if [0x1ec80] == 2: [0x1ec80] = 0                                               // obj1+0x21e06 to +0x21e19
if [0x1ec80] == 0: return from the race routine (jump to obj1+0x227aa)         // obj1+0x21e19 to +0x21e20
else: [0x28b88] = 4; [0x28c08] = 3; return                                     // bonus race follows, obj1+0x21e26 to +0x21e41
```

- **Points live in the word `+0x1e` of each racer record (obj2+0xaaae + 0x68 n), n = racer index; they accumulate over the races of a cup.** They are zeroed by the cup board (obj1+0x8384 to +0x839a, `mov word [eax+0xaaae],0`), copied into the save record at the race start (section 12), and nothing else resets them.
- `[0x28c08]` is the "go on with the next race" word read by the cup loop (section 10).
- Time trial (class 4): obj1+0x21e42 to +0x21ead calls the hall of fame `obj1+0x1e4b8` (eax = cup + bonus, edx = race, ebx = 1) when not 2-player, not link, `[0x1d998] == 0`, not duck shoot; not read further.

## 7. Place 4 to 8 after the wait: lost tries, GAME OVER, menu (obj1+0x2194b to +0x21c29)

```
[0x28c08] = 0                                                                    // obj1+0x21950
car.+0x6c--                      // the "tries" word; obj2+0x847c for player 1; drawn as the digit at (118, 11); set to 3 at obj1+0x1fe7d and obj1+0x1fe86
call obj1+0x19e0c                                                                // draws the digit, GAME OVER at 0
if car.+0x6c == 0 and ([0x28b88] == 5 or [0x1ec80] != 0): goto 0x21cf0           // final race / bonus race: no game over, obj1+0x21967 to +0x21983
if car.+0x6c == 0: return from the race routine (obj1+0x21989 to +0x21993, jump 0x227aa)   // c08 = 0: the cup loop calls the cup board
menu (obj1+0x55c0): item 1 = obj2+0x1a3c " TRY TO QUALIFY " (race 5: obj2+0x1a50 " TRY AGAIN "), item 2 = obj2+0x1a14 " LEAVE RACE ",
     item 3 = obj2+0x1a28 " SAVE AND QUIT " only if class != 4, not kid mode ([0x1edb0]), not the bonus race, single player   // obj1+0x219cd to +0x21a5e
choice 1: restart the race (jump to obj1+0x2006a: same track, tries already lowered); choice 2: return (obj1+0x21ce1 to +0x21ceb); choice 3: write the save and return (obj1+0x21b10 to +0x21b73)
```

- The test uses racer 0's place word `[0xaab0]` only. `obj1+0x19e0c` (obj1+0x19e0c to +0x1a265): single player draws the tries digit (LAP.SP 10 x 9 digit frame `[obj2+0xe440 + 4 * [0x847c]]`, opaque, at (118, 11), obj1+0x19e77 to +0x19eb4) and, when the tries are 0, "GAME OVER" (obj2+0x15d8, `obj1+0x7888`: centred, y 0x60, both pages, obj1+0x1a1f7) followed by a wait of 0x1f4 = 500 ticks (3.7 s) when `[0x1ee46]` (music, as the other song code tests it) is 0, or, when it is not 0, by the `GAMEOVER` song `[0x1c650]` (section 8) played to its end before `[0x1c648]` is restored (obj1+0x1a203 to +0x1a25d).
- A wrecked car (`[0x28c42] == 4`) loses a try the same way (obj1+0x214a2 to +0x21507) without the finish.
- The split-screen finish is a separate branch (obj1+0x2150c to +0x215fa: points `9 - 2 * place frame` from the HUD place words, then obj1+0x1bff0) and is not covered here.

## 8. The leaderboard: obj1+0x1bff0 (first part) and obj1+0x1b270

Entry: obj1+0x21e01 (races 1 to 5); the routine ends at obj1+0x1d261.

1. Music: if `[0x1eaf0] != [0x1c658]` the current song handle is set to `[0x1c658]` and obj1+0x1834 starts it (the song start routine, inferred from its callers; obj1+0x1bffb to +0x1c03a). The five song handles at obj2+0x1c648 + 4 i are filled by obj1+0x2360c from the name table obj1+0x1fc (12 byte records): 0 MAINMENU, 1 LEADRBRD, 2 GAMEOVER, 3 SPACEY, 4 ASHES (obj1+0x23659 to +0x236b5, names read from obj1.bin). So `[0x1c658]` = **ASHES** plays on the leaderboard (and on the cup board, obj1+0x83c5 to +0x83ff).
2. Table: `[esp+0x334]` = `[0x28c40] + 1` = number of racers (8); `[esp+0x348]` = 3 podium places (2 when there are two racers) (obj1+0x1c03f to +0x1c062). 8 records of 8 bytes at obj2+0x199d8 + 8 n (n = 1..8, 1-based): word = racer (n - 1) points (obj2+0xaaae + 0x68 (n - 1)), word = its driver slot (`obj2+0xaab6`) (obj1+0x1c07d to +0x1c0e6).
3. Sort, descending by points: `for si = 1..[0x28c40]: for dx = si + 1..8: if points[si] < points[dx]: swap` (obj1+0x1c0f2 to +0x1c165, swap = obj1+0x26f8c). Equal points are not swapped.
4. Background: `ORDER.PCX` (obj2+0x1624, 7609 bytes: a blue checkerboard, no text) is loaded and blitted to page 0 (obj1+0x1c167 to +0x1c1b1).
5. Table drawer obj1+0x1b270 to +0x1b555 (called at obj1+0x1c1fb with page 0 current; the four arguments are the places to store the player's row x, y, slot and rank; `ret 0x10` pops 4 more for a second player):

   ```
   title = " LEADER BOARD AFTER " (obj2+0x160c) + obj2+0xaa68 + " " (obj2+0xa0)   // obj1+0x1b284 to +0x1b2ec
           // obj2+0xaa68 = "RACE n" / "FINAL" / "BONUS", built by the loading card obj1+0x7928 (section 10.3)
   large text (obj1+0x46d4: WFONT1 15 x 13 glyphs, advance 11) at x = (320 - 11*len) / 2, y = 4          // obj1+0x1b2ed to +0x1b325
   large text "POINTS" (obj2+0xe9c) at (0x37 = 55, 0x22 = 34) and at (0xdf = 223, 34)                        // obj1+0x1b32a to +0x1b357
   y = 0x32 = 50; for n = 1..8 (record n of the sorted table):                                              // loop obj1+0x1b361 to +0x1b549
       x0 = 2 if n <= 4 else 0xaa = 170;  if n == 5: y = 50                                                  // obj1+0x1b399 to +0x1b3c7
       name  = " " + name(obj2+0x1d228 + 12*slot), then " " appended until the length is >= 8             // obj1+0x1b3cd to +0x1b42d
       points text = decimal, a leading "0" for one digit                                                    // obj1+0x1b36f to +0x1b399
       small text (obj1+0x48f4, 8 x 8, advance 8, mode 0): name at (x0, y); then points at (x0 + 8*len(name) + 8, y); 
       picture x = (x after the points text) + 8 = x0 + 8*len(name) + 32
       if slot == [0x28b96] (the player): store (x, y, slot, n) through the four arguments and draw no picture here
       else: transparent 38 x 28 CARS.SP slot frame 0 of the driver at (x, y)                               // obj1+0x1b504 to +0x1b52c
       y += 0x26 = 38
   ```

   The small text routine adds 8 to the blitter column `[0x28b32]` per character and leaves it there (obj1+0x4ae6 to +0x4aef), which is what puts the later elements at x0 + 72 and x0 + 96. Every default name has at most 7 characters, so `len(name)` is 8 and the elements sit at: left column name x 2, points x 74, picture x 98; right column name x 170, points x 242, picture x 266; rows y 50, 88, 126, 164 (ranks 1 to 4 left, 5 to 8 right). The rank-1 row is the top of the left column.
6. The player's own picture is drawn after the table at the returned (x, y): first slot frame 0 (obj1+0x1c217 to +0x1c25e), then, once the screen is shown, a frame counter `cx` steps 0..7 (wrapping, obj1+0x1c57e to +0x1c587) through the slot's frames 0..7 every 12 ticks (`esi = 0xc` against the zeroed counter `[0x1e720]`, obj1+0x1c311, +0x1c316, +0x1c56c), drawing `[slot record + 4 cx]` at the same place, on alternate pages, restoring the background from page 0x7d00 each time (`[0x28b1c] = 0x7d00`, obj1+0x1c2f4 to +0x1c32c; page 0x7d00 was filled at obj1+0x1c200 to +0x1c212; inferred: the page copy routine obj1+0x26f14 is not read). The picture is the animated car of the player (frames 0 to 7 of its CARS.SP slot).
7. Leaving: the loop ends when `[0x28b40]` (the accelerate word of player 1, set by the key sampler obj1+0x277ae via obj1+0x4b00) or Enter or Space (`[0x28cce]`, scancodes 0x1c and 0x39 in the keyboard handler obj1+0x30967 to +0x30982; obj1+0x1c3f1 to +0x1c3fa) is not 0 (obj1+0x1c574 to +0x1c57c). Then the screen is cleared back to the board (obj1+0x1c5a0 to +0x1c5ef) and the routine returns when the race is not 5 (obj1+0x1c614, jump to obj1+0x1d24d). There is no timeout.

Layout summary of the screen (320 x 200): title y 4, header "POINTS" y 34, rows at y 50 + 38 k; car pictures 38 x 28.

## 9. After race 5 (FINAL): bonus notice, rostrum, name entry (rest of obj1+0x1bff0)

Only when `[0x28b88] == 5` (obj1+0x1c614). (`docs/leads/prerace-screens.md` section 9.5 reads this part in more detail; what follows is what this reading adds or confirms.)

- Podium groups: from the sorted table, racers with equal points share a position; up to 3 groups (obj1+0x1c622 to +0x1c79f). The player's group number goes to `[esp+0x338]` (0 if not on the podium) (obj1+0x1c755 to +0x1c75e).
- **Bonus notice**: if the player is on the podium, `[0x1ec80] != 2`, class 3 (champion), `[0x1ed98] != 0` (set only for the regular Bronze cup, obj1+0x7a9b) and single player: the three lines " YOU HAVE WON THE RIGHT TO ENTER " (obj2+0x1730), " THE BONUS TRACK! THIS GIVES YOU " (obj2+0x1754), " THE CHANCE TO GET MORE POINTS!! " (obj2+0x1778) are drawn by obj1+0x1a268 (eax = 3, edx = 0, ebx = 0x220), `[0x1ec80] := 1`, and the routine returns (obj1+0x1c82b to +0x1c8b8). The caller (section 6.1) then sets race 4 / `[0x28c08] = 3`, so the cup loop makes it race 5 again: the loading card shows " LOADING BONUS! " and track 7 (SILVERM.SP strip, section 10.2); after that race `[0x1ec80]` is 2, the leaderboard comes again and now the rostrum.
- **Rostrum**: text "THE ROSTRUM" (obj2+0x179c, small font, centred, y 0x3c = 60) (obj1+0x1c97d to +0x1c9e7), 400 ticks (0x190) wait while `WIN.PCX` (obj2+0x17a8) is loaded (obj1+0x1c9f6 to +0x1ca5d), then the picture (buffer `[0xa978]`) is blitted to page 0 and copied to page 0x7d00, which the animation loop copies back every pass (obj1+0x1ca78 to +0x1cab9), and the song `[0x1c64c]` (LEADRBRD) is started (obj1+0x1cad1); sound 0x12 once (obj1+0x1cb7a); when that song ends `[0x1c648]` (MAINMENU) follows (obj1+0x1cb9f to +0x1cbfa).
  - Podium columns (x, y of the stack base): group 1 (142, 150), group 2 (85, 146), group 3 (197, 143) (obj1+0x1c8bd to +0x1c8fe); a player outside the groups stands at (10, 158) (obj1+0x1c7be to +0x1c7e2). Racers of a group are stacked upward, 28 apart.
  - Phase 1 (state `[esp+0x34c]` = 1): the 38 x 28 table obj2+0xa538 frames 0..3 are drawn at every stack position, 3 passes per frame, one pass = 6 ticks (obj1+0x1cc24 to +0x1cca6, wait obj1+0x1d1ac). obj2+0xa538 is **PUF.SP** frames 0 to 3 (obj1+0x3f59 to +0x3f7e: `[0xa538 + 4 i]` = the buffer `[0x1d6c4]` + 0x428 i, and `[0x1d6c4]` is read from `PUF.SP` at obj1+0x3ac4 to +0x3ae3): a puff of smoke. This also names the "phase 1 pictures" of `figure.rules` (the reaction figure ends with the same puff).
  - Phase 2: each racer is drawn as slot frame 0 (the arms-up portrait) except the player, who gets the finish pose table obj2+0x1b378 (rows stepped once a pass, wrap to row 5 at `[0x28c52]`) (obj1+0x1cd42 to +0x1cd7f); for the podium positions 4 and 5 (the player outside the podium and player 2) the defeat table obj2+0x1b238 is used (obj1+0x1cd84 to +0x1cddc). A cup wheel picture (28 x 23, the table obj2+0x1c800 + 4 (2 (cup - 1) + frame), frame 0/1 alternating) travels in from x = 0 at y = 170 in steps of 16 until 6 past the first group's x (obj1+0x1ce70 to +0x1cf43), and a 15 x 13 cup picture (obj2+0x1eb24 + 4 k, k = 2, 1, 0 for groups 1, 2, 3) drops onto each group's column in steps of 14 from y 0 to the top of the stack minus 11, playing sound 0x17 as each lands (obj1+0x1cf4a to +0x1d012).
  - Sprites of these tables, from the GENEF.SP cut (obj1+0x400f to +0x4064) and identified by decoding GENEF.SP offline [visual]: obj2+0x1c800..0x1c814 are six 28 x 23 pictures (0x284 bytes each) of a spinning wheel, bronze (2 frames: plus spokes, cross spokes), silver (2), gold (2); obj2+0x1eb24, +0x1eb28, +0x1eb2c are three 15 x 13 pictures (0xc3 bytes) of a bronze, a silver and a gold cup. So the group 1 marker is the gold cup, group 2 silver, group 3 bronze.
  - Leave: the loop ends when `[0x28b40]` or Enter/Space is set (obj1+0x1d02e to +0x1d037, +0x1d1e9); then, if the player's group is 1 (alone or tied) and it is single player, `call 0xce14` (name entry, next section) (obj1+0x1d1f1 to +0x1d227); otherwise the palette is restored and the routine returns (obj1+0x1d22c to +0x1d261). `[0x28c08]` is 0 (race 5), so the cup loop then calls the cup board.

## 10. The cup loop and the cup progression

### 10.1 The loop (obj1+0xfb0e to +0x100c5)

```
cup start (obj1+0xfb0e to +0xfb4f):  [0x28bb6] = 1 (cup); [0x28b88] = 1 (race); [0x1ecb4] = 0 (bonus-pack offset; 3 for BONUS PACK RACES, obj1+0x67c8) ...
obj1+0xfff3:  [0x28c08] = 0; call 0x7928 (loading card + preview); if [0x28b9e] == 0 (not escaped): call 0x1fd8c (the race)
obj1+0x1003c: if [0x28c08] == 3 and class != 4: [0x28b88]++ (obj1+0x100b9); goto obj1+0xfffd (next card)
              else: call 0x832c (the cup board: resets the points) and start again at obj1+0xfff3 (or back to the main menu if escaped)
```

(obj1+0xfffd to +0x100c0.) `[0x28b88]` (race 1 to 5) is incremented only here; the cup board sets it to 1 (obj1+0x845f) and clears the points (obj1+0x8384 to +0x839a) and the two HUD counters. The routine obj1+0x832c is only read in its first 0x370 bytes (it shows the pictures SB1.PCX..SB3.PCX / BSB1..3 and SBCS in three pages, `docs/leads/menus.md` 2.6).

### 10.2 Tracks of the cups and the FINAL (obj1+0x7a6b to +0x7b57)

The loading card forms `eax = [0x28bb6] + [0x1ecb4] - 1` and jumps through the obj1 table obj1+0x7910 = 0x7a8a, 0x7ada, 0x7af5, 0x7b0e, 0x7b24, 0x7b3a (read from obj1.bin). Each case stores the track number in `[0x1e728]` and the medal/minimap file name in obj2+0x20ace:

| Case | Cup | Minimap file | Track number (race n = `[0x28b88]` 1..5) | Tracks |
| - | - | - | - | - |
| 0 | Bronze | BRONZEM.SP (obj2+0x728) | n (obj1+0x7a94, +0x7aa5) | 1 to 5 |
| 1 | Silver | SILVERM.SP (obj2+0x734) | n + 5 (obj1+0x7adf, +0x7aeb) | 6 to 10 |
| 2 | Gold | GOLDM.SP (obj2+0x740) | n + 10 (obj1+0x7afa, +0x7b06) | 11 to 15 |
| 3 | Bonus Bronze | BONUSB.SP (obj2+0x74c) | n + 21 (obj1+0x7b13, +0x7b1f) | 22 to 26 |
| 4 | Bonus Silver | BONUSS.SP (obj2+0x758) | n + 26 (obj1+0x7b29, +0x7b35) | 27 to 31 |
| 5 | Bonus Gold | BONUSG.SP (obj2+0x764) | n + 31 (obj1+0x7b3f, +0x7b4b) | 32 to 36 |

- Bronze with `[0x1ec80] != 0` (the bonus race): file SILVERM.SP and track 7 (obj1+0x7abc to +0x7ad5); the strip index is forced to 2 (obj1+0x17a37 to +0x17a49), i.e. the Silver cup's second track.
- The five races of a cup are `[0x28b88]` = 1..5; **race 5 is the FINAL**: the card text and the leaderboard name switch to FINAL (obj1+0x7bbb to +0x7c4f), the praise lines use their 5th row, the leaderboard is followed by the bonus notice or the rostrum (section 9), and `[0x28c08]` is 0 so the loop ends the cup.
- Decoding all 42 SHRINK pictures offline (bottom caption band): 1 to 5 read BRONZE WHEELS, 6 to 10 SILVER WHEELS, 11 to 15 GOLD WHEELS, 16 to 21 SHOOTOUT ZONE 1 to 6, 22 to 26 BONUS BRONZE WHEELS, 27 to 31 BONUS SILVER WHEELS, 32 to 36 BONUS GOLD WHEELS, 37 to 42 SHOOTOUT ZONE 1 to 6 [visual]. This matches the arithmetic of the table.

### 10.3 The loading card and the track preview, obj1+0x7928 to +0x82cd

- Banner text (built in a stack buffer, drawn by obj1+0x1a414: a 16 high box of 8 x len + 8 at x = (320 - width) / 2, y = 92 (0x5c) for edx = 0, text at (+4, +4), colours 0x26 and 0x2c, obj1+0x1a414 to +0x1a4a8): " LOADING" (obj2+0x78c) + " RACE " (obj2+0x7c4) + the race number + " " for races 1 to 4; " LOADING" + " FINAL " (obj2+0x7ac) for race 5; " LOADING" + " BONUS! " (obj2+0x798) for the bonus race (obj1+0x7b77 to +0x7d3a). The leaderboard name obj2+0xaa68 is "RACE " + n, "FINAL" (obj2+0x7b4) or "BONUS" (obj2+0x7a4) (obj1+0x7c01 to +0x7c6c). It is drawn after the page flip at obj1+0x7d3a, i.e. over what the previous screen left (the board or the leaderboard page) (inferred from the call order).
- Then obj1+0x179e8 (names, minimap strip), obj1+0x1754c (track files) and obj1+0x73c4 (driver files) run behind the banner (obj1+0x7d6a to +0x7d91).
- **The track preview** is the 320 x 200 picture `SHRINK<track>.PCX` (name built at obj1+0x17aa0 to +0x17b08 from obj2+0x1560 "SHRINK", the decimal track number at obj2+0x1d770 and obj2+0xb4 ".PCX"), loaded with obj1+0x17060 (edx = 2) (obj1+0x7de4), drawn to page 0 and copied to page 1 (obj1+0x7e0c to +0x7ea3), faded in with obj1+0x22cf8 unless it is the bonus race (obj1+0x7ed6 to +0x7eed). It is the whole track seen from above with the cup name in the bottom band ("BRONZE WHEELS" for track 1) [visual]. It then waits with obj1+0x17920 (eax = 1): Enter, Space or any of the four control words of player 1 ends the wait (race starts); Esc returns 1 (`[0x28b9e] = 1`, no race, the loop goes to the cup board) (obj1+0x17920 to +0x179e6, +0x7f24 to +0x7f38). There is no timeout, and no wait in the bonus race (obj1+0x7f08).
- **BRONZEM.SP and the other five** are not the preview. Each is 19500 bytes = exactly 5 pictures of 78 x 50 = 3900 = 0xf3c bytes (the in-race overhead map): obj1+0x179e8 reads picture `[0x28b88] - 1` (offset 0xf3c (n - 1), computed by shifts at obj1+0x17a49 to +0x17a6f) into the buffer `[0x1eb5c]` when the OVERHEAD MAP switch `[0x28ca0]` is on (obj1+0x17a05 to +0x17a8e). The "18.33 frames of 1064 bytes" reading is not right: 19500 / 1064 is not an integer.

## 11. The FAMOUS DRIVERS name entry and board

Entry: `call 0xce14` from the rostrum (section 9) for the winner of the final standings; the routine is obj1+0xce14 to +0xd13a.

1. Screen: `LEAD.PCX` (obj2+0xdc4, 12523 bytes; decoded: the words "Famous Drivers" on a blue checkerboard [visual]) is loaded and shown (obj1+0xce1c to +0xce63).
2. Entry dialog obj1+0xcb44 to +0xce10 (eax = name buffer, edx = title obj2+0xac, empty, ebx = 0xb): the text "PLEASE ENTER NAME.." (obj2+0xd8c) in the small font at (10, 0x60 = 96) (obj1+0xcbaa to +0xcbce); the typed text at x = 10 + 0xa0 = 170, y = 96, advancing 8 per character (obj1+0xcc91 to +0xcc9a, +0xcdfa); a cursor marker picture 15 x 13 `[0x1eb2c]` (the gold cup picture of section 9) at (x, 91) (obj1+0xcce4 to +0xcd16); the buffer starts as spaces (obj2+0xdb4 for a limit up to 0xb, else obj2+0xda0, obj1+0xcc6e to +0xcc90); keys by the DOS read obj1+0x32c4d: A to Z (lower case minus 0x20), 0 to 9 and space are accepted up to the index 0xb, so 12 characters; Backspace (8) deletes; Enter (0xd) or Esc (0x1b) ends (obj1+0xcd88 to +0xce04).
3. Record (46 bytes = 0x2e): address = `obj2+0x17758 + 0x450 * (cup + bonus) + 0x170 * (class - 1) + 0x2e * rank` (obj1+0xcad0 to +0xcb3d), cup + bonus = `[0x28bb6] + [0x1ecb4]` (1 to 6). Fields: +0 word cup + bonus, +2 word driver slot, +4 word points, +6 date text (obj1+0xc994: `DD MON YYYY`, the day padded to two digits, month from the obj1 table "JAN".."DEC" at obj1+0x154 (4 bytes each), padded with spaces to at least 10 characters; obj1+0xc994 to +0xcac3), +0x1a the typed name. This is the layout of `hi.md` (`WACKY1.HI`/`WACKY2.HI`: the first block, cup + bonus = 1, is at obj2+0x17ba8, the address that obj1+0x25512 loads for the save).
4. Insertion (obj1+0xcea4 to +0xd0b9): the four stored points words of the (class, cup) group are read; the player's total `[0x1ed5c]` is compared with them; if it is below all four, the fourth is lowered to total - 1 (obj1+0xcf2f to +0xcf57) so that it always enters; it enters at the first rank whose stored points it is not below, lower records move down one (the fourth is dropped) copying +4, +0, +0x1a, +2, +6 (obj1+0xcf72 to +0xd02c); the new record gets points `[0x1ed5c]`, cup + bonus, driver `[0x28b96]`, the date and the name (obj1+0xd02c to +0xd0b6).
5. Save: `obj1+0x2542c` (eax = engine `[0x1ee5a]`) writes the 0x19e0 = 6624 bytes at obj2+0x17ba8 to the file "WACKY" + engine digit + ".HI" (name pieces obj2+0x1f9c, +0x1fac; obj1+0x2542c to +0x25530) (obj1+0xd0c9 to +0xd0d0). The song `[0x1c648]` (MAINMENU) is started if it is not the current one (obj1+0xd0d5 to +0xd119).
6. The board, obj1+0xd704 to +0xdabe (eax = class, edx = cup + bonus; the same routine as the INFO menu's FAMOUS DRIVERS): `LEAD.PCX` again; a banner made of the class title (40 byte records at obj1+0x184 "AMATEUR CLASS", obj1+0x1ac "PRO CLASS", obj1+0x1d4 "CHAMP CLASS") + " 12 HP" (obj2+0xe8c, when `[0x1ecb8] == 1`) or " 6 HP" (obj2+0xe94), drawn centred by obj1+0x1a414 at y = 0x32 = 50 (obj1+0xd7d6 to +0xd865); four rows with the records of rank 0..3: row k: the typed name at (10, 83 + 26 k); the driver's CARS.SP slot frame 0 (38 x 28) at (122, 71 + 26 k); the date at (122 + 48 = 170, 80 + 26 k); then, after the date (x advanced by 8 per character) + 8, the cup wheel picture (28 x 23, `[obj2+0x1c800 + 8 * (cup + bonus - ([0x1ecb4] + 1))]`, the first frame of that cup's wheel) at y = 76 + 26 k; the label "POINTS" (obj2+0xe9c) once, above the first row at y = 0x3f = 63; the points as two digits 34 pixels after the wheel's x, y = 83 + 26 k (obj1+0xd8cd to +0xda43). Then it waits with obj1+0x17920 (eax = 1) for a key and returns (obj1+0xda4d to +0xdabe). The rows' x positions depend on the date length (11 characters), so the wheel is at about x 266 and the points at about x 300 [derived from the text routine's advance, not checked against a screen].

## 12. Variables of this part

| Address | Meaning (as read) | Sites |
| - | - | - |
| obj2+0x28c3c | finish flag: 0, 1 (player finished), 2 (3 racers finished, results fixed) | obj1+0x216d3, +0x218a0, readers in section 2.1 |
| obj2+0x28c60 | number of racers that have finished; becomes the place of each | obj1+0x2e46, +0x2f08, +0x201db, +0x217fb |
| obj2+0xaab0 + 0x68 n | racer n place word (0 = not finished) | obj1+0x2e53, +0x2f15, +0x7261 |
| obj2+0xaaae + 0x68 n | racer n cumulative points (word) | obj1+0x21d0f, +0x1c08f, +0x8384 (cleared) |
| obj2+0xaab6 + 0x68 n | racer n driver slot (from obj2+0x10720 + 2 n) | obj1+0x7283, +0x281c |
| obj2+0x1ed50, +0x1ed54, +0x1ed58 | points for 3rd, 2nd, 1st | obj1+0x217a7 to +0x217f1 |
| obj2+0x1ea6c | stage 1 tick stamp | obj1+0x218a9, +0x21919 |
| obj2+0x1ed5c | the player's cumulative points | obj1+0x21d39, +0xcf34 |
| obj2+0x28c36 | state word the finish forces (10 or 13) | obj1+0x21705.., +0x1988f |
| obj2+0x28c5c, +0x28c5a | row cursors of the pose tables 0x1b378 and 0x1b238 | obj1+0x19ce9, +0x19d3d |
| obj2+0x28c52, +0x28c50, +0x28c4e | B + 5, 8, A | obj1+0x75fb, +0x7706, +0x7807, +0x75b2 |
| obj2+0x28c9c | count of driver-voice starts (0 to 4) | obj1+0x19cb6, +0x19ce2 |
| obj2+0x28c3a | pose loop counter (written only) | obj1+0x19d0e, +0x19d5c |
| obj2+0x28c48 | message on; obj2+0x28b66 x; obj2+0xaa18 text | obj1+0x1d268, +0x1aab9 |
| obj2+0x28c08 | 3 = go on with the next race, 0 = cup over | obj1+0x21da9, +0xfffd, +0x1003c |
| obj2+0x28b88 | race number in the cup, 1..5 (5 = FINAL) | obj1+0xfb4f, +0x100b9, +0x845f |
| obj2+0x28bb6, +0x1ecb4 | cup 1..3, bonus offset 0 or 3 | obj1+0xfb46, +0x6669, +0x67c8 |
| obj2+0x1e728 | track number | obj1+0x7a9b to +0x7b4b |
| obj2+0x1ec80 | bonus-race state: 0, 1 offered, 2 played | obj1+0x1c8ae, +0x21d9f, +0x21e0f |
| obj2+0x1ed98 | set when the Bronze cup card ran | obj1+0x7a9b |
| obj2+0x847c | tries (continues) left, 3 at the race routine entry | obj1+0x1fe7d, +0x21959 |
| obj2+0x174e4 + 0x74 k | save record: written at the race start (the 8 points words from obj1+0x1fffb) | obj1+0x1ff77 to +0x20064 |

## 13. Corrections and additions to earlier leads

- `lap.rules` says that after the flag "code that was not read runs (the places, the animations and the screens after the race)": that code is sections 2 to 11.
- `docs/leads/hud.md` section 9 describes obj1+0x2770 as "a finishing order list on the right ... callers not read": it is the label routine of section 3.2, called for the first three finishers only, with "1ST" "2ND" "3RD" and the driver's arms-up CARS.SP frame 0; the picture is not "car sprite CARS slot frame 0 via obj2+0x13c08 records ... inferred" but exactly the first dword of the 0x98 byte slot record of racer word +0x26.
- `figure.rules`: the phase 1 pictures of the reaction figure (obj2+0xa538 at index 3 - frame) are PUF.SP frames 0 to 3 (the same pointers the rostrum uses as its appear puff), 38 x 28 (obj1+0x3f59 to +0x3f7e).
- `car.finish-observed`: "the HUD then no longer draws the timer or the lap text": the lap text half is a record artefact (record finish-2 was restarted through Esc, so `[0x84b4]` stayed 0, section 2.1), the timer half is open (section 14); the "label 1ST with a picture of the driver" is section 3.2, the "victory pose from about the fourth call" is section 4.3, the "congratulation message in the middle ... about 40 s later" is section 5.1 (it appears when the third racer finishes), the list "one entry per racer that has finished" is section 3 (first three finishers only), the "button press leads to the leaderboard" is not a key rule: the leaderboard comes by itself 800 ticks after the message (section 6) and then waits for a key.

## 14. Uncertain / not read

- **Timer after the finish.** By obj1+0x1a993 to +0x1a9c9 the timer (the frozen `[0x1eccc]`, when CLOCK DISPLAY `[0x175d2]` is on or the class is 4) stays drawn; `car.finish-observed` reports from the screen frames that it is not. No explanation found: nothing on the flag in the HUD gate (obj1+0x1a942 to +0x1a96f) or in the draw routine before the HUD call (obj1+0x1f794 to +0x1fb6e), and no writer of `[0x175d2]` besides the menu toggle (obj1+0x112b0 to +0x112c5) and the flyover save and restore (obj1+0x200a1 to +0x200b1, +0x20a4a), which runs only when `[0x28ca8] != 0`, i.e. not in a restart. The lap banner half of that observation is explained in section 2.1 (record artefact). Treat the timer observation as the fact until a record of a race played from the start shows it.
- Which key ends the wait for the leaderboard exit is read as `[0x28b40]` (player 1's accelerate word) or Enter/Space; which scancodes the accelerate key sets is the key table of obj1+0x4b00 (not read). If the accelerate key is still held when the leaderboard appears the loop ends in its first pass (not observed).
- The page copy routine obj1+0x26f14 (`[0x28b1c]` source, `[0x28b1a]` destination, pages 0, 0x3e80, 0x7d00) and the flip obj1+0x27de0 were not read; the page roles above are inferred from their uses.
- The cup board obj1+0x832c (read only to about +0x8700), the three-line box obj1+0x1a268, the menu routine obj1+0x55c0, the PCX loader obj1+0x17060, the palette fade obj1+0x22cf8 and the file save obj1+0x2542c's name pieces were not read in full.
- The rostrum is read for its structure and constants (section 9); the exact tick counts of its state changes (`edi`, `esi` counters at obj1+0x1cc99 to +0x1ccc9, +0x1ccce to +0x1cf43) were not worked out, and the 2-player columns were not read.
- The sounds: numbers 0x11 (finish), 0x12 (rostrum start), 0x17 (cup lands) are only numbers; the sound-number-to-sample mapping is not traced (`docs/leads/pickups.md` and `race-sound.md`). The sound call in state 10 plays the driver's own sound (index = slot).
- The effect of the finish flag at obj1+0x12c8c is read as "the player's part of the object pass is skipped" (the code between obj1+0x12c8c and obj1+0x1378e was not read); at obj1+0x15042 the skipped draw call obj1+0x14afc is not identified.
- Time trial after the finish (obj1+0x21e42 to +0x21ead, obj1+0x1e4b8) and the split-screen finish (obj1+0x2150c to +0x215fa) were not read. The shoot-out and duck-shoot end screens (obj1+0x1b5e8 and others) were not read.
- Place words 4 to 8 of the computer racers are set, but nothing in this part uses them beyond the points loop; the computer racers' behaviour after finishing was not read.
- What `[0x28c3a]` (pose loop counter) and the cleared words `car.+0x44`, `+0x24`, `+0x22`, `+0x3c`, `+0x20`, `+0xb4` and racer word +0x5c mean was not worked out.
- Who sets `obj2+0x1ecb8` (12 HP / 6 HP marker used for the board banner) was not looked up; `[0x1ee5a]` (engine, used for the file name) likewise.
- The sprite descriptions marked [visual] come from decoding the members offline with the column-major 38 x 28 / 28 x 23 / 15 x 13 layouts and the palette of BACK1.PCX (the real run uses the track palette); they identify subjects (arms up, wheel, cup), not exact colours.
