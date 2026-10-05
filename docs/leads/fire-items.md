<!-- WF: output of a subagent's read of analysis/ww/obj1.asm on 2026-10-04; a lead, not evidence. The maintainer has not re-read it. Citations are plain instruction offsets (no fingerprints); nothing here was run or observed. Where a PROVEN claim (item.*, pickup.*) covers a statement it is named; where this read disagrees with docs/leads/pickups.md the difference is listed in section 14. -->

# Fire, held items and shots: a read of the code (WF lead, 2026-10-04)

Everything below was read from the flat disassembly `analysis/ww/obj1.asm` (and initial bytes in `obj1.bin` / `obj2.bin`). `obj1+0xN` is a code offset, `obj2+0xN` a data offset (`[0x28b42]` in an instruction is `obj2+0x28b42`). A citation `(obj1+0xN)` names the instruction offset(s) the statement was read from. "Word" is 16 bit, "dword" 32 bit. Statements marked *inferred* are not read directly. Section 15 lists what was not read.

## 0. Records and words used throughout

* Player car record: pointer at `obj2+0x1d5b0` (the current player's car); the two human cars are at `obj2+0x8410` and `+0x8514` (stride 0x104, `imul ..,0x104` at obj1+0x11993, obj1+0x1fbd0). Words used here: `+0xa` airborne/falling flag, `+0x14` inverted-steering flag, `+0x16` held item, `+0x18`/`+0x1a`/`+0x1e`/`+0x20`/`+0x3c`/`+0x4e` animation and spin state, `+0x32` tick stamp, `+0x42` throttle, `+0x44`, `+0x6a` hedgehog counter ("ammo"), `+0x7c` object-touched flag, `+0x7e` crashed flag, `+0x80` fire latch, `+0x8a` start tick of the inverted flag, `+0x8e` fire-press tick, `+0xe0` byte of ability bits (obj1+0x14364 .. obj1+0x147f8, obj1+0x1d851, obj1+0x1d8cb, obj1+0x11d86, obj1+0x1fc0d).
* Racer record: 0x68 bytes at `obj2+0xaa90 + 0x68 n` (obj1+0x11964, obj1+0x11dc4). Words used: `+2` state (0 normal, 1 contact this frame, 2 wrecked), `+0x12` shot-in-flight flag (= `obj2+0xaaa2` for racer 0), `+0x16`/`+0x18` world x/y, `+0x26` slot, `+0x38 + 2k` frame word per viewer k, `+0x4c` dword hit tick, `+0x50` dword heading, `+0x54` 0..3 counter, `+0x56` crash picture index, `+0x58` hit word, `+0x5a` hit-spin frame (obj1+0x161fc .. obj1+0x162f8, obj1+0x155d4 .. obj1+0x15a76, obj1+0x189ec).
* Racer 0 is the human; with `obj2+0x28be2` or `obj2+0x28bdc` non-zero racer 1 is a second human (obj1+0x225e3 .. obj1+0x22718, obj1+0x11a4b .. obj1+0x11a75). Their position `+0x16/+0x18` is copied from `obj2+0x28b68/0x28b6a` and the heading `+0x50` from `obj2+0x1d5d4` right before the fire call (obj1+0x225bc .. obj1+0x225d9, obj1+0x226d4 .. obj1+0x22709).
* The heading word `obj2+0x1d5d4` runs 0 to 0x77f (0x780 = a turn); it indexes the 8-byte TRIG entries at the table pointer `obj2+0x1d6a0` (obj1+0x190e2 .. obj1+0x1911a, obj1+0x15f37 .. obj1+0x15f64). A step of length L along heading h is `d = (TRIG[h] . L + 0x8000) >> 16` per axis, first TRIG dword into `obj2+0x1d610`, second into `obj2+0x1d620` (obj1+0x27bb1 .. obj1+0x27bef).
* A tick: `obj2+0x1ec64` is incremented once per pass of the race frame loop (obj1+0x2114c) which waits for the timer counter `obj2+0x1e720 - 0x1e724 >= obj2+0x1ea5c` first (obj1+0x21108 .. obj1+0x21122). (The word is also parked in `obj2+0x1ebac` and put back at obj1+0x22199 .. obj1+0x225a2.) So every "N ticks" below is N passes of the frame loop; the wall-clock length was not read.
* Sound: `obj1+0x1c04` plays the sound number in eax (does nothing when `obj2+0x1ee4e` is 0); `obj1+0x1bbc` asks whether that number is still playing and leaves 1 in `obj2+0x28c62` if so (obj1+0x1bbc .. obj1+0x1c01, obj1+0x1c04 .. obj1+0x1c10). Most callers play only when `obj2+0x28c62` is 0 afterwards; those that do not are marked "unconditional".

## 1. Where the fire word `obj2+0x28b42` comes from, and when it is cleared

1. The in-race poll `obj1+0x277ae` copies the bytes at `[obj2+0x1d8a4] + 5, +7, +9, +0xb` into the words `obj2+0x28b40`, `+0x28b42`, `+0x28b44`, `+0x28b46` (button 1 to 4) (obj1+0x277b4 .. obj1+0x277e0), then, unless `obj2+0x28c74` is 1, reads the joystick port 0x201 and sets `0x28b40/42/44/46` to 1 when the bit 0x10/0x20/0x40/0x80 is clear (obj1+0x277e6 .. obj1+0x27847); the fire word is the second: the joystick bit 0x20 (obj1+0x27816 .. obj1+0x2781c). The frame loop points `obj2+0x1d8a4` at `obj2+0x1d8ac` = `obj2+0x1b6d8` and calls the poll once per frame when the modem word `obj2+0x28c0c` is 0 (obj1+0x21152 .. obj1+0x21171, obj1+0x25d39 .. obj1+0x25d57). So the fire key's state byte is `obj2+0x1b6df`: the table at `obj2+0x1b6d8` is 0x18 bytes read from a file by the loader at obj1+0x1984 .. obj1+0x19a6 (taken to be the configuration file, *inferred*; the error text at `obj2+0x20d4` is "Incorrect Wacky Wheels Config File!"), two bytes per control (the menu compares the even byte with scan codes, e.g. `obj2+0x1b6dc` with 0x48 and 0x50, obj1+0x4ce1, obj1+0x4cea), and entries 0 and 1 are the two steering words (obj1+0x21209 .. obj1+0x21222). That the second button entry holds Ctrl, and what writes the state bytes (the keyboard handler), was not read here.
2. Demo/record playback fills the same words from a key byte instead: bit 0x8 of `obj2+0x28cef` becomes `0x28b42` (value 8) (obj1+0x1d94c .. obj1+0x1d97b, called at obj1+0x21fb9 from the recorded bytes at obj1+0x21fa1 .. obj1+0x21fb4; the same split at obj1+0x1e385 .. obj1+0x1e38d). The fire routine only tests for non-zero, so 1 and 8 are equivalent.
3. The second human's buttons come from `obj2+0x28cc4 .. 0x28cc7` (obj1+0x22692 .. obj1+0x226c4); when `obj2+0x1712c` is 0 the bytes `0x28cc4` and `0x28cc5` are filled from the poll's button 3 and button 4 words (obj1+0x211cd .. obj1+0x211e1), so the second player's fire is the poll's fourth button word; the modem path fills them from `obj2+0x28cef` (obj1+0x1f60b .. obj1+0x1f673). Not traced further.
4. The gate routine `obj1+0x1d6d0` runs just before the steering routine each frame (obj1+0x225b2, obj1+0x226ca):
   * Unless `obj2+0x28c44` is 2 it clears `0x28b42`, `0x28b44`, `0x28b46` (obj1+0x1d6d1 .. obj1+0x1d6ed). `obj2+0x28c44` is 2 once the race is running: the race setup sets it to 0 (and `obj2+0x28c38` to 1) before the start sequence (obj1+0x2014c .. obj1+0x2015e), the start code sets it to 1 and zeroes the stamp `obj2+0x1eba8` and the tick counter when the sequence begins (obj1+0x20e5c .. obj1+0x20e83), and the per-frame routine sets it to 2 (with sound 0xa) when `obj2+0x1ec64 - obj2+0x1eba8 >= 0x22` (obj1+0x166d1 .. obj1+0x166fc); in the modes where `obj2+0x28be2` or `obj2+0x1ec74` is non-zero the setup sets it to 2 at once (obj1+0x20139 .. obj1+0x20172). This is why a press in the countdown does nothing (matches item.racer-hit-observed).
   * It clears `obj2+0x28cd3`, `0x28cd5`, `0x28cdd` (the steering flags) and all four buttons whenever the car word `+0x20` (spin) is non-zero, `obj2+0x28c3c` is non-zero, the car word `+0x7e` (crashed) is non-zero, the car word `+0x6` is non-zero, or the racer word `+0x58` (hit word) of the current player is non-zero (obj1+0x1d7ba .. obj1+0x1d826). So a spinning, crashed or hit player cannot fire, steer or press anything.
   * Two chords with the command-line ability bits (section 2.5): button 3 and fire together with bit 0x1 (boost): sets car `+0xb4` to 1 once, throttle `+0x42` to 0xa0, `+0xb6` to 0x10, plays sound 0xc, then clears buttons 3 and 4 only (fire stays set, so the fire routine still runs) (obj1+0x1d838 .. obj1+0x1d8a8); button 3 and button 1 with bit 0x2 (hop): when the car word `+0xa` is 0 sets `+0xa` to 1, `+0xc` and `+0x10` to 8, `+0xe` to 0x28, `obj2+0x28bae` to 4 and plays sound 0xc (obj1+0x1d8aa .. obj1+0x1d948). Neither is the fire item.
   * With two humans or the modem flag it also handles the F1 to F6 taunt keys (`obj2+0x28ce0`): sound 0x1a when the car word `+0xbc` is already 6 or more, otherwise stores the key and bumps `+0xbc` (obj1+0x1d70e .. obj1+0x1d7ba). Not part of the item system.
5. Frame order of one pass (obj1+0x22593 .. obj1+0x227a5), for racing: `obj2+0x1ec64 = obj2+0x1ebac`; poll/gate `obj1+0x1d6d0`; steering `obj1+0x190a0`; racer 0 position and heading stored; fire `obj1+0x14364` (obj1+0x225de); for a second human the same with `obj2+0x28b7e = 1` (obj1+0x22670 .. obj1+0x22718); then `obj2+0x28b7e = 0` (obj1+0x2275a), the AI step `obj1+0x18cac` when `obj2+0x28c44` is 2 (obj1+0x2277c, obj1+0x2278d), and last the shot update `obj1+0x1602c` (obj1+0x227a0), after which the loop restarts at obj1+0x21021 (obj1+0x227a5). So a hit set by the shot update is first handled by the AI step of the next pass. Fire is called only for humans: the only callers of `obj1+0x14364` are obj1+0x225de and obj1+0x22718 and the only caller of the spawner `obj1+0x1d548` is the fire routine (its nine call sites obj1+0x14550 .. obj1+0x147a1), so computer racers never fire and never pick up. Negative finding: regex `call 0x14364\b|call 0x1d548\b` over all of `analysis/ww/obj1.asm` with a fresh script, no non-call instruction with either offset as an operand, and no entry of `analysis/ww/fixups.json` whose target is either offset (no function pointer), 2026-10-04.
6. The player control routine `obj1+0x190a0 .. obj1+0x19e0a` does not touch the fire word at all. Negative finding: regex `0x28b42` over obj1+0x19000 .. obj1+0x1a000 of obj1.asm finds nothing, 2026-10-04 (the other references to `obj2+0x28b42` are in the polls and recorders, the gate obj1+0x1d6d0, the second-player copy obj1+0x226a8, the modem and menu code, and the fire routine; they were not read one by one). What that routine does with the other button words: button 1 `0x28b40` is the throttle (held: `+0x42` rises by 0xa a tick, 6 with `obj2+0x28be2` or the modem flag, set to 0x36 when `obj2+0x1edb0` is non-zero, capped at 0x64; released: falls by 4; `+0x26` is then `[obj2+0x1e730 + 2 * throttle]`, obj1+0x19624 .. obj1+0x1966d, obj1+0x196b7 .. obj1+0x196d5); button 3 `0x28b44` brakes while the throttle is above 0 (clears button 1, sound 0x11, `+0x42` falls by 8, obj1+0x19553 .. obj1+0x195bd); button 4 `0x28b46` with a non-zero throttle, no spin and `+0x6 == 0` starts the sideways skid move (`+0x6` = 1, or 2 when `obj2+0x28b98` is set, sound 0x11, obj1+0x196f1 .. obj1+0x197b0); the steering flags `0x28b8c/0x28b98` are swapped when `+0x14` is set (obj1+0x1934a .. obj1+0x1937d). The physics of these moves was not read further.

## 2. The fire routine `obj1+0x14364`

### 2.1 Pseudo-code

```
fire():                                   # obj1+0x14364, human context: car=[1d5b0], idx=[28b7e], now=[1ec64]
  F = word [28b42]
  if F != 0 and car.+7e != 0: return                                   # obj1+0x1436e..0x14382 (crashed)
  if F == 0:   car.+8e = now ; car.+80 = 0                             # obj1+0x14388..0x143ba  (released: timer restarts every tick)
  else:                                                                # obj1+0x143c3..0x143f7
      if car.+80 == 0: car.+80 = 1 ; car.+8e = now                     #   first tick of a press: fire below
      else:            F = 0 ; word [28b42] = 0                        #   held: no repeat
      if now - car.+8e >= 0x14:                                        # obj1+0x14400..0x14417
          car.+8e = now
          if car.+16 != 8 and dword [1e574] == 0:                      # obj1+0x1442a..0x14431
              play(word [28b96])  (unconditional) ; car.+16 = 8        # obj1+0x1443a..0x1444b
          F = 0 ; word [28b42] = 0                                     # obj1+0x14451
  if F == 0: return                                                    # obj1+0x14466..0x1446e
  if car.+0a != 0: return                                              # airborne            obj1+0x14474..0x1447e
  if racer[idx].+12 != 0: return                                       # volley in flight    obj1+0x14484..0x14496
  if car.+16 == 0 and car.+6a == 0:                                    # obj1+0x1449e..0x144ba -> 0x14809
      if not playing(0x1a): play(0x1a) ; return                        # empty click         obj1+0x14809..0x14822
  sel = car.+16
  if sel == 0:                                                         # obj1+0x144cc..0x144f6
      if car.+e0 & 0x10: sel = 3
      if car.+e0 & 0x08: sel = 8                                       # 8 wins when both
  jump table obj1+0x14340[sel]  (sel > 8 -> just the sound step)       # obj1+0x14501..0x14524
  ...case code: spawn call(s), sound number into esi, racer[idx].+12 set or cleared (table in 2.2)...
  if not playing(esi): play(esi)                                       # obj1+0x147c4..0x147da
  if car.+16 == 0: car.+6a -= 1  else  car.+16 = 0                     # obj1+0x147eb..0x147fe  (the item is used first, the counter only when none is held)
```

* One shot (or volley) per press: while the key stays down the latch word `+0x80` is 1 and `0x28b42` is forced to 0 (obj1+0x143d6 .. obj1+0x143f7).
* The gate cases cost nothing and play nothing except the click (they all return at obj1+0x14827; the click is obj1+0x14809 .. obj1+0x14822).
* Jump table at `obj1+0x14340` (initial bytes): 9 dwords = `0x1452c, 0x147c4, 0x147c4, 0x14578, 0x14609, 0x14693, 0x146e1, 0x1472f, 0x1477a` for sel 0 to 8 (read from obj1.bin; the instruction at obj1+0x14524 is `jmp [cs:ebx*4+0x14340]`). The entries for 1 and 2 only run the sound step and consume (unreachable: no source sets `+0x16` to 1 or 2).

### 2.2 What each selector spawns

The spawner `obj1+0x1d548(eax = type, edx = owner idx)` is described in section 4; `[0x1eb04]` is the sprite block pointer it copies into the record (+0x1a), `[0x1eb9c]` the dword it copies into +0x1e, `[0x28bc0]` the frame count it copies into +0x10. `H` below is the car heading `obj2+0x1d5d4`.

| sel | when | entry | spawn calls (type, `[0x1eb9c]`) | sprite block (`obj2`) | `[0x28bc0]` | sound esi | racer `+0x12` (`0xaaa2`) afterwards |
|---|---|---|---|---|---|---|---|
| 0 | counter `+0x6a` > 0, nothing held, no ability bit | obj1+0x1452c | 1 x (0, 0) | `[0x1d740]` | 3 | 0x14 | 1 (obj1+0x1456a) |
| 3 | item 3 held, or counter with bit 0x10 | obj1+0x14578 | 3 x type 0 with `[0x1eb9c]` = 0, 1, 2 | `[0x1d73c]` | 1 | 0x13 | 3 (obj1+0x145fb) |
| 4 | item 4 held | obj1+0x14609 | 2 x type 1 with `[0x1eb9c]` = H+0x1e0 (wrap -0x780 when >= 0x780) then H-0x1e0 (wrap +0x780 when < 0) | `[0x1d738]` | 1 | 0x17 | 0 (obj1+0x147bb) |
| 5 | item 5 held | obj1+0x14693 | 1 x (2, H+0x3c0, or H-0x3c0 when H+0x3c0 >= 0x780) | `[0x1d734]` | 1 | 0x17 | 0 |
| 6 | item 6 held | obj1+0x146e1 | 1 x (3, same heading) | `[0x1d730]` | 1 | 0x17 | 0 |
| 7 | item 7 held | obj1+0x1472f | 1 x (4, same heading) | `[0x1d72c]` | 1 | 0x17 | 0 |
| 8 | item 8 held, or counter with bit 0x08 | obj1+0x1477a | 1 x (5, 0) | `[0x1d728]` | 3 | 0x14 | 0 |

Citations: sel 0 obj1+0x1452c .. obj1+0x14573; sel 3 obj1+0x14578 .. obj1+0x14604 (the three calls at obj1+0x145a1, obj1+0x145cd, obj1+0x145e1 with `[0x1eb9c]` = 0 (obj1+0x14594), 1 (obj1+0x145bb), 2 (obj1+0x145db)); sel 4 obj1+0x14609 .. obj1+0x1468e (loop bx = 1, 2; first pass adds 0x1e0, second subtracts: obj1+0x1461f .. obj1+0x14651); sel 5, 6, 7 obj1+0x14693 .. obj1+0x14778; sel 8 obj1+0x1477a .. obj1+0x147c2. The flag is written 1 and 3 by the first two (obj1+0x1456a, obj1+0x145fb) and cleared by the rest (obj1+0x147bb); the fire gate blocks a press only while the flag is non-zero. This matches the observed fan offsets, the devils' headings 960 and 0 for a car heading 480, and the mines' heading 1440 (item.fire-observed, item.shots-observed).

So, for the question "what each held item does":
* Item 3: a fan of three type-0 shots (lane words 0, 1, 2: straight, and 0x1e less / 0x1e more than the owner's heading each frame, section 5), picture block `[0x1d73c]` (one 18 x 13 frame, section 8), sound 0x13.
* Item 4: two type-1 shots sent 90 degrees to the left and right of the heading (0x1e0 of 0x780), which bounce off walls and objects and never time out ("devils" is the wiki name; it is only a lead), picture `[0x1d738]`, sound 0x17.
* Items 5, 6, 7: one stationary record of the type 2, 3, 4 dropped 10 behind the car (section 4.2) pictured by `[0x1d734]`, `[0x1d730]`, `[0x1d72c]`; sound 0x17. They differ only in the picture and in the effect on a human who touches them (type 4 inverts the steering, 2 and 3 spin the car, section 9); on a computer racer all three act the same (section 7).
* Item 8: one type-5 shot straight ahead (the frozen-engine effect on racers, section 7) with a three-frame picture, sound 0x14. No pickup gives item 8 (the pickup code only accepts catalogue kinds 3 to 7, section 3); it comes from the 20-tick hold (2.3) or from the `ICE` switch (2.5).
* The counter (no item): type 0, lane 0, one hedgehog shot with a three-frame picture, sound 0x14, costs one count.

### 2.3 Holding fire for 20 ticks puts item 8 (the ice cube) in the window

* While fire is held the press tick is `car+0x8e`; the test is `now - car+0x8e >= 0x14` (signed `jl` at obj1+0x14417), so after 20 consecutive ticks of holding (the timer restarts at every tick the key is up, obj1+0x143a3) `car+0x16` becomes 8 and `car+0x8e = now` (obj1+0x14419 .. obj1+0x1444b). It replaces whatever was held (the test is only "not already 8", obj1+0x1442a), plays the driver sound word `obj2+0x28b96` (unconditional), and forces `0x28b42` to 0 for that tick. Holding 20 more ticks does it again (a no-op while the item is 8). The held word 8 is then fired by releasing and pressing again (sel 8, section 2.2), which uses it up (obj1+0x147f8). It is the manual's "hold fire for a few seconds, get an ice cube in the weapons window at the lower right": the HUD icon for the held word 8 is the sixth ICONS.SP frame (section 10).
* It is switched off by the dword `obj2+0x1e574` (obj1+0x14431). `obj2+0x1e574` is set by the version probe `obj1+0x24458`: it asks `obj1+0x418c` (which uppercases the name and searches the WACKY.DAT directory table at `obj2+0x5080`, returning 1 when found, obj1+0x418c .. obj1+0x41fc) for the member `42.GAM`; found: `0x1e574 = 0`, `obj2+0x1eca0 = 3`; else for `20.GAM`: found: `0x1e574 = 0`, `0x1eca0 = 2`; neither: `0x1e574 = 1`, `0x1eca0 = 1` and the banner text "SHAREWARE RELEASE." (strings at `obj2+0x1eb8`, `+0x1ec0`, `+0x1ec8`) (obj1+0x24479 .. obj1+0x244e5). So the ice grant exists in the registered builds and not in the shareware release; the user's archive contains `42.GAM` and `20.GAM` (checked by listing the directory), so there it is on.
* Matches the observations: the held word becomes 8 at tick 55 = 35 (first racing tick, the press) + 20 (item.racer-hit-observed), and a 25-sample (about 17 tick) hold gives nothing (item.hedgehog-observed).
* The counter `obj2+0x1ed24` and the call at obj1+0x3780 that the task brief links with this are a different thing: `obj2+0x1ed24` counts frames of the steering flag `obj2+0x28b8c` held while the car word `+0x26` is 0 and `obj2+0x28c38` (set during the start sequence, obj1+0x2014c) is non-zero, and is reset when the flag is up or button 1 is down (obj1+0x19415 .. obj1+0x19442, obj1+0x1946a, obj1+0x194b2 .. obj1+0x194bc); with button 3 pressed in that phase and the counter at 0x36 or more, and neither two humans nor the modem flag, it sets `obj2+0x1ed40`, calls obj1+0x3780 and clears the counter (obj1+0x19502 .. obj1+0x19541; the same test at obj1+0x375c). obj1+0x3780 loads DOPE.SP (0x2e77 bytes) and, with sound on, BELCH.VOC (obj1+0x3780 .. obj1+0x37db) and `obj2+0x1ed40` makes the frame loop call obj1+0x3858 (obj1+0x1fc40 .. obj1+0x1fc49). It touches neither `car+0x16` nor the fire word; it is a separate easter egg (not read further, section 15).

### 2.4 The two other ways to get items

* Pickup (section 3): kinds 3 to 7 set `car+0x16`, kind 2 adds 4 to the counter.
* Resets: the race setup zeroes `car+0x6a` and `car+0x16` of the cars only in the multi-human and modem modes (obj1+0x20252 .. obj1+0x20283), so in a plain one-player race it does not; a routine around obj1+0xe540 (not identified, run when a game or championship starts, *inferred*) zeroes both for cars 0 and 1 (obj1+0xe59b .. obj1+0xe5b3). With a car's ability bits 0x4, 0x8 or 0x10 set, a routine at obj1+0x207d1 .. obj1+0x20830 (the setup path of a race, its caller not traced) sets `car+0x6a` to 0x63 for cars 0 and 1 (obj1+0x207fc .. obj1+0x20824).

### 2.5 The ability byte `car+0xe0` comes from command-line words

The command-line loop `obj1+0x26183 .. obj1+0x262d7` (argument words from index 1) uppercases each argument (`obj1+0x32dd0` is a strupr: `a`-`z` minus 0x20, obj1+0x32dd0 .. obj1+0x32dea) and compares it (`obj1+0x32df0` is a dword-wise strcmp returning 0 for equal) with, in this order: `TURBO` (`obj2+0x1b34`) adds 0x1 to the dword `obj2+0x84f0`; `JUMP` (`+0x21d0`) 0x2; `HOG` (`+0x21d8`) 0x4; `ICE` (`+0x21dc`) 0x8; `FIRE` (`+0x21e0`) 0x10; `NOW` (`+0x21e8`) sets `obj2+0x1ecbc`; `/1`, `/2`, `/3` set `obj2+0x1ed08` to 0xc, 6, 0; `/DEBUG` prints "Debug ON" (obj1+0x26194 .. obj1+0x262c6). `obj2+0x84f0` is car 0's `+0xe0` and it is copied to car 1's (`obj2+0x85f4`) and to `obj2+0x1ed64`, `+0x1ed68` (obj1+0x262d7 .. obj1+0x262ea; the copies are written back at obj1+0x11db, obj1+0x11ee). So:
* `TURBO`: the boost chord and `JUMP`: the hop chord of section 1, item 4; `HOG`: the bit is tested but its result is unused in the selector (obj1+0x144ce), it only fills the counter (2.4); `ICE`: the counter fires item-8 shots; `FIRE`: the counter fires the item-3 fan; both bits: ice wins (obj1+0x144da .. obj1+0x144f6). In all cases the cost is one count, not an item (obj1+0x147eb .. obj1+0x147f2).

## 3. Taking a pickup (object pass `obj1+0x12bf4 .. obj1+0x137a4`)

* The pass walks the sorted draw list at `obj2+0x19a50` (0x28 bytes a record, count word `obj2+0x28b78`) for the current car (obj1+0x12c0a .. obj1+0x12cc5). For an object entry the entry word `+0x1c` is the object record's word `+2` (obj1+0x15dce .. obj1+0x15dde: `[ecx+2]` stored at `[eax+0x1c]`, with `+0x24 = 0xffff`), which the car's collision test sets to 1 when the car overlaps the object within 14 (car.collision-test); the pickup code runs only when that word is non-zero and the car word `+0x7c` is non-zero (obj1+0x131d5 .. obj1+0x131f6), and the entry word `+0x24` is -1 (static object, obj1+0x13210). The shot draw records set `+0x1c = 0` (obj1+0x1660f), so a shot is never "touched" here.
* The catalogue kind is the word at `obj2+0x12998 + 0x28 * sprite id` (obj1+0x13219 .. obj1+0x1322d). Kind 1: tyres (pickup.tyres-observed). Kinds 2 to 7 (obj1+0x1324d .. obj1+0x132d1): refused when `car+0x6a >= 0x63` (even for kinds 3 to 7, obj1+0x1324d); taken when `car+0x16 == 0` or the kind is 2 (obj1+0x1325a .. obj1+0x13267); then plays the sound number in `obj2+0x28b96` (unconditional, obj1+0x13283 .. obj1+0x1328a), sets the object's word `+2` to 0xffff (obj1+0x1329c), and either (kind 2) `car+0x6a += 4`, clamped to 0x63 (obj1+0x132b6 .. obj1+0x132cb) or (kinds 3 to 7) `car+0x16 = kind` (obj1+0x132a8 .. obj1+0x132ad). A pickup that is refused stays on the road. Matches pickup.kinds-observed.
* Kind 0 obstacles wreck a fast car (obj1+0x1334d .. obj1+0x133f4, atr.kind-effects); not part of the shot system.
* Nothing in this pass looks at the shot list or at `+0x58`; the contact between a racer and a shot is in the shot code (section 6).

## 4. The shot list and the spawner

### 4.1 The records

61 records of 0x22 bytes from `obj2+0x1f2b0` (loops `cmp si,0x3c; jng` at obj1+0x16036 .. obj1+0x161e8 and obj1+0x1d556 .. obj1+0x1d616, so slots 0 to 0x3c). The race start clears the active word of all 61 and the car words `+0x12`, `+0x14` of both cars (obj1+0x1d4fc .. obj1+0x1d544, called at obj1+0x200fb).

| offset | size | meaning | source |
|---|---|---|---|
| +0x00 | word | owner (racer index = `obj2+0x28b7e` at the fire call) | obj1+0x1d5aa |
| +0x02 | word | type 0 to 5 (6 exists in the code but no caller makes it) | obj1+0x1d5a1; callers obj1+0x14550 .. obj1+0x147a1 |
| +0x04 | word | active (0 = free) | obj1+0x1d558, obj1+0x1d58f |
| +0x06 | word | state, 0 live, 0xff exploding | obj1+0x1d589, obj1+0x161c1 |
| +0x08 | word | "still overlapping the owner" flag, 1 at spawn | obj1+0x1d583, obj1+0x11a06 |
| +0x0a, +0x0c | words | world x, y | obj1+0x1d5c2, obj1+0x1d5cf |
| +0x0e | word | frame index | obj1+0x1d5e4, obj1+0x16048 |
| +0x10 | word | frame count (`obj2+0x28bc0`) | obj1+0x1d600 |
| +0x12 | word | bytes a frame, 0xea | obj1+0x1d5f0 |
| +0x14 | word | distance limit 0x3e8 (1000) | obj1+0x1d595 |
| +0x16 | word | step: 0x10 for type 1 and 6, else 0xa; set to 0x64 by the first update of types 0 and 5 | obj1+0x1d567 .. obj1+0x1d57d, obj1+0x160bc |
| +0x18 | word | travelled distance, 0 at spawn | obj1+0x1d5de |
| +0x1a | dword | sprite block pointer (`obj2+0x1eb04`) | obj1+0x1d5f6 |
| +0x1e | dword | types 0, 5: lane word 0, 1, 2 (`obj2+0x1eb9c`); types 1 to 4: heading 0 to 0x77f | obj1+0x1d5b3 |

### 4.2 The spawner `obj1+0x1d548`

```
spawn(type, owner):                              # obj1+0x1d548..0x1d60d
  find first record r with r.+4 == 0 (slots 0..0x3c); none -> return silently   # obj1+0x1d558, obj1+0x1d60e..0x1d625
  r.+16 = (type == 1 or type == 6) ? 0x10 : 0x0a
  r.+8 = 1 ; r.+6 = 0 ; r.+4 = 1 ; r.+14 = 0x3e8
  r.+2 = type ; r.+0 = owner ; r.+1e = dword [1eb9c]
  [1d5d0] = [1d5d4]                              # heading used by the lane branch of move()
  r.+a = word [28b68] ; r.+c = word [28b6a]      # the car's own point (camera + 0x7c ahead)
  move(0)                                        # one step, no collision test (section 5.1)
  r.+18 = 0 ; r.+e = 0 ; r.+1a = [1eb04] ; r.+12 = 0xea ; r.+10 = word [28bc0]
```
(obj1+0x1d548 .. obj1+0x1d60d). `obj2+0x28b68/6a` is the car's world point: the movement routine first stores the 0x7c-long heading vector in them (obj1+0x13800 .. obj1+0x13844) and ends by storing the camera words `obj2+0x28b0a/0e` plus that vector, passed through the terrain lookup's 0 to 0xfff clamp (obj1+0x14152 .. obj1+0x14194; the camera sits 0x7c behind the car, view.setup, and the observed car was at camera + 124), and the frame loop stores the result as the racer's `+0x16/+0x18` (obj1+0x225bc .. obj1+0x225ce). So a shot starts on the owner's car, moves one step in its first direction, and the same frame's update (section 5.2) moves it once more: the hog 10 + 10 = 20 ahead, a devil 16 + 16 = 32 to the side, a mine 10 behind (stationary after the first step). These are the observed numbers (item.hedgehog-observed: 20 ahead; item.shots-observed: columns +-32, rows 10 behind).

## 5. Per-frame update of the shots

### 5.1 The move `obj1+0x15e6c(mode)` (mode 0 = at spawn, 1 = per frame)

```
move(mode):                                      # obj1+0x15e6c..0x1602a ; r = [1d874]
  stationary = false
  if r.type in {0, 5}:                           # obj1+0x15e7a..0x15e86, 0x15ea6..0x15f05
      H = [1d5d0]
      h = (r.+1e == 0) ? H : (r.+1e == 1) ? H - 0x1e (+0x780 if < 0) : (r.+1e == 2) ? H + 0x1e (-0x780 if >= 0x780)
  else:
      h = r.+1e
      stationary = (r.type > 1)                  # types 2, 3, 4, 6                    obj1+0x15e88..0x15e9c
  if mode == 1 and stationary: end = start       # obj1+0x15f07..0x15f32   (the mine does not move)
  else: end = start + step(h, r.+16)             # obj1+0x15f37..0x15fb8 (section 0 formula)
  if mode == 0: r.pos = end ; return             # obj1+0x15fbe, 0x1600a
  collision = 0 ; [1e568] = 0
  walk(start -> end)  -> stops at the first point whose test is non-zero (section 6), pos words end on that point
  if collision == 3 and r.type == 1: r.pos = end       # a devil is not stopped by a racer   obj1+0x15fdb..0x15fef, 0x1600f
  else: r.pos = last point reached                      # obj1+0x15ff1..0x16008
```
* The walker `obj1+0x12230` is a Bresenham walk from (`obj2+0x28ba4`, `0x28bc2`) to (`0x28ba6`, `0x28bc4`) along the longer axis that calls the shot test `obj1+0x118a4` at each point, stops when `obj2+0x28bae` becomes non-zero and tests the end point once more (obj1+0x12230 .. obj1+0x1232d). For a stationary shot start = end and the test runs once at its own point.
* For types 0 and 5 the heading is the owner's current one (below), so the fan and the hog steer with the car; the lane words 1 and 2 are -0x1e and +0x1e (about 5.6 degrees, 0x1e of 0x780). 0x1e of 0x780 gives a drift of about 10 per 100 of travel, the observed value (item.fire-observed).
* `[0x1d5d0]` is the owner's heading: at spawn `obj2+0x1d5d4` (obj1+0x1d5b9 .. obj1+0x1d5bd), in the update the dword `racer[owner].+0x50` (`obj2+0xaae0 + 0x68 owner`, obj1+0x16074 .. obj1+0x16080).

### 5.2 The update `obj1+0x1602c` for each active record

```
for each of the 61 records r with r.+4 != 0:                                  # obj1+0x16036..0x161e8
    r.+e += 1 ; if r.+e >= r.+10: r.+e = 0 ; if r.+6 == 0xff: r.+4 = 0       # obj1+0x16048..0x16062  (animation; frees an exploded shot after its last frame)
    if r.+6 == 0xff: continue                                                 # obj1+0x16068..0x1606e  (exploding: nothing else)
    [1d5d0] = racer[r.+0].+50 ; move(1)                                       # obj1+0x16074..0x16095
    if r.type == 1:                                                           # obj1+0x1609d, obj1+0x160e2..0x1617b
        if collision in {1, 2}:  r.+1e = (r.+1e + 0x3c0) mod 0x780 ; r.pos += step(r.+1e, r.+16) ; collision = 0
        # a collision 3 (racer) or 0 falls through to the end test below
    elif r.type in {0, 5}:                                                    # obj1+0x160b5..0x160d4
        r.+16 = 0x64 ; r.+18 += (step used this frame) ; if r.+18 >= r.+14 (signed): collision = 1
    # types 2, 3, 4, 6: nothing more                                          # obj1+0x160a4..0x160b0 -> 0x1617f
    if collision != 0: explode(r)                                             # obj1+0x1617f..0x161dd
```
* Types 0 and 5: the first update uses the spawn step 0xa (so the first 10 of travel), then 0x64 = 100 a tick; the travel is added whether or not a collision cut the walk; the shot ends when it reaches 1000 or collides (collision 1, 2 or 3) (obj1+0x160b5 .. obj1+0x160d4). Matches `item.fire-observed` (travel 10, 110, ..., 1010; limit word 1000) and `item.hedgehog-observed` (travel 610 at the end of the road, stop 13 from a tyre stack).
* Type 1 (devils): step 0x10 a tick forever (the travel word is not touched, so it has no time limit); on a wall (1) or an object (2) hit the heading turns 180 degrees (+0x3c0, mod 0x780), the record takes one more step the new way from the point where the walk stopped, and the collision word is cleared so it goes on (obj1+0x160e2 .. obj1+0x1617b); a racer hit (3) or any other non-zero result ends it; it is not stopped by a racer on the way (obj1+0x15fe5 .. obj1+0x15fef). Matches `item.shots-observed` (turns at the column 1056 and 1456 and neither is gone by sample 59).
* Types 2, 3, 4 (and 6): never move after the spawn step; they end only when the shot test at their own point finds something: a wall at the point, any non-consumed object record within Manhattan 14, or a racer within 18 (section 6). A mine dropped within 14 of an unconsumed object record therefore explodes on the next update without touching anyone (inferred from obj1+0x118dc .. obj1+0x11937). Matches item.shots-observed ("does not move for the rest of the run") and item.mine-hit-observed / item.mine-types-observed (gone 3 ticks after a racer touched it).
* Explosion (the end of any shot, `obj1+0x16188 .. obj1+0x161dd`): plays sound 0x12 (unconditional), decrements the owner's `racer.+0x12` and floors it at 0 (obj1+0x161a4 .. obj1+0x161ba), sets `r.+6 = 0xff`, `r.+10 = 3`, `r.+12 = 0xea`, `r.+e = 0` and `r.+1a = [obj2+0x1d748]` (the explosion block). Because the animation counter is bumped before the exploded record is skipped, the record is drawn with the frames 0, 1, 2 for one tick each (the ending update and the two after it) and is freed on the third update after the ending one (obj1+0x16048 .. obj1+0x16062). Matches the observed records that stay 3 ticks after a hit and are gone at the fourth tick (item.racer-hit-observed: hit at tick 36, gone at 39).
* The first frame of a freshly spawned shot is drawn with frame index 1 (the same frame's update bumps `+0xe` from 0) when `+0x10` is 3 (hog, ice); the single-frame blocks show frame 0 always (inferred from obj1+0x16048 .. obj1+0x16056 and the order in section 1.5).

### 5.3 The in-flight word `obj2+0xaaa2` (racer `+0x12`)

Cleared by the racer initialisation (obj1+0x7122; obj1+0x6fe3 stores a zeroed register in the modem path, obj1+0x6fbd .. obj1+0x6fe3), set to 1 after a counter shot and to 3 after the fan, cleared after the other selectors (section 2.2), decremented once per ending shot of that owner and floored at 0 (obj1+0x161a4 .. obj1+0x161ba, including mines and devils, which never raised it), and read only by the fire gate (obj1+0x1448e). So the fire key is dead until the volley has ended (hog: the shot; fan: all three), as observed (flag 3 while the fan flies).

## 6. The shot test `obj1+0x118a4` (called at each walker point)

Point = (`obj2+0x28ba4`, `0x28bc2`) as sign-extended words in `obj2+0x1d7a4/a8` (obj1+0x118a8 .. obj1+0x118bb). In this order, stopping at the first hit:

1. Terrain: `obj1+0x27b04` looks the point up (coordinates clamped to 0 to 0xfff; `[0x1e568]` receives one of two class dwords of the tile's entry, chosen by a pixel of a bit map; read only that far, obj1+0x27b04 .. obj1+0x27baf). Class 3 -> `obj2+0x28bae = 1` (wall) (obj1+0x118c0 .. obj1+0x118cc). Class 10 (pit) is not tested for shots.
2. Objects: the 12-byte records at `obj2+0x13938`, count word `obj2+0x28b8e`; records whose word `+2` is 0xffff (consumed) are skipped; any other record with `|x - rec.+4| + |y - rec.+6| < 0xe` (14) -> `0x28bae = 2` (obj1+0x118dc .. obj1+0x11937). Every kind counts (obstacles, hedgehog pickups, items, tyres). The record is not changed.
3. Racers: base `obj2+0xaa90`, stride 0x68, indices 0 to the word `obj2+0x28c40`; a racer is skipped when its `+2` is 2 (wrecked) or when its car's word `+0xa` (airborne, `obj2+0x841a + 0x104 idx`) is non-zero (obj1+0x11985 .. obj1+0x119a1); a racer counts as touched when `|x - racer.+0x16| + |y - racer.+0x18| < 0x12` (18) (obj1+0x119a7 .. obj1+0x119d4). Matches `item.racer-hit-observed` (stop at Manhattan 17, hit at 17 and not at 18 inferred from the `jnl`).
4. Owner rules for a racer that is the owner (`cx == r.+0`) (obj1+0x119d9 .. obj1+0x11a0c):
   * overlapping the owner: no hit while the record's `+8` is non-zero; when `+8` is 0 the types 0 and 5 still never hit their owner, the types 1, 2, 3, 4 (and 6) can (obj1+0x119e3 .. obj1+0x119fd);
   * not overlapping: `+8` is cleared (obj1+0x11a01 .. obj1+0x11a08).
   So a fresh mine or devil cannot hit its owner while still within 17 of him; once it has been farther away than that, it can (the mine 10 behind the car is first left behind, then can be driven into).
5. Racer already hit (`racer.+0x58 != 0`): the record is consumed (collision 3) and nothing else happens (obj1+0x11a15 .. obj1+0x11a1f -> obj1+0x11db6). `racer.+2 == 2` was already excluded above.
6. Otherwise the record's x, y words are set to the racer's (obj1+0x11a30 .. obj1+0x11a42; the move routine overwrites them again, section 5.1) and the effect of section 7 (computer racer) or section 9 (human) is applied, always ending with `obj2+0x28bae = 3`.

Who is "computer" (obj1+0x11a46 .. obj1+0x11a75): with `obj2+0x28be2` or `obj2+0x28bdc` non-zero racers 2 to 7 are computer racers and 0, 1 humans; otherwise racers 1 to 7 are computer and only 0 is human. The shot type is replaced by 0 when it is 5 and `obj2+0x28be2` or `obj2+0x1ec74` is non-zero (obj1+0x11a7f .. obj1+0x11a98).

## 7. Effects on a computer racer (single player: racers 1 to 7)

1. Types 0, 1, 2, 3, 4 (sound 0x11, unconditional; not in the modem mode): `racer.+0x58 = 1`, `racer.+0x5a = word[racer + 0x38 + 2 * obj2+0x28b7e]` (its current picture index; `obj2+0x28b7e` is 0 in the update), `racer.+0x4c = obj2+0x1ec64`; collision 3 (obj1+0x11aad .. obj1+0x11b3e).
2. Type 5 (ice): `racer.+0x58 = 2`, `racer.+0x4c = now`; if sound 0x19 is not already playing it is played; collision 3 either way (obj1+0x11b43 .. obj1+0x11b86, obj1+0x11db6).
3. Modem mode (`obj2+0x1ec74` non-zero) takes a separate branch with a sound 0xff and the racer words `+0x64`, `+0x66` (obj1+0x11ab2 .. obj1+0x11aee); not decoded.
4. The AI step `obj1+0x18cac` (called each racing frame, obj1+0x2278d) calls the hit handler `obj1+0x189ec` for every racer whose `+0x58` is non-zero and then skips that racer's movement, so it does not move, steer or accelerate while hit (obj1+0x18cdb .. obj1+0x18ce9, obj1+0x1903b). The handler (obj1+0x189ec .. obj1+0x18b0c):
   * the limit is 0x21 (33 ticks) when `+0x58` is 1, else 0x32 (50 ticks), and 4 in the modem mode (obj1+0x189f5 .. obj1+0x18a16);
   * when the limit is 0x32 (states 2 and 3): if the sound of the current state (state 2: 0x19, state 3: 0x18) is not playing, the state flips 2 <-> 3 and the sound of the new state (0x19 for 2, 0x18 for 3) is played if not playing (obj1+0x18a1f .. obj1+0x18a8c); this is the observed 2, 3, 2, 3 switching at 13- and 6-tick spacings (item.racer-hit-observed): the code flips only after the sound of the current state has stopped, so the spacings are the lengths of sounds 0x19 and 0x18 (*inferred*, the sample lengths were not read);
   * when `now - racer.+0x4c >= limit` the word `+0x58` is cleared (obj1+0x18a96 .. obj1+0x18aa5); in the modem mode the racer is then wrecked instead (sound 0xd, `+0x56 = 0`, `+0x58 = 0`, `+0x5c = 0`, `+2 = 2`, obj1+0x18aab .. obj1+0x18aff).
   So a shot or mine stops a computer racer for 33 ticks (hit word 1) and an ice shot for 50 ticks (2/3), matching item.mine-hit-observed (33 ticks, stood 5 from the record) and item.racer-hit-observed (33 and 50).
5. Pictures while hit: the racer draw routine `obj1+0x155d4` uses the normal frame (`[slot * 0x98 + frameWord * 4 + obj2+0x13c08]`) when `+0x58` is 0 or 2 or 3, and, when `+0x58` is 1, the frame whose index is `racer.+0x5a` instead (obj1+0x157d3 .. obj1+0x1581e); the per-frame routine `obj1+0x161fc` bumps `+0x5a` by one (wrapping 7 -> 0) for every computer racer whose `+0x58` is 1 (obj1+0x162ab .. obj1+0x162bd). So a racer hit by a shot or mine visibly turns through all eight views one view a tick, and a frozen racer is drawn normally (view-rotation read from code; the pictures were not looked at). A wrecked racer (`+2 == 2`) shows picture `[obj2+0x1c7f0 + 4 * racer.+0x56]` for `+0x56` 0 to 3 and nothing above (obj1+0x157b4 .. obj1+0x157d1), `+0x56` rising one a tick in `obj1+0x161fc` (obj1+0x16288 .. obj1+0x162a5); no shot or mine wrecks a computer racer in the single-player mode.

## 8. Drawing the shots `obj1+0x1632c`

* Called from the render paths of the frame (the `call` sites are obj1+0x34ff, obj1+0x3608, obj1+0x189d7, obj1+0x1f77d, obj1+0x1fa18 and obj1+0x208d5; the paths were not told apart). It walks the same 61 records (obj1+0x16335 .. obj1+0x1668b) and for each active record projects the world point (`+0xa`, `+0xc`). This routine is the one the claim view.object-projection describes (it names obj1+0x1632c and the same 0x22-byte list); the claim lists "what the 0x22-byte records are and who fills them" and "where the ten scaled pictures come from" as not observed, and the answers are in sections 4 and 5 (the spawner obj1+0x1d548 and the update obj1+0x1602c fill and move them) and in the next bullets (the pictures). The projection steps are: view box test, the visibility routine obj1+0x14a08, forward distance f and lateral distance l from the camera words (`0x28b0a/0e`) and heading vectors (`0x1d614`, `0x1d5e4`), column = 0xa0 + l * 0xa0 / ((f * 0x93cd) >> 16), distance = sqrt(f^2 + l^2) * VIEW[column] >> 14 (rounded with 0x1fa0), drawn only for 0x50 <= distance <= 0x462, size class = min(9, (distance - 0x7c) / 0x46), bottom row = word at `obj2+0xbd00 + 2 * distance` (obj1+0x16351 .. obj1+0x164d8, view.object-projection, view.row-table). The shot's world position is used as is: a shot is drawn standing on the ground at its x, y, bottom at the ground row of its distance; nothing lifts it.
* The object pass `obj1+0x15a78` (the static .SPW objects at `obj2+0x13938`, which the brief names) has the same projection, row table and draw-record layout but picks its size-class table by the object's sprite: the set index is the word at `obj2+0x129a4 + 0x28 * sprite id` (catalogue word +0xc), the picture table is `[obj2+0xe470 + 0x50 * set + 4 * class]` (obj1+0x15c43 .. obj1+0x15c67), and its record's `+0x1c` carries the object record's word `+2` (obj1+0x15dce .. obj1+0x15dde); the racer draw `obj1+0x155d4` uses set 0, `[obj2+0xe470 + 4 * class]` (obj1+0x157a6), and set 3 for the jumping second car (obj1+0x15858). Shots do not choose: they always use set 5, below. Which set each catalogue sprite uses was not tabulated (section 15).
* The size-class pictures of the shots come from the dword table at `obj2+0xe600 + 4 * class` (obj1+0x164e1), the sixth of six size tables `obj2+0xe470 + 0x50 j + 4 class`. The tables are loaded by `obj1+0x18038` from six WACKY.DAT members in this order (name strings at `obj2+0x1bf4`, `+0x1c00`, `+0x1c0c`, `+0x1c18`, `+0x1c24`, `+0x1c30`, copied to the name slots `obj2+0x1d8b8 + 0x16 j` at obj1+0x23842 .. obj1+0x238d8): `38X28.INF`, `28X28.INF`, `14X28.INF`, `32X24.INF`, `15X13.INF`, `18X13.INF`; each member is ten tables of (word width, word height, then (height + 1) * width dwords) read in turn (obj1+0x1808b .. obj1+0x18159, obj1+0x180e2 stores the table pointer at `obj2+0xe470 + ebp + 4 di`, ebp = 0x50 j). The set `j = 5` (`obj2+0xe600`) is `18X13.INF`. Parsing that member of the user's archive with this layout gives the ten (width, height) pairs (18, 13), (17, 12), (15, 11), (14, 10), (12, 9), (11, 8), (9, 7), (8, 6), (6, 5), (5, 4) for the size classes 0 to 9 (the layout fills 4900 of the member's 4992 bytes; the dword 0x1324 = 4900 stored next to that name at obj1+0x238ce is the size reserved for it, and the sizes stored for the other five names, 0x519c, 0x3c28, 0x1e38, 0x3a70, 0xffc, equal the member sizes 20892, 15400, 7736, 14960, 4092 of the user's archive, obj1+0x2384c .. obj1+0x238ac). So the shot pictures are 18 x 13 at full size.
* The draw record queued per shot (obj1+0x16603 .. obj1+0x1667b): `+0` width, `+2` height, `+4` column, `+6` top row, `+8` pointer into the table after (width, height), `+0xc` the source frame address = `r.+0x1a + r.+0xe * r.+0x12` (frame index times 0xea, obj1+0x1665e .. obj1+0x1667b), `+0x10` the projected distance, `+0x14` skip bytes, `+0x1a` the size class, `+0x18 = 0xffff`, `+0x24 = 0xffff`, `+0x1c = 0`; the list count `obj2+0x28b78` is incremented. The record is then sorted farthest first with the objects and racers and blitted column by column with index 0 transparent (view.draw-order, sp.draw; the blit `obj1+0x27487` steps the source with the per-pixel dword offsets of the table, obj1+0x2750e .. obj1+0x27529).
* So the picture of a shot is the HOGMIS.SP frame at `r.+0x1a + 0xea * r.+0xe`, scaled to the size class. HOGMIS.SP (6084 bytes, read to `obj2+0x1d748`, obj1+0x3b30 .. obj1+0x3b4f) is carved into 0xea-byte (18 x 13) frames at obj1+0x3d60 .. obj1+0x3dc4:

| offset in HOGMIS.SP | pointer | frames | used by |
|---|---|---|---|
| 0x0000 | `[0x1d748]` | 3 | the explosion of any ending shot (obj1+0x161d3) |
| 0x02be | `[0x1d740]` | 3 | the counter's hedgehog shot, sel 0 (obj1+0x14535) |
| 0x057c | `[0x1d73c]` | 1 | the item-3 fan (obj1+0x14581) |
| 0x0666 | `[0x1d738]` | 1 | item 4, type 1 (obj1+0x14660) |
| 0x0750 | `[0x1d734]` | 1 | item 5, type 2 (obj1+0x146ae) |
| 0x083a | `[0x1d730]` | 1 | item 6, type 3 (obj1+0x146fc) |
| 0x0924 | `[0x1d72c]` | 1 | item 7, type 4 (obj1+0x1474a) |
| 0x0a0e, 0x0db6, 0x115e | `[0x1d724]`, `[0x1d720]`, `[0x1d71c]` | 4 each | not the shots: the rear wheels of the player's car, 18 x 13 drawn twice at the car (obj1+0x14b14 .. obj1+0x14bc2) |
| 0x1506 | `[0x1d728]` | 3 | the ice shot, sel 8 (obj1+0x14783) |

  The offsets are the running sums of the `add eax,..` steps (0x2be, 0x2be, 0xea x 5, 0x3a8 x 3, then 0x2be to the file end 0x17c4). The frame counts of the shots are the `obj2+0x28bc0` values of the table in section 2.2 (3 for the hog and ice, 1 for the fan, devils and mines).
* No other `.SP` member is referenced by the fire, spawn, move, update, shot-test or shot-draw code: SPARK.SP, EFFECTS.SP, PUF.SP, the H*.SP object sprites and AJ.SP do not appear in any of them (negative finding: the routines obj1+0x14364, obj1+0x1d548, obj1+0x15e6c, obj1+0x1602c, obj1+0x118a4, obj1+0x12230, obj1+0x1632c were read in full, 2026-10-04; HOGMIS.SP is the only sprite file whose buffer pointers they use).

## 9. What a shot or mine does to a human player (the shot owner's own car, or the second human)

Reached when the racer index is a human (section 6) and the racer's car word `+0x7e` is 0 (a crashed car only consumes the record, obj1+0x11b87 .. obj1+0x11b9a):

* With `obj2+0x28be2` non-zero and type 0, 1 or 2: the human is wrecked outright: sound 0xd, racer `+0x56`, `+0x58`, `+0x5c` = 0, `+2 = 2`, car `+0x7e = 1`, car `+0x44`, `+0x20`, `+0x3c`, `+0x18`, `+0x42` = 0 (obj1+0x11ba0 .. obj1+0x11c65). (Single-player play never has `obj2+0x28be2` set; what the mode is was not established.)
* Type 4 ("inverted hog"): car `+0x14 = 1` and `+0x8a = now` unless `+0x14` is already 1; no sound (obj1+0x11d86 .. obj1+0x11db0). The steering routine then swaps the left and right steering flags `obj2+0x28b8c` and `0x28b98` (obj1+0x1934a .. obj1+0x1937d). The flag is cleared by the race start (obj1+0x1d518) and by the split-screen branch of the frame loop when `now - car.+0x8a >= 0x12c` (300 ticks) (obj1+0x1fbd6 .. obj1+0x1fc1d; that branch is entered only when `obj2+0x28be2` or `obj2+0x28bdc` is non-zero, obj1+0x1fb86 .. obj1+0x1fb9e, and no other clear of `+0x14` exists in the code: grep `+0x14],0x0` and the absolute `0x8424` over obj1.asm, 2026-10-04). So in a one-player race an inverted flag set by one's own type-4 mine (the only way to get it there) is not cleared until the next race start (read from code, not run).
* Type 5 (ice) (with `obj2+0x28be2` and `obj2+0x1ec74` both 0): the racer `+0x58 = 2`, `+0x4c = now`, sound 0x19 if not playing, as for a computer racer (obj1+0x11c74 .. obj1+0x11cb9); the human then does not move (the steering routine returns at once while the racer's `+0x58` is non-zero, obj1+0x124fe .. obj1+0x12506), its input is cleared (section 1.4) and the hit handler flips 2/3 and clears the word after 50 ticks like for a computer racer (the AI loop's first test, `+0x58 != 0` -> handler, is applied to every racer index including 0 and 1, obj1+0x18cdb .. obj1+0x18ce9). Reachable only with two humans: a human's own ice cannot hit him (section 6.4).
* Types 0, 1, 2, 3 (and 6) (the spin-out): sound 0x11 (unconditional), `obj1+0xc90` is called with the racer's `+0x26`, car `+0x1a = 7`, `+0x3c = 0`, `+0x20 = 1`, `+0x1e = 0`, `+0x18 = 1`, `+0x4e = obj2+0x1b448 + 8 * 7 + 4 * idx`, `+0x32 = now` (obj1+0x11cbe .. obj1+0x11d81). The steering routine then runs the spin: it zeroes the steering words `obj2+0x28b90/92` each tick (obj1+0x1258b .. obj1+0x12595), and on every tick with `now - car.+0x32 >= 1` it stores `now` in `+0x32`, takes `car.+0x1a` down by one and sets `obj2+0x28b92` to `obj2+0x28c54` (= 0x78, obj1+0x6d00; car.move-step subtracts `obj2+0x28b92` from the heading, so the car turns 0x78 a tick, 8 x 0x78 = 0x3c0 = half a turn); when `+0x1a` goes below 0 (the 8th tick) `+0x1e = 1`, `+0x20 = 0`, `+0x22 = 0`, `+0x24 = 0`, the steering words 0 and the throttle `+0x42 = 0` (obj1+0x12574 .. obj1+0x1260e). The car speed word `+0x26` is also reduced each tick by the fraction `+0x36` / 65536 of itself (obj1+0x12680 .. obj1+0x1269c). So a bomb or oil touching a human spins him for 8 ticks, turns him half a circle and stops his throttle; both are the same code.
* A mine (type 2, 3 or 4) is tested every tick against all racers, the owner included: a mine dropped 10 behind the car is within the 17 of the owner, so he is immune until he has been 18 or more away from it (section 6.4, obj1+0x119d9 .. obj1+0x11a08); if he drives back to it afterwards it hits him (types 2 and 3 spin him, type 4 inverts his steering). A one-player human is hit only by his own records, since computer racers never fire.

## 10. The effects of the held item, and its HUD icon

* The held word is only used by the fire routine (selector), the pickup (set), the hold grant (set to 8), the HUD icon and the race start/reset (sections 2 to 4); nothing else in the object pass or the steering routine reads it (grep of `0x8426` and `+0x16]` over obj1.asm, 2026-10-04: the readers of the held word are the HUD icon obj1+0xe0f, obj1+0xe19; the pickup obj1+0x1325a, obj1+0x132a8; the fire routine obj1+0x1442a, obj1+0x1449e, obj1+0x144c5, obj1+0x147eb, obj1+0x147f8; the save at obj1+0x2002d; the other `+0x16` hits are racer positions and the shot step).
* HUD icon `obj1+0xdd8` (called each frame before the page flip, obj1+0x1fc3b): for the two players, when the per-player draw word `obj2+0x1eb80 + 2 k` is non-zero and the car word `+0x16` (`obj2+0x8426 + 0x104 k`) is non-zero, it takes the picture pointer `[obj2+0x1c0a4 + 4 * held]` (obj1+0xe05 .. obj1+0xe27), sets x = 0x125 (293), y = 0xb2 (178), width 0x1a (26), height 0x15 (21) (obj1+0xddb .. obj1+0xdf6; for the second player y is lowered by `obj2+0x1ed30`, obj1+0xe2c .. obj1+0xe37) and blits it (obj1+0xe3e, sp.draw). The table is carved from the ICONS.SP buffer `[obj2+0x1ea88]` (read at obj1+0x3c18 .. obj1+0x3c37): `[0x1c0b0]` (index 3) = its start, then +0x222 (546 = 26 x 21) for each of `[0x1c0b4]` (4), `[0x1c0b8]` (5), `[0x1c0bc]` (6), `[0x1c0c0]` (7), `[0x1c0c4]` (8) (obj1+0x3cd4 .. obj1+0x3d15). So the held word k from 3 to 8 shows ICONS.SP frame k - 3 of 26 x 21 pixels at (293, 178); the icon has no effect on the game (matches pickup.kinds-observed for k = 3).
* The counter `car+0x6a` is drawn as two digits (leading "0" for a single digit) of 10 x 9 pixels at x = 0xb5 (181), y = 0xb (11), second digit 10 to the right; for the second player y is lowered by `obj2+0x1ed30`; with the word `obj2+0x28bde` non-zero at (0x9a, 0x64) instead; the glyph pointers are `[obj2+0xe380 + 4 * ascii code]` (obj1+0x1af82 .. obj1+0x1b056). It is read only; no gameplay effect (obj1+0x1afc5).

## 11. Sounds passed to `obj1+0x1c04` / `obj1+0x1bbc` by this system

| number | where | when |
|---|---|---|
| 0x14 | obj1+0x147c4 (esi from obj1+0x1455f, obj1+0x147b0) | the counter's hedgehog shot and the ice shot (played unless playing) |
| 0x13 | obj1+0x147c4 (obj1+0x145f0) | the fan |
| 0x17 | obj1+0x147c4 (obj1+0x14609, obj1+0x14693, obj1+0x146e1, obj1+0x1472f) | devils and the three mines |
| 0x1a | obj1+0x14809 .. obj1+0x14822 | fire pressed with no item and no count (played unless playing) |
| word `obj2+0x28b96` | obj1+0x1443a (hold grant), obj1+0x13283 (a pickup of kind 2 to 7) | unconditional; the driver's number 0 to 7 (set from the driver word `obj2+0x28c6a` at several sites, e.g. obj1+0x26d2, obj1+0x7da6; not traced) |
| 0x12 | obj1+0x16188 .. obj1+0x16193 | any shot ending (explosion), unconditional |
| 0x11 | obj1+0x11b00 | a shot or mine hits a computer racer (types 0 to 4), unconditional, not in modem mode |
| 0x11 | obj1+0x11cf3 | a human is spun out (unconditional); the steering routine also plays it for its button-3 brake (obj1+0x1956a, unless playing) and its button-4 move (obj1+0x1972b), unrelated |
| 0x19 | obj1+0x11b6f, obj1+0x11cab; obj1+0x18a39 .. obj1+0x18a8a | ice hit (played unless playing); the state-2 sound of the freeze loop |
| 0x18 | obj1+0x18a40 .. obj1+0x18a8c | the state-3 sound of the freeze loop |
| 0x0d | obj1+0x11bc0, obj1+0x18ab4 | wrecked (the `obj2+0x28be2` mode, the modem time-out) |
| 0x16 | obj1+0x132f2 | the tyre pickup |
| 0x0c | obj1+0x1d88c, obj1+0x1d90c | the TURBO and JUMP chords |

Which sample each number plays (the table at `obj2+0x1a9c8`, 0x18-byte records, obj1+0x1c4f .. obj1+0x1c96) was not traced.

## 12. Numbers in one place

| quantity | value | citation |
|---|---|---|
| records in the shot list | 61 x 0x22 bytes at `obj2+0x1f2b0` | obj1+0x1d556 .. obj1+0x1d616 |
| frames a hold must last | 0x14 = 20 ticks | obj1+0x14414 |
| ice item word | 8 | obj1+0x1444b |
| counter cap | 0x63 (99), a count of 4 per pickup | obj1+0x132bb .. obj1+0x132cb |
| shot distance limit | 0x3e8 (1000) | obj1+0x1d595 |
| spawn step | 0xa; 0x10 for type 1 and 6 | obj1+0x1d567 .. obj1+0x1d57d |
| step after the first update (types 0, 5) | 0x64 | obj1+0x160bc |
| lane offsets of the fan | -0x1e, 0, +0x1e of 0x780 | obj1+0x15ed1, obj1+0x15ee9 .. obj1+0x15ef1 |
| devils' side turn | +-0x1e0; bounce +0x3c0 | obj1+0x1461f, obj1+0x1463b, obj1+0x160fa |
| mines' heading | H +- 0x3c0 | obj1+0x14693 .. obj1+0x146a8 |
| object touch radius for shots | Manhattan < 0xe | obj1+0x11931 |
| racer touch radius for shots | Manhattan < 0x12 | obj1+0x119ce |
| computer stun | 0x21 (state 1), 0x32 (states 2/3), 4 in modem mode | obj1+0x189fc .. obj1+0x18a11 |
| spin-out length | 8 ticks (7 down to -1) | obj1+0x11d16, obj1+0x125c3 .. obj1+0x125d3 |
| inverted-steering time | 0x12c, split-screen branch only | obj1+0x1fc15 |
| animation counter limit for the explosion | 3 frames | obj1+0x161c7 |
| frame bytes | 0xea = 18 x 13 | obj1+0x1d5f0, obj1+0x14b89 .. obj1+0x14b92 |

## 13. Agreement with the PROVEN observations

* item.fire-observed: three records, offsets 0, +2, -2 at the start, 100 a state, drift 10 per 100, travel 10, 110, ..., 1010 against the limit 1000, flag 3, nothing spawned by the second press: sections 2.2, 4.2, 5.1, 5.2, 5.3 (the second press hits the empty click, obj1+0x14809).
* item.shots-observed: devils two records of type 1 at +-32, step 16, turning at the road sides; mines one record of type 2, 3, 4, 10 behind, never moving, heading 1440: sections 2.2, 4.2, 5.1, 5.2.
* item.hedgehog-observed: one record 20 ahead, travel 10 then +100, stops 13 before the tyre stack, counter spent, no ice within 17 ticks: sections 2.1, 2.3, 4.2, 5.2, 6.
* item.mine-hit-observed and item.mine-types-observed: hit word 1 for 33 ticks, racer stood still, record gone 3 ticks later, collision word 3 for that call: sections 6, 7.
* item.racer-hit-observed: shots stop at distance 17, hit words 1 (fan, counter) and 2 (item 8) lasting 33 and 50 ticks with 2/3 switching, fire ignored before the green light, item 8 at tick 55: sections 1.4, 2.3, 6, 7.
* pickup.kinds-observed and the HUD icon: section 3 and section 10.

## 14. Where this read differs from docs/leads/pickups.md

* Types 2, 3, 4 do not "keep rolling": the move routine makes them stationary after the spawn step (obj1+0x15f07 .. obj1+0x15f32), as item.shots-observed shows. (pickups.md section 3 says they roll until they hit something.)
* The fan's block `[0x1d73c]` is one frame, not three, and the ice block `[0x1d728]` is three frames, not four; `[0x1d724]`, `[0x1d720]`, `[0x1d71c]` are the car's rear-wheel frames, not weapon pictures (section 8).
* `obj2+0x1e574` is the shareware-release flag set by the probe of the members `42.GAM` and `20.GAM` (section 2.3); pickups.md left it open.
* `car+0xe0` has a source: the command-line words TURBO, JUMP, HOG, ICE, FIRE (section 2.5); pickups.md left it open.
* The unit of `obj2+0x1ec64` is one pass of the race frame loop (section 0); pickups.md left it open.
* The 300-tick clear of the inverted flag is only in the split-screen/two-human branch (section 9); pickups.md section 4 states it unconditionally.
* "0x28bc0 = 3" is the frame count stored in the record (`+0x10`), not an in-flight flag; the in-flight word is `racer+0x12` (section 5.3).
* The hold-fire grant also replaces a held item 3 to 7 and is not blocked by an empty counter (section 2.3).
* The 0x1ed24 / 0x1ed40 / obj1+0x3780 sequence is the DOPE.SP and BELCH.VOC easter egg, not the ice item (section 2.3).

## 15. Uncertain / not read

* What the sound numbers play: the sound table behind `obj1+0x1c04` (`obj2+0x1a9c8`, 0x18-byte records, and the 0x1bbc/0x1c04 bodies beyond the first lines) was not traced; `obj1+0xc90` / `obj1+0xc50` (called with the racer's `+0x26` on a spin-out and for car-to-car contact) were read only as far as "starts a voice sample".
* What writes the key-state bytes of the table at `obj2+0x1b6d8` (the keyboard handler) was not located, and so "button 2 is Ctrl" is taken from the brief, not from the code here. The second player's key mapping (obj1+0x211cd .. obj1+0x21203) was not followed.
* The meaning of `obj2+0x28c3c` (clears the player's input, obj1+0x1d7c6), `obj2+0x28be2` (set to 1 at obj1+0x1017a), `obj2+0x28bdc`, `obj2+0x28bde`, `obj2+0x28be0`, `obj2+0x1ec74` (taken as the modem flag from the lead), `obj2+0x1edb0`, `obj2+0x1d998` (demo/record mode) beyond what they gate here was not established.
* The modem-mode branch of the racer hit (obj1+0x11ab2 .. obj1+0x11aee, words `racer+0x64/+0x66`, sound 0xff) was not decoded, nor was the human wreck-in-`obj2+0x28be2` mode beyond the instructions listed.
* The word array `racer+0x38 + 2k` was read only as the per-viewer picture index (racer.frames); the value copied into `racer+0x5a` at a hit is that word for the viewer `obj2+0x28b7e` (0 during the shot update).
* The set of scaled pictures used by each catalogue sprite (the word at `obj2+0x129a4 + 0x28 * id` for the 36 catalogue entries) was not tabulated, only the shots' set 5 and the racers' set 0 were identified.
* The visibility routine `obj1+0x14a08`, the terrain lookup behind `obj1+0x27b04` (read only as far as "class into `obj2+0x1e568`") and the delta tables inside the `*.INF` members (only the ten width/height pairs were parsed) were not read; the shape of a scaled picture beyond its width and height is unchecked, and no pixel of a shot was compared with a frame.
* Whether `car+0x6a` and `car+0x16` persist from one race to the next in a one-player championship was not established (they are zeroed at a new game, obj1+0xe59b, and in the multi-human or modem modes at the race start, obj1+0x20252; a save/restore of both into `obj2+0x17540 ..` at obj1+0x20020 .. obj1+0x2006a was seen but not followed).
* The F1 to F6 taunt code at obj1+0x1d70e .. obj1+0x1d7ba and the steering chords' effect on cars beyond the lines cited were read only for their interaction with the fire word.
* The wall-clock length of a tick (pace set by the wait at obj1+0x21108 .. obj1+0x21122 against `obj2+0x1ea5c`) was not computed.
* No run-time check of any statement in sections 2.3 (the shareware gate), 5.2 (frame index 1 on the first drawn frame), 7 item 5 (picture rotation of a hit racer), 9 (inverted flag staying set in one-player races, spin length 8, half-turn) and 10 (the counter's position) was made; they are read from the instructions only.
