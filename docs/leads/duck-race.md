<!-- WF: output of a subagent's read of analysis/ww/obj1.asm, obj1.bin, obj2.bin, fixups.json and the user's WACKY.DAT on 2026-10-05; a lead, not evidence. Nothing was run in the game. Citations are obj1 instruction offsets (the first column of obj1.asm) and obj2 data offsets; no `npm run cite` fingerprints were produced. -->

# WACKY DUCK SHOOT: how the duck race differs from a normal race (WF lead, 2026-10-05)

## 0. Conventions and method

* `obj1+0xN` = code offset (first column of `analysis/ww/obj1.asm`), `[0xN]` / `obj2+0xN` = data offset. "Frame" = one pass of the race frame loop (`[0x1ec64]` counts them); default frame = 12/136 s = 88.2 ms (`[0x1ea5c] = [0x1ed08] = 0xc`, obj1+0x6d5b; `tick.rate`). "Tick word" = `[0x1e71c]`, the 10 Hz counter (claims `port.*` timer text, `hud.timer-observed`).
* **Completeness of the site list.** The relocation records (`analysis/ww/fixups.json`, entries with targetObject 2, target 0x1ec74) list exactly **69** absolute references to the duck flag, all in obj1, all at operand offsets = (instruction offset + 2) of the 69 instructions that `awk '/\[0x1ec74\]/'` on obj1.asm finds; section 3 lists every one. Same technique, 2026-10-05, for the other words: `[0x1ec6c]` 7 refs, `[0x1ec70]` 6, `[0x1eca4]` 3, `[0x1edb4]` 11, `[0x1ec88]` 2, `[0x1ec84]` 3, `[0x1eda4]` 4, `[0x1ec90]` 6 (see 2.2). Indirect (register-computed) accesses are not covered by relocations.
* Routine starts below are the nearest call targets (a few routines are entered by jumps only). Records: racer n = 0x68 bytes at obj2+0xaa90 + 0x68 n; car n = 0x104 bytes at obj2+0x8410 + 0x104 n (24 of each are initialised, obj1+0x20255 to +0x20384 and obj1+0x6fb8 to +0x708d). Existing docs used: `docs/leads/racer-states.md`, `fire-items.md`, `hud.md`, `race-sound.md`, `prerace-screens.md`, claims `racer.init`, `route.placement`, `route.placement-observed` (record `start-3`, the only observation of a duck race), `ai.step-rules`, `tick.rate`.
* I rendered DIGGER.SP, GENEF.SP and the LAP.SP panels from the user's WACKY.DAT into the scratchpad with the `a_f3.pcx` palette (zone 1 = track 16 uses tileset `f3.pcx`, read from 16.GAM) to see what the sprites are. Those are visual observations of archive bytes, not of the running game.

## 1. Summary (what a duck game is)

* The ducks are **the ordinary computer racer records 1..7** (racer 0 is the human). The duck flag `[0x1ec74]` (dword, 1 only between obj1+0x10422 and +0x10590) switches the racer code to a different regime: no laps, no places, no start countdown, no start grid, no catch-up AI, no wrecks. All seven racers run the same state (state 2) at one fixed speed along the zone track's `.RD` route (14 route points a frame), each 260 route points behind the previous one. They never leave their route and never react to the player.
* Their pictures are the **first 16 frames of DIGGER.SP** written over the CARS.SP slots of two drivers other than the player's: frames 0..7 = a white duck on a kart (compass views), frames 8..15 = the same duck with an aviator helmet and goggles. Two slot words: A = plain duck (`[0x1ec70]`), B = helmeted duck (`[0x1ec6c]`).
* The player shoots with the normal fire routine (hedgehog shots; ammo = the car's hedgehog counter, `+0x6a`, which starts at 0 and is filled by hog crates, +4 each). A shot that hits a duck stuns it for 4 frames; then it explodes (BOOM, four GENEF explosion frames), the score `[0x1edb4]` goes up by 1 (plain duck) or 2 (helmeted duck, which needs two hits) and the duck vanishes. When all seven are gone the convoy is placed again at a random point of the route with one more helmeted duck (`[0x1eca4]` rounds).
* The race is timed: `[0x1ec88] = 0x4b0` = 1200 tenths of a second = 2 minutes counted **down** (HUD `02:00:0` at (264,112)); at 0 the frame loop leaves through the duck end screen (`obj1+0x1b5e8`, eax = 1) with the score compared against the 4-entry WACKY.DTT table.
* HUD: top-left panel (38 x 41 at (17,6)) holding a 19 x 14 helmeted-duck head at (26,14) and the two score digits at (26,32) and (36,32); top-middle label (61 x 19 at (146,6), a hedgehog and "x") with the two ammo digits at (181,11) and (191,11); timer at (264,112); driver name at (4,50). No speedometer, place digit, lap text, minimap, reaction figure, pill or lives label.

## 2. The mode flags and the flow that sets them

### 2.1 The flow `obj1+0x1037c` (inside the main menu routine `obj1+0xf858`; menu item 4)

In order (obj1+0x1037c to +0x105b4; read in full):

1. Clears `[0x28be2]`, `[0x28bdc]`; `[0x1ea58] = 2` (VEL2.TAB, see 4.4); saves engine word `[0x1ee5a]` in `[0x1eca8]` and sets it to 2 (the "6 hp" engine); `[0x28bce] = 1`; `[0x28c96] = 6` (zone word default); clears `[0x28c58]`, `[0x28b9e]`, `[0x28b4a]`; decodes the menu background (`call 0x275cd`); clears `[0x84e0]`, `[0x85e4]` (the two shoot-out score dwords); **`[0x1ec74] = 1` at obj1+0x10422, `[0x1ec90] = 1` at obj1+0x1042c** (obj1+0x1037c to +0x10436).
2. `call 0xa2f8; call 0xa380` (vehicle screen and menus, section 4.1), then `call 0x227e0` (obj1+0x10490: loads DIGGER.SP into two CARS slots, section 5.1).
3. Loop at obj1+0x10495: `[0x28b9e] = 0; call 0x93a8` (zone chooser: sets `[0x28c96]` to 6..11 for zones 1..6; it prints the shareware "THESE EXTRA ZONES" notice and uses SBCS.PCX / BSBCS.PCX, obj1+0x93a8 to +0x9500) ; when not escaped: `[0x28c90] = [0x28c96] - 6` (song slot, obj1+0x104ad to +0x104b6), `[0x28b88] = [0x28c96]` (obj1+0x104bc to +0x104c2), `call 0x7928` (loading card, 4.2), `[0x28bce] = 1`, `[0x28bcc] = 0`, **`[0x1ecd0] = 1; call 0x1fd8c; [0x1ecd0] = 0`** (the race, obj1+0x104f3 to +0x10502), `call 0x1adc` (stop all sounds), jump back to obj1+0x10495. So after a game the zone chooser comes back; Escape in it (obj1+0x104a3) leaves.
4. Leave (obj1+0x10513 to +0x105b4): reload the menu picture, `call 0x228d4` (rebuilds the CARS slot records, undoing the DIGGER frames), `[0x28bb6] = 1`, `[0x28b88] = 1`, `call 0x25718`, **`[0x1ec74] = 0` at obj1+0x10590**, engine word restored from `[0x1eca8]`, `[0x1ec90] = 0` (obj1+0x105a5), `jmp 0xf878` (the main menu).

### 2.2 The other flag words

| word | what the code does with it | cite |
| --- | --- | --- |
| `[0x1ec74]` | the duck flag (the existing leads call it "linked / modem / network"; that label is wrong, see 9). Reset to 0 at: main menu entry (obj1+0xf92a), single-player entry (obj1+0xfb29), the attract/demo setup (obj1+0xe4d8, ebx = 0), obj1+0xe7c5, the start-up reset obj1+0x25d61. | section 3 |
| `[0x1ec90]` | **write-only**: set 1 at obj1+0x1042c, cleared at obj1+0xe4de, +0xe7cf, +0xf934, +0xfb33, +0x105a5; the six relocations are exactly those six writes, so no direct read exists in obj1 (2026-10-05). Meaning unknown. | fixups.json |
| `[0x28bb2]` class | forced to 4 for the duck (and the shoot-out): the class menu `obj1+0x9eac` takes eax = `[0x28be2]`, else `[0x1ec74]` (obj1+0x9eb1 to +0x9ec6) and a non-zero value skips the menu (`jnz 0xa107`, obj1+0x9f61) and stores 4 (obj1+0xa107). Record `start-3` shows the level word `[0x28b84]` = 84 (class 4 level, `obj1+0x9db8`). In a duck race nothing consumes the class beyond that: the level 84 and `[0x1ece0]` = 20 only feed the catch-up helper, which returns at once (obj1+0x18b3b), and the class-4 tests of the race routine (obj1+0x1fe01, +0x1fef7, +0x1ff85, +0x221f6) and of the object table routine (obj1+0x11429) are each bypassed by an earlier duck test (sites 53, 55, 57, 64, 25/26); the class-4 timer test of the HUD (obj1+0x1a9b3) is in the block the duck skips (48). | obj1+0x9eac to +0xa110 |
| `[0x28bce]` | `[0x28bce] = 1` is set by the duck flow, but its only reader is the song-name shuffle at obj1+0x23349 (a 1 -> 2 -> 3 cycle for the five regular songs), which the duck skips (obj1+0x22e7f jumps to the separate list). So no in-race effect. | obj1+0x22e68, +0x23349 |
| `[0x28c44]` | race mode word: **2 from the first frame** (4.3). | obj1+0x20172 |
| `[0x28c38]` | starter / countdown flag: 0 (4.3). | obj1+0x20169 |
| `[0x28ca8]` | "plain race" flag (set 1 only for a one-screen non-time-trial race): 0 in the duck (obj1+0x1fde4). Gates the start-of-race camera fly-in (obj1+0x2075d to +0x207e6) and the clock-option save. | obj1+0x1fdb3, +0x1fde4 |
| `[0x28c40]` | racer count word: 7 (4.3 and 5.5). | obj1+0x1ff00 |

## 3. Every site that tests or writes `[0x1ec74]` (69, in address order)

"cmp" means `cmp dword [0x1ec74],0`; "dupl" = what the duck does there. Section numbers point to the detail.

| # | instruction | routine (start) | duck effect |
| --- | --- | --- | --- |
| 1 | +0x1c16 | sound play `0x1c04` | sound numbers 0..7 other than the viewer's driver word `[0x28b96]` play the QUACK buffer `[0x1eaec]` (digital voices only; nothing when `[0x1ecf8]` = 0) (9.1) |
| 2 | +0x316d | static HUD `0x2f80` | draws the 19 x 14 picture `[0x1eb60]` at (26,14) (8.1) |
| 3 | +0x31b7 | `0x2f80` | skips the 65 x 19 "lives" label |
| 4 | +0x33a4 | `0x2f80` | skips the "TIME TRIAL" text (class-4 branch) |
| 5 | +0x6803 | engine menu `0x67d8` | skips the engine menu (engine already 2) |
| 6 | +0x6ce7 | class setup `0x6ca0` | turn rate `[0x28c7c] = 0x24` (also half rate 0x12 and `[0x28c54] = 0x78`), same as the shoot-out; the table copy follows `[0x1ea58]` = 2 (4.4) |
| 7 | +0x6f94 | racer.init `0x6f90` | the duck branch (5.2) |
| 8 | +0x7a11 | loading card `0x7928` | skips cutting the LAP.SP place-digit frames (obj1+0x7a1a to +0x7a69) |
| 9 | +0x7b6a | `0x7928` | skips the cup title text, takes the "LOADING ZONE" text (obj2+0x7cc) |
| 10 | +0x7ddb | `0x7928` | skips loading the cup picture (name at obj2+0x1eb6c) |
| 11 | +0x7e36 | `0x7928` | **calls `0x1b5e8` with eax = 0**: the duck intro screen (4.2) |
| 12 | +0x825c | `0x7928` tail | song slot `[0x28c90]` (zone number - 1) instead of `[0x28b88] - 1` (9.2) |
| 13 | +0x9ec6 | class menu `0x9eac` | class menu skipped, class = 4 (2.2) |
| 14 | +0xa124 | `0x9eac` | clears `[0x84e0]`, `[0x85e4]` |
| 15 | +0xa15b | laps menu `0xa148` | laps menu skipped (`[0x28b9c]` stays as it was; unused in the duck) |
| 16 | +0xbd79 | vehicle/setup `0xa380` | race-type menu called with the shoot-out/duck flag (REGULAR ZONES / BONUS PACK ZONES, obj2+0x4e4, +0x4f8; `docs/leads/prerace-screens.md` 4.1) |
| 17 | +0xbda9 | `0xa380` | skips the cup board `0x832c` |
| 18 | +0xbdea | `0xa380` | `[0x28bb6] = 3`, `[0x28b88] = [0x28c96]` (zone word): track = `[0x28b88] + 10` = 16..21, or +0x1f = 37..42 with the bonus pack (jump table at obj1+0x7910; GOLDM/BONUSG names) |
| 19 | +0xe4d8 | attract/demo `0xe2e4` | store of 0 (reset) |
| 20 | +0xe7c5 | `0xe760` | store of 0 (reset) |
| 21 | +0xf92a | main menu `0xf858` | store of 0 (reset on entering the menu) |
| 22 | +0xfb29 | `0xf858` single-player entry | store of 0 |
| 23 | +0x10422 | `0xf858` duck flow | **store of 1** (2.1) |
| 24 | +0x10590 | `0xf858` duck flow | store of 0 (2.1) |
| 25 | +0x113f5 | object table prep `0x113f0` | read into ecx (see 26) |
| 26 | +0x1147d | `0x113f0` | writes ecx back unchanged; in between: objects whose catalogue kind is above 2 get the sprite id `[0x1eda4]` (6.2) |
| 27 | +0x11a89 | shot hit `0x118a4` | shot type 5 (ice) is treated as type 0 |
| 28 | +0x11ab2 | `0x118a4` | the duck hit branch: sound 0xff, slot test, hit points (5.3) |
| 29 | +0x11af7 | `0x118a4` | no SKID sound 0x11 on an effective hit |
| 30 | +0x12986 | steering `0x124ec` | `allow` stays 0: no slide / drift / hop start at full throttle (7.1) |
| 31 | +0x12dff | object pass `0x12bf4` | the driver-voice branch of the near-racer trigger is the short one (9.1) |
| 32 | +0x12eda | `0x12bf4` | the blink phase `+0x28` is **not** started (picture frames 8..11 never used) |
| 33 | +0x12f6c | `0x12bf4` | the PASS-glance sound branch is the short one, without the voice-limiter calls (9.1) |
| 34 | +0x1338a | `0x12bf4` | no head-on wreck on map obstacles (kind 0) |
| 35 | +0x134c0 | `0x12bf4` | no head-on wreck on a racer entry (the contact falls to the bump, 7.2) |
| 36 | +0x135c9 | `0x12bf4` | after a wreck: no crack / camera state `[0x28c42] = 1` (never reached in the duck) |
| 37 | +0x154ca | sort and blit `0x153d8` | **flicker** of a duck with hit points 0 (5.3) |
| 38 | +0x16a77 | player car draw `0x16a3c` | wreck-picture path of the multi-human modes (not reachable, no wreck in the duck) |
| 39 | +0x188fe | compass frame `0x187ec` | blink flag `+0x30` set for racers 1.. when the frame word is 0, 2, 4 or 6 (9.1) |
| 40 | +0x18a08 | stun routine `0x189ec` | stun limit 4 frames |
| 41 | +0x18aab | `0x189ec` | at the end of the stun: BOOM, crash state, score (5.4) |
| 42 | +0x18b3b | catch-up helper `0x18b20` | returns at once |
| 43 | +0x18cf1 | racer step loop `0x18cac` | a racer with `+2` = 2 is skipped (crashed ducks stand still) |
| 44 | +0x18e52 | `0x18cac` | no "push" between racers |
| 45 | +0x194f9 | player control `0x190a0` | no DOPE.SP / BELCH.VOC easter egg |
| 46 | +0x19647 | `0x190a0` | throttle rises by 6 a frame instead of 10 |
| 47 | +0x19e52 | lap/continue screen `0x19e0c` | skipped |
| 48 | +0x1a95e | HUD `0x1a92c` | clears the local "show place digit and normal timer" word (8.2) |
| 49 | +0x1a9e9 | `0x1a92c` | the duck block: countdown timer and score digits (8.2) |
| 50 | +0x1ad4e | `0x1a92c` | speedometer skipped |
| 51 | +0x1b06a | `0x1a92c` | pill, lap banner and reaction figure skipped (`jnz 0x1b265`, the return) |
| 52 | +0x1fb78 | frame draw `0x1f794` | calls the round check `0x6eac` once per drawn frame |
| 53 | +0x1fde4 | race `0x1fd8c` | `[0x28ca8]` not set to 1 |
| 54 | +0x1fe3b | `0x1fd8c` | minimap flag `[0x28ca0]` cleared |
| 55 | +0x1ff00 | `0x1fd8c` | racer count `[0x28c40] = 7` (after the class-4 value 0 at +0x1fef7) |
| 56 | +0x1ff1c | `0x1fd8c` | starts the zone song now (obj1+0x1ff25 to +0x1ff57) |
| 57 | +0x1ff6a | `0x1fd8c` | skips the block that stores the "last race settings" at obj2+0x174e8 on |
| 58 | +0x20143 | `0x1fd8c` | `[0x28c38] = 0`, `[0x28c44] = 2` at once: no starter, no countdown |
| 59 | +0x20267 | `0x1fd8c` | clears car `+0x6a` (hog counter) and car `+0x16` (held item) of all 24 cars (obj1+0x2026f to +0x20283) |
| 60 | +0x20bac | `0x1fd8c` | heading `[0x1d5d4] = 0x1e0` |
| 61 | +0x20cb6 | `0x1fd8c` | skips the start-grid code for the racers (grid values, VEL.TAB speed lookup, surface slow-down, obj1+0x20cc3 to +0x20d9b) |
| 62 | +0x20f38 | `0x1fd8c` | skips the plain-race song start |
| 63 | +0x21e6b | `0x1fd8c` post-finish | skips the time-trial hall of fame call `0x1e4b8` |
| 64 | +0x221ce | pause menu in `0x1fd8c` | menu strings " BACK TO ZONE" / " LEAVE ZONE" (obj2+0x1a94, +0x1aa8) |
| 65 | +0x222a7 | pause menu | item count `[0x28b72] = 2` |
| 66 | +0x22567 | pause menu | no life (`car+0x6c`) decrement |
| 67 | +0x22792 | frame loop | **skips the progress / lap / ranking routine `0x2b44`** |
| 68 | +0x22e7f | song-name builder `0x22e60` | takes the separate six-song list (9.2) |
| 69 | +0x25d61 | start-up `0x25ca4` | initial store of 0 |

## 4. The race: set-up, loop and end

### 4.1 Pre-race screens (differences only)

* Vehicle screen `0xa380`: only the driver choice is asked; the class menu (13), the laps menu (15), the engine menu (5) are skipped; the race-type menu is the zones variant (16); no cup board (17). Class becomes 4, `[0x28bb6] = 3`, `[0x28b88] = [0x28c96]` (18). `call 0xbe3c` (the random driver permutation of 9.3 in `racer-states.md`) is **not** called by the duck flow (it is in the single-player and shoot-out flows only, obj1+0xffee, +0x102c9); the duck needs no permutation because the racers' slots are set by `0xbf00` (5.1).
* Zone chooser `0x93a8` (obj1+0x1049e): zone 1..6 = `[0x28c96]` 6..11, `[0x28c90]` = zone - 1 = the song slot.

### 4.2 Loading card `0x7928` and the intro screen

* Single-screen set-up: `[0x28be2]` = `[0x28bdc]` = 0 so `[0x28bde] = 0`, `[0x1ed30] = 0`, player slot flags `[0x1eb80] = 1`, `[0x1eb82] = 0` (obj1+0x79e2 to +0x79fe).
* The card text is "LOADING ZONE" (obj2+0x7cc, copied at obj1+0x7d2d to +0x7d39, drawn by the banner `0x1a414`); then `0x179e8`, the track load `0x1754c`, the driver file load `0x73c4` for the player only.
* Intro screen `obj1+0x1b5e8` with eax = 0 (called at obj1+0x7e41): background ORDER.PCX (obj2+0x1624, loaded at the top), the texts "THE WACKY DUCK SHOOT" (obj2+0x1658), "YOU HAVE TWO MINUTES TO" (+0x1670, centred at y = 0x1e), "BLAST AS MANY DUCKS AS YOU CAN!" (+0x1688, y = 0x28), the two duck pictures (slot A frame at `record+0x1c` -> frame 7 at (0x4c, 0x3c) and slot B frame at `record+4` -> frame 1 at (0xcd, 0x3c), 38 x 28, transparent blit; obj1+0x1b912 to +0x1b97a) and the top-4 table under the heading "THE WACKY DUCK TOP SHOOTERS" (obj2+0x16a8, WFONT1 text at y = 0x6e via `0x46d4`; each entry is its name (obj2+0xe768 + 0x18 k) followed by the score dword at +0x14 as text, one OFONT line centred (8 x length) at y = 0x82 + 10 k, k = 0..3; obj1+0x1b9c9 to +0x1bac8). The routine returns right after drawing when eax = 0 (obj1+0x1bace to +0x1bad6). (Read from the code; not observed.)

### 4.3 Race load differences in `0x1fd8c` (obj1+0x1fd8c to +0x20f13)

* Timer and score constants: `[0x1ec88] = 0x4b0` (obj1+0x1fd95, set by every race, used only by the duck HUD), `[0x1e71c] = 0`, `[0x1ec84] = 0` (end flag), `[0x28ca8] = 0`, **`[0x1edb4] = 0`** (the score, obj1+0x1fdbc), `[0x1ed20] = [0x1ed1c] = 0x440`. These run once per call of the routine; the pause-menu restart paths jump to obj1+0x2006a, past them (the duck pause menu has no restart, 4.4).
* No countdown or starter: `[0x28c38] = 0` (the starter lion `0x166a8` is called only when it is non-zero, obj1+0x208c7, +0x1fa09), `[0x28c44] = 2` (racing mode: fire/steering/AI step all enabled, `obj1+0x1d6d0` does not clear the buttons) (obj1+0x20143 to +0x20172). The first frame already runs the AI step and the timer (obj1+0x2100d zeroes the tick word right before the loop head obj1+0x21021).
* The camera starts at the human's record (obj1+0x20521 to +0x2058f) and the heading is 0x1e0 (obj1+0x20bac); the fly-in at obj1+0x2075d is skipped (`[0x28ca8]` = 0).
* Racer count 7 (obj1+0x1ff09). Minimap off (`[0x28ca0] = 0`, obj1+0x1fe44). Music: the zone song starts at obj1+0x1ff25 to +0x1ff57 (`obj1+0x1834`, loop flag 1) and the plain-race start at obj1+0x20f45 is skipped.
* Cars (all 24 records, obj1+0x20255 to +0x20384): `+0x6a` and `+0x16` are cleared in the duck (and shoot-out / two-player): **hog counter 0 and nothing held at the start**; in a plain one-player race they are left alone. `[0x1ecb0] = 7` (obj1+0x2038a), `[0x1eca4] = 0` (the round index, obj1+0x20394), `call 0x9db8` (level 84), `call 0x6f90` (racer.init, 5.2).
* The loop at obj1+0x207ef to +0x2083c sets car `+0x6a = 0x63` for the cars whose ability byte `+0xe0` has a bit of 0x4, 0x8 or 0x10 (command-line words HOG, ICE, FIRE, `fire-items.md` 2.5): with such a word the duck player starts with 99 hogs. Not duck-specific; stated because the duck otherwise starts with 0.
* The post-load "start grid" block (grid values `+0x24`, VEL.TAB lookup of `+8/+0xa`, surface slowdown by `car+0x36`, obj1+0x20cc3 to +0x20d9b) is skipped, so the racer speed words are those written by racer.init (5.2).

### 4.4 The frame loop in the duck

Loop head obj1+0x21021. Differences from `racer-states.md` section 1:

* **Logic group** (obj1+0x22593 to +0x227a5): input gate `0x1d6d0`, car step `0x190a0` (throttle +6, no slide, no easter egg), fire `0x14364`, the racer step `0x18cac` (mode 2, obj1+0x22783 to +0x2278d), then **no call to `0x2b44`** (obj1+0x22792): no progress keys, no lap count, no ranking, no place, no finishing order. Then the shot update `0x1602c`. Car word `+0xb2` (laps) therefore stays 0 and the finish test (obj1+0x21609: `+0xb2 == laps + 1`) can never fire; `[0x28c3c]` (finish flag) stays 0. The pause menu's lives code and the lap/continue screen `0x19e0c` are skipped (47, 66).
* **Draw group** `0x1f794` (called at obj1+0x210c0 each frame): compass frames `0x187ec`, racer drawing `0x155d4`, player car `0x16a3c`, shots `0x1632c`, sort and blit `0x153d8`, HUD `0x1a92c` (obj1+0x1fb6e), anim counters `0x161fc` (obj1+0x1fb73), then **`call 0x6eac` (the round check, obj1+0x1fb78 to +0x1fb81)**.
* Pause (Esc, obj1+0x22121 to +0x22163 when the page word is 0x3e80): the tick word is saved in ebp (obj1+0x22189) and restored (obj1+0x225a7), so paused time does not count against the 2 minutes. Menu: " BACK TO ZONE" / " LEAVE ZONE" only (item count 2, obj1+0x222f2; the third string " RESTART RACE" at obj2+0x1abc is copied but not offered). Choice 2 leaves the race routine at once (obj1+0x2253d to +0x22541, jump to obj1+0x227aa) **without the end screen or the score table**.
* VEL table: the flow set `[0x1ea58] = 2`, so `0x6ca0` copies the table at obj2+0x1e584 into `[0x1e730..]` (obj1+0x6d18 to +0x6d3b); the user's `VEL2.TAB` word 50 is 14 and word 100 is 28.

## 5. The ducks

### 5.1 What they are, how many, which pictures

* **Racer records 1..7** (`[0x28c40]` = 7). Never more than 7 (5.5). Racer 0 is the human; racers 8..23 are cleared and unused.
* **Pictures: DIGGER.SP** (name obj2+0x1acc, 17024 bytes = 16 frames of 38 x 28 = 0x428). `obj1+0x227e0` (called only at obj1+0x10490), with p = `[0x28b96]` (the player's driver): A = lowest driver number not equal to p (obj1+0x227e5 to +0x22804, stored in `[0x1ec70]` at obj1+0x2283f); B = lowest number equal to neither p nor A (obj1+0x2280b to +0x22815, stored in `[0x1ec6c]`). The first 0x2140 bytes of DIGGER.SP (frames 0..7) are read into CARS.SP's slot A (buffer `[0x1d708]` + A x 0x31e0), the next 0x2140 (frames 8..15, a second read on the open file with no seek) into slot B, and the first eight frame pointers of each 0x98-byte slot record (obj2+0x13c08 + 0x98 slot) are rewritten (obj1+0x22822 to +0x228c3). I rendered the archive's DIGGER.SP: **frames 0..7 = white duck on a red-wheeled kart, front, three-quarter and side, back, ...; frames 8..15 = the same duck with a brown aviator helmet and goggles**. So slot A = plain duck, slot B = helmeted duck. The slot's frames 8..11 keep CARS.SP's blink pictures but are never used in the duck (32).
* **Which racers are which** (`obj1+0xbf00`, called at the end of racer.init, obj1+0x7098): `n = min([0x1eca4] + 1, 0x15)`; racers 1..n get `+0x26` (slot word) = `[0x1ec6c]` (B), the rest of 1..7 get `[0x1ec70]` (A); every racer 1..7 gets `+0x64` (hit points) = 1 (obj1+0xbf04 to +0x71). Round 0: racer 1 is helmeted and racers 2..7 plain; round r: racers 1..r+1 helmeted; from round 6 all seven.
* The compass frame of a duck is the usual `racer.frames` word (`+0x38`), so the seven ducks are seen from the camera as 8 views of their slot; the draw routine's size classes, clip and distance range are those of `racer-states.md` 2.1.

### 5.2 Spawn: racer.init duck branch `obj1+0x6f90` (claims `racer.init`, `route.placement`)

* Gate obj1+0x6f94 (`[0x1ec74]` != 0). For all 24 racer records: state `+4 = 2` (obj1+0x6fc5), `+0x62`, `+0x54`, `+0x56`, `+0x12`, `+0x5c`, `+0x58`, `+0` cleared; for racers 0..7: x `+0x16` and y `+0x18` from the start tables obj2+0x1d7cc / +0x1d7e0 (the .GAM coordinate pairs; the human's record gets its own pair, racer 0, but its x/y are overwritten by the car walk every frame), `+0x1c = 0`, `+0x1a = [0x12356]` (first route record's compass word); for all: `+0x28/+0x2a/+0x30/+0x32`, `+2`, `+0x20/+0x22/+0x24` cleared and **`+8` (speed) = the word `[0x1e794]`** = entry 50 of the copied VEL table = **14** with VEL2.TAB (obj1+0x7066, +0x7082). Observed in `start-3`: every racer's `+4` = 2, `+8` = 14. Then `call 0x6f24` (placement driver) and `call 0xbf00`.
* Placement driver `obj1+0x6f24`: **`[0x28c40] = [0x1ecb0]` (= 7, written only at obj1+0x2038a)** (obj1+0x6f29 to +0x6f34), seeds the library LCG with max(tick word, `[0x28b7a]`) and draws a route entry index 0..`[0x28b7a]` (the last entry index; 49 for track 16) (obj1+0x6f3a to +0x6f69), then `0x6d68` for racers 1..count with 0x104 steps: racer 1 gets the cursor of the drawn entry (pointer `+0x5e`, count `+0x10`, entry `+0x1c`, compass `+0x1a`), racers n >= 2 copy racer n-1's cursor and walk **0x104 = 260 route points further along the route** (obj1+0x6dad to +0x6e96). So the ducks form a convoy 260 points apart on one randomly chosen part of the route, racer 7 furthest ahead. Positions come from the **.RD route** of the zone track only; the **.SPW objects are not used for ducks**. Racer 1's x/y are not set by the placement (the eax <= 1 branch, obj1+0x6d73 to +0x6da8); they come from the first AI step. (`route.placement-observed` took `start-3` about 5 s after the start; at 14 points a frame and 11.3 frames a second the racers would have moved about 800 points by then, which may explain why racer 1 was seen at point 77 of entry 17 rather than at an entry start; not checked.)
* The same code runs again every round (5.5).

### 5.3 Movement and hit points

* Step loop `0x18cac` (mode word 2): a racer with `+0x58` != 0 goes to the stun routine; with `[0x1ec74]` != 0 a racer with `+2 == 2` is skipped (obj1+0x18cf1 to +0x18d08); otherwise the four-state machine (jump table obj1+0x18c9c: 0x18d5b, 0x18d80, 0x18d98, 0x18db0). A duck is always in **state 2** (`+4 = 2`), whose handler sets the step count N = `+8` = 14 (obj1+0x18d98 to +0x18da9) and calls the helper `0x18b20`, which returns at once in the duck (42); state 2 has no counter and never changes, so the ducks never change state. The lateral word `+0` is 0, so there is no offset. The walk (obj1+0x18eff to +0x18f84) takes N route points a frame: x/y from the route array at `+0x5e`, `+0x10` counts the points left in the entry, at 0 the next entry is loaded (wrapping after `[0x28b7a]`) and `+0x1a` takes its compass word. **Not random; pure route following at a fixed 14 points a frame**, the same for all ducks (158.7 points/s at the default frame period; the track-16 route has about 9300 points). There is no avoidance, no push between ducks (44), no reaction to the player or to shots, no rubber band.
* The racer-versus-human contact inside the walk (obj1+0x18fa9 to +0x19024) is the normal one (7.2).
* Hit points: `+0x64` (set 1 by `0xbf00`) and the flicker flag `+0x66`.

**The shot hit routine `0x118a4`** (called from the shot walkers; Manhattan distance below 0x12 = 18 between the shot point `[0x1d7a4]/[0x1d7a8]` and the racer's x/y, obj1+0x119a7 to +0x119d4; not hit while `+2 == 2` (skipped, the shot passes), car `+0xa` != 0, or the owner rules of `racer-states.md` 3.1). For a "computer racer" (any index other than 0 here, obj1+0x11a6e to +0x11a75), type 5 (ice) is replaced by type 0 in the duck (obj1+0x11a89 to +0x11a98), then:

1. obj1+0x11a15 to +0x11a1f: a racer with `+0x58` != 0 (already stunned) absorbs the shot with no effect and no sound; the shot ends (result word `[0x28bae] = 3`, obj1+0x11db6).
2. Duck branch (obj1+0x11ab2 to +0x11aee): `edx = 1`; **sound 0xff** (the play routine maps 0xff to sound 3, PEGGLES.VOC, and, being above 7, bypasses the quack substitution, obj1+0x1c1f, +0x1c40 to +0x1c47), unconditional. Then: if the racer's slot word `+0x26` equals `[0x1ec6c]` (a helmeted duck): `+0x66 = 1`, `+0x64` is decremented and the hit counts only when `+0x64 < 0` (`edx = 1`), else `edx = 0`. A plain duck (slot A) always counts. So **a helmeted duck needs two hits** (hit points 1 -> 0 absorbed -> -1 effective), a plain duck one.
3. `edx != 0` (obj1+0x11aee to +0x11b35): no SKID sound (29); `+0x58 = 1` (stunned), `+0x5a` = the racer's current frame word, `+0x4c` = the frame counter; shot result 3. The shot's x/y are set to the racer's beforehand (obj1+0x11a30 to +0x11a42).
4. Absorbed first hit of a helmeted duck (`edx = 0`): the shot is consumed with the PEGGLES sound and the duck starts to **flicker**: in the sort-and-blit routine a racer record (draw record type `+0x24` > 0) with `+0x64 == 0` is skipped on every second draw (`+0x66` toggles 1 / 0, the blit `0x27487` is skipped when ecx = 1; obj1+0x154ca to +0x15516, +0x15580 to +0x15585).

### 5.4 The stun, the explosion and the score `obj1+0x189ec`

Called from the step loop instead of the walk for a racer with `+0x58` != 0 (obj1+0x18ce0 to +0x18ce7):

* Limit = 4 frames in the duck (obj1+0x189ec to +0x18a11; 0x21 / 0x32 otherwise). The stun picture: `+0x5a` goes up 1 a frame and wraps after 7 (obj1+0x162ab to +0x162bd), so for 4 frames the duck shows 4 consecutive compass frames of its own slot (spinning). The ice-sound code is skipped (limit != 0x32). The duck does not move while stunned.
* When `[0x1ec64] - (+0x4c) >= 4` (obj1+0x18a91 to +0x18aa5): `+0x58 = 0`; then (duck): **sound 0xd (BOOM.VOC)**, unconditional (obj1+0x18ab4 to +0x18ab9); `+0x56 = 0`, `+0x58 = 0`, `+0x5c = 0`, **`+2 = 2`** (crash state) (obj1+0x18ac3 to +0x18ad5); **score `[0x1edb4]` += 2 when the slot word `+0x26` equals `[0x1ec6c]` (helmeted), else += 1; capped at 0x63 = 99** (obj1+0x18adb to +0x18aff). So the point is counted 4 frames after the killing shot, not at the shot.
* **Explosion**: while `+2 == 2` the draw routine shows `obj2+0x1c7f0 + 4 x (+0x56)` (`racer-states.md` 2.1): the four 38 x 28 GENEF.SP frames at GENEF offsets 7641, 8705, 9769, 10833 (my render: a fire-and-smoke cloud that thins out). `+0x56` goes up one a frame for racers 1..7 while `+0x56 <= 3` (obj1+0x16288 to +0x162a5; the loop covers racers 0..7 only, `cmp cx,8` at obj1+0x162f4, which is enough because the count never exceeds 7, 5.5); at `+0x56 > 3` the duck is no longer drawn (obj1+0x157bb to +0x157c0). So four explosion frames of one frame each (about 0.35 s) and then it is gone; the crashed record keeps `+2 == 2`, does not walk (43), can no longer be hit (obj1+0x11985) and does not collide.
* The "+2 = 1" contact write of the walk (obj1+0x19005 to +0x1900a) cannot reach a crashed duck because it does not walk.

### 5.5 Rounds: re-placement `obj1+0x6eac`

* Each drawn frame (obj1+0x1fb78 to +0x1fb81): counts the racers 1..count with `+2 == 2` and `+0x56 == 4` (obj1+0x6ec5 to +0x6ed9). If fewer than all: nothing. If all (obj1+0x6eec): `count += 2`, `[0x1eca4] += 1` (one more helmeted duck next round), `count = min(count, 0x12)` stored in `[0x28c40]`, then `call 0x6f90` (obj1+0x6ef0 to +0x6f12).
* **Net effect on the count: none.** `0x6f90` calls the placement driver `0x6f24`, which overwrites `[0x28c40]` with `[0x1ecb0]` = 7 (obj1+0x6f29 to +0x6f34; the only other writer of `[0x28c40]` in the duck is `0xbf00` writing back the value it read, obj1+0x6f71), so the "+2, at most 0x12" of `racer-states.md` 3.5 is dead code in effect: the seven ducks come back every round (this removes the worry that racers 8..17 would be stuck on explosion frame 0). Reading only; a live check would be a pause in round 2 with `[0x28c40]` read.
* All 24 racer records are re-initialised (including the human's racer record: x/y, hit state `+0x58`, crash picture `+0x56`), the convoy is placed at a new random route entry, helmeted ducks = round + 1. The score, the timer and the player's car are untouched. Maximum per round: round 0: 2 + 6 = 8 points; round r: 2 (r + 1) + (6 - r) = r + 8 points, up to 14 from round 6 (all helmeted); total capped at 99.

## 6. The player's weapon, ammo and pickups

### 6.1 The fire routine is the normal one

`obj1+0x14364` (`fire-items.md` section 2) has no duck test. With the car's hog counter `+0x6a` > 0 and nothing held (`+0x16 == 0`), one press fires one hedgehog shot (type 0, sprite block `[0x1d740]`, 3 frames, sound 0x14 HOG.VOC), costs one count; the shot walks along the owner's heading for 0x3e8 units and ends on wall, object or racer. With counter 0 and nothing held the press plays sound 0x1a (NO) and does nothing (obj1+0x14809 to +0x14822). One volley at a time (`racer[0].+0x12`), no auto-repeat. So **the player does not have unlimited hogs**: the counter starts at 0 (4.3) and is filled by pickups.

### 6.2 Where the ammo comes from: the object table is rewritten (`obj1+0x113f0`, called twice at obj1+0x201b6)

* Sprite loader `obj1+0x11310`: for each catalogue sprite present in the zone's `.SPW` it loads the `.SP`; the first catalogue id (ascending) of kind 2 (the "hedgehog counter" pickup) that is present is remembered in `[0x1eda4]` (obj1+0x11319, +0x1139d to +0x113b0).
* `obj1+0x113f0` (the 12-byte object table at obj2+0x13938): **in the duck every object whose catalogue kind (the word at obj2+0x12998 + 0x28 id) is above 2, i.e. the item pickups kinds 3..7, gets the sprite id `[0x1eda4]`** (obj1+0x1144a to +0x1146a), so all held-item pickups become hog crates. (In a class-4 time trial the same routine sets word `+2 = -1` for all objects of kind >= 2 instead, obj1+0x11429 to +0x11445, which the duck bypasses.)
* From the user's archive: in zone 1 (track 16) there are 38 objects: 16 of kind 2 (H2.SP x1, H4.SP, H7.SP, H8.SP, H10.SP, H25.SP x11), 16 of kinds 3..7 (H1 kind 3 x2, H12 kind 5 x5, H15 kind 4 x3, H16 kind 6 x4, H20 kind 7 x2) and 6 obstacles (OB3 x5, OB6). Here `[0x1eda4]` = 1 (H2.SP), so the duck arena has 32 hog crates. I computed the same for all twelve duck tracks (16..21 and 37..42): each has 8..18 kind-2 objects and a kind-2 sprite, first ids 1 or 2.
* Pickup: the object pass (obj1+0x1324d to +0x132cb) for kind 2: refused when the counter is already >= 0x63; otherwise the driver's own voice is played (sound `[0x28b96]`, unconditional), the object's `+2 = 0xffff`, **counter += 4, capped at 99**. Not duck-specific.

### 6.3 Held items and the "ice" grant

* No kind 3..7 pickup exists in the duck (6.2), so nothing is held at the start (the clear at obj1+0x2027c to +0x20283) except by the hold rule: **holding fire for 20 frames sets `car+0x16 = 8`** (obj1+0x14400 to +0x1444b; only when `[0x1e574] == 0`, i.e. a registered archive such as the user's, `fire-items.md` 2.3). Item 8 fires one type-5 shot (3-frame ice picture `[0x1d728]`, sound 0x14) and is used up instead of a count. In the duck a type-5 shot is handled as type 0 when it hits a racer (27), so **holding fire for 20 frames (1.76 s) gives one free shot**. This is the only ammo-free fire. Not tested in the running game.
* The command-line words HOG / ICE / FIRE give `+0x6a = 99` at race load (4.3).

### 6.4 Contact between player and ducks

* Nothing in a duck damages the player and nothing hurts a duck by contact. A duck within Manhattan 14 of the car point (`[0xaaa6]/[0xaaa8]`) sets the duck's `+2 = 1` and car `+0x7c = 1` (obj1+0x19005 to +0x19010, only when car `+0xa == 0`, `+0x7e == 0`, `[0x28c3c] == 0`); the player's own walk does the same (`car.collision-test`, obj1+0x11866 to +0x1188b). `+2` is cleared to 0 every frame (obj1+0x162c5 to +0x162cc).
* The object pass then runs the **bump** (obj1+0x1369f to +0x13772): car `+0x3c`, `+0x20` cleared with throttle `+0x42`; sound `0x16` (SWIPE) for a racer; spark animation; the contact routine `0x1d3fc` turns the camera by 0x12 and changes the throttle by +-0x28 depending on the zone (`racer-states.md` 5.4). The **head-on wreck** (`+0x7e = 1`, sound 0xd, car stops) is disabled by tests 34, 35 (the racer test: `eax` forced 0 at obj1+0x134c0 to +0x134d2); a wreck of the player cannot happen in the duck (its only duck-reachable source, the shoot-out wreck at obj1+0x11bc0, needs `[0x28be2]`).
* Ducks fire nothing (no caller of the spawner outside the human fire routine, `racer-states.md` 3.6).

## 7. Player car and rules that change

### 7.1 Car

* Throttle: +6 a frame while accelerating instead of +10 (obj1+0x19647 to +0x19650), cap 0x64; steering rates R = 0x24 (36) per step, half rate 0x12 (obj1+0x6ce7 to +0x6d12); speed words from VEL2.TAB (word 100 = 28).
* `allow = 0` in the steering routine (obj1+0x12986 to +0x12998): no powerslide / drift / hop at full throttle (`player-anim.md` 16.4 step 4: "return when allow == 0"). The hop chords (`JUMP` ability) and boost chord are unchanged.
* No DOPE / BELCH easter egg (45). No lives code (66, 47). The car's draw is the normal one (38 is unreachable).

### 7.2 Rules that are off

| rule | how it is off | cite |
| --- | --- | --- |
| laps, place, finishing order, banners, cup points | the progress routine `0x2b44` is never called (frame loop) | obj1+0x22792 |
| place digit, lap text, FINISHED / LAST LAP, speedometer | not drawn | obj1+0x1a95e, +0x1ad4e, +0x1b06a |
| start countdown, starter lion, START sound, camera fly-in | `[0x28c38] = 0`, `[0x28c44] = 2`, `[0x28ca8] = 0` | obj1+0x20143, +0x1fde4 |
| computer-racer catch-up and push | helper returns, push gated | obj1+0x18b3b, +0x18e52 |
| head-on wreck, obstacle wreck | gated | obj1+0x1338a, +0x134c0 |
| minimap | `[0x28ca0] = 0` | obj1+0x1fe3b |
| saved "last race settings" | skipped | obj1+0x1ff6a |

## 8. HUD

All coordinates are pixels, x then y, from the instruction operands; sprite sizes from the operand words (`[0x28b36]` columns, `[0x28b26]` rows). Blits: `0x26fd0` transparent, `0x273ee` opaque. Not compared with a screen.

### 8.1 Static part, drawn once into both pages by `obj1+0x2f80` (called from obj1+0x367a, the pre-race frame set-up routine `0x33d8`, which the race load calls at obj1+0x2083e)

| item | position / size | source | cite |
| --- | --- | --- | --- |
| driver name text (the driver `[0x28b96]`; OFONT 8 x 8 via `0x48f4`, mode 0) | (4, 0x32 = 50) | name table obj2+0x1d228 + 0xc x driver | obj1+0x30cd to +0x3135 |
| panel 38 x 41 | (0x11 = 17, 6) | LAP.SP at 0x377c (`hud.md` correction), pointer `[0x1d83c]` | obj1+0x313a to +0x3168 |
| **duck icon 19 x 14** | **(0x1a = 26, 0xe = 14)**, transparent | **`[0x1eb60]` = the last 266 bytes of GENEF.SP (offset 14426 = 14692 - 19 x 14)**: my render is the helmeted duck's head (goggles, helmet) | obj1+0x3176 to +0x31a4; offsets from the cut code obj1+0x4073 to +0x411e |
| "lives" label 65 x 19 | not drawn in the duck | | test 3 |
| **hog label 61 x 19** | **(0x92 = 146, 6)** | LAP.SP at 0x4265, pointer `[0x1d810]`: my render shows a hedgehog, a yellow "x" and an empty two-digit slot | obj1+0x333e to +0x336c |
| "TIME TRIAL" text at (0xe8, 6) | not drawn in the duck (class 4 path) | obj2+0x28c | test 4 |
| minimap panel | not drawn (`[0x28ca0] = 0`) | | obj1+0x2f9e |

### 8.2 Per frame, `obj1+0x1a92c` (called at obj1+0x1fb6e and obj1+0x208ed)

* The local word `[esp+0x2c]` ("normal timer and place digit") is 0 when `[0x28be2]` != 0, `[0x1d998]` is neither 0 nor 3, or `[0x1ec74]` != 0 (obj1+0x1a942 to +0x1a967). With 0 the normal timer block (obj1+0x1a97a to +0x1a9e4) and the place digit block (obj1+0x1aebd, +0x1aec2) are skipped.
* **Duck block** (obj1+0x1a9e9 to +0x1aab1):
  * `remaining = [0x1ec88] - [0x1e71c]` (1200 tenths minus the tick word); if `remaining <= 0` then `[0x1ec84] = 1` and `remaining = 0` (obj1+0x1a9f6 to +0x1aa13). Formatted by `0x1a618` as `MM:SS:T` (so 02:00:0 at the start) and drawn by `0x1a6f8` at **(0x108 = 264, 0x70 = 112)** with the 7 x 9 GENEF glyphs, advance 7 (obj1+0x1aa19 to +0x1aa28). Drawn **whatever the CLOCK DISPLAY option `[0x175d2]`** says (the normal block tests it).
  * **Score digits**: `[0x1edb4]` formatted with the library itoa `0x325f9` (base 10, a one-character result padded with `'0'`), two 10 x 9 LAP.SP digit glyphs from the ASCII table obj2+0xe380 (`'0'` at 0xe440), **opaque** blits at **(0x1a = 26, 0x20 = 32) and (0x24 = 36, 32)** (obj1+0x1aa2d to +0x1aab1). That is "00" at the start, inside the 38 x 41 panel under the duck icon.
* The ammo counter block (obj1+0x1af64 to +0x1b049, shown when `[0x1d998]` is 0 or 3, not duck-gated): the word car `+0x6a` (obj2+0x847a) as two 10 x 9 opaque LAP.SP glyphs at **(0xb5 = 181, 0xb = 11) and (191, 11)**, inside the 61 x 19 hog label: "x 00" at the start in the duck (the counter is 0, 4.3), +4 per hog crate, -1 per shot.
* Skipped in the duck: speedometer (obj1+0x1ad4e: also needs `[0x1ec74] == 0`), place digit, pill 80 x 17, lap banner at (4, 164), the driver-reaction figure `0x1a740` (obj1+0x1b06a jumps to the return), minimap (`[0x28ca0]` = 0).
* Held-item icon `0xdd8` (26 x 21 at (293, 178)) is the normal one: drawn only when `car+0x16` is non-zero, i.e. after the 20-frame hold (item 8, the ice frame).
* The user's brief says "top-left '00' and top-middle 'x00'": the top-left is the duck score at (26,32)/(36,32), the top-middle is the hog counter at (181,11)/(191,11). Matches 8.1 and 8.2 by the sprites.

## 9. Sounds and music

### 9.1 Table

Sound numbers are the order of the name list at obj1+0x10 (0xc-byte entries; I re-read it: 0 UNO, 1 SULTAN, 2 MORRIS, 3 PEGGLES, 4 RAZER, 5 RINGO, 6 BLOMBO, 7 TIGI, 8 PASS, 9 BELL, 0xa START, 0xb GLASS, 0xc WARP, 0xd BOOM, 0xe HORN, 0xf SPLASH, 0x10 PLIP, 0x11 SKID, 0x12 PUF, 0x13 FLAME, 0x14 HOG, 0x15 CLANG, 0x16 SWIPE, 0x17 DROP, 0x18 BACKFIRE, 0x19 STALL1, 0x1a NO).

| event | sound | cite |
| --- | --- | --- |
| a duck's near-racer trigger (size class <= 2 i.e. distance < 334, zone 3 or 1, blink flag set: the frame word is 0, 2, 4 or 6, race mode 2, racer not stunned, not crashed, human not wrecked) | **its slot number (A or B, never the player's own)** = **QUACK.VOC** (obj2+0x2a4, loaded into `[0x1eaec]` (digital voices only) by `obj1+0x36f8` at start-up, obj1+0x3a77, and again at obj1+0x100e8 when the DOPE/BELCH state word `[0x1ead8]` is non-zero; the same routine loads GIGGLES.SP into `[0x1ea90]`); played only when not already playing; no play-counter / horn logic; with `[0x1ecf8]` = 0 (speaker modes) nothing | obj1+0x12d88 to +0x12e2d, +0x12eb0, +0x1c16 to +0x1c3e, +0x3728 to +0x3741 |
| the same trigger in a normal race | the driver's voice with the limiter and horn (not in the duck), and the blink animation phase starts; both differ in the duck (test 32) | obj1+0x12e32 to +0x12eb5 |
| shot hits a duck (effective or absorbed first hit of a helmeted one) | sound 0xff = 3 = PEGGLES.VOC (real sample, not the quack: 0xff is above 7) | obj1+0x11abb to +0x11ac0 |
| duck explodes | 0xd BOOM.VOC | obj1+0x18ab4 |
| fire a shot | 0x14 HOG.VOC | `fire-items.md` 2.2 |
| fire with no ammo | 0x1a NO.VOC | obj1+0x14809 |
| pick up ammo | the player's own driver voice (number `[0x28b96]`, real sample since it is the viewer's own) | obj1+0x13283 |
| a duck passes the player's row (zone 3 or 2) | 8 PASS.VOC if not already playing, race mode 2 | obj1+0x12f6c to +0x12fa5 |
| bump into a duck | 0x16 SWIPE.VOC | obj1+0x136fc |
| hold fire 20 frames | the driver's own voice (unconditional) | obj1+0x1443a |
| effective hit on a racer in a normal race | 0x11 SKID: **not played** in the duck | test 29 |
| engine | MOTOR.VOC loop, pitch from speed (digital modes) | `race-sound.md` 5.1 |

Quack buffer fact: QUACK.VOC 3642 bytes, 11111 Hz (`race-sound.md` 5.4).

### 9.2 Music

The duck uses the separate six-song list (BANSHI, KARD, TURBO, BRICWALL, STARBRAI, FLIGHT per `race-sound.md` 6.3 item 2; I re-read only the selection): slot `[0x28c90]` = zone - 1 (stored at obj1+0x104b6; the song file name is looked up at obj2+0x1c530 + 0xe x slot, obj1+0x8265 to +0x827d) and started at race load (test 56). The end screen plays `[0x1c64c]` when a score enters the table (obj1+0x1b692 to +0x1b6c1), the zone chooser `[0x1c658]`.

## 10. End of the game and the score table

* End condition: the frame loop tests `[0x1ec84]` right after the page flip (obj1+0x21124): when set and the page word is 0x3e80 it does `call 0x1adc` (stop sounds), **`call 0x1b5e8` with eax = 1**, then leaves the race routine (obj1+0x21124 to +0x21147). `[0x1ec84]` is set only by the HUD routine when `[0x1ec88] - [0x1e71c] <= 0` (obj1+0x1aa09), i.e. when the tick word reaches 1200 (2 minutes of game time; 10 Hz). There is no other exit except the pause menu's LEAVE (4.4).
* The end screen (obj1+0x1b5e8 to +0x1bbd5, skimmed): background ORDER.PCX; compares `[0x1edb4]` with the score dwords at obj2+0xe768 + 0x18 k + 0x14 (4 entries, `score.insert` claim, obj1+0x1b664 to +0x1b7f6); a new entry asks for a name through `0xcb44` (title "DUCK SHOOT HALL OF FAME" obj2+0x1630, up to 15 characters) and inserts it (the table is kept falling); shows "YOUR DUCK SCORE" (obj2+0x1648) with the score as two big LAP.SP 22 x 29 digits at (0x8a, 0x3c) (`0x1b558`, table obj2+0xe350), then the four entries. The zone chooser follows.
* Per round the maximum score is 8, 9, 10, ... 14 (5.5); WACKY.DTT's shipped scores are 16, 12, 8, 6 (claim `dtt.layout`).

## 11. Corrections and cross-links for the existing leads

1. **`[0x1ec74]` is the duck flag, not a "linked / modem / network" flag.** `race-sound.md` (rows 1.1, 5.4, 124, 142, 197, 225, 227), `pickups.md` 5 / 6, `fire-items.md` 2.1 item 4 / 7, `effects.md` 43, `player-anim.md` 204 and `hud.md` 61 / 95 call it that or leave it open. All 69 sites are in this report (section 3); the "modem" reading is not supported: the only code that sets it is the duck flow (obj1+0x10422).
2. `racer-states.md` 3.5 / 9.1 "the count goes up by 2 (at most 0x12)": the net count stays 7 because `0x6f24` rewrites `[0x28c40]` from `[0x1ecb0]` (5.5). The helmeted-duck count rises instead (`[0x1eca4] + 1` racers take slot B, `0xbf00`).
3. `racer-states.md` 3.5 "Racers whose slot equals obj2+0x1ec6c have +0x64 = 1": `+0x64` = 1 is set for **all** racers 1..7 (obj1+0xbf36 / +0xbf5b); only slot-B racers use it (obj1+0x11ace).
4. `racer-states.md` 2.3 and 9.4 (DIGGER) are confirmed; DIGGER frames 0..7 = plain duck (slot A), 8..15 = helmeted duck (slot B) by the archive bytes.
5. `hud.md` 5 "19 x 14 sprite `[0x1eb60]` ... probably a small icon": it is the helmeted-duck head (last 266 bytes of GENEF.SP). Timer: "the `[0x1ec74]` mode (the timed mode with start 0x4b0)" = the duck's 2-minute countdown; the two-digit `[0x1edb4]` value at (26,32)/(36,32) = the score.
6. `fire-items.md` 3 / `racer-states.md` 3.1 (type 5 treated as type 0 in the shoot-out or duck) confirmed at obj1+0x11a89.
7. `prerace-screens.md` 3 item 1 ("Clears ... `+0x1ec74`, `+0x1ec90`") is the single-player entry; the duck flow sets both (obj1+0x10422, +0x1042c).

## 12. Not determined / needs a live check

* Meaning of `[0x1ec90]` (only written; relocations show no direct reader). Possibly read through a computed pointer or by a loader, not found.
* Any observation of a duck game after `start-3`: the 4-frame stun, the score steps (1 / 2), the flicker, the round re-placement, the end at 02:00:0, the exact HUD pixels. All of 5.3 to 5.5, 8 and 10 are reading only. Suggested records (DOSBox bridge, `npm run observe`): the words `[0x1edb4]`, `[0x1eca4]`, `[0x28c40]`, `[0x1e71c]`, `[0x1ec84]` and racers 1..7 `+2/+0x26/+0x56/+0x58/+0x64/+0x66` over a round; the displayed page for the HUD digits.
* Whether the hog crates really replace the item pickups on screen (6.2 is code + archive reading); the ice-by-hold shot in the duck; whether `[0x1e574]` is 0 in the observed build (the user's archive has 42.GAM and 20.GAM, so the ice grant is on there).
* Racer 1's initial x/y (placement does not set them; the first AI step does) and the placement's exact route points; `route.placement-observed` leaves this open.
* The route loop closure of the zone tracks and whether the 260-point convoy ever overlaps the player's start; the arena geometry (walls: a shot ends on terrain 3, obj1+0x118c5 to +0x118cc).
* The zone chooser `0x93a8`, the vehicle screen's duck branch beyond sites 13..18, and the end screen `0x1b5e8` were skimmed, not read in full. The title/loading-card picture of the duck zone (`0x7928` after test 11) and `0x1bbd8` / `0x1bff0` (other end screens) were not read.
* The song names of the six-song list (taken from `race-sound.md`, not re-read); the loader at obj1+0x8237 to +0x82bd was not read again.
* What a "frame" is in wall-clock time in the duck when `/1 /2 /3` command-line words change `[0x1ed08]` (6 or 0 frames of delay); default 12.
