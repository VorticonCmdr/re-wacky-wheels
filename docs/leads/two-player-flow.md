# Survey: TWO PLAYER RACE and TWO PLAYER SHOOT OUT (WW.EXE, static disassembly)

Status of everything below: WF lead from a read-only static pass over `analysis/ww/obj1.asm`
(addresses are obj1 offsets, `[0x....]` = obj2 offset), `obj2.bin`, and the user's local
`game/WackyWhe/WACKY/WACKY.CFG`. Nothing was run live. Re-verify before tagging.
Notation: `A=0x...` is an instruction address in obj1 (first column of obj1.asm).

## 0. Corrections to the working assumptions

* `[0x28bdc]` is NOT the shoot-out flag. It is the TWO PLAYER RACE mode word:
  0 = off, 1 = "RACE HEAD TO HEAD", 2 = "RACE WITH ALL CARS". Evidence: set only at
  A=0xFA65 (main-menu item 2) and A=0xFD74 (head-to-head menu result); cleared at A=0xF947/0xFA31/0x10385.
* `[0x28be2]` is the SHOOT-OUT flag (1 only between A=0x1017A and A=0x10369). It is the flag that
  selects the "PLAYER ONE/TWO" titles together with `[0x28bdc]` (A=0xA3EC), 'LOADING ZONE'
  (A=0x7B5C -> 0x7D2D, string obj2:0x7cc), the "PLAY FOR n HITS" menu (A=0xBC63) and the zone screen.
* `[0x28bde]` = "two humans on one screen" (split-screen) flag: set to 1 at A=0x7973 whenever
  `[0x28be2]||[0x28bdc]` (non-link). Link mode copies `[0x28bd0]` instead (A=0x7986).
* `[0x28c96]` is not "number of zones". It is the zone cursor, range 6..11 (wraps 6<->11, A=0x9A9C..0x9B2D),
  initialised to 6 at A=0x10123 / A=0x103CB.
* `[0x28c24]` is not a racer count. Its references (A=0x18B26..0x1902E) are inside per-car update code; the
  item 2/3 flow code never touches it. The racer count is `[0x28c40]` (see 7.2).
* `[0x28b9e]` = ESC/abort word (confirmed). The menu routine 0x55c0 reports ESC through dword `[0x1ecc0]`;
  callers copy it to `[0x28b9e]` (e.g. A=0xBD20..0xBD29, A=0xFD4E..0xFD57).
* Input words (the caller's guesses `[0x28b44]` accelerate, `[0x28b46]` spin, `[0x28b8c]` left, `[0x28b98]` right, `[0x28b40]` brake are partly wrong):
  `[0x28b40]` = ACCELERATE (key record field 2), `[0x28b42]` = FIRE (field 3), `[0x28b44]` = BRAKE (field 4), `[0x28b46]` = HAND BRAKE TURN (field 5).
  `[0x28b8c]` = steer LEFT and `[0x28b98]` = steer RIGHT are the car-update copies of `[0x28cd5]` / `[0x28cdd]` (A=0x19330..0x19344; they are swapped when the
  racer's status word `[edx+0x14]` is set, A=0x1934A..0x1937D; `[0x28b98]` also decides the drift direction at A=0x1973E: right=2, left=1).
  `[0x28cd5]`/`[0x28cdd]` come from key record fields 0/1 (+ joystick axes + Up/Down arrows in the zone screen, see 6.6).
* Method: all "only reference", "never touched" and "not reached" statements below come from grep over operand text in `obj1.asm` (a refs.py script run on 2026-10-05);
  it misses base+index or register-computed addressing and was not cross-checked in Ghidra, so they are leads, not proof.
* Item numbering: main menu items are 1..9. Item 1 = SINGLE PLAYER RACING, 2 = TWO PLAYER RACE,
  3 = TWO PLAYER SHOOT OUT, 4 = WACKY DUCK SHOOT, 5 = COMM#BAT~ PLAY, 6 = GAME OPTIONS,
  7 = WACKY WHEELS INFO, 8 = ORDERING INFO, 9 = LEAVE GAME.
* Live observation hint: item 2 (without a saved 2P game) shows the "RACE HEAD TO HEAD / RACE WITH ALL CARS"
  menu BEFORE the 'PLAYER ONE' vehicle screen (A=0xFCAE..0xFD84). Item 3 goes straight to 'PLAYER ONE'
  (A=0x101C2..0x101FF). If the observed run went directly to 'PLAYER ONE', it was probably item 3 (or the
  head-to-head menu was dismissed quickly).

## 1. Main menu and dispatch

* Menu text is copied into 60-byte slots at obj2:0x1bc3c + 0x3c*(n-1) by A=0xF760..0xF820
  (source strings obj2:0x10b8 ' SINGLE PLAYER RACING ', 0x10d0 ' TWO PLAYER RACE ', 0x10e8 ' TWO PLAYER SHOOT OUT ',
  0x1100 ' WACKY DUCK SHOOT ', 0x1118 ' COMM#BAT~ PLAY ', 0x1130 ' GAME OPTIONS ', 0x1148 ' WACKY WHEELS INFO ',
  0x1160 ' ORDERING INFO ', 0x1178 ' LEAVE GAME ').
* Non-link menu call: A=0xFA7D `call 0xf760`, A=0xFA82..0xFA92 `eax=count(dx=9), edx=[0x28bda] (fade-in flag),
  call 0x55c0`, result `esi=ax` (1-based). Idle timeout at A=0xFA9A..0xFAAF: when `[0x1ed0c]>=0x1f4` it calls 0xe2e4(3) (probably the attract demo; not checked) and returns to A=0xF878. ESC handling of the main menu was not traced.
* Generic menu routine 0x55c0 (A=0x55C0): `eax` = number of entries, `edx` = nonzero => palette fade-in via 0x22cf8,
  `ebx`/`ecx` = mode/banner selectors; the initial highlighted entry depends on `[0x28bb0]` (menu kind:
  1 main, 2 cup, 6 class, 0xd/0xe/0x10 generic -> `[0x28c80]`, A=0x56A3..0x5733). Returns `ax` = chosen 1-based entry.
* Post-menu: A=0xFA31 `[0x28bdc]=0`; A=0xFA3A `[0x28bb8]=si` (remember last choice);
  A=0xFA41..0xFA4B non-link: `[0x1ed9c]=1`; A=0xFA55 `if esi==2: [0x28bdc]=[0x1ed9c]; esi=1`;
  A=0xFA6B `dec esi; cmp esi,8; ja`; A=0xFA75 `jmp [cs:esi*4+0xf824]`.
* Jump table obj1+0xf824 (esi after dec): idx0 -> 0xfb0e (items 1 and 2), idx2 -> 0x100f2 (item 3),
  idx3 -> 0x1037c (item 4 duck shoot), idx4 -> 0x105b9, idx5 -> 0x110ba, idx6 -> 0x10df5, idx7 -> 0x112fe,
  idx8 -> 0x6978. idx1 (0xf878) is unreachable from the menu (item 2 is remapped to esi=1 at A=0xFA55).
* So item 2 and item 1 share code at 0xFB0E; item 2 differs only by `[0x28bdc]=1` (link mode: `[0x28bdc]` is
  taken from the link menu, 1/2, see A=0xF516/0xF533 where `[0x1ed9c]` and `[0x28c22]=2` are set).
* Main-menu loop entry A=0xF878..0xF9A1: resets many words each time (`[0x28b9e]=0` A=0xF921, `[0x28be2]=0` A=0xF93E,
  `[0x28bdc]=0` A=0xF947, `[0x1ec74]=0` A=0xF92A, `[0x1ec90]=0` A=0xF934).

## 2. Word glossary (all `[0x....]` are obj2 offsets)

Mode / flow words
* `[0x28bdc]` 2P race mode 0/1/2 (see 0). `[0x28be2]` shoot-out flag. `[0x1ec74]`,`[0x1ec90]` duck shoot flags (item 4: A=0x10422/0x1042C).
* `[0x28bce]` "mode word": 0 for races (A=0xFB17), 1 for shoot-out and duck shoot (A=0x1011A, 0x102CE, 0x103C2, 0x104E1).
* `[0x28c0c]` link mode (0 = local; all local flows below assume 0). `[0x28c98]` saved-game state: 0 none/new,
  1 = restore a 1P save, 2 = restore a 2P save (A=0xFBB6/0xFBCA).
* `[0x28b7e]` current player index 0/1 (vehicle screens, help, and during the race "which racer is being processed").
* `[0x28b9e]` ESC/abort word. Also reused as slot index 1 in the restore path (A=0xFDAB..0xFEDE).

Per-player choices
* `[0x28b96]` P1 driver (0..7). `[0x28c6a]` P2 driver. `[0x28c68]` temp copy of P1's driver while P2 chooses
  (A=0xFF27 / 0x10224); this is what is crossed out and refused for P2.
* Driver indices 0..7 = NUNO, SULTAN, MORRIS, PEGGLES, RAZER, RINGO, BLOMBO, TIGI (name table obj2:0x1d228, 12-byte
  records, filled by A=0x6AAC from obj2:0x5ac/0x5b0/0x5b8/0x5c0/0x5c8/0x5d0/0x5d8/0x5e0; strings at obj2:0x5ab ff.).
* Per-racer driver roster word array `[0x10720 + 2*i]` (i = 0..7): slot0 = P1, slot1 = P2, rest filled by A=0xBE3C (6.5).

Race parameters
* `[0x28b9c]` laps: 6 / 8 / 10 (A=0xA246/0xA255/0xA2E7 and A=0xA2D8; kid mode 3 at A=0xA17A).
* `[0x28bb2]` "class": 1 AMATEUR, 2 PRO, 3 CHAMPION, 4 TIME TRIAL (also forced to 4 for shoot-out/duck, A=0xA107),
  5 = KID MODE choice (converted to 1 + `[0x1edb0]=1`, A=0xA054..0xA05D). 2P head-to-head forces 1 (A=0xA0A2).
* `[0x28bb6]` cup 1 BRONZE / 2 SILVER / 3 GOLD (cup-select screen); shoot-out forces 3 (A=0xBDF9).
* `[0x1ecb4]` bonus-pack offset: 0 regular, 3 bonus pack (set by 0x6664, A=0x67C8).
* `[0x28b88]` race number inside a cup (1..5; 5 = FINAL). In shoot-out it carries the zone cursor 6..11 (A=0x102AA, 0x104C2, 0xBDF3).
* `[0x1ee5a]` / dword `[0x1ea58]` engine: 1 = FAST 12 HP, 2 = SLOW 6 HP (menu 0x67d8; shoot-out forces 2, A=0x100F2/0x1010C and
  restores the old value from `[0x1eca8]` at A=0x1034F..0x10372).
* `[0x28c20]` graphic detail used for the race (1 HIGH / 2 MEDIUM / 3 LOW; A=0x6CA2..0x6CD4 maps it to `[0x28c7c]` 0x28/0x24/0x20).
  For both 2P modes it is loaded from `[0x174de]` = "SPLIT SCREEN DETAIL" setting (A=0xFFD8..0xFFDE for 2P race,
  A=0x101A8..0x101AE for shoot-out) and restored from `[0x28c1e]` afterwards (A=0xFEF1 / 0x100CF / 0x10183 / 0x10340).
  (`[0x174de]` is written by the option routine 0x647c, `[0x1ee58]` by 0x63fc; the GAME OPTIONS sub-menu 0x6982 lists
  SINGLE SCREEN DETAIL / SPLIT SCREEN DETAIL / LEAVE THIS MENU.)
* `[0x1eda0]` shoot-out hit target (5/10/15/20), set at A=0xBCFB..0xBD03 (`eax*5` of the menu result 1..4).
* `[0x28c40]` index of the LAST racer (racer count - 1), set at A=0x1FE96..0x1FF09 (7.2).
* Track number `[0x1e728]` is built in 0x7928 (A=0x7A6B..0x7B52): `idx=[0x28bb6]+[0x1ecb4]-1`, jump table obj1+0x7910:
  idx0 0x7a8a (+0, BRONZEM.SP), idx1 0x7ada (+5, SILVERM.SP), idx2 0x7af5 (+0x0a, GOLDM.SP), idx3 0x7b0e (+0x15, BONUSB.SP),
  idx4 0x7b24 (+0x1a, BONUSS.SP), idx5 0x7b3a (+0x1f, BONUSG.SP); track = offset + `[0x28b88]`.
  Races: 1..5 / 6..10 / 11..15, bonus 22..26 / 27..31 / 32..36. Shoot-out zones (gold, cursor 6..11): 16..21 regular,
  37..42 bonus pack (idx5, 0x1f + 6..11). Total 42 tracks (consistent with the 42-track archive).
* Hits per racer: racer struct stride 0x104, base `[0x1d5c0]`=0x8410 (P1) and 0x8514 (P2); hit counters `[0x84e0]` (P1) and
  `[0x85e4]` (P2) (= struct+0xD0), zeroed at A=0x10166/0x10170 (shoot-out entry), A=0xA12D (class menu pass) and A=0x2146D..0x21483 (after a finished match).

Input words (see section 9)
* `[0x28cd0]` last raw scancode; `[0x28cd5]`/`[0x28cdd]` steer left/right; `[0x28cec]` ESC pressed;
  `[0x28b40]` accelerate; `[0x28b42]` fire; `[0x28b44]` brake; `[0x28b46]` hand-brake turn (also "F1 pressed" in the vehicle screen);
  `[0x28cce]` Enter/Space; `[0x28ccd]` F10 (screen grab, see 9.2); `[0x28cdb]`/`[0x28cd2]` Up/Down arrow.

## 3. TWO PLAYER RACE (main-menu item 2): step by step

All addresses are obj1.

1. A=0xFB0E..0xFB61 clear/prepare: `[0x28c22]=0 [0x28bce]=0 [0x28be2]=0 [0x1ec74]=0 [0x1ec90]=0 [0x28c58]=0 [0x28bb6]=1
   [0x28b88]=1 [0x28b9e]=0 [0x28b4a]=0`. Note `[0x28bdc]` was set to 1 by the dispatcher.
2. A=0xFB6A..0xFB92: draws the picture in picbuf[0] (`[0xa978]`, malloc 0xfa00 at A=0x23B0C) via 0x275cd to video page offset 0x7d00.
   picbuf[0] holds whatever 0x17060(name,0) loaded last; on return-to-menu paths it is CHECK.PCX (A=0xFF7C `mov eax,0xe80` = 'CHECK.PCX'),
   so the vehicle/menu backdrop is very likely CHECK.PCX (inference; the initial load was not located).
3. Saved-game probe A=0xFB99..0xFBD3 (non-link only): `[0x28bdc]!=0` -> `[0x17558]` (2P slot, dword flag) nonzero => `[0x28c98]=2`.
4. If `[0x28c98]!=0`: menu 'RESTORE SAVED GAME' / 'START NEW GAME' (obj2:0x1190, 0x11a8; A=0xFBE1..0xFC35, 2 entries, kind 0xd).
   Entry 2 clears the slot (`dword [0x28c98*0x74-0x74+0x174e4]=0`, A=0xFC79..0xFC8D) and `[0x28c98]=0`. ESC is NOT tested after this menu
   (no read of `[0x1ecc0]`); ESC behaviour here is undetermined. Entry 1 (restore) -> A=0xFD89 restore path (section 3.R).
5. If no saved game (or new): A=0xFCAE..0xFD6E (only when `[0x28bdc]==1 && [0x28c0c]==0`): menu 'RACE HEAD TO HEAD' / 'RACE WITH ALL CARS'
   (obj2:0xfec, 0x1004; 2 entries; initial `[0x28c80]=1`). ESC (`[0x1ecc0]`) -> `[0x28b9e]=1` -> back to main menu (A=0xFD60 `jnz 0xf878`).
   Result stored: `[0x28bdc]=[0x28c80]` (A=0xFD6E..0xFD74) => 1 head-to-head, 2 all cars.
6. A=0xFD7A `call 0xa2f8` (car lock table, 6.1), A=0xFD7F `call 0xa380` = PLAYER ONE vehicle screen (section 6.1).
7. A=0xFEE3..0xFF6C (only if `[0x28bdc]!=0 && [0x28b9e]==0 && [0x28c98]==0`): `[0x28c1e]=[0x28c20]`; redraw backdrop (A=0xFF2D..0xFF40),
   `[0x28c68]=[0x28b96]` (P1's car), `[0x28b7e]=1`, `call 0xa380` = PLAYER TWO vehicle screen (P1's car crossed out), then
   `[0x28c6a]=[0x28b96]` (P2's car) and `[0x28b96]=[0x28c68]` (P1's car back).
   The post-selection menus (class/laps/engine/regular-bonus/cup) are run INSIDE the second 0xa380 call, see 6.2.
8. ESC anywhere above -> A=0xFF72: `[0x28b9e]!=0` -> reload 'CHECK.PCX' (A=0xFF7C..0xFF83), restore palette (A=0xFF96..0xFFAE:
   `0xbf80`, `[0x28bda]=1`) -> A=0x100C5 (restore `[0x28c20]=[0x28c1e]`) -> jmp main menu A=0xF878.
9. A=0xFFBC..0xFFE4: `[0x28c20]=[0x174de]` (split detail; link: `[0x28cb8]`); `[0x28c98]==0 -> call 0xbe3c` (driver roster, 6.5).
10. A=0xFFF3..0x10006: `[0x1d854]=[0x1d85c]`, `[0x28c08]=0`, `call 0x7928` (race load, 6.5).
11. A=0x1000B..0x10037: if not aborted: `[0x28c98]=0; [0x1ecd0]=1; call 0x1fd8c` (THE RACE) `; [0x1ecd0]=0; call 0x1adc` (sound/voice cleanup only).
12. A=0x1003C..0x100C0 loop: `[0x28c08]==3` (set by the race when a race finished and it was not race 5) and `[0x28bb2]!=4` ->
    `inc [0x28b88]` (A=0x100B9) and jump to A=0xFFFD (re-run 0x7928 with the next track: 5 races per cup).
    Otherwise A=0x10050: `[0x28b9e]=0`; if `[0x28c98]==0` `call 0x832c` (cup-select screen again, 6.4); ESC there -> `[0x28b9e]=1` ->
    A=0x1008A.. reload CHECK.PCX etc. -> main menu. A normal pick starts again at A=0xFFF3 with `[0x28b88]=1` (set at A=0x845F).
13. 3.R Restore path A=0xFD89..0xFEDE: `[0x28bdc]=[0x175cc]` (saved mode), `[0x28b9e]=1` (slot idx), `[0x1ee5a]` from `[0x175d8]`
    (2P; 1P uses `[0x175d6]`), `[0x1ecb4]` from `[0x175dc]` (1P: `[0x175da]`); copies slot fields back: `[0x28b96]`,`[0x28c6a]`,`[0x28b9c]`,`[0x28bb2]`,
    `[0x28bb6]`,`[0x28b88]`, per-racer points `[0xaaae+0x68*i]` and `[0x10720+2*i]`, then `[0x847a],[0x8426],[0x84e0],[0x857e],[0x852a],[0x85e4]`
    (A=0xFDF1..0xFEBF); `[0x28b9e]=0; call 0x67d8(eax=3)` (re-applies engine) -> jmp A=0xFEE3 (P2 vehicle pass is skipped because `[0x28c98]!=0`).
    Saving happens in the race: A=0x1FF93..0x20064 writes the same record at the start of every 2P race (slot `setnz [0x28bdc]` -> slot 1) and the
    pause menu 'SAVE AND QUIT' writes the flag/metadata then calls 0x1a38(0) (A=0x224C7..0x22525: `[0x175cc]=[0x28bdc]`, `[0x175d8]=[0x1ee5a]`,
    `[0x17558]=1`, `[0x175dc]=[0x1ecb4]`). The slots live in the third block of WACKY.CFG (section 9.1), so saving rewrites WACKY.CFG.

Result: 2P race = a cup of 5 races on the cup picked on 0x832c, points accumulated across races (leaderboard after each), rostrum after race 5, then back to cup select.

## 4. TWO PLAYER SHOOT OUT (main-menu item 3), A=0x100F2..0x10377

1. A=0x100F2..0x1017A: `[0x1ea58]=2` (engine word 2), `[0x28c22]=0`, `[0x1eca8]=[0x1ee5a]` (save old engine), `[0x1ee5a]=2`, `[0x28bce]=1`,
   `[0x28c96]=6`, `[0x28c58]=0`, `[0x28b9e]=0`, `[0x28b4a]=0`; draw picbuf[0] (A=0x10147..0x10161); `[0x84e0]=[0x85e4]=0`; `[0x28be2]=1`.
2. A=0x10183..0x101AE: `[0x28c1e]=[0x28c20]`; `[0x28c20]=[0x174de]` (split detail; link `[0x28cb8]`).
3. A=0x101B4..0x101FF (if not aborted): redraw, `[0x28b7e]=0`, `call 0xa2f8` then `call 0xa380` -> PLAYER ONE vehicle screen.
4. A=0x10204..0x10257: `[0x28c68]=[0x28b96]`, redraw, `[0x28b7e]=1`, `call 0xa380` -> PLAYER TWO vehicle screen; `[0x28c6a]=[0x28b96]`;
   `[0x28b96]=[0x28c68]`.
   Inside the PLAYER TWO pass of 0xa380, after the car is chosen: (a) 'PLAY FOR n HITS' menu (A=0xBC63..0xBD03), (b) 0x9eac sets `[0x28bb2]=4`
   (no class menu), (c) 0xa148 and 0x67d8 return immediately (laps/engine skipped because `[0x28be2]!=0`: A=0xA14D, A=0x67F5),
   (d) 0x6664 (edx=1) shows 'REGULAR ZONES' / 'BONUS PACK ZONES' only if the bonus pack is installed (`[0x1eca0]==3`), (e) `[0x28b88]=[0x28c96]`,
   `[0x28bb6]=3` (A=0xBDF3..0xBE02). See 6.2.
5. A=0x1026F..0x102FE zone loop:
   `[0x28b9e]=0` (A=0x1027D); `call 0x93a8` = ZONE SELECTION screen (6.6); ESC there -> `[0x28b9e]=1` -> A=0x10303 (leave);
   else `[0x28c90]=[0x28c96]-6` (zone 0..5), `[0x28b88]=[0x28c96]`, `[0x1d854]=[0x1d85c]`, `call 0x7928` (load, 'LOADING ZONE'),
   if aborted loop; else `call 0xbe3c` (roster), `[0x28bce]=1`, `[0x28bcc]=0`, `[0x1ecd0]=1`, `call 0x1fd8c` (the match), `[0x1ecd0]=0`, `call 0x1adc`,
   `jmp 0x1027d` (back to the zone selection screen).
   So the shoot-out repeats "zone select -> match -> winner screen" until ESC on the zone screen. Cars, hit target and bonus/regular choice are kept.
6. Leave A=0x10303..0x10377: reload 'CHECK.PCX' (obj2:0xe80), palette (`0x26cca`, `0xbf94`), `[0x28b24]=0`, `[0x28bda]=1`,
   `[0x28c20]=[0x28c1e]`, `[0x28bb6]=1`, `[0x28b88]=1`, `[0x1ee5a]=[0x1eca8]` (engine restored), `[0x28be2]=0`, `[0x1ea58]=[0x1eca8]`; `jmp 0xf878`.
   ESC at either vehicle screen jumps to A=0x1033A (same tail but without the CHECK.PCX reload, uses 0x1026F's `[0x28b9e]` test).

## 5. Where the item 2 / item 3 flows differ (summary)

| step | item 2 TWO PLAYER RACE | item 3 TWO PLAYER SHOOT OUT |
|---|---|---|
| 1 | (if 2P save exists) RESTORE SAVED GAME / START NEW GAME | - |
| 2 | RACE HEAD TO HEAD / RACE WITH ALL CARS | - |
| 3 | vehicle PLAYER ONE | vehicle PLAYER ONE |
| 4 | vehicle PLAYER TWO (P1 car crossed out) | vehicle PLAYER TWO (P1 car crossed out) |
| 5 (after P2 car) | [all cars only] class menu AMATEUR/PRO/CHAMPION | PLAY FOR 5/10/15/20 HITS |
| 6 | laps menu SIX/EIGHT/TEN LAP RACE | (skipped) |
| 7 | engine menu FAST 12 HP / SLOW 6 HP | (skipped, engine forced 6 HP) |
| 8 | REGULAR RACES / BONUS PACK RACES (only if bonus pack installed) | REGULAR ZONES / BONUS PACK ZONES (same condition) |
| 9 | cup select BRONZE/SILVER/GOLD (0x832c) | zone selection screen (0x93a8, SBCS.PCX / BSBCS.PCX) |
| 10 | LOADING RACE n -> race (split screen) | LOADING ZONE -> match (split screen) |
| end | leaderboard after each race; after race 5 the ROSTRUM (WIN.PCX) with the cars on the steps; then cup select | winner screen ('<NAME> IS THE OVERALL WINNER!' / 'YOU HAVE BOTH DRAWN!'); back to zone selection |

## 6. Screens in detail

### 6.1 Vehicle selection, function 0xa380 (A=0xA380..0xBE35), preceded by 0xa2f8

* 0xa2f8 (A=0xA2F8): zeroes the lock table `[0x1d338 + 4*car]` (8 dwords) and, if `[0x1e574]!=0` (shareware; link: `[0x1ec9c]==1`),
  sets entries 0,1,4,5 to 1 = locked cars NUNO, SULTAN, RAZER, RINGO (A=0xA334..0xA352). `[0x1e574]`/`[0x1eca0]` come from the version probe
  A=0x24458..0x244DE: file '42.GAM' present -> `[0x1eca0]=3` (registered and upgraded, bonus pack), else '20.GAM' -> 2 (registered), else 1 (shareware,
  `[0x1e574]=1`).
* Title text: A=0xA3EC..0xA42E. Default 'CHOOSE VEHICLE' (obj2:0xb50). If `[0x28be2]||[0x28bdc]`: 'PLAYER ONE' (obj2:0xb6c) for `[0x28b7e]==0`,
  'PLAYER TWO' (obj2:0xb60) for `[0x28b7e]==1`; also `[esp+0x178]=2` for P2 which selects the P2 cursor sprite pair
  (`[0xa878+4*(blink+0|2)]`, A=0xAE2A..0xAE48; 38x28 px sprite, `[0x28b36]=0x26 [0x28b26]=0x1c`).
* Sub-lines built by 0x9c68 (A=0x9C68..0x9DA6, called at A=0xA437): line A = 'KEYBOARD' (obj2:0x920) / 'JOYSTICK #' + n (0x908) / 'GAME PAD #' + n (0x914)
  where n = player+1; selection: P1 uses `[0x1ee4a]` (nonzero=joystick) and `[0x17128]` (nonzero => game pad); P2 uses `[0x1712c]` (nonzero = keyboard)
  and `[0x1712a]`. Line B = 'PRESS F1 TO VIEW YOUR CONTROLS' (obj2:0x92c, A=0x9D90..0x9DA0). Drawn at x=0x2e, y=0xaf and y=0xbc (A=0xA5DA, A=0xA5F5);
  title at y=0x60 centred (A=0xA5D5).
* Grid: 8 cars in a 4x2 grid, cells in the array at obj2:0x13938 + 12*i (+0 car id, +4 x, +6 y): ids 0..3 at y=0x3a, x=0x2e+0x40*i;
  ids 4..7 at y=0x72 (A=0xA4B1..0xA52D). Cursor -> car id lookup is 0x6a7c (A=0x6A7C). Car sprites per cell: [0x13c08+0x98*car+..] (pointer table).
* Input (non-link, A=0xB272..0xB52E):
  - `[0x1d8a4]=[0x1d8ac]` (P1 key record pointer), `call 0x4b00(edx=[0x28b7e])` joystick calibration for that player, `call 0x277ae` (poll).
  - Left/right = key states of record `[0x28b7e]`: `[0x1b6d9 + 12*idx]` -> `[0x28cd5]`, `[0x1b6db + 12*idx]` -> `[0x28cdd]` (A=0xB3C5..0xB3E4).
    So during the PLAYER TWO pass the cursor is moved with the PLAYER TWO left/right keys.
  - Accept word `[0x28b40]` (A=0xB299..0xB3C5): 0x277ae first loads it with the P1 ACCELERATE key state (rec+5, plus game-port button 1). So in the PLAYER ONE pass accept =
    P1 accelerate OR P1 fire (`[0x28b42]`, A=0xB3A0) OR Enter/Space (`[0x28cce]`, A=0xB3B3) OR joystick buttons.
    In the PLAYER TWO pass (2P modes) `[0x28b40]` is OVERWRITTEN (A=0xB2B6..0xB39A) with P2's FIRE key state `[0x1b6df+12*idx]` (= 0x1b6eb) if `[0x1712c]!=0`
    (P2 on keyboard) or with `[0x28b44]` (game-port bit 6) otherwise; then it is still forced to 1 by P1's FIRE (`[0x28b42]`) or Enter/Space. So in the P2 pass:
    accept = P2 fire OR P1 fire OR Enter/Space (P1 can confirm P2's car; P1's accelerate does not count).
  - ESC (`[0x28cd0]==1` -> `[0x28cec]`): A=0xB52E..0xB537 -> `[0x28b9e]=1`, return.
  - F1 (`[0x28cd0]==0x3b` -> `[0x28b46]`): A=0xB3FA..0xB45A -> `call 0xc0f4` (help screen, 9.5) with eax = empty string; afterwards input words cleared.
* Locked car (shareware): A=0xB461..0xB4E1: if `[0x1d338+4*cursorcar]!=0` and accept pressed: sound 0x1a, then message box (0x1a268) built from
  obj2:0xba4/0xbc0/0xbdc: 'PLEASE READ ORDERING INFO / TO FIND OUT HOW TO RACE / WITH THIS ANIMAL.' ; selection refused.
* TAKEN CAR (the P2 exclusion):
  - Logic: A=0xB4E1..0xB523: if (`[0x28be2]||[0x28bdc]`) && `[0x28b7e]==1` && cursor car == `[0x28c68]` (P1's pick) -> accept word `[0x28b40]=0`
    and the blink/selection counters cleared (so fire does nothing).
  - Visual: function 0x4380 (draws the 8 cells, A=0x4380..0x46D0) at A=0x469B..0x46B8: if `[0x28b7e]==1` and slot == `[0x28c68]` it draws the sprite `[0x1eae8]`
    (the red cross) over that cell (called with eax=-1, A=0xADF2 / 0xA9A4).
  - P1 can still be crossed out only for P2; P1's own pass has no exclusion (`[0x28c68]` is only written before the P2 pass, A=0xFF27 / A=0x10224).
* After accept: small state machine (jump table obj1+0xa360 for cell animation, obj1+0xa370 for the 4 post-accept states, A=0xB939..0xBC55),
  sound `0x1c04(car)`, then state 4 -> A=0xBC55.

### 6.2 What 0xa380 does after a car is accepted (A=0xBC55..0xBE29)

Order (each routine checks `[0x28b7e]` itself, so P1's pass mostly returns immediately in the two-player modes):
1. A=0xBC63..0xBD03 (only `[0x28be2]!=0 && [0x28b7e]==1`): menu 'PLAY FOR n HITS' = obj2:0xbf8 ' PLAY FOR 5  HITS ', 0xc0c '... 10 HITS',
   0xc20 '... 15 HITS', 0xc34 '... 20 HITS' (4 entries, kind 0xd, initial 1). `[0x1eda0]=choice*5` (A=0xBCFB..0xBD03). ESC -> `[0x28b9e]=1`.
2. A=0xBD3C `call 0x9eac` class menu (A=0x9EAC..0xA141):
   - `[0x28be2]||[0x1ec74]` -> no menu, `[0x28bb2]=4` (A=0x9F5F -> 0xA107), then `[0x84e0]=[0x85e4]=0` (A=0xA12D).
   - 1P (`[0x28bdc]==0`): menu AMATEUR CLASS / PRO CLASS / CHAMPION CLASS / TIME TRIAL / KID MODE (obj2:0x96c, 0x980, 0x994, 0x9a8, 0x9bc; 5 entries, 4 in link).
   - 2P race (`[0x28bdc]!=0`): `[0x28bb2]=1`; only if `[0x28bdc]==2 && [0x28b7e]==1` a 3-entry menu (AMATEUR/PRO/CHAMPION) sets `[0x28bb2]` (A=0xA0A2..0xA0CF).
3. A=0xBD4B `call 0xa148` laps menu (A=0xA148..0xA2F5): skipped when `[0x28be2]||[0x1ec74]` (A=0xA14D). 2P race: shown only in the P2 pass
   (A=0xA264 `cmp [0x28b7e],1`), 3 entries 'SIX LAP RACE' / 'EIGHT LAP RACE' / 'TEN LAP RACE' (obj2:0xb14, 0xb28, 0xb3c) -> `[0x28b9c]=6/8/10`.
4. A=0xBD5F `call 0x67d8(eax=2)` engine menu (A=0x67D8..0x6981): skipped for `[0x28be2]` and duck; 2P race: only in the P2 pass (A=0x6886).
   Entries 'FAST 12 HP ENGINES' / 'SLOW 6 HP ENGINES' (obj2:0x534, 0x54c; extra banner via 0x1a414 at y=0x4e, text at obj2:0x3f8 = 'LEE & JACKSON LAWNMOWERS' (the bytes before it, obj2:0x3f5..0x3f7, are '.AT', so the readable sponsor text 'ATLEE & JACKSON LAWNMOWERS' is cut by the 8-aligned string address; verify live), A=0x68CD / A=0x5FA1..0x5FBA). Result -> `[0x1ee5a]`, `[0x1ea58]`,
   `[0x1ecb8]`, `call 0x257ac(engine)`.
5. A=0xBD87 `call 0x6664(eax=2, edx=[0x28be2] or [0x1ec74])` (A=0x6664..0x67D7): only if the bonus pack is installed (`[0x1eca0]==3`, link `[0x1ec9c]==3`);
   in 2P modes only in the P2 pass (A=0x66D6). edx!=0: 'REGULAR ZONES' / 'BONUS PACK ZONES' (obj2:0x4e4, 0x4f8); edx==0: 'REGULAR RACES' / 'BONUS PACK RACES'
   (obj2:0x50c, 0x520). Entry 2 -> `[0x1ecb4]=3`. Without the bonus pack the menu is skipped and `[0x1ecb4]=0`.
6. A=0xBD94..0xBDD9: if race mode (not shoot-out/duck) and (`[0x28bdc]==0` or P2 pass): `[0x1d854]=[0x1d85c]; call 0x832c` (cup-select screen).
   A=0xBDE0..0xBE02: shoot-out/duck: `[0x28b88]=[0x28c96]; [0x28bb6]=3`.
7. A=0xBE22 `[0x28b96]=cursor car`; return.

### 6.3 Class / laps / engine / bonus menus: skipped or shown in two-player (answer to task item 2)

* 2P race, HEAD TO HEAD: no class menu (class=1), laps menu YES (after P2), engine menu YES (after P2), regular/bonus races menu YES if bonus pack, cup select YES.
* 2P race, ALL CARS: as above plus a class menu AMATEUR/PRO/CHAMPION shown only after P2 (so P2 picks the class for both).
* Shoot-out: none of class/laps/engine; hits menu and zones menu instead.

### 6.4 Class / cup selection screen 0x832c (A=0x832C..0x93A5) -- used by 1P and 2P race

* Resets per-racer points `[0xaaae+0x68*i]=0` (i=0..7, A=0x8386..0x8399) and the two player structs' `[0x847a],[0x8426]=0`; `[0x1ec80]=0`;
  sets `[0x28b88]=1` (A=0x845F). Shows the cup pictures: file names built from obj2:0x898/0x89c ('B' prefix + 'SB' + n + '.PCX' => SB1/SB2/SB3.PCX regular,
  BSB1/BSB2/BSB3.PCX bonus pack; all exist in WACKY.DAT) loaded with 0x17060 into picbuf[2] (`[0xa980]`) and drawn with 0x275cd.
* Choose with left/right (`[0x28cd5]`/`[0x28cdd]`, P1 keys + joystick via 0x4b00(0)/0x277ae, A=0x9302..0x9321) over `[0x28bb6]` 1..3 wrapping (A=0x92E8..0x9318).
  Accept = `[0x28b40]` (A=0x8D83): as in the zone screen (6.6), P1 ACCELERATE counts as accept unless it is bound to Up/Down (Up/Down are navigation), plus Enter/Space. Shareware lock: `[0x1e574]!=0 && [0x28bb6]>1` -> sound 0x1a + message box (obj2:0x844/0x860/0x87c 'PLEASE SEE MAIN MENU TO /
  FIND OUT HOW TO ORDER / THESE EXTRA RACES.') (A=0x8DB5..0x8DE3). ESC (`[0x28cec]`) -> `[0x28b9e]=1` (A=0x9369..0x9390).
* Only P1's keys work here and in the zone screen (they poll the P1 record only).

### 6.5 Race load 0x7928 (A=0x7928..0x7D6F) and the roster 0xbe3c

* A=0x795B..0x7A06: for `[0x28be2]||[0x28bdc]`: `[0x28bde]=1`, `[0x1ed30]=0x64`, `[0x1eb80]=1`, `[0x1eb82]=1` (both players active); else single player:
  `[0x1ed30]=0`, `[0x1eb80]=1`, `[0x1eb82]=0` (A=0x79E2..0x79FE).
* A=0x7A6B..0x7B52 track number (2); A=0x7B57 `call 0x22e60`.
* Banner text: shoot-out/duck -> obj2:0x7cc 'LOADING ZONE' (A=0x7D2D). Races: 'LOADING' (obj2:0x78c) + for race 5: ' FINAL' (obj2:0x7ac) or ' BONUS! ' (obj2:0x798, when `[0x1ec80]`),
  otherwise 'RACE ' (obj2:0x7c4) + race number. `[0xaa68]` (used by the leaderboard title) = 'BONUS' (0x7a4) / 'FINAL' (0x7b4) / 'RACE ' (0x7bc) + number (A=0x7BC9..0x7CA0).
* A=0x7D74..0x7DC5: loads both players' car data: `[0x28b7e]=0; call 0x73c4; [0x28b7e]=1; swap [0x28b96]<->[0x28c6a]; call 0x73c4; restore` (0x73c4 loads
  per-driver sprite files, 12-byte file-name records at obj2:0x1bba0 + 12*driver, filled at A=0x228DD.. from names at obj2:0x1acc..0x1b30 (DIGGER.SP, PANDA.SP, CAMEL.SP, MOOSE.SP, PELICAN.SP, SHARK.SP, RINGO.SP, ELE.SP, TIGER.SP); name-to-driver mapping not checked).
* 0xbe3c (A=0xBE3C..0xBEFE) roster: `[0x10720..]=-1`; slot0=`[0x28b96]`; if `[0x28be2]||[0x28bdc]` slot1=`[0x28c6a]`. Remaining slots (to 7): for 1P a random unused driver
  (via 0x33088), for the 2P race (`[0x28bdc]!=0`) the lowest unused driver index ascending (A=0xBEAE..0xBEFB); duplicates skipped. In shoot-out only slots 0/1 matter.
  Not called when a saved game is restored.

### 6.6 Zone selection screen 0x93a8 (A=0x93A8..0x9C65), shoot-out only here

* Picture: `[0x1ecb4]==0` -> 'SBCS.PCX' (obj2:0x8d0), else 'BSBCS.PCX' (obj2:0x8c4) (A=0x9480..0x94A7), loaded into picbuf[2] (0x17060, A=0x94F3), drawn A=0x9501..0x9512.
  Both files exist in WACKY.DAT. Six thumbnails, palette per zone via 0x82d0 / 0x27cf1. Text strings for the shareware lock at obj2:0x844/0x860/0x8a8
  ('... THESE EXTRA ZONES.') copied to `[0x1c854]/[0x1c890]/[0x1c8cc]`.
* Cursor `[0x28c96]` 6..11: left (`[0x28cd5]`) decrements (wrap 6->11), right (`[0x28cdd]`) increments (wrap 11->6) (A=0x9A9C..0x9B63). P1 keys only
  (A=0x9686: `[0x1d8a4]=[0x1d8ac]; 0x4b00(0); 0x277ae`).
* Accept `[0x28b40]` (A=0x9B68) = P1 ACCELERATE (via 0x277ae) unless the pressed accelerate key's scancode is 0x48 (Up) or 0x50 (Down) (A=0x969C..0x96B7 test `[0x1b6dd]` state and `[0x1b6dc]` scancode), OR Enter/Space (`[0x28cce]`, A=0x96C6..0x96CF). Fire (`[0x28b42]`) is not tested here. Navigation also accepts: P1 left/right keys (`[0x1b6d9]`/`[0x1b6db]` -> `[0x28cd5]`/`[0x28cdd]`, A=0x96D8..0x96F1), and Down arrow / joystick-down (`[0x28cd2]`/`[0x28cd3]`) = RIGHT, Up arrow / joystick-up (`[0x28cdb]`/`[0x28cd6]`) = LEFT (A=0x96F8..0x9727). Then: sound 0x12; shareware (`[0x1e574]!=0`) and `[0x28c96]>7` -> locked message (A=0x9B88..0x9BB6); else return with `[0x28b9e]=0`.
  (so in shareware zones 6 and 7 playable). ESC (`[0x28cec]`) -> `[0x28b9e]=1` (A=0x9BCA..0x9C4D).
* Result: `[0x28c96]` (6..11). Caller computes `[0x28c90]=[0x28c96]-6` and `[0x28b88]=[0x28c96]`.

## 7. Race start details (0x1fd8c setup, A=0x1FD8C..0x20300)

### 7.1 What the race entry sets (A=0x1FD95..0x20169)
* `[0x28ca8]=1` only for 1P non-time-trial (A=0x1FE01..0x1FE0B). Racer structs: P1 at 0x8410, P2 at 0x8514 (`[0x1d5c0]`, `[0x1d5bc]`).
* A=0x1FF5C..0x1FF8D skip rules for the save (2P race saves; shoot-out/duck/link/time trial do not). The save block layout is in 3.R.
* A=0x20139..0x2017B: if NOT (`[0x28be2]` or `[0x1ec74]`) -> `[0x28c38]=1, [0x28c5e]=0, [0x28c44]=0` (all races, INCLUDING the 2P race); for shoot-out and duck shoot -> `[0x28c38]=0, [0x28c44]=2`. Meaning of these words not determined.

### 7.2 Racer count `[0x28c40]` (A=0x1FE96..0x1FF09)
* default 7 (8 racers); `[0x28be2]` -> 1 (2 racers); `[0x28bdc]==2` -> 7; `[0x28bdc]` other (=1) -> 1 (2 racers); time trial (`[0x28bb2]==4 && !shoot-out`) -> 0; duck -> 7.
  Consequences: HEAD TO HEAD and SHOOT OUT have exactly 2 racers (P1, P2); ALL CARS has 8 (P1, P2 and six AI in the roster order of 0xbe3c).
* Initial places: if `[0x28c40]>1`: `[0x84bc]=[0x85c0]=8` else 1 (A=0x20214..0x2023B).

### 7.3 Split screen
* `[0x28bde]=1` and `[0x1ed30]=0x64` (100). View offsets: the render loop starts `[0x28b34]=0x2260` for racer 0 and subtracts `[0x1ed30]*0x50` for racer 1
  (A=0x1FB9E..0x1FBC2). Which player is on top/bottom was not determined.

## 8. End of race / back to the menus

### 8.1 Shoot-out hit scoring and "kill" messages (A=0x21229..0x214A2, race function)
* Trigger: racer 0 or racer 1 "dead" flag (`[0x848e]` / `[0x8592]`) after the 0x3e80-page frame.
* Messages (via banner 0x1a414, held 0x190 ticks A=0x213D2..0x213F2):
  both dead -> if `[0x28bdc]!=0` 'WHAT A CRASH!' (obj2:0x19d8) else (shoot-out) 'THAT WAS A DOUBLE KILL!' (0x19e8);
  one dead -> '<NAME> HAS BEEN WAXED!' (name from obj2:0x1d228 + 12*driver, driver `[0x28b96]` or `[0x28c6a]`; text obj2:0x1a00 ' HAS BEEN WAXED!').
* Credit (shoot-out only; the 2P race jumps back to the race at A=0x21411 `[0x28bdc]!=0 -> 0x2006a`): A=0x2141F..0x2143F: if `[0x848e]` (P1 dead) `[0x85e4]++` (P2 scores);
  if `[0x8592]` (P2 dead) `[0x84e0]++` (P1 scores) -> a double kill credits both.
* Match end: A=0x21444..0x2145E: `[0x84e0]>=[0x1eda0]` or `[0x85e4]>=[0x1eda0]` -> ebx=2 -> `call 0x1adc; call 0x1bbd8` (winner screen), reset hit counters (A=0x2146D..0x21483),
  `jmp 0x227aa` (leave race function). Otherwise `[0x847c]=3; [0x8580]=3` (respawn state) and the race continues (`jmp 0x2006a`).

### 8.2 Shoot-out winner screen, function 0x1bbd8 (A=0x1BBD8..0x1BFEC)
* Background: loads obj2:0x1624 = 'ORDER.PCX' into picbuf[0] (A=0x1BC39..0x1BC4A; palette A=0x1BC59). ORDER.PCX is a 7.6 KB member of WACKY.DAT (probably a plain backdrop; the
  ordering-info pages are OR1..OR11.PCX). Drawn with 0x275cd (A=0x1BC84).
* Clamp both hit counters to `[0x1eda0]` (A=0x1BC92..0x1BCB3). Compare P1 `[0x84e0]` vs P2 `[0x85e4]` (A=0x1BCBA..0x1BCD9):
  equal -> draw: 'YOU HAVE BOTH DRAWN!' (obj2:0x16c4; A=0x1BCE8..0x1BCF7); P1 > P2 -> winner driver `[0x28b96]`; else `[0x28c6a]`.
  A draw is possible after a double kill at match point (both clamp to the target).
* Winner text: name (obj2:0x1d228 + 12*driver, A=0x1BCF9..0x1BD21) + ' IS THE OVERALL WINNER!' (obj2:0x16dc, A=0x1BD22..0x1BD4E). Centred, y=0x36 (A=0x1BD76).
  Sprite(s) drawn with 0x26fd0 at y=0x56: single winner at x=0x8d (sprite `[0x13c08+0x98*driver]`); draw: P1 car at x=0x78 and P2 car at x=0x78+0x28=0xa0 (A=0x1BD81..0x1BDE5).
* Bottom prompt y=0xb4: 'PRESS FIRE' (obj2:0x7dc, A=0x1BE23); 'WAITING FOR PLAYER ONE TO PRESS FIRE' (obj2:0x16f4) only for link `[0x28c0c]==2` (A=0x1BE37..0x1BE4D).
* Waits with 0x17920(0) (A=0x1BFC3, the non-link path): clears b40..b46, then polls and returns as soon as P1 accelerate/fire/brake/hand-brake key, Enter or Space is down.
  It does NOT wait for a release first (0x178c4 is the release-wait and is not called on this path), so a key still held from the match can dismiss the screen right after the fade.
  Only P1's key record is polled (A=0x17957..0x17964), P2's keys do not dismiss it. Then palette restore and return.
* "How many rounds": one match = first to `[0x1eda0]` hits (5/10/15/20); there is no best-of series. After the winner screen the flow returns to the zone screen (4.5).

### 8.3 2P race end (A=0x2150C..0x21608)
* Race end test (2P): `[0x28b9c]+1 == [0x84c2]` (P1 lap counter) or `== [0x85c6]` (P2) -> A=0x2153C: `[0x28c08]=0` if `[0x28b88]==5` else 3; copy 0x2ff palette bytes (A=0x2155A..0x2158C);
  `call 0x1adc`; for racers 0..`[0x28c40]` add points `9-place` to `[0xaaae+0x68*i]` using `[0x84bc+0x104*i]` (A=0x21599..0x215EE); `[0x1ec80]=0`; `call 0x1bff0`; return.
  First player to complete the laps ends the race for both.
* Leaderboard function 0x1bff0 (A=0x1BFF0..0x1C400+): palette from `[0x1d85c]`, sorts racers 0..`[0x28c40]` by points (`[0xaaae+0x68*i]`; bubble sort with 0x26f8c),
  loads obj2:0x1624 'ORDER.PCX' again (A=0x1C167), draws via 0x1b270 (title ' LEADER BOARD AFTER ' (obj2:0x160c) + `[0xaa68]` race text, plus a header 'POINTS' at obj2:0xe9c; rows: place number, driver name
  obj2:0x1d228+12*driver, points; the two human rows get their car sprites 0x26fd0 at x/y returned from 0x1b270 for `[0x28b96]` and (2P race) `[0x28c6a]`, A=0x1B478..0x1B52C).
  Then an input-wait loop that polls P1's record (0x4b00(0)/0x277ae, A=0x1C3DB..0x1C403; not read to the end).
* After the leaderboard (wait: P1 accelerate or Enter/Space, `[0x28b40]`, A=0x1C3DB..0x1C403 and A=0x1C574; otherwise the car sprites animate, loop A=0x1C316..0x1C59B):
  A=0x1C614 `cmp [0x28b88],5; jnz 0x1d24d` -> only after race 5 (FINAL) the same function continues into the ROSTRUM scene:
  groups the racers by equal points (A=0x1C632..0x1C6D2; number of podium steps `[esp+0x348]` = 2 when `[0x28c40]+1==2` (head to head) else 3, A=0x1C04D..0x1C062),
  finds P1's group (`[esp+0x338]`, driver `[0x28b96]`) and P2's group (`[esp+0x354]`, driver `[0x28c6a]`, A=0x1C755..0x1C76E); a human who is not on the podium gets a corner marker
  (P1 at x=0x0a,y=0x9e; P2 at x=0x110,y=0x9e when `[0x28bdc]!=0`, A=0x1C7B3..0x1C823); loads 'WIN.PCX' (obj2:0x17a8, A=0x1C9F6) with title text 'THE ROSTRUM' (obj2:0x179c, A=0x1C964..0x1C9E7),
  draws the cars on the steps, loops (animation `[0x1e724]+6` ticks, A=0x1D1AC) until `[0x28b40]` (P1 accelerate/Enter/Space), then returns (A=0x1D22C / 0x1D24D).
  The 'YOU HAVE WON THE RIGHT TO ENTER THE BONUS TRACK!' text (obj2:0x1730/0x1754/0x1778, A=0x1C86E..0x1C8A9) is gated by `[0x28bdc]==0` (A=0x1C85A) so it is 1P only.
  No text naming a winner was found in this rostrum path (only sprites and the 'THE ROSTRUM' title were seen; the segment A=0x1CC00..0x1D0F0 was only skimmed with grep for calls to 0x48f4/0x46d4/0x1a414: none besides the link error banner).
  So for the 2P race the "winner" is shown only as the car(s) on the top rostrum step (ties share a step); there is no 'IS THE OVERALL WINNER!' text in the 2P race path
  ('IS THE OVERALL WINNER!' / 'YOU HAVE BOTH DRAWN!' have exactly one reference each, A=0x1BD24 / A=0x1BCEF, both inside 0x1bbd8 which only the shoot-out call at A=0x21468 reaches).
  After the rostrum the race function returns and the loop at 3 step 12 sends the players back to the cup-select screen (`[0x28c08]=0` after race 5).

### 8.4 ESC pause menu during the race (A=0x221A3..0x22525)
* Race 2P (`[0x28be2]==0`): entries 'BACK TO RACE' (obj2:0x1a64), 'LEAVE RACE' (0x1a74), 'SAVE AND QUIT' (0x1a84; only non-link, `[0x28bb2]!=4`, not kid mode, `[0x1ec80]==0`;
  sets `[0x28c98]=1`), 'RESTART RACE' (0x1abc). Count `[0x28b72]` = 2/3/4 (A=0x222B0..0x222F0).
* Shoot-out (and duck): 'BACK TO ZONE' (0x1a94), 'LEAVE ZONE' (0x1aa8); count fixed 2 (A=0x222F2).
* Choice 3 with `[0x28c98]!=0`: save and quit (3.R). Choice 2: leave -> A=0x227AA (race function returns): 2P race -> `[0x28c08]=0` => cup select; shoot-out -> zone select.
  Restart entry: `[0x1d5b0]+0x6c` (tries) is decremented ONLY for 1P (A=0x22553..0x22575 skip it when `[0x28be2]`, `[0x28bdc]` or `[0x1ec74]` is set), so restarts are unlimited in the 2P race and shoot-out; then 0x19e0c; if `[+0x6c]==0` the race function returns (A=0x22583..0x22588), else `jmp 0x2006a`.
* The Pause/Break key (raw scancode 0xC5 left in `[0x28cd0]`) shows the 'PAUSED' banner (obj2:0x19d0) and waits for any key (A=0x1FC95..0x1FD84); F10 is not the pause key.

## 9. Controls

### 9.1 WACKY.CFG layout (loader A=0x25F52..0x2610F)
* File name string obj2:0x208c 'WACKY.CFG' (path built at 0x1c0d8). Size must be 0xADA (2778): check at A=0x26020; `[0x17430]` must equal 0xFA (A=0x26072) else
  'Incorrect Wacky Wheels Config File!' (obj2:0x20e4).
* Three fread()s (A=0x26041 / A=0x26057 / A=0x2606D): `0x492` bytes -> `[0x1ee1c]`; `0x18` bytes -> `[0x1b6d8]` (KEY TABLE, file offset 0x492); `0x630` bytes -> `[0x17128]`.
  0x492+0x18+0x630 = 0xADA.
* Third block (file offset 0x4aa) contents used by the flows: `[0x17128]` P1 game-pad flag, `[0x1712a]` P2 game-pad flag, `[0x1712c]` P2 keyboard flag (nonzero = P2 uses keyboard),
  `[0x17130..0x1713a]` P2 joystick calibration, `[0x174de]` split-screen detail, `[0x174e0]` P1 joystick up/down option, key-NAME strings `[0x17432]` (P1, 6 x 14 bytes) and
  `[0x17486]` (P2) at file offset 0x7b4/0x808, saved-game slots `[0x174e4]` (1P) and `[0x17558]` (2P), 0x74 bytes each, plus header words `[0x175cc..0x175dc]`.
  First block: `[0x1ee4a]` P1 joystick flag (file offset 0x2e), `[0x1ee58]` single-screen detail, `[0x1ee5a]` engine (file 0x3e).
* Local file `game/WackyWhe/WACKY/WACKY.CFG` (2778 bytes): `[0x1ee4a]=0` (P1 keyboard), `[0x1712c]=1` (P2 keyboard), `[0x174de]=1` (split detail HIGH), magic 0xFA ok, no saved games.

### 9.2 Key table (records of 6 x (scancode, state) bytes)
* P1 record at obj2:0x1b6d8..0x1b6e3, P2 record at obj2:0x1b6e4..0x1b6ef. Field k: byte +2k = scancode, +2k+1 = pressed state.
  Order (by the help-screen label order and the consumers): k0 STEER LEFT, k1 STEER RIGHT, k2 ACCELERATE, k3 FIRE WEAPONS, k4 BRAKES, k5 HAND BRAKE TURN.
* Keyboard ISR 0x30907 (A=0x30907..0x309EA, hooked INT 9): `edi=[0x1d990]` (=0x1b6d8, set at A=0x25D4D), reads port 0x60, ignores E0 prefix (reuses `[0x28cd0]`),
  break codes >0x52 become scancode-0x80 with state 0; scans the 12 (scancode,state) pairs (`ecx=0xc`, A=0x309C1..0x309D3) and writes the state byte of every pair whose
  scancode matches. Also: 0x1c Enter and 0x39 Space -> `[0x28cce]`; 0x44 F10 -> `[0x28ccd]` (screen grab: after each 0x27de0 call the callers test `[0x28ccd]` and call 0x14c8, e.g. A=0xA9A9..0xA9B7; 0x14c8 builds a 'WACKnnn.PCX' file name from obj2:0xa2..0xb4; likely screenshot, not verified); 0x48 Up -> `[0x28cdb]`; 0x50 Down -> `[0x28cd2]`;
  last scancode -> `[0x28cd0]` (A=0x309D5).
* Record pointers: `[0x1d8ac]=0x1b6d8` (P1), `[0x1d8b0]=0x1b6e4` (P2), `[0x1d8a4]` = record used by the poller 0x277ae (A=0x25D39..0x25D57).
* Poller 0x277ae (A=0x277AE..0x27847): `[0x28b40]=rec[+5]` ACCELERATE, `[0x28b42]=rec[+7]` FIRE, `[0x28b44]=rec[+9]` BRAKE, `[0x28b46]=rec[+0xb]` HAND BRAKE TURN; then ORs
  game-port buttons (port 0x201 bit 4/5/6/7 -> b40/b42/b44/b46, unless `[0x28c74]==1`). Left/right are read directly from the record: `[0x1b6d9]` / `[0x1b6db]` (P1),
  `[0x1b6e5]` / `[0x1b6e7]` (P2). Joystick axes are handled by 0x4b00 -> 0x2784b (sets `[0x28cd5]/[0x28cdd]/[0x28cd6]/[0x28cd3]`).
* Meaning confirmed in the car update (A=0x194B2..0x19740): `[0x28b40]` accelerate (speed +6/+10 up to 100, else -4), `[0x28b44]` brake (speed -8, A=0x19553),
  `[0x28b46]` hand-brake turn/drift flag (A=0x19707), `[0x28b42]` weapon fire (A=0x1436E..0x14466). Kid mode forces accelerate (A=0x195F5..0x19601).
* Joystick button labels in the help screen: BRAKES -> 'BUTTON3' (obj2:0xd20), HAND BRAKE TURN -> 'BUTTON4' (0xd28) for game pads (A=0xC592..0xC5D0 / 0xC6A8..0xC6E6).

### 9.3 Defaults in the local WACKY.CFG (decoded)
| action | P1 key (scancode) | P2 key (scancode) |
|---|---|---|
| STEER LEFT | LEFT CURSOR (0x4b) | D (0x20) |
| STEER RIGHT | RIGHT CURSOR (0x4d) | F (0x21) |
| ACCELERATE | ALT (0x38) | A (0x1e) |
| FIRE WEAPONS | CTRL (0x1d) | S (0x1f) |
| BRAKES | DOWN CURSOR (0x50) | G (0x22) |
| HAND BRAKE TURN | SPACE (0x39) | H (0x23) |
* The key table bytes are `4b 00 4d 00 38 00 1d 00 50 00 39 00 | 20 00 21 00 1e 00 1f 00 22 00 23 00`. Name table (what the help screen prints):
  'LEFT CURSOR','RIGHT CURSOR','ALT','CTRL','DOWN CURSOR','SPACE' | 'D','F','A','S','G','H'.
* The DOSBox run copy `analysis/dosbox/WACKY/WACKY.CFG` has P1 = 0x10..0x15 (Q W E R T Y: left, right, accelerate, fire, brake, hand brake; names overwritten with
  'Q','W','E','R','T','Y') and the same P2 keys D F A S G H. (Its remaining name bytes are leftovers, harmless because the strings end at the NUL.)
* ESC = scancode 1 (`[0x28cec]`), Enter/Space accept in menus, F10 screen grab, Pause/Break pauses the race, F1 opens the help screen in vehicle screens, and F1 = P1's first giggle key in the race.

### 9.4 Race polling of both players (non-link)
* P1 (A=0x1F4A8..0x1F566): `[0x1d8a4]=[0x1d8ac]`, `0x4b00(0)`, `0x277ae`; ESC -> `[0x28cec]`; scancodes 0x3b..0x40 (F1..F6) -> `[0x28ce0]=code-0x3a` (giggle 1..6);
  `[0x1b6d9]`/`[0x1b6db]` OR into `[0x28cd5]`/`[0x28cdd]`.
* P2 (A=0x1FAA3..0x1FB69): `[0x1d8a4]=[0x1d8b0]`, `0x4b00(1)` (P2 joystick calibration from `[0x17130..]`), left/right: `[0x28cd5]->[0x28cc3]`, `[0x28cdd]->[0x28ccc]` OR `[0x1b6e5]`/`[0x1b6e7]`;
  giggle keys: scancodes 2..7 (top-row '1'..'6') -> `[0x28cdf]=code-1`; if `[0x1712c]!=0` (P2 keyboard): `[0x28cc4]=[0x1b6e9]` accelerate, `[0x28cc5]=[0x1b6eb]` fire;
  always `[0x28cc6]=[0x1b6ed]` brake, `[0x28cc7]=[0x1b6ef]` hand brake (so brake/handbrake always come from P2's keys).
  If P2 is on a second joystick (`[0x1712c]==0`): A=0x211C3..0x211FB `[0x28cc4]=[0x28b44]` and `[0x28cc5]=[0x28b46]` (port bits 6/7 = joystick B buttons 1/2) and then
  re-reads P1's brake/hand-brake keys `[0x1b6e1]`/`[0x1b6e3]` into b44/b46 unless P1 is on a game pad (`[0x17128]`). (Inference.)
* P2 swap-in before updating racer 1 (A=0x22655..0x226C4): `[0x28b96]=[0x28c6a]`, `[0x28b7e]=1`, giggle `[0x28ce0]=[0x28cdf]`, `[0x28cd5]=[0x28cc3]`, `[0x28cdd]=[0x28ccc]`,
  `[0x28b40]=[0x28cc4]` (accelerate), `[0x28b42]=[0x28cc5]` (fire), `[0x28b44]=[0x28cc6]` (brake), `[0x28b46]=[0x28cc7]` (hand brake), then the common car update 0x190a0 runs.
* Menus (main menu, hits/laps/engine/cup/zone screens and the 'PRESS FIRE' waits) read only P1's record, except the PLAYER TWO vehicle screen (6.1).

### 9.5 'PRESS F1 TO VIEW YOUR CONTROLS' help screen, function 0xc0f4 (A=0xC0F4..0xC88B)
* Called from the vehicle screen on F1 (A=0xB413 in the non-link input path; A=0xB2DF in the link branch) with eax = pointer to an (empty) string.
* Player shown: `[0x28b7e]` (link: always 0) in `[esp+0x3cc]`. Fills the screen (`[0x28b32..]=0,0,0x140,0xc8`, `[0x28ce9]=0x2c`, `[0x28ce8]=0x26`, `[0x28b24]=0xbb80`, `call 0x271e4`),
  hides the video page (`[0x28b24]=0xbb80`).
* Text (8x8 font via 0x48f4, centred except the label rows):
  y=8: 'PLAYER ' (obj2:0xc48) + (player+1 via 0x325f9) + ' CONTROLS' (obj2:0xc50).
  y=0x14: 'USE LEFT AND RIGHT CONTROLS TO CHOOSE' (obj2:0xc5c). y=0x1e: 'THEN PRESS FIRE TO SELECT THE CAR' (obj2:0xc84).
  (x=0x10, y=0x3c): the eax string (blank from the vehicle screen). Then six label rows from y=0x4c, step 10, x=0x10:
  'STEER LEFT      - ' (0xca8) + name[0], 'STEER RIGHT     - ' (0xcbc) + name[1], 'ACCELERATE      - ' (0xcd0) + name[2], 'FIRE WEAPONS    - ' (0xce4) + name[3],
  'BRAKES          - ' (0xcf8) + name[4], 'HAND BRAKE TURN - ' (0xd0c) + name[5], where name[k] = `[0x17432 + 0x54*player + 14*k]` (14-byte records).
  Joystick/game-pad: name[4]/name[5] replaced by 'BUTTON3'/'BUTTON4' (0xd20/0xd28); game-pad type `[0x1ee4a]`/`[0x17128]` (P1) or `[0x1712c]`/`[0x1712a]` (P2) decide (A=0xC183..0xC1F5).
  A blank row, then the footnote: P1 (idx 0) 'F1 - F6 ARE YOUR GIGGLE KEYS!' (obj2:0xd30); P2 (idx 1, non-link) '1  - 6  ARE YOUR GIGGLE KEYS!' (obj2:0xd50) (A=0xC607..0xC64A).
  y=0xba: 'PRESS FIRE TO LEAVE HELP' (obj2:0xd70, centred, A=0xC748..0xC7A4).
* Exit: waits for F1 to be released (A=0xC7CE), then 0x178c4 / 0x17920 (wait for fire: P1's keys/Enter/Space), palette restore, returns to the vehicle screen.

## 10. Not determined / suggestions for verification

* Initial load of picbuf[0] before the vehicle screens (backdrop picture) and exact look of the vehicle screens (only the sprite/text calls were read).
* ESC behaviour of the 'RESTORE SAVED GAME / START NEW GAME' menu (no `[0x1ecc0]` test follows it, A=0xFC35..0xFC8D).
* The exact meaning of `[0x28c24]` (not the racer count) and of `[0x28c42]`, `[0x28c3c]`, `[0x28c44]`, `[0x28c38]` set at race entry.
* Which player is shown on the top and which on the bottom half in split screen (7.3).
* Whether any text accompanies the 2P-race rostrum after race 5 (only the title 'THE ROSTRUM' and sprites were found; segment A=0x1CC00..0x1D0F0 not read line by line); how cars with equal points are placed on the steps; what the animation at A=0x1CB84.. does exactly.
* The up/down/Enter navigation inside menu routine 0x55c0 was not traced (ISR sets `[0x28cdb]` Up, `[0x28cd2]` Down, `[0x28cce]` Enter/Space).
* Link-play (`[0x28c0c]!=0`) variants were only noted where they branch (A=0xF43C link menu: 'RACE HEAD TO HEAD' / 'RACE WITH ALL CARS' / 'SHOOT OUT GAME' / 'TERMINATE LINK').

## 11. Index of key routines (obj1 offsets)

| addr | role |
|---|---|
| 0xFA75 | main-menu `jmp [cs:esi*4+0xf824]` |
| 0xFB0E | items 1/2 start |
| 0xFB99..0xFC97 | saved-game probe and restore/new menu |
| 0xFCAE..0xFD84 | 2P race HEAD TO HEAD / ALL CARS menu |
| 0xFEE3..0xFF6C | PLAYER TWO vehicle pass (2P race) |
| 0xFFF3..0x100C0 | race loop (2P race) |
| 0x100F2..0x10377 | shoot-out |
| 0x1037C..0x105B4 | duck shoot (same helpers) |
| 0xA2F8 | car lock table |
| 0xA380..0xBE35 | vehicle selection |
| 0x9C68 | vehicle-screen sub-lines (KEYBOARD / JOYSTICK / GAME PAD, PRESS F1...) |
| 0x4380 | draws 8 car cells (+ red cross for P1's car at 0x46A5) |
| 0x9EAC / 0xA148 / 0x67D8 / 0x6664 | class / laps / engine / regular-bonus menus |
| 0x832C | cup (bronze/silver/gold) select screen |
| 0x93A8 | shoot-out zone select screen |
| 0x7928 | race/zone load and track number |
| 0xBE3C | driver roster |
| 0x1FD8C | the race function (setup 0x1FD95..0x20300, scoring 0x21229..0x214A2, 2P end 0x2150C, pause 0x221A3) |
| 0x1BBD8 | shoot-out winner screen |
| 0x1BFF0 / 0x1B270 | 2P race leaderboard |
| 0xC0F4 | F1 controls help screen |
| 0x277AE / 0x4B00 / 0x2784B | input poll / joystick setup / joystick axes |
| 0x30907 | keyboard ISR |
| 0x25F52 | WACKY.CFG loader |
| 0x55C0 | generic menu (eax = entries, returns 1-based choice, ESC -> `[0x1ecc0]`) |
