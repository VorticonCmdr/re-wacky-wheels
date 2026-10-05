# WACKY DUCK SHOOT: screens and flow in WW.EXE (survey, tag WF: leads, not facts)

Everything below is a subagent reading of `analysis/ww/obj1.asm` (static, nothing run in DOSBox). Addresses are
`obj1+0x...` (code, first column of obj1.asm) and `obj2+0x...` (data; the `[0x...]` operands are pre-fixup obj2
offsets). "read" = I read the instructions; "inferred" = a role guessed from use.

## 0. Method and conventions

- Disassembly: `analysis/ww/obj1.asm`; strings/tables from `analysis/ww/obj2.bin`; jump tables read from `obj1.bin`.
- WACKY.DAT was opened read-only with a throw-away Python reader (directory: 2-byte count, 22-byte entries, name at +0,
  length dword at +14, offset dword at +18, member starts at offset+2, which matches `obj1+0x41f4` `add edx,0x2`) to confirm
  member names/sizes and to decode SBCS.PCX, BSBCS.PCX, ORDER.PCX to PNG (scratchpad) and measure their palette indices.
  Nothing under the repo was changed.
- obj2 strings sometimes appear to start 1 to 3 bytes earlier in a dump (tail of the previous record). Use the address the
  code uses (all addresses below are the code's).
- Helper routines (names are mine, behaviour read unless marked):
  - `0x418c(eax=name)`: look the name up in the archive directory (obj2+0x5080, 22 bytes/entry), seek the handle `[0x1d584]`
    to the member; returns 1 found / 0 missing; member index in `[0x28b00]` (obj1+0x418c..0x4201).
  - `0x17060(eax=name, edx=slot)`: open member, read it (minus the 0x80 PCX header and the 0x300 palette) into the buffer at
    `[obj2+0xa978 + 4*slot]` (obj1+0x17060..0x170d9). The data stays RLE-compressed.
  - `0x275cd`: decode the RLE picture at `[0x1d714]` into the VGA mode-X planes of the page `[0x28b24]` (port 0x3c4 plane writes).
  - `0x26f14`: copy one 0x3e80-byte page, dest page `[0x28b1a]`, source page `[0x28b1c]` (latch copy). Pages used: 0, 0x3e80,
    0x7d00 (hidden "clean background"), 0xbb80.
  - `0x27de0`: show page `[0x28b24]` (CRTC start address regs after vertical retrace).
  - `0x26cca`: read the 256 DAC entries into buffer `[0x1d760]`; `0xbf94(eax=pal)`: palette fade out (inferred);
    `0x22cf8(eax=pal)`: fade in to `pal` (inferred); `0x27cf1`: write `[0x28b10]` DAC entries from index `[0x28b1e]`, source
    buffer `[0x1d760]`.
  - `0x82d0(eax=A, edx=idx, ebx=count, ecx=flag, push B)` (obj1+0x82d0..0x8326): flag!=0: `A[3*idx..] = B[3*idx..]`;
    flag==0: `A[3*idx..] = A[0..]` (copy entry 0 over them).
  - `0x48f4(eax=x, edx=y, ebx=str, ecx=0)`: 8x8 text. `0x46d4(eax=x, edx=y, ebx=str, ecx=0)`: big font, 15x13 glyph cell
    (`[0x28b36]=0xf`, `[0x28b26]=0xd`); all centring code uses 11 px per character (`imul edx,ecx,0xb`, x=(320-11*len)/2).
  - `0x26fd0`: transparent sprite blit: pointer `[0x1d704]`, x `[0x28b32]`, y `[0x28b34]`, w `[0x28b36]`, h `[0x28b26]`.
  - `0x1a414(eax=text, edx=y)`: boxed banner, width 8*len+8, height 0x10, x centred, y=0x5c when edx=0.
  - `0x55c0`: generic menu (eax=item count, edx=initial item; returns 1-based choice, 0 = ESC); taken from docs/leads/menus.md
    section 1 and the callers I read.
  - `0x17920(mode)`: wait for fire (see 6.1). `0x1c04(id)`: play SFX. `0x1adc`: stop all SFX channels (clears the channel
    tables at obj2+0x1a960.. when `[0x1ee4e]`).
  - Timers (startup obj1+0x264c2..0x26503: `0x30e38(eax=0xbe8 tick handler, edx=Hz, ebx=1, ecx=&counter)`; handler obj1+0xbe8 is
    `mov eax,[eax+0xc] ; inc dword [eax]`): `[0x1e720]` ticks at 0x88 = 136 Hz, `[0x1e71c]` at 0xa = 10 Hz, `[0x1ea74]` at
    1 Hz. So `[0x1e71c]` counts tenths of a second.
  - Keyboard ISR obj1+0x30907 (INT 9, port 0x60): last raw scancode `[0x28cd0]` (break = +0x80); Enter(0x1c) and Space(0x39) ->
    `[0x28cce]`; F10(0x44) -> `[0x28ccd]` (screenshot hotkey `0x14c8`); Up(0x48) -> `[0x28cdb]`; Down(0x50) -> `[0x28cd2]`;
    plus 12 (scancode,state) byte pairs at `[0x1d990]`. (CORRECTION to docs/leads/menus.md, which calls F10 "wait/pause": `0x14c8` builds "WACK"+3-digit number+".PCX" and probes with fopen for the next free name (read to `0x1600`; the write part not read), evidently a screenshot hotkey; the
    `while ([0x28ccd]) wait` loops after each screen just wait for the key release.) `0x277ae` copies four button states from the control set `[0x1d8a4]`
    (+5,+7,+9,+0xb) into `[0x28b40],[0x28b42],[0x28b44],[0x28b46]` and reads joystick port 0x201 when `[0x28c74]!=1`; `0x2784b`
    turns joystick axes into `[0x28cd5]` left, `[0x28cdd]` right, `[0x28cd6]` up, `[0x28cd3]` down.
  - Edition words (read, obj1+0x24471..0x244d4): `42.GAM` and `20.GAM` both found -> `[0x1e574]=0`, `[0x1eca0]=3`; only `20.GAM` ->
    `[0x1e574]=0`, `[0x1eca0]=2`; neither -> `[0x1e574]=1`, `[0x1eca0]=1`. So `[0x1e574]=1` means SHAREWARE (docs/leads/menus.md
    calls it "REGISTERED"; the instructions say the opposite). The user's archive has both: `[0x1e574]=0`, `[0x1eca0]=3`.

## 1. Screen map (duck shoot, single player, no link)

| # | Screen / step | Routine | Ends with |
| - | - | - | - |
| 0 | main menu item 4 | jump table obj1+0xf824 index 3 = obj1+0x1037c (`jmp [cs:esi*4+0xf824]` at 0xfa75) | - |
| 1 | CHOOSE VEHICLE | obj1+0xa380 (first part; one routine for all modes) | fire = chosen; ESC = main menu |
| 2 | REGULAR ZONES / BONUS PACK ZONES menu | obj1+0x6664, called inside 0xa380 at 0xbd87 | choice 1/2; ESC = main menu |
| 3 | SHOOTOUT ZONE / BONUS SHOOTOUT ZONE picture, six thumbnails | obj1+0x93a8 (loop label 0x10495) | fire = zone chosen; ESC = main menu |
| 4 | LOADING ZONE banner, then intro "THE WACKY DUCK SHOOT" | obj1+0x7928, then obj1+0x1b5e8 (eax=0) | fire starts race; ESC = back to 3 |
| 5 | the race, 02:00:0 countdown (format MM:SS:T), score digits | obj1+0x1fd8c | clock reaches 0 (or LEAVE ZONE in the ESC menu) |
| 6 | (new score only) DUCK SHOOT HALL OF FAME name entry | obj1+0xcb44, called at 0x1b6d7 | Enter or ESC |
| 7 | YOUR DUCK SCORE end screen | obj1+0x1b5e8 (eax=1), called at 0x21142 | fire; then back to 3 |

## 2. The driver: obj1+0x1037c

Step by step (all read):

1. `0x1037c` `[0x28be2]=0` (two-player flag), `0x10385` `[0x28bdc]=0` (shootout flag), `0x1038e` dword `[0x1ea58]=2`,
   `0x10398..0x103a7` `[0x28c22]=0`, `[0x28c20]=[0x1ee58]`.
2. `0x103ad..0x103bd`: `eax=sx[0x1ee5a]; [0x1ee5a]=2; [0x1eca8]=eax`. The engine word is saved and forced to 2 for the session;
   restored at `0x10590..0x105af` (`[0x1ee5a]=[0x1eca8]`, `[0x1ea58]=[0x1eca8]`).
3. `0x103c2` `[0x28bce]=1`; `0x103cb` `[0x28c96]=6` (zone cursor, see 5); `0x103d4` `[0x28c58]=0`; `0x103dd` `[0x28b9e]=0` (abort
   flag); `0x103e6` `[0x28b4a]=0`.
4. `0x103ef..0x10409`: `[0x28b24]=0x7d00`, `[0x1d714]=[0xa978]` (picture slot 0 = CHECK.PCX, the main-menu background),
   `call 0x275cd` (drawn into the hidden page 0x7d00); `0x10436` `[0x28b24]` restored.
5. `0x1040e` `[0x84e0]=0`, `0x10418` `[0x85e4]=0` (racer words), `0x10422` dword `[0x1ec74]=1` (DUCK FLAG), `0x1042c` dword
   `[0x1ec90]=1` (second flag; no reader found in obj1, writers only at 0xe4de, 0xe7cf, 0xf934, 0xfb33, 0x1042c, 0x105a5).
6. `0x1043d..0x10478`: CHECK.PCX drawn again into page 0x7d00, `[0x28b7e]=0` (player one), `call 0xa2f8` (table init at obj2+0x1d338,
   8 dwords, racer locks in shareware), `0x1047d` `call 0xa380` (vehicle screen, class/laps/engine skipped, zone-type menu: sections 3 and 4).
7. `0x10482` `[0x28b9e]!=0` (ESC in 1 or 2) -> `jnz 0x10573` (exit path B).
8. `0x10490` `call 0x227e0`: loads DIGGER.SP into two racer slots (6.3). Once per duck session, before the loop label.
9. Loop label `0x10495`: `[0x28b9e]=0`; `0x1049e` `call 0x93a8` (zone selection); `0x104a3` `[0x28b9e]!=0` (ESC) -> `jnz 0x10513` (exit path A).
10. `0x104ad..0x104bc`: `[0x28c90]=[0x28c96]-6` (zone index 0..5), `[0x28b88]=[0x28c96]` (zone value 6..11); `0x104c8` `[0x1d854]=[0x1d85c]`;
    `0x104d2` `call 0x7928` (loading card + intro); `0x104d7` `[0x28b9e]!=0` -> `jnz 0x10495` (ESC at the intro: back to zone selection).
11. `0x104e1` `[0x28bce]=1`, `0x104ea` `[0x28bcc]=0`, `0x104f3` dword `[0x1ecd0]=1`, `0x104fd` `call 0x1fd8c` (the race, end screen is drawn
    inside it), `0x10502` `[0x1ecd0]=0`, `0x1050c` `call 0x1adc` (stop SFX), `0x10511` `jmp 0x10495`: after the race the game returns to the
    ZONE SELECTION screen (not to the vehicle screen, not to the main menu). `[0x28b96]` (vehicle) and `[0x28c96]` (zone cursor) are kept.
12. Exit path A (ESC at zone selection) `0x10513..0x10571`: `0x17060(CHECK.PCX obj2+0xe80, slot 0)`, `[0x1d760]=[0x1d850]`, `0x26cca`, `0xbf94`,
    `0x418c`/`0x32c68` re-read CARS.SP (obj2+0x11c0, 0x18f00 bytes = 8 slots x 0x31e0) into `[0x1d708]` (undoes the DIGGER.SP overwrite),
    `0x228d4` (rebuild slot pointer tables and names obj2+0x1bba0..), `[0x28b24]=0`, `[0x28bda]=1`.
13. Common exit `0x10573..0x105b4`: `[0x28bb6]=1`, `[0x28b88]=1`, **`0x10585` `call 0x25718` (writes WACKY.DTT, section 9)**, `[0x1ee5a]=[0x1eca8]`,
    `[0x1ec74]=0` (`0x10590`), `[0x1ec90]=0` (`0x105a5`), `[0x1ea58]=[0x1eca8]`, `jmp 0xf878` (main menu loop). Exit path B enters here directly
    (CHECK.PCX/CARS.SP not reloaded: DIGGER.SP is not loaded yet at that point).

## 3. Screen 1: CHOOSE VEHICLE (obj1+0xa380..0xbe3b)

- `fn@0xa380` (prologue `sub esp,0x17c` at 0xa386, epilogue `add esp,0x17c` at 0xbe2f) is one routine for all modes. Duck-specific points (read):
  - `0xa3c9..0xa3e4` copies "CHOOSE VEHICLE" (obj2+0xb50) to `[esp+0x50]`; the "PLAYER ONE/TWO" replacement (`0xa3ec..0xa429`) is skipped
    (`[0x28be2]==0`, `[0x28bdc]==0`).
  - Title: `0xa44e..0xa46b` x=(320-8*14)/2=104, `0xa5d5 call 0x48f4` y=0x60=96, ecx=0. Two lines from `0x9c68` (call `0xa437`): controller label "KEYBOARD" /
    "JOYSTICK #n" / "GAME PAD #n" (obj2+0x920/0x908/0x914) at x=0x2e=46, y=0xaf=175 (`0xa5e5..0xa5f0`) and "PRESS F1 TO VIEW YOUR CONTROLS" (obj2+0x92c) at
    x=46, y=0xbc=188 (`0xa5fa..0xa610`). Racer name/tagline via `0x6b38` (calls at `0xa925`, `0xba59`); racer sprites 38x28 via `0x26fd0`
    (`[0x28b36]=0x26`, `[0x28b26]=0x1c`) from the slot table obj2+0x13c08 + 0x98*slot (CARS.SP data).
  - Background restore every frame: `0xa641..0xa652` copies page 0x7d00 to the draw page (`[0x28b1a]=[0x28b24]`, `[0x28b1c]=0x7d00`, `0x26f14`), which is why
    section 2 step 4 draws CHECK.PCX into page 0x7d00.
  - Keys (loops `0xab3d..0xad17`, `0xb294..0xb54d`): left `[0x28cd5]`, right `[0x28cdd]`, fire `[0x28b40]` (Enter/Space `[0x28cce]` or the configured fire words,
    zeroed when key word 0 is Up/Down), F1 (`[0x28cd0]==0x3b`) opens the controls help `0xc0f4` (`0xb2df`, `0xb415`), ESC (`[0x28cd0]==1`) sets `[0x28cec]` and
    `0xb52e..0xb537` set `[0x28b9e]=1`. Result `[0x28b96]` = racer slot 0..7 (`0xbe22`).
- After the racer is chosen: `0xbc55` `[0x28b9e]=0`, `call 0x4264`; the "PLAY FOR n HITS" menu (`0xbc84..0xbcf5`) is skipped for duck (`0xbc63 cmp [0x28be2],0 ; jz 0xbd32`).
  Then (`0xbd32..0xbd87`):
  - `0xbd3c call 0x9eac` (class menu): duck has `eax=[0x28be2]|[0x1ec74]!=0`, so `0x9f5f jnz 0xa107` sets `[0x28bb2]=4` with no menu, then `0xa12d` `[0x84e0]=0`, `[0x85e4]=0`.
  - `0xbd4b call 0xa148` (laps): `0xa15b cmp [0x1ec74],0 ; jnz 0xa2f0` returns at once.
  - `0xbd5f call 0x67d8(eax=2)` (engine menu): `0x6803 cmp [0x1ec74],0 ; jnz 0x6978` returns at once.
  - `0xbd6e..0xbd87`: `edx=[0x28be2] or [0x1ec74]` (=1), `eax=2`, `call 0x6664` (zone-type menu, section 4).
  - `0xbd8c` `[0x28b9e]!=0` -> `jnz 0xbe08` (ESC: leave with `[0x28b9e]=1`).
  - `0xbde0..0xbe02` (duck/two-player): `[0x28b88]=[0x28c96]` (6 on first entry) and **`[0x28bb6]=3`** (cup word 3 = gold; it selects the GOLD / BONUS GOLD branch in 5.4).

## 4. Screen 2: REGULAR ZONES / BONUS PACK ZONES menu (obj1+0x6664)

- `0x6669` `[0x1ecb4]=0` (cleared on every entry), `0x6673` `[0x28b9e]=0`.
- Shown only if `[0x1eca0]==3` (`0x6693 cmp [0x1eca0],3`, `0x669c ebp=1`, `0x66a3 jz 0x67d2`): the archive must contain `42.GAM` (bonus pack). Otherwise the routine returns at once and
  `[0x1ecb4]` stays 0 (regular zones only).
- Called with `eax=2` (`0x66b4`) and `edx!=0` (`0x66ed test edx,edx`): `0x66f6..0x6714` item 1 " REGULAR ZONES    " (obj2+0x4e4) -> obj2+0x1bc3c, item 2 " BONUS PACK ZONES "
  (obj2+0x4f8) -> obj2+0x1bc78 (edx==0 would give REGULAR RACES / BONUS PACK RACES, obj2+0x50c/0x520). Menu: `[0x28bb0]=0xd` (style, `0x66a9`), `[0x28c80]=1` (initial item, `0x66e4`),
  `0x6749 call 0x55c0(eax=2, edx=0, ebx=0, ecx=0)`.
- Result: ESC (latch `[0x1ecc0]` -> `[0x28b9e]=1`, `0x6767..0x6770`) returns; otherwise only if the choice is 2: `0x67c8` dword **`[0x1ecb4]=3`** (bonus pack). `[0x1ecb4]` is 0 or 3
  (the main-menu loop top clears it again at `0xf8a0`).
- ESC leaves via `0xbd8c` -> `0x10482 jnz 0x10573`: back to the main menu (and WACKY.DTT is rewritten).

## 5. Screen 3: zone selection (obj1+0x93a8..0x9c65)

### 5.1 What it draws
- Picture: `0x9480 cmp [0x1ecb4],0`: bonus -> "BSBCS.PCX" (obj2+0x8c4, copied `0x9490`); regular -> "SBCS.PCX" (obj2+0x8d0, copied `0x949b`). Archive members (checked): SBCS.PCX 40376 bytes
  (member 41), BSBCS.PCX 37412 (member 45), both 320x200 8 bpp. **The six arena thumbnails and the title are baked into the picture** (decoded: "Shootout Zone" / "Bonus Shootout Zone" at the
  top on a red checkerboard; three thumbnails per row; blue label bars "ZONE 1".."ZONE 6" under them). No separate thumbnail files or sprites are used.
- Palette: `0x94b1..0x94e7` open the member (`0x418c`), seek to `length-0x300` (`0x4218`), read the 0x300 palette bytes into `[0x1d848]` (`0x424c`), shift to 6 bit (`0x16ec4`).
  `0x94f3 call 0x17060(name, edx=2)`: picture data into slot 2 (`[0xa980]`). `0x9501..0x9512` draw it (`0x275cd`) into page `[0x28b24]=0`; `0x951e call 0x27de0` shows it.
- Music: `0x93d3..0x9417`: if `[0x1eaf0] != [0x1c658]` the current song is switched to `[0x1c658]` = ASHES (song handles obj2+0x1c648+4i: 0 MAINMENU, 1 LEADRBRD, 2 GAMEOVER, 3 SPACEY, 4 ASHES,
  per docs/leads/race-sound.md 6.2) with `0x1834(1)`.
- Shareware lock: texts built at `0x9421..0x9466` (obj2+0x844/0x860/0x8a8 " PLEASE SEE MAIN MENU TO / FIND OUT HOW TO ORDER / THESE EXTRA ZONES.") and shown by `0x9bb6 call 0x1a268(eax=3, ebx=0)` when
  `[0x28c0c]==0 && [0x1e574]!=0 && [0x28c96] > 7` (`0x9b7e..0x9b99`, SFX 0x1a at `0x9b9b`): in the shareware edition zones 3 to 6 cannot be chosen. Not relevant for the full archive.

### 5.2 Selection state and highlight (palette trick)
- Cursor word `[0x28c96]` = 6..11 (6 = ZONE 1). Initial 6 (`0x103cb`), kept between games. zone number n = `[0x28c96]-5`; palette index of that zone's label bar = `[0x28c96]-1` = 5..10.
- Measured in the PCX: the label bars are filled with palette indices 5..10 (ZONE 1 idx 5 x 7..97 y 94..103; ZONE 2 idx 6 x 114..204; ZONE 3 idx 7 x 221..311; ZONE 4 idx 8 x 7..97 y 178..187; ZONE 5 idx 9;
  ZONE 6 idx 10); the text on the bars uses indices >= 16; palette entry 0 is (0,0,0); all six bars are the same blue (about 43,107,227). Same in both pictures.
- `0x9543..0x9561` copy the 0x300-byte palette `[0x1d848]` to a stack buffer A (`[esp]`); `0x9563..0x958a` for si=5..10 `0x82d0(A, si, 1, flag=0, [0x1d848])` = entries 5..10 of A overwritten
  with entry 0 (black): every label bar hidden; `0x958c..0x95a7` `0x82d0(A, [0x28c96]-1, 1, flag=1, [0x1d848])` restores only the selected bar; `0x95ae call 0x22cf8(A)` fades in; `0x95ef`
  `[0x1d760]=A`, `0x95e2` `[0x28b10]=1`; `0x95c0 xor eax,eax ; call 0x178c4` (read obj1+0x178c4..0x1791e) first waits until Enter/Space and all four button words are released (no ESC check with eax=0).
  So the base state is: only the selected zone's label bar is visible (blue), the other five are black.
- **The selected bar blinks** (read `0x99fd..0x9a6a`, which I first missed): each main-loop pass does `0x9a04 inc esi` (esi starts 0 at `0x9549`); when `esi > 0xc` (`0x9a13 cmp si,0xc ; jng 0x9a6c`) the code toggles the flag
  `[esp+0x328]` (init 0 at `0x95b5`, so the first toggle hides): flag==0 -> `0x9a43` ecx=0 (hide: `0x82d0(A, di, 1, 0, B)`), flag := 1 (`0x9a55`); flag!=0 -> `0x9a22` ecx=1 (restore), flag := 0 (`0x9a36`);
  then `0x9a60 call 0x82d0`, `0x9a65 call 0x27cf1` (DAC entry `[0x28b1e]=di=[0x28c96]-1`), `0x9a6a esi=0`. A selection change writes flag=0 (`0x9a87`, `0x9b05`) so the newly selected bar starts visible.
  Cadence (derived, check on screen): one pass is at least 8 ticks of the 136 Hz counter (`0x9633 [0x1e720]=0`, wait `0x964e`) = about 59 ms; a toggle every 13 passes = about 0.76 s. So the highlighted label's blue bar
  blinks blue/black, the five others stay black, and the "ZONE n" text stays visible on all six bars (it uses palette indices >= 16).
- Changing the selection (`0x9a6c..0x9b63`): left/up: `0x82d0(A, old=[0x28c96]-1, flag 0)` + `0x27cf1` (hide the old bar on the DAC), `0x9a9c dec [0x28c96]` (wrap `<6 -> 0xb`, `0x9aa5..0x9aaf`),
  `0x82d0(A, new, flag 1)`, `[0x28b1e]=new`, `0x27cf1`; right/down: same with `0x9b1a inc [0x28c96]` (wrap `>0xb -> 6`, `0x9b23..0x9b2d`). No SFX on moves. After any action `0x99c7` sets
  `[0x1e720]=0` and waits 0x14 ticks (136 Hz, about 0.15 s) (`0x99f4`); ESC breaks the wait.

### 5.3 Keys and exit (read)
- Per pass: `0x9692 call 0x4b00`, `0x9697 call 0x277ae`; `0x969c..0x9727` map: key word 0 is Up/Down -> `[0x28b40]=0`; Enter/Space `[0x28cce]` -> `[0x28b40]=1`; configured left key `[0x1b6d9]` or Up
  (`[0x28cdb]`/`[0x28cd6]`) -> `[0x28cd5]` (previous zone); configured right key `[0x1b6db]` or Down (`[0x28cd2]`/`[0x28cd3]`) -> `[0x28cdd]` (next zone). ESC: `[0x28cd0]==1` -> `[0x28cec]=1`
  (`0x9657..0x966b`). Frame limiter `0x964e`: up to 8 ticks.
- Fire (`[0x28b40]!=0`, `0x9b68`): `0x9b72 call 0x1c04(0x12)` (select SFX); full version: `0x9bbb jz 0x9c53` returns with `[0x28b9e]=0`, zone in `[0x28c96]`.
- ESC (`[0x28cec]!=0`, `0x9bca`): no link: `0x9c23..0x9c4d` copies A back into `[0x1d718]`, returns `[0x28b9e]=1`.
- Link-play branches (`[0x28c0c]!=0`, `0x1dd30`) exist and are not described.

### 5.4 Zone -> track, music, minimap
- Loading card `0x7a6b`: `eax=[0x28bb6]+[0x1ecb4]-1` = 3+0-1 = 2 (regular) or 3+3-1 = 5 (bonus); `cmp eax,5 ; ja`; jump table obj1+0x7910 (read from obj1.bin: 0x7a8a, 0x7ada, 0x7af5, 0x7b0e, 0x7b24, 0x7b3a):
  - idx 2 `0x7af5`: `[0x20ace]="GOLDM.SP"` (obj2+0x740), **`[0x1e728] = [0x28b88] + 0xa`** = 16..21. REGULAR zones 1..6 = tracks 16..21 (`[0x28b88]=[0x28c96]`, set at `0x104bc`).
  - idx 5 `0x7b3a`: "BONUSG.SP" (obj2+0x764), **`[0x1e728] = [0x28b88] + 0x1f`** = 37..42. BONUS zones 1..6 = tracks 37..42.
  - Archive members 16..21 and 37..42 each exist as .RD .M .PAR .POS .SPW .SIN, and .GAM (checked in the directory).
- File names: `0x179e8..0x17a00` itoa(`[0x1e728]`) into obj2+0x1d770, then `<n>.PAR` (obj2+0xa4b8), `<n>.SPW` (obj2+0xa508), `.RD`, `.POS` ... (obj1+0x17aa0..0x17d00); `.GAM` check in `0x1717c`.
- Race music: `0x22e60` (call `0x7b57`) takes the `[0x28be2]||[0x1ec74]` branch (`0x22e71..0x22e86`) to `0x23410`: slot names at obj2+0x1c530 + 0xe*k: k=0 BANSHI (obj2+0x1b6c), 1 KARD (0x1b64),
  2 TURBO (0x1b34), 3 BRICWALL (0x1b74), 4 STARBRAI (0x1b4c), 5 FLIGHT (0x1b44) + the runtime extension at obj2+0x20adc (.KLM/.MID, written at `0x1ce8`/`0x1d59`). The zone index `[0x28c90]` (0..5)
  picks the slot (`0x8265..0x8278`: `[0x28c90]*0xe + 0x1c530` -> `0x418c`, read into `[0x1eb00]` at `0x82ad..0x82bd`). Started at race start (`0x1ff1c..0x1ff57`: `[0x1eaf0]=[0x1eb00]`, `0x1834(1)`).
  The song depends only on `[0x28c90]`, so bonus zone k plays the same song as regular zone k.
- Minimap lead: `0x179e8` reads picture `[0x28b88]-1` (0xf3c bytes each, `0x17a49..0x17a89`) from the file named at obj2+0x20ace when the overhead-map option `[0x28ca0]` is on. For zones that index is 5..10,
  beyond the five pictures of GOLDM.SP / BONUSG.SP, so the read runs into the next archive members (BONUSB.SP / BONUSS.SP for the regular zones). Unknown whether the duck HUD draws it.

## 6. Screen 4: LOADING ZONE and the intro (obj1+0x7928, obj1+0x1b5e8 with eax=0)

### 6.1 obj1+0x7928 for duck (read)
1. `0x795b..0x79f5`: `[0x28be2]==0`, `[0x28bdc]==0` -> `[0x1ed30]=0`, `[0x28bde]=0`, `[0x1eb80]=1`, `[0x1eb82]=0`.
2. `0x7a11` duck skips the LAP.SP digit cut; `0x7a6b` medal/track selection (5.4); `0x7b57 call 0x22e60` (race song names).
3. `0x7b6a cmp [0x1ec74],0 ; jnz 0x7d2d`: banner text **"LOADING ZONE"** (obj2+0x7cc) copied to `[esp+0x50]` (`0x7d31..0x7d39`).
4. `0x7d3a call 0x27de0`, `0x7d5f..0x7d65 call 0x1a414(eax=text, edx=0)`: boxed banner, y=0x5c=92, width 8*12+8=104 -> x=108, drawn over the still-visible zone picture.
5. `0x7d6a call 0x179e8`, `0x7d6f call 0x1754c` (loads the track files), `0x7d74` `[0x28b7e]=0`, `0x7d91 call 0x73c4` (loads the player's own racer file `obj2+0x1bba0 + 12*slot` =
   PANDA/CAMEL/MOOSE/PELICAN/SHARK/RINGO/ELE/TIGER.SP into `[0x1d6c8]`, `0x73f5..0x7430`).
6. `0x7ddb..0x7e3f`: `[0x1d998]==0`; duck skips the SHRINKn.PCX preview (`0x7ddb cmp [0x1ec74],0 ; jnz 0x7e36`); `0x7e3f xor eax,eax`, **`0x7e41 call 0x1b5e8` (intro screen)**.
7. `0x7e46..0x7e8c`: `0x418c([0xa4b8])` = `<n>.PAR`, read 0x6400 bytes into `[0xa980]` (slot-2 buffer, picture already drawn), `0x26f55` writes them as raw planar pixels into page 0x7d00
   (the track's PAR data sits in VRAM page 0x7d00 during the race). `0x7e91..0x7ea3`: `[0x28b1c]=0 ; [0x28b1a]=0x3e80 ; 0x26f14` (page 0 -> page 0x3e80), `[0x28b24]=0`, `0x27de0` (show page 0 = intro).
8. `0x7ed6..0x7ee8`: fade in with `0x22cf8([0x1d718])` (skipped when `[0x1d998]==3` or `[0x1ec80]!=0`).
9. Wait: `0x7f15 cmp [0x28c0c],0` (no link) `0x7f1f eax=1 ; call 0x17920` -> `[0x28b9e]` (`0x7f29`); nonzero -> `jnz 0x82c2` return (ESC; caller loops to zone selection). Else `0x8237..0x82bd` reads the
   race song into `[0x1eb00]` and returns `[0x28b9e]=0`.
- `0x17920(1)` (read obj1+0x17920..0x179e6): clears `[0x28b40..46]`, loops `0x277ae`; returns 1 on ESC (`[0x28cd0]==1`, mode != 0); returns 0 when Enter/Space (`[0x28cce]`) or any of the four button
  words `[0x28b40..46]` is set. No timeout (only mode 2 has one, 0x440 ticks). So the intro ends on Enter / Space / a player-1 fire or button key / joystick button; ESC aborts the zone.
  **No release wait**: it zeroes the four words at `0x17924..0x17946` but `0x277ae` re-reads the live key state each loop, so a key still held counts at once. Which control-set entries feed `[0x28b40..46]` (`0x277ae` reads +5,+7,+9,+0xb
  of the control set, i.e. the state bytes of entries 2..5): from the CONTROLS help order (`0xc3c0..0xc433`: STEER LEFT, STEER RIGHT, ACCELERATE, FIRE WEAPONS, BRAKES, HAND BRAKE TURN, key names fetched in that order from obj2+0x17432 + 0x54*player + 0xe*k)
  I infer `[0x28b40]` = ACCELERATE, `[0x28b42]` = FIRE, `[0x28b44]` = BRAKES, `[0x28b46]` = HAND BRAKE (to check against WACKY.CFG; this is consistent with the menus' "key word 0 is Up/Down -> not fire" test on `[0x1b6dc]`).
  If that holds, a player still holding accelerate when the intro appears (or when time runs out, see 8.4) passes the wait immediately.
- Banner colours: `0x1a414` sets `[0x28ce8]=0x26`, `[0x28ce9]=0x2c` (`0x1a470`, `0x1a477`) before the box routine `0x271e4` (palette indices 0x26 and 0x2c for border/fill, not traced further), text at (box x+4, box y+4) = (112, 96) for LOADING ZONE
  (`0x1a483..0x1a49f`, `0x48f4` ecx=0). Text colours of `0x48f4`/`0x46d4` glyphs are in the font data (WFONT1.SP / OFONT.SP) and were not traced; `0x48f4` with ecx=1 draws its own box with the same 0x26/0x2c colours (`0x4959`, `0x4963`), ecx=2 uses 0x2c/0x2c.

### 6.2 Intro screen: obj1+0x1b5e8 with eax=0 (`[esp+0xd0]=mode`)
- `0x1b5fb..0x1b605` `0x17060("ORDER.PCX" obj2+0x1624, slot 2)`; `0x1b60a..0x1b61e` `[0x1d760]=[0x1d850]`, `0x26cca`, `0xbf94`; `0x1b623..0x1b644` `[0x28b24]=0`, `[0x1d714]=[0xa980]`, `0x275cd`.
  ORDER.PCX (member 425, 7609 bytes) decodes to a plain blue checkerboard without text. The end screen and the leaderboard (docs/leads/finish-ui.md section 8) use the same background.
- Texts (x = (0x140 - len*cell)/2):
  - Title "THE WACKY DUCK SHOOT" (obj2+0x1658, 20 chars, copied `0x1b816..0x1b824`): `0x46d4` x=50, y=0x0a=10 (`0x1b842..0x1b84d`, ecx=0).
  - "YOU HAVE TWO MINUTES TO" (obj2+0x1670, 23 chars, copied `0x1b876..0x1b882`): `0x48f4` x=68, y=0x1e=30 (`0x1b8b7..0x1b8c6`). (0x166e, the address quoted in the task, is two stray bytes before it; the only
    code use of 0x166e is `0x7a29 add eax,0x166e`, an offset into the LAP.SP digit buffer, unrelated.)
  - "BLAST AS MANY DUCKS AS YOU CAN!" (obj2+0x1688, 31 chars, `esi` loaded at `0x1b8a9`): `0x48f4` x=36, y=0x28=40 (`0x1b900..0x1b90d`).
- Two "duck on car" pictures (common to intro and end screen, `0x1b912..0x1b97a`), 38x28 (`[0x28b36]=0x26`, `[0x28b26]=0x1c`) via `0x26fd0`:
  - left: x=0x4c=76, y=0x3c=60, pointer `[obj2+0x13c24 + 0x98*[0x1ec70]]` = frame 7 of racer slot `[0x1ec70]` (`0x1b912..0x1b94b`);
  - right: x=0xcd=205, y=0x3c=60, pointer `[obj2+0x13c0c + 0x98*[0x1ec6c]]` = frame 1 of racer slot `[0x1ec6c]` (`0x1b950..0x1b97a`). Both come from DIGGER.SP (6.3).
- "THE WACKY DUCK TOP SHOOTERS" (obj2+0x16a8, 27 chars, copied `0x1b95a..0x1b97f`): `0x46d4` x=11, y=0x6e=110 (`0x1b9ba..0x1b9c4`).
- Table lines (`0x1b9c9..0x1bac8`, i=0..3, y=0x82+10*i = 130,140,150,160, `0x48f4`, ecx=0, `0x1bab3`): text = name record i (obj2+0xe768+0x18*i, 16 chars space padded) + " " (obj2+0xa0) + 2-digit score
  (itoa of the dword at obj2+0xe77c+0x18*i via `0x325f9`, '0' prefixed if one digit, `0x1ba2f..0x1ba49`), centred x=(320-8*len)/2 (19 chars -> x=84). With the default file: "SHAUN           16" etc.
- Mode 0 returns at `0x1bace` (`cmp [esp+0xd0],0 ; jz 0x1bbc9`): no waiting inside; the caller (6.1 steps 7 to 9) shows it and waits.

### 6.3 DIGGER.SP and racer slots (obj1+0x227e0)
- DIGGER.SP (obj2+0x1acc; archive member 17024 bytes = 2 x 0x2140 = two sets of 8 frames of 38x28 = 0x428 bytes) is loaded by `0x227e0` (called at `0x10490`): `[0x1ec70]` = 0 if the player's racer `[0x28b96]` != 0, else 1
  (`0x227f4..0x22804`); `[0x1ec6c]` = the first slot index equal to neither the player's racer nor `[0x1ec70]` (`0x2280d..0x22822`). The first 0x2140 bytes go to `[0x1d708] + [0x1ec70]*0x31e0` (`0x22822..0x22852`), frame
  pointers `obj2+0x13c08 + 0x98*slot + 4k = base + 0x428*k` (`0x22857..0x22879`); the next 0x2140 bytes (same open handle, no second `0x418c`) go to slot `[0x1ec6c]` (`0x2287b..0x228c3`). So the two lowest racer slots that are not
  the player's are overwritten with duck-on-car sprites; `0x228d4` / exit path A restore CARS.SP.

## 7. Screen 5: the race (obj1+0x1fd8c): duck-specific parts (read, not exhaustive)

- Start (`0x1fd95..0x1fdd0`): **`[0x1ec88]=0x4b0` (1200)**, `[0x1e71c]=0` (clock, 10 Hz), `[0x1ec84]=0` (time-up flag), `[0x28ca8]=0`, **`[0x1edb4]=0` (score)**, `[0x1ecc4]=0`. `0x1fe96` `[0x28c40]=7` (7 opponents), `0x1ff00..0x1ff09`
  forces 7 again for duck. `0x20139..0x20172`: duck -> `[0x28c38]=0`, `[0x28c44]=2` (state "racing" at once; the normal race has `[0x28c38]=1`, `[0x28c44]=0` and the start sequence), so no 3-2-1 start. `0x6cdd..0x6cf0`: speed word `[0x28c7c]=0x24`.
- Countdown: HUD routine around `0x1a92c..0x1aab1`. Duck (`0x1a9e9 cmp [0x1ec74],0`): `remaining = [0x1ec88] - [0x1e71c]` (`0x1a9f6..0x1aa03`); `<=0` -> `[0x1ec84]=1` (`0x1aa09`). 1200 tenths = 120 s = "two minutes".
  `0x1a618` formats it as "MM:SS:T" (template obj2+0x15e4 "00:00:0"; t=v%10, s=(v/10)%60, m=v/600; `0x1a637..0x1a6e9`), so the start value reads `02:00:0`; `0x1a6f8(eax=0x108=264, edx=0x70=112, ebx=str)` draws it in the 7x9 timer font at x=264, y=112 (`0x1aa19..0x1aa28`).
  The normal race-clock block `0x1a97a..0x1a9c9` is skipped for duck (`[esp+0x2c]=0` at `0x1a967`).
- Score digits (`0x1aa2d..0x1aaac`): itoa(`[0x1edb4]`), zero-padded to 2 digits, two 10x9 digit sprites (`[0x28b36]=0xa`, `[0x28b26]=9`) from the ASCII table obj2+0xe380 (LAP.SP digits, docs/leads/hud.md) at x=0x1a=26 and x=36,
  y=0x20=32, via `0x273ee`. The coin counter and the status pill are skipped for duck (`0x1ad4e`, `0x1b06a`).
- Scoring (`0x189ec..0x18b0c`, per racer `[0x1d800]`, 0x68-byte records): in duck the expiry is 4 (`0x18a11 ebx=4`; normal 0x21/0x32). When `[0x1ec64] - [racer+0x4c] >= 4` (`0x18a9f..0x18aa3`): `[racer+0x58]=0`,
  **SFX 0x0d** (`0x18ab4 call 0x1c04`, BOOM per docs/leads/race-sound.md), `racer+0x56=0, +0x58=0, +0x5c=0, +2=2`, then **`[0x1edb4] += 2` if `[racer+0x26] == [0x1ec6c]`, else `+= 1`** (`0x18adb..0x18af0`), capped at
  0x63 = 99 (`0x18af6..0x18aff`). So every target whose hit state runs out gives 1 point, the racer in the second DIGGER slot gives 2. What starts that state (`[racer+0x58]`) was not traced.
- SFX: in duck `0x1c04` (`0x1c16..0x1c3e`) ids 0..7 other than the player's slot `[0x28b96]` play buffer `[0x1eaec]` (QUACK.VOC or BELCH.VOC, loaded by `0x36f8` / `0x3780` when `[0x1ecf8]`), nothing with digital sound off.
  (docs/leads/race-sound.md line 197 calls `[0x1ec74]` "a linked game"; it is the duck flag.)
- End of race: `0x21124 cmp [0x1ec84],0 ; jz 0x2114c`, `0x2112d cmp [0x28b24],0x3e80 ; jnz` (only right after a page flip), then `0x21138 call 0x1adc`, `0x2113d eax=1`, **`0x21142 call 0x1b5e8` (end screen)**,
  `0x21147 jmp 0x227aa` (return from the race routine to `0x10502`).
- ESC in the race: `0x21072` sets `[0x28cec]`; the pause code `0x22154..0x225b2`: duck (`0x221c8`, `0x221ce` -> `0x22252`) shows " BACK TO ZONE " (obj2+0x1a94) and " LEAVE ZONE " (obj2+0x1aa8) (a third " RESTART RACE " is copied but
  `[0x28b72]=2` at `0x222f2`, so two items), `0x2230b call 0x55c0`. Result 2 (LEAVE ZONE) -> `jz 0x227aa`: return without end screen (back to zone selection). Other results resume (`0x22593..`); the 10 Hz clock is saved in ebp at
  `0x22189` and restored at `0x225a7`, so the countdown is frozen during the pause.

## 8. Screens 7 and 6: end screen and hall of fame (obj1+0x1b5e8 with eax=1; name entry obj1+0xcb44)

### 8.1 Qualification (read)
- Score `[0x1edb4]` vs the four table scores (dwords at obj2+0xe77c + 0x18*i, kept descending): `0x1b65b..0x1b68a`: `cmp score,[0xe77c] ; jl next`; loop `edx=0x18..0x48`: `cmp score,[edx+0xe77c] ; jnl qualify` (signed).
  **Qualifies if score >= any of the four, i.e. >= the 4th (ties qualify).** With the default table: score >= 6.
- Not qualified: `0x1b806` title "YOUR DUCK SCORE" (obj2+0x1648), table unchanged, no name entry.
- Qualified (`0x1b692..0x1b6d7`): music `[0x1c64c]` = LEADRBRD via `0x1834(0)`; then **`0x1b6c6..0x1b6d7`: `eax=[esp+0xa0]` name buffer, `edx=0x1630` ("DUCK SHOOT HALL OF FAME"), `ebx=0xf`, `call 0xcb44`**. Afterwards the screen is rebuilt
  (`0x1b6dc..0x1b715`: palette read, fade, ORDER.PCX redrawn with `0x275cd`) and the entry inserted (8.3).

### 8.2 Name entry obj1+0xcb44 (eax=buffer, edx=title, ebx=max index; read `0xcb44..0xce10`)
- `0xcb55..0xcb6c`: `[0x28b1a]=0x7d00 ; [0x28b1c]=[0x28b24] ; 0x26f14` saves the screen to page 0x7d00; each loop pass restores it (`0xccd9..0xcce4`).
- This is **the screen that shows "DUCK SHOOT HALL OF FAME"**. There is no separate list screen; the list is the TOP SHOOTERS block of the intro/end screens. On the ORDER.PCX checkerboard:
  - title (edx string): `0x46d4` x=(320-11*23)/2=33, y=0x0a=10 (`0xcb71..0xcba5`);
  - "PLEASE ENTER NAME.." (obj2+0xd8c, copied `0xcb92..0xcbbf`): `0x48f4` x=0x0a=10, y=0x60=96 (`0xcbca..0xcbce`);
  - typed name: `0x48f4` x=0xaa=170 (=10+0xa0, `0xcc91..0xcc9a`), y=96, 8 px per character (`0xcd25..0xcd40`);
  - cursor marker: 15x13 sprite `[0x1eb2c]` at (cursor x, y=91) via `0x26fd0` (`0xcce4..0xcd16`); cursor x starts 170, +8 per accepted character, clamp 170+8*(max+1)=298 (`0xcc9e..0xccb5`, `0xcdef..0xcdfa`).
- Buffer init (`0xcc6e..0xcc90`): 16 spaces + NUL (obj2+0xda0, 17 bytes) when `ebx > 0xb` (duck passes 0xf), else 12 spaces (obj2+0xdb4).
- Keys: DOS `getch` (`0xcd88 call 0x32c4d`, blocking). The game's INT 9 handler is removed and the BIOS one restored while in this routine (`0xcc2f..0xcc5b`, DOS 25h/09h with the vectors in `[0x1d58c]`, `[0x1d5a4]`) and re-hooked at the end by
  `0x22b14` (INT 9 -> obj1+0x30907, flush buffer, clear key flags `0x22ba4`).
  - Enter (0x0d) or ESC (0x1b) finish (`0xcd8f..0xcd9f jz 0xce04`; ESC keeps the text typed so far).
  - `al>=0x61` is upper-cased (`sub bl,0x20`, `0xcd9f..0xcda3`); Backspace (8): `di>0` -> `dec di`, cursor -8, `buffer[di]=' '` (`0xcda6..0xcdb9`).
  - Accepted: `A`..`Z`, space, `0`..`9` (`0xcdbd..0xcdd8`); anything else ignored (loop `0xccca`).
  - Max length: stores only while `di <= ebx` (`0xcdde..0xcde8`), so **16 characters** with ebx=0xf; the string stays 16 characters padded with spaces.

### 8.3 Insertion (`0x1b723..0x1b7e7`)
- First `i` (0..3) with `score >= table[i].score` (`0x1b728..0x1b800`, `jl` skips): the new entry goes there; entries `i..2` move down to `i+1..3` (`0x1b737..0x1b7ae`: strcpy of the name text and dword copy of the score, the last entry is dropped; `i==3`
  skips the move). `0x1b7ae..0x1b7e7`: `table[i].score = [0x1edb4]`, `table[i].name = [esp+0xa0]` (strcpy). A tie goes above the equal entry. Then title "YOUR DUCK SCORE" (`0x1b7e8..0x1b7f6`).

### 8.4 End screen drawing (eax=1, `0x1b825..0x1bbc9`)
- Same ORDER.PCX background. Title "YOUR DUCK SCORE" (obj2+0x1648, 15 chars): `0x46d4`, x=77, y=10.
- Big score: `0x1b85c..0x1b86c call 0x1b558(eax=0x8a=138, edx=0x3c=60, ebx=[0x1edb4])`: itoa, zero-padded to 2 digits (`0x1b56f..0x1b586`), two 22x29 sprites (`[0x28b36]=0x16`, `[0x28b26]=0x1d`) from the ASCII table obj2+0xe350 (the
  22x29 LAP.SP digit frames, obj2+0xe410..) at x=138 and x=138+0x16=160, y=60, via `0x26fd0` (`0x1b58f..0x1b5d4`). The two duck pictures (6.2) are at x=76 and x=205 on the same row; "THE WACKY DUCK TOP SHOOTERS" and the table follow as in 6.2.
- `0x1badc..0x1bb67`: `[0x1eaf0]` set to `[0x1c658]` = ASHES when different, `0x1834(1)`; text "PRESS FIRE" (obj2+0x7dc, 10 chars, copied `0x1bb22..0x1bb2b`) with `0x48f4` x=120, y=0xb4=180; `0x27de0` shows; `0x1bb91..0x1bb9b`
  `[0x1d854]=[0x1d85c]`, `0x22cf8` fade in.
- Wait: **`0x1bba2 xor eax,eax ; call 0x17920`** = mode 0: Enter/Space or any player-1 button word; ESC is not checked in mode 0; no release wait (see 6.1: `0x178c4` is not called here), so a held accelerate/fire key
  (probable meaning of `[0x28b40..46]`, 6.1) would dismiss the screen right after the fade; a check rather than a finding. The only release wait in this flow is `0x178c4(0)` at `0x95c0` (zone selection entry) and `0xcc2a` (name entry).
- `0x1bba7..0x1bbc0`: palette save/fade (`0x26cca`, `0xbf94`), `[0x28b9e]=0`, return into the race routine, which returns (`0x21147`) to `0x10502`.

## 9. WACKY.DTT: storage, load, save (read)

- File "WACKY.DTT" (obj2+0x1fb0) in the game folder, path prefix string at obj2+0x1c158 (`0x25574`, `0x25725`). Not an archive member.
- In memory: 96 bytes at obj2+0xe768 = 4 records of 0x18 bytes: char[20] name (16 characters space padded, then NULs) at +0, dword score at +0x14 (obj2+0xe77c, +0xe794, +0xe7ac, +0xe7c4). On disk the same 0x60 bytes (the installed file
  is exactly that: SHAUN, ANDY, NUGGET, RUEBEN with 16, 12, 8, 6).
- Load: `0x25534` (called once at startup from `0x26845`): fopen name + "rb" (obj2+0xbc, `0x255a6..0x255d8`); if it opens, `0x255e1 jnz 0x256ed` reads 0x60 bytes into obj2+0xe768 (`0x256ed..0x25705`). If it does not exist it builds defaults:
  names from obj1+0x238 ("SHAUN", "ANDY", "NUGGET", "RUEBEN", 10 bytes each, `0x25540..0x25567`) padded with " " to 16 characters (`0x2564f cmp ecx,0x10`, `0x25654..0x25681`), scores 0x10, 0xc, 8, 6 (`0x25551..0x25569`, `0x2569b..0x256a5`),
  writes the file ("wb" obj2+0xc0, fwrite 0x60 bytes, `0x256b4..0x256df`), reopens and reads it.
- Save: `0x25718` (fopen "wb", fwrite 0x60 bytes from obj2+0xe768, fclose, `0x25781..0x2579b`). **Its only caller is obj1+0x10585 (duck-shoot exit).** New scores live in memory only (they show in the next intro/end screens) and reach the
  disk when the player leaves the duck shoot with ESC (vehicle screen, zone-type menu or zone selection).

## 10. After the end screen and other exits

- After "PRESS FIRE" the game goes back to zone selection (section 5), cursor on the zone just played. ESC there -> main menu (WACKY.DTT rewritten).
- ESC at the intro -> zone selection. ESC in the race -> pause menu (BACK TO ZONE = resume, LEAVE ZONE -> zone selection, no end screen, no score entry). Time up -> end screen -> zone selection.

## 11. Data words (obj2 offsets) that matter

| Word | Meaning (as read) | Sites |
| - | - | - |
| 0x1ec74 (dword) | DUCK flag 1/0 | set 0x10422, cleared 0x10590; 69 fixup sites in total |
| 0x1ec90 (dword) | second duck flag, no reader found | 0x1042c, 0x105a5 |
| 0x28be2 / 0x28bdc | two-player / shootout flags (0 in duck) | 0x1037c, 0x10385 |
| 0x28b96 | chosen racer slot 0..7 | 0xbe22 |
| 0x28bb2 | class word, 4 in duck | 0xa107 |
| 0x28bb6 | cup word, 3 in duck (gold) | 0xbdf9 |
| 0x1ecb4 | bonus word, 0 regular / 3 bonus | 0x6669, 0x67c8 |
| 0x1eca0 / 0x1e574 | edition level 1..3 / shareware flag | 0x24471..0x244d4 |
| 0x28c96 | zone cursor 6..11 (zone = value-5) | 0x103cb, 0x9a9c, 0x9b1a |
| 0x28c90 | zone index 0..5 (song slot) | 0x104ad |
| 0x28b88 | zone value 6..11 (track = +10 or +31) | 0x104bc, 0xbdf3 |
| 0x1e728 | track number 16..21 / 37..42 | 0x7af5.., 0x7b3a.. |
| 0x28b9e | abort flag (1 = ESC) | many |
| 0x28cd5 / 0x28cdd / 0x28b40 / 0x28cec | left / right / fire / ESC flags in menus | 5.3 |
| 0xa978 + 4*slot | picture buffer pointers (slot 0 CHECK.PCX, slot 2 SBCS/BSBCS/ORDER) | 0x17060 |
| 0x1ec70, 0x1ec6c | racer slots receiving DIGGER.SP set 1 / set 2 (set 2 scores 2) | 0x227e0 |
| 0x1ec88 | duck time limit 0x4b0 tenths = 02:00:0 | 0x1fd95 |
| 0x1e71c | race clock, 10 Hz | timers 0x264e5 |
| 0x1ec84 | time-up flag | 0x1aa09, 0x21124 |
| 0x1edb4 | duck score 0..99 | 0x1fdbc, 0x18ae7, 0x18af0 |
| 0xe768 + 0x18*i | WACKY.DTT table (name 20, score dword at +0x14) | 0x1b9bf, 0x25725.. |
| 0x28c44 / 0x28c38 | race phase (2 = racing at once in duck) / start-sequence flag | 0x20139.. |
| 0x28c40 | number of opponents, 7 | 0x1fe96, 0x1ff09 |
| 0x1ecd0 | 1 while the race call runs | 0x104f3, 0x10502 |
| 0x1eca8 | saved engine word | 0x103bd |

## 12. Negative findings (tool, technique, date) and caveats

- Date of all checks below: 2026-10-05. Tool: Python over `analysis/ww/fixups.json` and `analysis/ww/obj1.bin` (not Ghidra, not DOSBox). The obj1.asm listing is a linear sweep with data decoded as code (jump tables at 0x7910, 0x9da8,
  0xa360, 0x18b10), so a grep of it can lose sync; the checks therefore use the fixup table (every absolute obj2 operand has a fixup) and a byte scan.
- obj2 reference counts (fixups with `targetObject==2`, exact target; the obj1 sites are the fixup offsets, instruction address = site - 1 or - 2):
  - 0x1ec90 (second duck flag): 6 sites, all writes (`0xe4e0, 0xe7d1, 0xf936, 0xfb35, 0x1042e, 0x105a7`; addresses of the stores are those minus 2). No exact-target reader. Limit: an access through `[reg+base]` with a different base would not match.
  - 0x1630 DUCK SHOOT HALL OF FAME: 1 site (`0x1b6ce`); 0x1648 YOUR DUCK SCORE: 2 (`0x1b7f0`, `0x1b80e`); 0x1658 title: 1 (`0x1b81e`); 0x1670: 1 (`0x1b87e`); 0x1688: 1 (`0x1b8aa`); 0x16a8: 1 (`0x1b962`). All inside obj1+0x1b5e8.
  - 0x1fb0 "WACKY.DTT": 2 sites (`0x255a7` loader, `0x2574b` saver). 0xe768 (table): 9 sites, all in `0x1b5e8` (`0x1b748, 0x1b74e, 0x1b7b2, 0x1b9c0`) or the load/save code (`0x255ee, 0x2563d, 0x256cd, 0x256ee, 0x2578e`);
    0xe77c (first score): 6 sites (`0x1b666, 0x1b682, 0x1b72d, 0x1b7c6, 0x1ba27, 0x256a7`). So the table is touched only by the duck screens and the DTT load/save.
  - 0x1ec74 (duck flag): 69 fixup sites (not 60); 0x1edb4 (score): 11 sites (`0x18ae9, 0x18af2, 0x18af8, 0x18b01, 0x1aa40, 0x1b65c, 0x1b674, 0x1b724, 0x1b7be, 0x1b868, 0x1fdbe`); 0x1ec88: 2; 0x1ec84: 3 (`0x1aa0b, 0x1fdab, 0x21126`).
- obj1 call-target checks (byte scan of every `E8`/`E9` rel32 in obj1.bin and fixups with `targetObject==1`; no function-pointer uses of any of these):
  - 0x25718 (save DTT): one call, `0x10585`. 0x227e0 (DIGGER.SP load): one call, `0x10490`. 0x1b5e8: calls at `0x7e41`, `0x21142`. 0xcb44 (name entry): `0xce78`, `0x1b6d7`, `0x1e769`.
  - 0x93a8 (zone selection): `0x10286` (the two-player shoot-out flow, obj1+0x100f2) and `0x1049e`. 0x6664: `0xbd87`, `0x10fa2`. 0x7928: `0xe5c5`, `0x10006`, `0x102ba`, `0x104d2`. 0x1adc: 12 calls.
- Not determined / caveats:
  - Nothing was run; sizes and positions come from constants. Check 5.2 (blink, only the selected bar visible) on screen.
  - Palette handling at the intro (which palette `[0x1d718]` / `[0x1d85c]` holds for ORDER.PCX) not traced; fade routines `0xbf94`, `0x22cf8` described only by use.
  - `0x55c0` (menu drawing and keys) not re-read here (taken from docs/leads/menus.md).
  - Which in-race event puts a racer into the state that scores (`[racer+0x58]`), the hit/AI code, `[0x1ec90]`'s role, and whether the overhead map is drawn for zones are open.
  - About 69 `cmp [0x1ec74],0` sites exist in obj1 (e.g. `0x316d, 0x31b7, 0x33a4, 0x113f5..0x11af7, 0x12986..0x135c9, 0x154ca, 0x16a77, 0x188fe..0x19e52, 0x1fb78, 0x20bac, 0x20cb6, 0x21e6b, 0x22e7f`); I read only those named in sections 2 to 8.
  - Shareware branches (locked zones, 0xa2f8 racer locks) noted, not explored.
