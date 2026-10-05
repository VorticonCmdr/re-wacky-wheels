<!-- WF: output of a subagent's read of the disassembly (analysis/ww/obj1.asm, obj1.bin, obj2.bin, fixups.json) and of the user's WACKY.DAT on 2026-10-04; a lead, not evidence. The maintainer has not re-read it. Citations are offsets with no fingerprints (take them with `npm run cite` before a claim uses them). Nothing was run in DOSBox. -->

# How the race plays sound (WF lead, 2026-10-04)

**Status: WF.** Every statement below is read from the flat disassembly of `WW.EXE` (`obj1+0xNNNN` = code object offset, `obj2+0xNNNN` = data object offset; `fixups.json` was used to resolve whether an immediate or absolute address belongs to obj1 or obj2) and, for the bank and VOC numbers, from the user's `WACKY.DAT` through the existing decoders (`src/vfs/node.js`, `src/formats/dat.js`, `audio-bank.js`, `voc.js`, `voc-audio.js`). Where an existing claim already covers a fact it is named (`audio.load`, `audio.record-roles`, `audio.speaker-player`, `voc.library-player`, `voc.rate-observed`, `klm.player`, `midi.player`, `car.speed-model`, `terrain.lookup`). Nothing here is observed at run time. Items I did not read are in the last section.

## 0. Additions and notes on text already in the repo

- The sound record table has **27** records (`audio.load` observed the 26 that the loop builds; the 27th is a later copy, so this adds to that claim and does not dispute it): the bank loader copies record 18 into a 27th record at obj2+0x1ac38 (`obj1+0x20e6` to `+0x2110`), and the digital loader runs its store loop 27 times (ebp 0x18 to 0x288, `obj1+0x2341` to `+0x23a0`) from a 27-name array (`0x51` dwords = 27 x 12 bytes, `obj1+0x2130`). `audio.load`/`audio.record-roles` state 26.
- The **names of the 27 sounds** are a table in the code object, `obj1+0x10`, 27 entries of 12 bytes: UNO, SULTAN, MORRIS, PEGGLES, RAZER, RINGO, BLOMBO, TIGI, PASS, BELL, START, GLASS, WARP, BOOM, HORN, SPLASH, PLIP, SKID, PUF, FLAME, HOG, CLANG, SWIPE, DROP, BACKFIRE, STALL1, NO (`obj1+0x2137` loads `obj1+0x10` as the source of the copy; fixup `o1+0x10`). Appending `.VOC` gives the member names (`obj1+0x21e2`, `+0x22e5`; the suffix string is obj2+0x240). `docs/leads/pickups.md` section 7 ("the sound-number to file mapping was not traced") is answered by section 2 below.
- `obj1+0x1bbc` is **"is this sound still playing"**, not stop (it sets the word obj2+0x28c62 to 0 or 1, `obj1+0x1bbd`, `+0x1beb`). The routine that stops one voice is the library's `obj1+0x31e24`; the one that stops everything and resets the records is `obj1+0x1adc`. `docs/leads/menus.md` calls `0x31dd4`/`0x31e24` "sound for the intro music" and `0x1adc`/`0x1c04` "sound start/stop (inferred)": `0x31dd4` is the voice is-active routine and `0x31e24` the voice stop routine (device tables read in section 1.2), and `0x1c04` starts a sound.
- `docs/leads/menus.md` line 147 says SPACEY and ASHES are not referenced. They are: the five songs loaded at start-up are MAINMENU, LEADRBRD, GAMEOVER, SPACEY, ASHES (name array at `obj1+0x1fc`, section 6.2). (This file does not edit menus.md.)

## 1. How a sound number reaches a speaker

### 1.1 State words (obj2 offsets)

| Word | Meaning as read | Cite |
| --- | --- | --- |
| 0x17404 | effects device = file offset 0x786 of WACKY.CFG (`cfg.md`); -1 means no effects | start-up `obj1+0x1d94` (skip when -1), `+0x1db3` (check call), `+0x1df7` (init call) |
| 0x17408 | music device = CFG 0x78a; -1 means no music | `obj1+0x1ced`, `+0x1d0d` |
| 0x1ee4e | effects enabled: cleared at `obj1+0x1cc8`, set to 1 only after the library init of the effects device returned 0 | `obj1+0x1e25` |
| 0x1ecf8 | "digital voices" flag: 1 when the effects device is not 7 and not 2 (devices 0, 1, 5, 6 as far as they pass the device gate) | `obj1+0x1e2e` to `+0x1e40` |
| 0x1ed48 | copy of 0x1ecf8 taken at init | `obj1+0x1e6b`, `+0x1e70` |
| 0x1ee46 | music enabled (set after the music init succeeded) | `obj1+0x1d44` |
| 0x1ed4c | music init done | `obj1+0x1d7b` |
| 0x17428 / 0x1d890 | effects volume (CFG 0x7aa, default 240 in `cfg.md`); 0x1d890 holds the copy that every effect play passes to the library | `obj1+0x1e57` (call `0x31a0c`), `+0x1e61`, `+0x1e66`; volume menu `obj1+0xedef` to `+0xedfe` |
| 0x1742c | music volume (CFG 0x7ae, default 250), applied by library `obj1+0x320dc` | `obj1+0x1d71`, `+0x1d76`; menu `obj1+0xeddc`, `+0xede1` |
| 0x174da | engine volume (CFG 0x85c, default 100) used only for the engine loop voice | `obj1+0xd4c`, `+0xd57`, menu `obj1+0xee29` |
| 0x1ecd0 | "race in progress": 1 right before the race routine is called and 0 right after (`obj1+0x1001e`, `+0x1002d`); the per-record play counter only counts while it is set | `obj1+0x1c87`, `+0x1c90` |
| 0x1ec74 | the linked-game flag (the existing notes call it network; I did not read how it is set) | `obj1+0x1c16` |
| 0x28c62 | result word of the is-playing routine | `obj1+0x1bbd`, `+0x1beb` |
| 0x28b96 | the viewer's driver number 0 to 7 ("the driver's own sound"), copied from 0x28c6a when the viewer changes | `obj1+0x2265b`; read by every site that plays "0x28b96" below |

### 1.2 The routines

- **Play, `obj1+0x1c04` (eax = sound number).** Returns at once when 0x1ee4e is 0 (`obj1+0x1c08`). In a linked game (0x1ec74 != 0) and for a number 0 to 7 that is not the viewer's own driver word 0x28b96, it does not use the record's data: with no digital voices (0x1ecf8 = 0) it plays nothing, with them it plays the buffer at obj2+0x1eaec instead, using the record of the requested number for pitch, priority and handle (`obj1+0x1c16` to `+0x1c3e`, then `+0x1c55`). Otherwise the number 0xff is replaced by 3 (`obj1+0x1c40` to `+0x1c47`) and the data pointer is record+0. It then calls the library play `obj1+0x31bc8` with eax = data pointer, edx = record dword +8, ebx = ecx = obj2+0x1d890 and on the stack (last pushed first) 0x1d890, record dword +0xc (priority) and 0 (`obj1+0x1c58` to `+0x1c78`). A return value above 0 is stored as the voice handle at record +0x10, and +0x14 is incremented while 0x1ecd0 is set (`obj1+0x1c7d` to `+0x1c90`). A failed play (0 or -2) stores nothing.
- **Is playing, `obj1+0x1bbc`.** Sets 0x28c62 = 0; if effects are on and the record's handle is not -1 it asks the library `obj1+0x31dd4`; a live voice sets 0x28c62 = 1, a dead one clears the record handle to -1 (`obj1+0x1bbc` to `+0x1bf6`). It looks only at the last handle stored for that sound number.
- **Reset, `obj1+0x1adc`.** Calls library stop-all `obj1+0x31ec8` (`obj1+0x1aec`), then sets every record's handle to -1 and its counter to 0 (`obj1+0x1af1` to `+0x1bb6`). Called at the end of each race (`obj1+0x10037`, `+0x102f9`, `+0x1050c`) and from `obj1+0x1fcf5`, `+0x200e4`, `+0x21138`, `+0x21463`, `+0x21594`, `+0x21d7a`, `+0x250e6`, `+0x576d`, `+0xe5db`.
- **Library entries** (all dispatch on the device word obj2+0x3fe8 = the effects device, `audio.speaker-player`): play `0x31bc8` (device table `obj1+0x31ba8`: 0, 1, 6 go to the digital player `obj1+0x39615`; 5 to `obj1+0x37d34`; 7 to the PC-speaker player `obj1+0x37248`; 2, 3, 4 and above 7 are errors); is-active `0x31dd4` (table `0x31db4`: 0, 1, 6 to `0x38e34`; 5 to `0x37838`; 7 to `0x372cc`); stop one voice `0x31e24` (table `0x31e04`: 0, 1, 6 to `0x38e94`; 5 to `0x37870`; 7 to `0x3712c`); stop all `0x31ec8` (table `0x31ea8`: 0, 1, 6 to `0x38e5d`; 5 to `0x378ac`; **7 does nothing**, `obj1+0x31ec4` points at the plain return `0x31f1e`); set one voice's pitch `0x31b44` (edx = pitch, table `0x31b24`: 0, 1, 6 to `0x3903c`; 5 to `0x37950`; **7 returns without doing anything**, `obj1+0x31b40` points at `0x31ba5`); set the effects volume `0x31a0c`.

### 1.3 Which data a sound number selects: the effects device

| Effects device (0x17404) | Reaches the race? | Loader | What the records point at |
| --- | --- | --- | --- |
| -1 | no effects; every play and every is-playing call is a no-op | `obj1+0x1d94`, `+0x1e77` | nothing |
| **7 PC speaker** | yes (observed, `audio.speaker-state`) | bank loader `obj1+0x1f98`, called from `obj1+0x215e` | `AUDIOT.FX` slots 0 to 25 (base 0): PC-speaker chunks (`audio.load`) |
| **2 AdLib** | **no**: the check/init refuse 2 ("Invalid Sound Fx device.", `audio.device-gate-run`, PROVEN) | the same bank loader with base 26 (`obj1+0x2007` to `+0x2010`) would take slots 26 to 51, the AdLib-effect chunks | unreachable: I found no other way to the second bank, so **nothing plays it** and slot 26+k is not "the AdLib version of sound k" |
| 3, 4 | no: 3 and 4 are refused by the init table (`audio.device-gate`) | - | - |
| **0 Sound Blaster, 1 Pro AudioSpectrum, 6 Sound Source** | yes (0 observed with `BLASTER` in DOSBox, `voc.rate-observed`) | digital loader, the rest of the same routine: `obj1+0x2124` falls to `obj1+0x2168` when the device is not 7 or 2 (`obj1+0x214c` to `+0x215c`) | the 27 VOC members, each read whole into the buffer obj2+0x1eb14 (`obj1+0x22b2` to `+0x23a0`) |
| **5 Gravis UltraSound** | by the same loader (flag 0x1ecf8 is set, `obj1+0x1e40`); the player `obj1+0x37d34` is not read | digital loader | the same VOC members |

Which names the digital loader reads: for k = 0 to 26 the 12-byte name k of the array at `obj1+0x10` is copied to a stack buffer, `.VOC` is appended, the archive member is looked up with `obj1+0x418c` and read with `obj1+0x32c68` for the size in the directory entry (`obj1+0x2214` to `+0x2344`). Record k = pointer to that copy in the buffer, +8 = 0, +0xc = 27 - k, +0x10 = -1, +0x14 = 0 (`obj1+0x2349` to `+0x2383`).

The digital loader also reads **five GIG samples**, `GIG1.VOC` to `GIG5.VOC` (name = obj2+0x23c "GIG" + decimal digit + ".VOC", five passes, `obj1+0x2182` to `+0x2262`), into the dword table obj2+0xa490 (+4 each) and sets obj2+0xa4a4 and +0xa4a8 equal to obj2+0xa4a0 (`obj1+0x2268` to `+0x2272`); then `MOTOR.VOC` into obj2+0x1eb10 (`obj1+0x2288` to `+0x22a2`) and, after the records, `HORN1.VOC` into obj2+0x1eae0 (`obj1+0x23bf` to `+0x23d9`). The loop that resets the horn state follows (`obj1+0x23de` to `+0x2479`). None of these three are numbered sounds (sections 5.1 to 5.3).

### 1.4 The records (obj2+0x1a9c8, 27 x 0x18 bytes)

`+0` data pointer, `+4` chunk length (bank mode only; the digital loader leaves it alone), `+8` pitch offset in cents passed to the play call (0 in both loaders), `+0xc` priority, `+0x10` voice handle (-1 none), `+0x14` play counter (`audio.record-roles`).

- **Bank mode**: pointer = AUDIOT buffer + AUDIOHED offset of slot k (`obj1+0x2032`); priority 27 - k (`obj1+0x2015` to `+0x206d`, ecx counts 0x1b down); then records 0 to 7 are overwritten with record 20's pointer and length (`obj1+0x2075` to `+0x20e4`, `audio.alias`) and **record 26 is overwritten with record 18's pointer, length, priority and handle** (`obj1+0x20e6` to `+0x2110`; sound 0x1a plays slot 18's chunk at priority 9). Record 25 keeps priority 2.
- **Digital mode**: priority 27 - k for k = 0 to 26, except **record 25 (STALL1) gets 0x20** (`obj1+0x23a6`) and **record 26 (NO) gets record 18's priority, 9** (`obj1+0x23b0` to `+0x23ba`). Records 0 to 7 are not aliased.

### 1.5 Priority, stealing, looping, volume, pitch

- **PC speaker (device 7)**: one voice. A new sound whose priority argument is **below** the stored one is refused (returns -2, `obj1+0x3724e` to `+0x3725b`), equal or higher replaces it: the stored priority is set at `obj1+0x372ab`; the stop routine zeroes it (`audio.speaker-player`). The chunk is played once, one byte per tick (`audio.speaker-tick` PROVEN). Is-active is true only for the last handle and while its byte counter is above 0 (`obj1+0x372cc` to `+0x372ec`). There is no looping, no pitch argument, and no engine, horn or giggle voice (all gated on 0x1ecf8, below).
- **Digital voices (devices 0, 1, 6)**: eight voices (`voc.rate-observed`). A free voice is taken if there is one; otherwise the active voice with the lowest priority is found (`obj1+0x38f8d` to `+0x38fa4`, ties keep the earlier one) and it is stopped and reused **only if the new priority is greater than or equal to it** (`obj1+0x38fa6` to `+0x38fae`); a lower priority fails (library error 3, play returns -2, `obj1+0x39659`, `+0x31bfb` to `+0x31c05`). The voice record keeps the priority at +0x78 and the callback at +0x88 (`obj1+0x397d2` to `+0x397ea`), the callback is 0 in every play call I read. Unguarded plays of the same number simply start another voice (the record handle is overwritten); guarded ones (below) wait for the previous voice of that number to end.
- **Looping**: the digital player starts at the block list after the VOC header (it adds the header-size word at file+0x14 to the data pointer, `obj1+0x3966d` to `+0x3968e`; this answers the open "whether the 26-byte header is skipped" in `voc.library-player`). Only a VOC with a repeat block loops, and the only such file is `MOTOR.VOC` (type 6 with count 0xffff, then the block, then type 7: loops for ever, `voc.library-player`, section 5.1). Every numbered sound is a single-block VOC and plays once.
- **Pitch** (digital only): the cents in edx (record +8, or the value computed by the caller) go through `obj1+0x3f140`. It builds, once, a table of 12 x 25 dwords from 1/300 (obj2+0x2c84), 2.0 (obj2+0x2c94) and 65536 (obj2+0x2c8c) (`obj1+0x3f0c0` to `+0x3f12b`: row r, column j holds the value of 2 raised to ((25 r + j) / 300), times 65536, truncated, i.e. cents = 100 r + 4 j), then takes the cents modulo 1200 for the row and column (4-cent steps) and shifts by the whole octaves (`obj1+0x3f163` to `+0x3f1e1`); a value of 0 returns the table's first entry (`obj1+0x3f159`). The voice's rate is its base rate times that factor divided by the mixer rate word obj2+0x2b8f8 (`obj1+0x39089` to `+0x390a2`, set-pitch). For a port this is `playbackRate = sampleRate * 2 ** (cents / 1200)` to within the 4-cent step; the routine at `obj1+0x46284` that the table builder calls is not read.
- **Volume**: for a digital play the volume (0 to 255, clamped) shifted right by 4 becomes the voice's 0 to 15 levels (`obj1+0x396f4` to `+0x397c9`); which of the three copies is left or right is not read. For the PC speaker the effects volume is a byte at obj2+0x4330: 0 silences the speaker (clears bits 0 and 1 of port 0x61), anything else lets the tick handler drive it (`obj1+0x372f0` to `+0x3732e`).

## 2. Sound number to data

Names from the table at `obj1+0x10`. PC speaker = `AUDIOT.FX` slot k (chunk = 4-byte length, 2 bytes the player skips, payload, one 0 byte; playing time about payload bytes / 140 s, the 140 is the tick rate argument at `obj1+0x373f1`, not observed). VOC = member `<name>.VOC` of `WACKY.DAT` (rate = `1000000 / (256 - tc)` rounded down as in `voc.library-player`; samples and seconds are the output of `decodeVocAudio`). Priority is the digital value (27 - k, except 25 and 26); the speaker priority is 27 - k except record 26 = 9.

| N | Name | PC-speaker slot k: payload bytes (about s); offset in AUDIOT.FX | VOC: file bytes, rate, samples (s) | Priority (digital) | Where the race plays it (details in section 3) |
| --- | --- | --- | --- | --- | --- |
| 0 | UNO | slot 0 is empty (0 bytes): the record is record 20 (HOG) | 7634, 22222 Hz, 7601 (0.34) | 27 | driver voice of driver 0 |
| 1 | SULTAN | empty, record 20 | 3352, 8000, 3319 (0.41) | 26 | driver voice 1 |
| 2 | MORRIS | empty, record 20 | 6267, 8000, 6234 (0.78) | 25 | driver voice 2 |
| 3 | PEGGLES | empty, record 20 | 4042, 8000, 4009 (0.50) | 24 | driver voice 3; also the target of sound 0xff |
| 4 | RAZER | empty, record 20 | 7174, 8000, 7141 (0.89) | 23 | driver voice 4 |
| 5 | RINGO | empty, record 20 | 3637, 8000, 3604 (0.45) | 22 | driver voice 5 |
| 6 | BLOMBO | empty, record 20 | 5257, 8000, 5224 (0.65) | 21 | driver voice 6 |
| 7 | TIGI | empty, record 20 | 6078, 10000, 6045 (0.60) | 20 | driver voice 7 |
| 8 | PASS | 125 (0.89); 0x38 | 8281, 8000, 8248 (1.03) | 19 | passing another car |
| 9 | BELL | 62 (0.44); 0xbc | 6544, 8000, 6511 (0.81) | 18 | last-lap bell |
| 10 | START | 88 (0.63); 0x101 | 9166, 8000, 9133 (1.14) | 17 | green light |
| 11 | GLASS | 64 (0.46); 0x160 | 4775, 10000, 4742 (0.47) | 16 | wreck breaks up |
| 12 | WARP | 120 (0.86); 0x1a7 | 7230, 8000, 7197 (0.90) | 15 | boost, hop, jump terrain |
| 13 | BOOM | 174 (1.24); 0x226 | 7840, 8000, 7807 (0.98) | 14 | crash, wreck |
| 14 | HORN | 23 (0.16); 0x2db | 5720, 8000, 5687 (0.71) | 13 | car in the special surface state |
| 15 | SPLASH | 108 (0.77); 0x2f9 | 5811, 8000, 5778 (0.72) | 12 | special surfaces 6 and 0xf |
| 16 | PLIP | 63 (0.45); 0x36c | 2724, 8000, 2691 (0.34) | 11 | surface effect picture 24 rows high |
| 17 | SKID | 43 (0.31); 0x3b2 | 6425, 8000, 6392 (0.80) | 10 | steering slide, braking, spin-out, finish |
| 18 | PUF | 31 (0.22); 0x3e4 | 1531, 6024, 1498 (0.25) | 9 | shot ends; menu confirm click; slot also stands in for sound 0x1a in speaker mode |
| 19 | FLAME | 123 (0.88); 0x40a | 8126, 8000, 8093 (1.01) | 8 | fireball volley |
| 20 | HOG | 41 (0.29); 0x48c | 5700, 8000, 5667 (0.71) | 7 | hedgehog and ice shots; also the speaker stand-in for 0 to 7 |
| 21 | CLANG | 39 (0.28); 0x4bc | 1844, 6024, 1811 (0.30) | 6 | wall bounce, car contact |
| 22 | SWIPE | 30 (0.21); 0x4ea | 2865, 11111, 2832 (0.25) | 5 | tyre pickup, car contact |
| 23 | DROP | 22 (0.16); 0x50f | 2787, 8000, 2754 (0.34) | 4 | hop landing, devil/bomb/oil/inverted-hog shot |
| 24 | BACKFIRE | 50 (0.36); 0x52c | 7955, 10000, 7922 (0.79) | 3 | exhaust overlay, frozen racer state |
| 25 | STALL1 | 60 (0.43); 0x565 | 14028, 8000, 13995 (1.75) | **32** (speaker: 2) | ice hit, frozen racer state |
| 26 | NO | slot 18's chunk (31 bytes, record copy) | 3879, 8000, 3846 (0.48) | 9 (record 18's) | empty-gun click, refused giggle key |

PC-speaker bytes are the payload length dword (`audio-bank` slots 8 to 25); slots 0 to 7 have a length of 0. A non-empty chunk (`AUDIOT.FX` from the slot's offset, `6 + length` bytes) is what `decodePcSpeaker` takes. The two header bytes the player skips are "00 00" in every slot of the first bank.

Second bank (AdLib effect chunks, 23-byte header, trailer text), **for completeness only** (section 1.3: not reachable): slots 26 + k hold k = 8 to 14, 16, 18, 20 to 23 with payloads of 125, 56, 58, 64, 120, 63, 51, 63, 31, 40, 39, 41, 40 bytes; slots 26 to 33 (k = 0 to 7), 41, 43, 45, 50, 51 (k = 15, 17, 19, 24, 25) have 0 payload bytes; slot 26 + k does not necessarily hold the same sound as k.

## 3. Call sites in the race (frame, control, object, HUD code)

Format: call offset (the `call 0x1c04`), N, guard, what is going on. **Guard "G"** = the site first calls `obj1+0x1bbc` and plays only when the sound's last voice has ended (`[0x28c62]` = 0); **"-"** = it plays every time the code is reached. Routine entries are the nearest preceding return plus padding; where I name a routine that is only a branch target of a larger one I say so. All values read in the disassembly at the cited offsets.

| Call | N | Guard | What the surrounding code is doing |
| --- | --- | --- | --- |
| `obj1+0x166fc` | 10 START | - | Starter routine `obj1+0x166a8` (race.js claim): in countdown mode (`[0x28c44]` = 1) when `[0x1ec64] - [0x1eba8]` reaches 0x22 it sets `[0x28c44]` = 2 and `[0x28c5e]` = 2 and plays the green-light sound (`obj1+0x166e0` to `+0x166fc`). No sound plays at tick 0x11 or earlier in this routine. |
| `obj1+0x2c8a` | 9 BELL | G (`obj1+0x2c76`) | Lap-line routine `obj1+0x2b44` (called from `obj1+0x2279b`): when the helper `obj1+0x260c` returns 1 for the racer's position and the checkpoint word matches (`obj1+0x2b8f` to `+0x2ba7`) the racer's lap word (+0x9c, obj2+0x84c2) is increased by that result (`obj1+0x2bce`); when it then equals the laps word obj2+0x28b9c (the value at which the HUD banner reads LAST LAP!, `hud.md`) the bell plays and the racer words +0xce = 7, +0xd6 = 6 are set (`obj1+0x2c64` to `+0x2ca3`). |
| `obj1+0x11720` | 12 WARP | - | Routine `obj1+0x116a0` after the terrain lookup `obj1+0x27b04`: terrain value obj2+0x1e568 = 0xa (`obj1+0x116d4`) and the car not airborne (+0xa = 0): the car word +0xa becomes 1, +0xc and +0x10 become 8 (same state as the hop below), then the sound. (`surfaces.md` labels value 10 "pit: the car falls".) |
| `obj1+0x142d4` | 12 WARP | - | Hop start (routine at `obj1+0x14298`: car +0xa = 1, +0xc = +0x10 = 8, `[0x28bae]` = 4, +0xe = 0x28). The routine is entered by a branch or table; I found no `call` to it. |
| `obj1+0x14339` | 12 WARP | - | Boost start (routine at `obj1+0x142fc`: car +0xb4 = 1, throttle +0x42 = 0xa0, +0xb6 = 0x10, speed +0x26 = `VEL.TAB[0xa0]`). No `call` found. |
| `obj1+0x1d891` | 12 WARP | - | Input handling `obj1+0x1d6d0`: brake (`[0x28b44]`) and fire (`[0x28b42]`) together with ability bit 0x1 of car +0xe0 and +0xb4 = 0: boost start (same words as above). Skipped when `[0x1d998]` != 0. |
| `obj1+0x1d911` | 12 WARP | - | Input handling: brake and `[0x28b40]` together with ability bit 0x2 and the car on the ground: hop start (+0xa = 1, +0xc = +0x10 = 8), clearing +0x44 first. |
| `obj1+0x1982d` | 12 WARP | - | Car step (branch target `obj1+0x191e0` of the routine at `obj1+0x190a0`, which `obj1+0x225b7` calls every frame): terrain value 2 (boost strip, `car.speed-model`) and +0xb4 = 0 and the helper `obj1+0x25bc` returns non-zero: sound, throttle = 0xa0. |
| `obj1+0x11ac0` | 0xff (= 3 PEGGLES) | - | Shot-hits-racer routine (the branch for a human racer in the routine around `obj1+0x11945`; shot type = word +2 of the record at `[0x1d874]`), linked game only (`[0x1ec74]` != 0, `obj1+0x11ab2`). |
| `obj1+0x11b05` | 17 SKID | - | Same routine, unlinked game, when the hit counts (the flag in edx, `obj1+0x11aee` to `+0x11af1`; the linked flag is tested at `+0x11af7` and is 0 here). |
| `obj1+0x11b74` | 25 STALL1 | G (`obj1+0x11b5c`) | Same routine, ice shot (type 5, `obj1+0x11aa3`) on a human: racer +0x58 = 2, +0x4c = now. |
| `obj1+0x11bc5` | 13 BOOM | - | Same routine, human hit with `[0x28be2]` != 0 (and shot type <= 2): wrecked outright (`obj1+0x11bb7` to `+0x11bc0`); +0x56 and +0x58 cleared. |
| `obj1+0x11cab` | 25 STALL1 | G (`obj1+0x11c93`) | Hit routine for computer racers (`obj1+0x11c6a`), ice (type 5): racer +0x58 = 2. |
| `obj1+0x11cfe` | 17 SKID | - | Spin-out start (`obj1+0x11cbe`: viewer switched to the hit racer's record, `[0x1d5b0]` = obj2+0x8410 + 0x104 n); then the horn routine `obj1+0xc90` is called for the racer in `[0x1d800]+0x26` (`obj1+0x11d0c`). |
| `obj1+0x127d6`, `+0x12849`, `+0x12a15`, `+0x12a9b`, `+0x12b03`, `+0x12b85` | 17 SKID | - | Steering routines `obj1+0x127b7` and `obj1+0x12940`: the car's steer-hold counters (+0x22/+0x24 against the limits +0x3e/+0x3a) reach their limit and the car enters the sliding-turn state (+0x1a = 7 or 9, +0x32 = now, etc.). Six sites, all `mov eax,0x11`. |
| `obj1+0x12eb0` | racer word +0x26 (the other racer's slot 0 to 7) | G (`obj1+0x12e11`, `+0x12e3b`) | Object/car contact routine `obj1+0x12bf3`, racing mode (`[0x28c44]` = 2): a computer racer sprite is in contact range (`[0x1d86c]+0x1e` = 3 or 1, racer +0x58 = +0x5c = 0, own car +0x7e = 0). That racer's driver voice plays unless it is still playing; after the sound's play counter record +0x14 reaches 4 the horn routine takes over instead (`obj1+0x12e56` to `+0x12e93`). Linked games take the first branch (`obj1+0x12e08`), unlinked the second (`obj1+0x12e32`); both play the same number. |
| `obj1+0x12fa0` | 8 PASS | G (`obj1+0x12f7a`) | Same routine: racing mode, another racer's sprite in the passing zone (`[0x1d86c]+0x1e` = 3 or 2, `obj1+0x12f4c`): PASS, linked-game branch. |
| `obj1+0x12fd1` | 8 PASS | G (`obj1+0x12fbd`) | Same, unlinked branch; afterwards when record 8's counter (obj2+0x1aa9c) exceeds 4 and the horn of the viewer's slot (word +0x26 of racer record obj2+0xaa90 + 0x68 v) is not playing, that horn starts and the counters reset once the horn counter exceeds 3 (`obj1+0x12fd6` to `+0x1303d`). |
| `obj1+0x1328a` | `[0x28b96]` (viewer's driver, 0 to 7) | - | Object contact: pickups of kinds 2 to 7 (ammo/item, `docs/leads/pickups.md`); the object is then marked 0xffff. |
| `obj1+0x132f7` | 22 SWIPE | - | Object contact: tyre pickup (kind 1) while `[0x28c8c]` = 0 and `[0x28bdc]` = 0. |
| `obj1+0x133bf` | 13 BOOM | - | Object contact: head-on with an obstacle zone value 3 at throttle >= 0x64 with none of car +0x7e, +0xa, +0x44, `[0x28be2]`, `[0x28bdc]`, `[0x1ec74]`, `[0x1edb0]` set (`obj1+0x1334d` to `+0x133af`); the engine voice is stopped (`obj1+0x133e0`) and the car wrecked (+0x7e = 1, throttle 0). |
| `obj1+0x1353d` | 13 BOOM | - | Object contact with a racer whose frame word (+0x38 + 2 viewer) is 0, 1 or 7 and car +0x44 = +0xa = 0: wreck (racer +2 = 2, car +0x7e = 1), engine voice stopped (`obj1+0x13598`, `+0x13628` are the same stop in two more wreck paths). |
| `obj1+0x13701` | 21 CLANG or 22 SWIPE | - | Object contact bounce: 21 when the word obj2+0x28bf6 is 0, else 22. That word is set to 1 at `obj1+0x13479` for a contact at throttle >= 0x64 with an object whose +0x24 word is positive. |
| `obj1+0x13b14`, `+0x13bb7`, `+0x13fdc`, `+0x1407f` | 21 CLANG | car +0x46 == 0 (`obj1+0x13b08`, `+0x13bab`, `+0x13fd0`, `+0x1406e`) | Wall bounce from the wall flags obj2+0x1e570 / 0x1e56c, in the two turn routines; the bounce timer car +0x46 becomes 3 or 4 after the sound, so the clang repeats at most once per bounce. |
| `obj1+0x14212` | 15 SPLASH | - | Special surface: terrain value 6 or 0xf (`[0x1e568]`, `obj1+0x141d1`, `+0x141da`), car on the ground, car +0x44 and +0x7e = 0: sets +0x44 = 1, +0x5a = 1, `[0x28bd8]` = the surface value, copies SDX dwords +0x126/+0x12a (`obj1+0x14217` to `+0x14291`). |
| `obj1+0x16b84` | 15 SPLASH | - | Player-car draw routine `obj1+0x16a3c`: when the car word +0x56 is not 3 and differs from `[0x28bd8]` it clears +0x44 and +0x5c, sets +0x5a = 2 and plays the sound (`obj1+0x16b40` to `+0x16b84`). What state this is (the end of the splash?) is not read. |
| `obj1+0x16aeb` | 14 HORN | G (`obj1+0x16ad7`) | Same draw routine: while car +0x44 != 0 (the special surface state above) (`obj1+0x16ac7`); a wrecked car in a linked game (`[0x1ec74]` != 0 and +0x7e != 0) takes another path first (`obj1+0x16a77` to `+0x16aa7`). |
| `obj1+0x14441` | `[0x28b96]` | - | Fire held for 0x14 ticks of `[0x1ec64]` (`obj1+0x14414`): item 8 (ice) is granted unless held already or `[0x1e574]` != 0 (see `pickups.md` item 2). |
| `obj1+0x147da` | esi = 0x14 HOG, 0x13 FLAME or 0x17 DROP | G (`obj1+0x147c9`) | Shot just fired (`obj1+0x147c4`): the number is set per shot type: `obj1+0x1455f` hedgehog 0x14, `+0x145f0` fireballs 0x13, `+0x14609` devils / `+0x14693` bomb / `+0x146e1` oil / `+0x1472f` inverted hog 0x17, `+0x147b0` ice 0x14 (type to number table: `pickups.md` section 4). |
| `obj1+0x14822` | 26 NO | G (`obj1+0x1480e`) | Fire pressed with no ammo, no item or a shot still in flight (`obj1+0x14809` is the fall-through of the fire gate). |
| `obj1+0x14b48` | 24 BACKFIRE | G (`obj1+0x14b34`) | Exhaust overlay routine `obj1+0x14afc` (called from `obj1+0x15086` with the car's throttle +0x42): second stack argument (racer word +0x62, obj2+0xaaf2 for racer 0) = 1 and car +0x44 = 0. |
| `obj1+0x14ccc` | 23 DROP | G (`obj1+0x14cb8`) | Car draw `obj1+0x14bcc` (called from `obj1+0x154b0`): hop height +0x10 has fallen to 0 so +0xa becomes 3: landing. |
| `obj1+0x15185` | 16 PLIP | G (`obj1+0x15171`) | Same draw routine: the SDX record of the terrain under the car (`[0x1d89c]` = obj2+0x141f8 + 0x12e v, `obj1+0x141ae` to `+0x141c0`) has a picture height word +0x118 of 0x18 (`obj1+0x15147` to `+0x15166`). Which surfaces that is I did not list. |
| `obj1+0x16193` | 18 PUF | - | Shot-end routine `obj1+0x1602c` (called from `obj1+0x227a0`): the shot hit something (the collision word `[0x28bae]` changed): the explosion. |
| `obj1+0x18a8c` | 24 BACKFIRE / 25 STALL1 | G (`obj1+0x18a7b`; also the check `+0x18a45`) | Computer-racer step `obj1+0x189ec` (from `obj1+0x18ce7`): racer +0x58 alternates 2 and 3 each time the previous sound has ended; the number is 0x18 + (new state is 2), so state 2 plays 25 and state 3 plays 24. |
| `obj1+0x18ab9` | 13 BOOM | - | Same routine, linked game only, when the freeze has lasted the timeout (`obj1+0x18aa1`): racer wrecked. |
| `obj1+0x1958c` | 17 SKID | G (`obj1+0x19578`) | Car step `obj1+0x191e0`: brake flag `[0x28b44]` set with throttle > 0 (`obj1+0x19553` to `+0x1956a`): the sound and throttle -= 8. |
| `obj1+0x1972b` | 17 SKID | - | Same car step: `[0x28b46]` set, throttle != 0, car on the ground (+0xa, +0x3c, +0x20 = 0, +0x6 = 0): car word +0x8 = 1 after the sound. |
| `obj1+0x19cdd` | `[0x28b96]` | G (`obj1+0x19cc7`) | Finish-animation tick `obj1+0x19cb6` (reached through the table entry at `obj1+0x1908c`): the driver's voice plays while the counter `[0x28c9c]` is at most 3 and increments it. |
| `obj1+0x2172c` | 17 SKID | - | Finish handler (branch target `obj1+0x21609` of the end-of-race code at `obj1+0x214a2` to `+0x21536`): word obj2+0xaab0 (racer 0's +0x20, read as the finishing place: inferred) is 1 to 3: victory animation (`[0x28c5c]` = 0, `[0x28c36]` = 0xa), sets `[0x28c9c]` = 0 so the finish animation's driver voice may repeat; places 4 and later take the other animation without a sound. |
| `obj1+0x1fc70` | 11 GLASS | latch `[0x28c56]` (set `obj1+0x1fc67`, cleared `obj1+0x200e9`) | Per-frame race routine that starts at `obj1+0x1f794` (called from `obj1+0x1de3f` and `+0x210c0`), at `obj1+0x1fc4e`: the wreck-state word obj2+0x28c42 is above 1 (it is 1 at `obj1+0x13422`/`+0x135dc`, 2, 3, 4 at `obj1+0x16c34`/`+0x16c80`/`+0x16ce2`). Once per wreck. |
| `obj1+0x1d731` | 26 NO | - | Giggle keys (section 5.3): the key is pressed while the viewer's use counter (car +0xbc, obj2+0x84cc) is already 6 or more. |

Other race-code calls to the library that are not numbered sounds are in section 5 (engines, horns, giggles). Is-active calls: `obj1+0xc76` (horn), `+0x1be2` (the is-playing routine), `+0xe70b` (volume menu), `+0x1a781`, `+0x1ab2b` (giggle voices), `+0x251dd` (intro). Stop calls: `obj1+0xc0e` (engine stop, routine `obj1+0xbf0`), `+0x11c07`, `+0x133e0`, `+0x13598`, `+0x13628` (engine stop on a hit or wreck), `+0x2cdd`, `+0x1a8e9` (giggle slot B), `+0x1ac88` (giggle slot A), `+0x1d79a` (previous giggle on a new key), `+0xee11`, `+0xee3c` (engine stop in the volume menu), `+0x251eb` (intro PASS retrigger).

## 4. Call sites outside the race (menus, intro, end screens)

| Call | N | Guard | Context |
| --- | --- | --- | --- |
| `obj1+0x8da1`, `+0x90ef`, `+0x9b77`, `+0xa632` | 18 PUF | - | menu confirm click: after the poll `obj1+0x27cf1`, when the accelerate key flag `[0x28b40]` is set |
| `obj1+0x8dd2`, `+0x9ba5`, `+0xb4a7` | 26 NO | - | menu refusal: the word obj2+0x1e574 is non-zero (a registration/shareware switch; its polarity is not checked here) and the chosen value is above 1 (`obj1+0x8dbe`) or 7 (`obj1+0x9b91`) |
| `obj1+0xb987` | stack local `[esp+0x140]` | - | driver-selection screen (strings CHOOSE VEHICLE, `menus.md`): the selected number is the argument; taken as the driver number 0 to 7 by name order (inferred) |
| `obj1+0x1cb7f` | 18 PUF | - | the rostrum/order screens routine `obj1+0x1bff0` (strings ORDER.PCX, THE ROSTRUM, WIN.PCX at `obj1+0x1c167`, `+0x1c964`, `+0x1c9f6`) at its start |
| `obj1+0x1cff4` | 23 DROP | - | the same routine: an animated 15 x 13 picture reaches its end position |
| `obj1+0x24e19` | 12 WARP | once (`[esp+0x20]`) | intro/title animation `obj1+0x248f4` (called from `obj1+0x26784`) after 3 ticks |
| `obj1+0x250f0`, `+0x251f2` | 8 PASS | retrigger | same animation: when a racer passes the camera more than 0x190 units away the previous PASS voice is stopped (`obj1+0x251eb`) and PASS starts again |

Library plays outside the numbered mechanism: volume-menu preview `obj1+0xe752` plays record 21's data (CLANG) with priority 1 every 0x13 ticks of `[0x1ec64]` (`obj1+0xe6ea` to `+0xe757`, obj2+0x1abc0 is record 21's pointer, 0x1a9c8 + 21 x 0x18); the shoot-out and duck-shoot code plays the buffer obj2+0x1eaec at priority 0x20 (`obj1+0x3a1d`, and a plain routine `obj1+0xc20` with no direct caller).

## 5. Side mechanisms that are not numbered sounds

### 5.1 Engine sound (digital voices only)

- Start: `obj1+0xd04`, called at race start (`obj1+0x1fd84`), race restart (`+0x20ff5`), after a wreck restart (`+0x225ad`) and from the volume menu (`+0xead0`, `+0xee4b`). Only when 0x1ecf8 != 0. For each human viewer (1, or 2 when `[0x28be2]` or `[0x28bdc]` is set, `obj1+0xd12` to `+0xd2f`) it plays `MOTOR.VOC` (buffer obj2+0x1eb10) with pitch -1800 cents (0xfffff8f8, `obj1+0xd45`), volume obj2+0x174da (`obj1+0xd4c`), **priority 0x28** (`obj1+0xd4a`, higher than every effect), and stores the handle in the viewer's record at obj2+0x84e4 (+0x104 for viewer 2) (`obj1+0xd68`). The file has a repeat-forever block (`voc.library-player`), so it loops.
- **Pitch follows speed every frame**: in the HUD routine, for each viewer, `pitch cents = word(obj2+0x8436 + 0x104 n) * 0x14 - 0x708`, passed to `obj1+0x31b44` with the engine handle (`obj1+0x1ad25` to `+0x1ad3b`). obj2+0x8436 is the car record's word +0x26 (the car record is obj2+0x8410 + 0x104 n, `obj1+0x1fe73`), the speed word `VEL.TAB[throttle]` of `car.speed-model`. So the engine plays at `10989 Hz * 2 ** ((20 * speed - 1800) / 1200)`: a factor of 0.35 at speed 0, 1.0 at speed 90. Not applied for the PC speaker (library entry returns at once) and not for AI cars (no engine voice for them).
- Stop: when the viewer is wrecked or hit (the sites in section 3), the voice is stopped and the handle cleared; `obj1+0xbf0` is the stop routine for racer n (it has no direct caller); stop-all `obj1+0x1adc` at the end of a race.

### 5.2 Horn (digital voices only)

- `obj1+0xc90` (eax = racer slot 0 to 7) plays `HORN1.VOC` (buffer obj2+0x1eae0) unless the racer's horn is already active (`obj1+0xc50` is the active check: flag obj2+0x1b0f8 + 16 k, handle +0x1b0fc, play count +0x1b100), with priority **0x16** and pitch obj2+0x1b104 + 16 k cents, volume 0x1d890 (`obj1+0xca8` to `+0xce0`). The eight pitch values written at `obj1+0x2433` to `+0x2479` are, for slots 0 to 7: -650, -300, +200, +750, 0, -300, +750, +200 cents. HORN1.VOC is 4036 samples at 12048 Hz (0.34 s).
- Triggers: a human spin-out hit (`obj1+0x11d0c`), the contact-range driver-voice path after four plays (`obj1+0x12e5f` to `+0x12e78`) and the pass path after the fifth PASS (`obj1+0x12ff0` to `+0x13011`).

### 5.3 Giggle keys (digital voices, and only when `[0x28be2]` or `[0x28bdc]` is not 0)

- The keyboard poll maps scan codes 0x3b to 0x40 (the F1 to F6 keys) to obj2+0x28ce0 = 1 to 6 (`obj1+0x1f4db` to `+0x1f4ec`); the help text "F1 - F6 ARE YOUR GIGGLE KEYS!" is at obj2+0xd30 (where it is shown is not read). `obj1+0x1d6d0` handles a key only when one of those two mode words is non-zero (`obj1+0x1d6f6` to `+0x1d708`): if the viewer's use counter (car +0xbc) is 6 or more it plays sound 26 NO (section 3), otherwise it counts, stores the key in car +0xc0 (obj2+0x84d0), stops the previous giggle voice (`obj1+0x1d79a`) and calls `obj1+0x1d628`.
- `obj1+0x1d628` (viewer n) plays `GIG<k>.VOC` where k = word(obj2+0x84d0 + 0x104 n): the pointer comes from obj2+0xa490 + 4 (k - 1), so keys 1 to 4 play GIG1 to GIG4 and **keys 5 and 6 both play GIG5** (obj2+0xa4a4 = obj2+0xa4a0, `obj1+0x2268`); priority **0x22**, no pitch, handle at obj2+0x84e8, flag +0x84ec (`obj1+0x1d63b` to `+0x1d66b`). The HUD restarts the voice while the reaction picture is shown and the voice has ended (`obj1+0x1ab13` to `+0x1ab36`) and stops it when the picture ends (`obj1+0x1ac70` to `+0x1ac9d`).
- A second slot with the same shape (`obj1+0x1d67a`: index obj2+0x84fc, handle +0x850c, flag +0x8510) is stopped at the lap bell (`obj1+0x2cdd`) and at `obj1+0x1a8e9`; I found no call to `obj1+0x1d67a`, so what starts it is not read.
- Sample facts (`decodeVocAudio`): GIG1 7903 bytes 10989 Hz 0.72 s; GIG2 17665, 11111 Hz, 1.59 s; GIG3 4386, 11111 Hz, 0.39 s; GIG4 5093, 13157 Hz, 0.39 s; GIG5 5474, 10989 Hz, 0.50 s.

### 5.4 Linked-game substitution and the shoot-out samples

- In a linked game (0x1ec74) the numbers 0 to 7 other than the viewer's own driver word play the buffer obj2+0x1eaec in digital mode and nothing in speaker mode (`obj1+0x1c16` to `+0x1c3e`). That buffer is filled with `QUACK.VOC` by `obj1+0x36fb` to `+0x3759` or with `BELCH.VOC` by `obj1+0x3780` to `+0x37dd` (gated on 0x1ecf8; the load of GIGGLES.SP / DOPE.SP happens in the same routines). QUACK.VOC 3642 bytes, 11111 Hz, 0.33 s; BELCH.VOC 3481 bytes, 11111 Hz, 0.31 s. Which routine runs before a linked race is not read.

## 6. Music

### 6.1 Devices and files

- Music device words (CFG 0x78a, obj2+0x17408): the library dispatch in `obj1+0x321e0` sends devices 0, 1, 2 to the KLM (AdLib-style) player `obj1+0x3a620` (`klm.player`), devices 3, 4, 5 to the MIDI sequencer `obj1+0x3b014` (`midi.player`) and 6, 7 to error 2 (`obj1+0x321ed`, jump table `obj1+0x321c0`). The file extension appended to every song name is `.KLM` for a device of 2 or less and `.MID` above 2 (`obj1+0x1d50` to `+0x1d6f`, copied into obj2+0x20adc; `obj1+0xd80` is the helper that appends it).
- Start routine: `obj1+0x180c` (eax = pointer to the loaded song, edx = loop flag) or its tail `obj1+0x1834` (song pointer taken from obj2+0x1eaf0, eax = loop flag): both stop a playing song first when the music-enabled word 0x1ee46 is set (`obj1+0x1824` to `+0x182d`: `0x32160` returns the player's playing flag (obj2+0x43e4 for KLM, +0x4434 for MIDI, `obj1+0x3a6f4`, `+0x3afa4`), `0x3219c` stops the song (`obj1+0x3a5fc`, `+0x3afb4`); `0x32174` sets the playing flag to 1 and resumes, `0x32188` clears it and silences the chip (`obj1+0x3a6bc`, `+0x3a6d8`, `+0x3af74`, `+0x3af88`): resume callers `obj1+0x1206`, `+0x10b54`, `+0x10bdb`, `+0x1fd7f` (right before the race's engine start), pause callers `obj1+0x1100`, `+0xdb04`, `+0x1fcf0`). The loop flag is stored at obj2+0x43ec (KLM, `obj1+0x3a649`) or obj2+0x443c (MIDI, `obj1+0x3b032`); every race start passes 1, so the race song loops.
- Song data sizes in `WACKY.DAT` (both formats exist for 15 names plus APOGEE): KLM TURBO 28587, DANCE 15845, FLIGHT 17584, STARBRAI 20845, BASSATTK 20767, KARD 7815, BANSHI 14103, BRICWALL 14627, PUMPER 15468, OVERDRIV 25282, MAINMENU 17289, LEADRBRD 1142, GAMEOVER 639, SPACEY 8009, ASHES 5154, APOGEE 1703; MID TURBO 48257, DANCE 22923, FLIGHT 36725, STARBRAI 37299, BASSATTK 35687, KARD 15287, BANSHI 23290, BRICWALL 40195, PUMPER 16331, OVERDRIV 49765, MAINMENU 30077, LEADRBRD 1989, GAMEOVER 2641, SPACEY 11482, ASHES 13492, APOGEE 1540 (bytes).

### 6.2 The five songs loaded at start-up

`obj1+0x2360c` reads five songs, names from the 12-byte array at `obj1+0x1fc` + the extension, into obj2+0x1c648 + 4 i (`obj1+0x23614` to `+0x236b7`, buffer size 0xcb20 per `obj1+0x2363a`): i = 0 MAINMENU (obj2+0x1c648), 1 LEADRBRD (+0x1c64c), 2 GAMEOVER (+0x1c650), 3 SPACEY (+0x1c654), 4 ASHES (+0x1c658). Uses I read: MAINMENU, LEADRBRD and GAMEOVER at menus and end screens (GAMEOVER at `obj1+0x1a20d`, then MAINMENU at `+0x1a227`; LEADRBRD at `obj1+0x1b692`, `+0x1cad1`, `+0x1e724`; MAINMENU also at `obj1+0x18c2`, `+0xd0d5`, `+0xf8c0`, `+0x10e13`, `+0x1cbcd`, `+0x24e61`); **SPACEY when the mode word obj2+0x1d998 is 2** during the race routine (`obj1+0x20f7c` to `+0x20fc4`); ASHES at the cup/track-selection routine `obj1+0x832c` (`obj1+0x83c0` to `+0x83ff`) and at `obj1+0x93ce`, `+0x1bae1`, `+0x1bbe6`, `+0x1bffb`, `+0x1f025`.

### 6.3 The race song

1. **List built per cup** by `obj1+0x22e60` (called at `obj1+0x7b57` inside the loading-card routine `obj1+0x7928`, which `obj1+0x10006` calls just before the race routine `obj1+0x1fd8c`): index c = `[0x28bb6] + [0x1ecb4] - 1` (cup 1 to 3 plus 0 or 3 for the bonus pack, the same index the HUD's `BRONZEM/SILVERM/GOLDM/BONUS*` pick uses, `hud.md`; `[0x1ecb4]` is set to 0 at `obj1+0x6669` and to 3 at `obj1+0x67c8`). It jumps through the six-entry table at `obj1+0x22e48` (targets `0x22eab`, `0x22f63`, `0x2301b`, `0x230d3`, `0x2318b`, `0x23243`) and, in each case, puts three names A, B, C (stack locals +0x20, +0x10, +0x0) together with the extension; the slot list at obj2+0x1c530 (14 bytes a slot) is then filled A, B, C, A (`obj1+0x23341` to `+0x233fb`, state word `[0x28bce]` 1, 2, 3, 1) and slot 4 (obj2+0x1c568) gets OVERDRIV (`obj1+0x23401`). Names (strings at obj2+0x1b34 TURBO, +0x1b3c DANCE, +0x1b44 FLIGHT, +0x1b4c STARBRAI, +0x1b58 BASSATTK, +0x1b64 KARD, +0x1b6c BANSHI, +0x1b74 BRICWALL, +0x1b80 PUMPER, +0x1b88 OVERDRIV):

| c (cup) | Case start | A | B | C | Race 1 | Race 2 | Race 3 | Race 4 | Race 5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `0x22eab` | TURBO | DANCE | FLIGHT | TURBO | DANCE | FLIGHT | TURBO | OVERDRIV |
| 1 | `0x22f63` | STARBRAI | BASSATTK | KARD | STARBRAI | BASSATTK | KARD | STARBRAI | OVERDRIV |
| 2 | `0x2301b` | BANSHI | STARBRAI | BRICWALL | BANSHI | STARBRAI | BRICWALL | BANSHI | OVERDRIV |
| 3 | `0x230d3` | FLIGHT | KARD | PUMPER | FLIGHT | KARD | PUMPER | FLIGHT | OVERDRIV |
| 4 | `0x2318b` | DANCE | BASSATTK | TURBO | DANCE | BASSATTK | TURBO | DANCE | OVERDRIV |
| 5 | `0x23243` | BANSHI | BRICWALL | STARBRAI | BANSHI | BRICWALL | STARBRAI | BANSHI | OVERDRIV |

   An index above 5 skips the case code (`obj1+0x22e9a`) and leaves the three locals unset. The race number is `[0x28b88]` (starts at 1, incremented after every race of the cup, `obj1+0x100b9`); the track index for the cup is that plus 0, 5, 10, 0x15, 0x1a, 0x1f (table `obj1+0x7a8a` to `+0x7b3a`), so each cup has five races.
2. **Separate list** when `[0x28be2]` != 0 or `[0x1ec74]` != 0 (`obj1+0x22e71`, `+0x22e7f`): six slots BANSHI, KARD, TURBO, BRICWALL, STARBRAI, FLIGHT at obj2+0x1c530, +0x1c53e, +0x1c54c, +0x1c55a, +0x1c568, +0x1c576 (`obj1+0x23410` to `+0x235fd`); the song used is slot `[0x28c90]` (`obj1+0x8265`; the word is stored at `obj1+0x1029e` and `+0x104b6`, its meaning is not read).
3. **Load**: the tail of `obj1+0x7928` at `obj1+0x8237` (reached from `obj1+0x7f0f`, `+0x7f38`, `+0x8057`, `+0x81a9`) does nothing unless music is on (`obj1+0x8237`) or when `[0x1d998]` = 2 (no race song for that mode, `obj1+0x8245`); otherwise it looks up slot `[0x28b88] - 1` (or `[0x28c90]` in the special modes) of the list with `obj1+0x418c`, stops the song if the song pointer obj2+0x1eaf0 equals the race buffer (`obj1+0x8292` to `+0x82a8`) and reads the song into the buffer whose address is obj2+0x1eb00 (`obj1+0x82b2` to `+0x82bd`).
4. **Start** in `obj1+0x1fd8c` with loop flag 1: when `[0x28be2]` or the linked flag is set (`obj1+0x1ff25`), or when `[0x28ca8]` is non-zero and `[0x1d998]` != 2 (`obj1+0x207af`), or in the plain race (`[0x1d998]` = 0 and `[0x28be2]`, `[0x28ca8]`, `[0x1ec74]` all 0, `obj1+0x20f45`); for `[0x1d998]` = 2 the song is SPACEY instead (`obj1+0x20f97`). The song pointer goes to obj2+0x1eaf0 first (`obj1+0x1ff38`, `+0x207c2`, `+0x20f58`) and `obj1+0x1834` is called. The pause screen stops the music (`menus.md`: "MUSIC PAUSED").

### 6.4 Does the engine sound vary with speed? Looping rules, volumes

- Yes, but only on digital devices: section 5.1. In PC-speaker mode there is no engine sound at all.
- Looping: the race song loops (loop flag 1), `MOTOR.VOC` loops, nothing else does (section 1.5).
- Volumes: music `[0x1742c]` through `0x320dc` (clamped 0 to 255; devices <= 2 call the pointer obj2+0x28d50, others `obj1+0x3aec0`, `obj1+0x320f0` to `+0x32111`), effects `[0x17428]` (copy `[0x1d890]` in every play), engine `[0x174da]` in the engine play only. The volume menu "SOUND VOLUMES: MUSIC / SOUND FX / ENGINE FX" (`menus.md`) writes them (`obj1+0xeddc`, `+0xedef`, `+0xee29`) and restarts the engine voice.

## 7. What the port can reuse

All of these read the archive in-process; the existing decoders already parse what is needed.

- Archive: `parseDatDirectory(WACKY.DAT)` gives the members by name (`src/formats/dat.js`). Effects: `parseAudioBank(AUDIOHED.FX, AUDIOT.FX)` (`src/formats/audio-bank.js`) gives slot objects `{index, start, size, length, payload}`. A PC-speaker chunk to feed `decodePcSpeaker` (`src/audio.js:6`) is `AUDIOT.FX.subarray(start, start + 6 + length)`. Slots: effects number k plays slot k for k = 8 to 25, slot 20 for k = 0 to 7, slot 18 for k = 26 (section 2); slot offsets are in the table in section 2.
- Digital: `decodeVocAudio(member)` (`src/formats/voc-audio.js`) returns samples, rate and loop for `<NAME>.VOC` with the 27 names of section 2, plus `MOTOR.VOC` (loops), `HORN1.VOC`, `GIG1.VOC` to `GIG5.VOC`, `QUACK.VOC`, `BELCH.VOC` (the archive's 36 VOC members are exactly these 27 + 9). The rate of each is already `voc.rate-observed`'s rule.
- Engine: `rate = 10989 * 2 ** ((20 * car.speed - 1800) / 1200)` with `car.speed` the car record's +0x26 word the port already models (`car.speed-model`); horn: `12048 * 2 ** (cents / 1200)` with the per-slot cents of section 5.2; both clamp nothing in the game (the table builder rounds the factor to 4-cent steps).
- Priorities: `27 - k`, with 25 -> 32 and 26 -> 9 in digital mode; the engine 40, giggles 34, horn 22; voice limit 8; a failed play when every voice is higher priority; plays below the current priority are refused on the speaker.
- Music: `parseKlm` + `renderOpl(data, 'klm')` for the KLM songs (`src/audio.js`, `src/synthesis.js`) and `parseMidi` + `renderMidi` for the MIDI songs. The song for race n of cup c is the table in section 6.3 (names without extension; `.KLM` or `.MID` by music device). A race song loops. `renderOpl` renders offline up to `limit` seconds (default 30): for a loop the port needs the whole song length (`song.duration`).
- Sites to port first, in order of audibility: START (10) at the green light, the engine loop with its pitch, BOOM (13) and GLASS (11) on a wreck, CLANG (21) on wall bounces, SKID (17) on slides and braking, WARP (12) on boosts and hops, the shot sounds (0x13, 0x14, 0x17, 0x12), BELL (9) on the last lap, PASS (8) when passing; the driver voices (0 to 7) come with pickups (`[0x28b96]`).

## 8. Uncertain / not read

- The device-5 (Gravis UltraSound) player `obj1+0x37d34` and its is-active/stop routines (`0x37838`, `0x37870`, `0x378ac`, `0x37950`, `0x379b0`): not read, so I do not know whether it honours priorities or pitch.
- What the three volume values passed to `obj1+0x31bc8` (ebx, ecx and the stack copy) mean per channel (`obj1+0x396f4` to `+0x397c9` split them under the stereo flag obj2+0x43ac); the effect of the effects volume on the PC speaker is only on/off.
- The routine `obj1+0x46284` called while the pitch table is built (read as a power function only from the constants it is fed).
- Whether modes 1 (Pro AudioSpectrum) and 6 (Sound Source) really run this digital path in the real game (the dispatch tables send them to the same player as 0, but the start-up check for 1 names MVSOUND.SYS and for 6 the Sound Source, `audio.device-numbers`); only mode 0 was observed (`voc.rate-observed`).
- Why sites 0x142d4, 0x14339 (hop and boost start routines), 0x1982d's routine `0x191e0`, `0x19cb6` (finish-animation tick), `0x21609` (finish handler) and `0x1d8aa` are not reached by a direct `call`: they are entered by branches or tables (`0x191e0` from `obj1+0x190c3`, `0x19cb6` through the dword at `obj1+0x1908c`, `0x21609` from `obj1+0x21514`/`+0x21536`, `0x1d8aa` from `obj1+0x1d840`/`+0x1d84a`/`+0x1d858`); I did not follow the hop and boost routines to their callers, so "who calls `0x14298`/`0x142fc`" is open.
- Meanings of the words `[0x1d998]` (values 0, 1, 2, 3 seen: 2 selects SPACEY and no per-race song, `obj1+0xe485` stores a menu value plus 2), `[0x28ca8]`, `[0x28c90]`, `[0x28bd8]`, `[0x28bf6]` beyond what is stated; the exact meaning of the zone words `[0x1d86c]+0x1e`/`+0x20` at the PASS and driver-voice sites in `obj1+0x12bf3`; what car +0x44 and +0x56 (the special surface state) and racer word +0x62 are called.
- Site `obj1+0x16b84` (second SPLASH), `obj1+0x15185` (PLIP: which surface has a 0x18-high picture), `obj1+0x14b48` (BACKFIRE: what racer word +0x62 holds) are described only by their guard words.
- What starts the second giggle slot (`obj1+0x1d67a` has no direct call) and how the lap-bell values (+0xce = 7, +0xd6 = 6) are used; the unnumbered play routine `obj1+0xc20` has no direct caller either.
- Which routine loads QUACK.VOC / BELCH.VOC before a linked race, and whether an ordinary linked race has the buffer obj2+0x1eaec filled at all (the substitution at `obj1+0x1c38` reads it either way).
- The meaning of `[0x28bb6]` as "cup" is from the HUD sprite pick (`hud.md`), not from the menu code; the cup names BRONZE/SILVER/GOLD for c = 0 to 2 are the sprite names, the mapping of cups to songs is by index only.
- The music loop flag observed as 0 for the 14-track MIDI files in `midi.driver-state` (demo race) versus the 1 that every race start I read passes: the demo path may call `obj1+0x1834` with another value; not read.
- Playing times of the PC-speaker chunks assume 140 bytes per second (`audio.speaker-player` reads the rate argument 0x8c, not observed).
- The archive-level facts (slot lengths, VOC rates and sample counts) come from running the existing decoders on the user's `WACKY.DAT` once on 2026-10-04 (an ad hoc script, not a check in `src/verify/checks/`); nothing in this file is pinned by a check.
