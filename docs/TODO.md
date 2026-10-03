# TODO

How this file works (`test/evidence.test.js` enforces the first two rules):

- Every claim that is not `PROVEN` has exactly one **unchecked** line of the form ``- [ ] `claim-id` [TAG] ...`` under *Open claims*.
- A checked line (``- [x] `claim-id` ...``) may only name a claim that is `PROVEN` or no longer exists. When a claim is promoted, tick it and move it to *Done* in the same commit as the registry tag and the docs line.
- Work items that are not claims go under *Work items* with plain ``- [ ]`` lines (no claim id in backticks at the start).
- `Gap` says what is not established; `Next` is the concrete step that would close it. Negative findings say what was checked (tool, address, date), never "does not exist".

## Open claims

### Archive (`WACKY.DAT`)

- [ ] `dat.entry-compare` [STATIC] — the compare function is a NUL-terminated string compare after an in-place upper-case of a-z (obj1+0x32df0, +0x32dd0)
  - Gap: the tail-insensitivity (`dat.entry-tail`) and the upper-casing range (`dat.uppercase-range`) are observed; the word-wise compare function itself (obj1+0x32df0) is read, not exercised beyond that.
- [ ] `UNKNOWN_DAT_SENTINEL_ENTRY` [UNKNOWN] — whether the packer writes the 22-byte sentinel after the directory on purpose
  - Gap: the game does not load it (the 22 bytes after its table are zero), so it is irrelevant to the game; only archive rewriting cares.

### Images (PCX, tiles, masks)

- [ ] `pcx.rle-rule-vga` [STATIC] — the decoder that writes VGA planes (obj1+0x75cd) uses the same rule; runs continue across rows; a zero count is not special-cased
  - Gap: this decoder, run continuation and zero counts were not observed (no archive file has such a run). Only the linear-buffer decoder was confirmed (`pcx.rle-rule`).
  - Next: capture VRAM right after a full-screen PCX is drawn (needs a code breakpoint at a 32-bit offset, which the DOSBox API does not offer) or accept as static.
- [ ] `pos.progress` [STATIC] — the progress lookup and lap logic (`FUN_0001260c`, `FUN_00012b44`): grid cell at `((y-0x400)>>5, (x-0x400)>>5)`, 0 off the course, lap counted when the previous value is the trailer and the new one is 1, ranking key `progress + trailer * laps`
  - Gap: the lookup and the ranking keys are observed (`pos.progress-live`: 24 pauses, 8 racers, every one consistent); what stays STATIC is the lap counting itself (a lap is counted when the previous value is the trailer and the new one is 1; racers in the recording were all on lap 2) and the flag-word branch. The wiki's wrong-way warning was not located.
  - Next: a recording that spans a lap crossing (and a racer with the flag word set), or find the wrong-way code.
- [ ] `pos.quarter-unreferenced` [STATIC] — the trailer's quarter at obj2+0x28ba0 has one reference, the loader's write
  - Gap: stamped negative finding (Ghidra MCP `get_xrefs_to` 0x00088ba0, block obj2, 836 functions analysed, 2026-10-03): nothing found reads it by a direct address; a computed-pointer read is not ruled out.
- [ ] `rd.unused-words` [STATIC] — the `.RD` loader never reads record words +0x08 and +0x0c (the wiki's angle and distance)
  - Gap: the observed route table does not depend on them (`rd.route`); another reader of the record buffer at obj2+0x1ee0c is not ruled out.
- [ ] `racer.init` [STATIC] — `FUN_00016f90` resets 24 racer records (0x68 bytes) and, for racers 0 to 7, sets x and y from the `.GAM` start tables and the heading word from the first route compass word
  - Gap: read in full; the demo race takes the other branch (obj2+0x1ec74 = 0, `racer.start-grid`), so this branch was not seen. Next: find what sets obj2+0x1ec74 and reach that mode.
- [ ] `route.placement` [STATIC] — in racer.init's first branch racers 1 upward are laid out along the route point array, 0x104 points ahead of each other from a random route entry, with the entry's compass word as heading
  - Gap: read in full; not observed: the recorded race start (`start-1`) had obj2+0x1ec74 = 0, the branch without it. Next: a record taken right after a race starts, comparing racer positions with the point array, and find what obj2+0x1ec74 selects.
- [ ] `ai.surface-slowdown` [STATIC] — the AI speeds are lowered by the car record's dword +0x36 (SDX +0x120, a 16.16 fraction per surface)
  - Gap: code and the SDX values only; no scaled value seen. Next: sample the racers' speed words and the car's +0x36 together on a slow surface.
- [ ] `ai.step-rules` [STATIC] — the per-racer update loop `FUN_00028cac`: a four-state machine chooses the route points advanced per frame (words +8, +0xa, +0xc, counters +6, +0xe), with a rubber-band helper, a push rule and a contact flag
  - Gap: read in full; observed: racers on route points (`ai.route-follow`), the initial words (`ai.speed-setup`), the state machine's relations and the speed-table lookup (`ai.state-machine`, `ai.race-speeds`). Still unseen: state 3, the rubber-band helper, the push rule and the contact flag.
- [ ] `UNKNOWN_RD_FIELD_USE` [UNKNOWN] — what sets the level word obj2+0x28b84, what reads the heading word, and what the mode words obj2+0x1ec74, +0x1ece0, +0x1edb0 mean
  - Next: the writers of those words (the AI start values themselves are `ai.speed-setup`, proven).
- [ ] `UNKNOWN_SIN_KEPT_FIELDS` [UNKNOWN] — what the property values mean as surfaces (track 2 yields 4, 5 and 7), and what the 4 discarded `.SIN` bytes hold
  - Gap: the kept 8 bytes are two dwords, one per mask value (`terrain.lookup`, proven); the lookup never reads the discarded 4.
  - Next: what the SDX fields and the compare cases (2, 3, 6, 0xa, 0xf) do, and whether anything reads the discarded bytes (consumers found: `terrain.sdx-index`).
- [ ] `UNKNOWN_SPW_FIELDS` [UNKNOWN] — what the `.SPW` words mean (id matches a sprite-catalogue index; +4/+6 are coordinates; +8 is a tick counter and +0x0a the frame index by `spw.frame`; +2 is cleared by the loader and set to 0xFFFF in some records later)
  - Gap: what word +2 is and what the objects do besides being drawn (collision, pickups) is not read. Two recordings disagreed on which records the game rewrites (see `docs/spw.md`).
  - Next: readers and writers of word +2 (obj2+0x1393a + 12 k).
- [ ] `UNKNOWN_PAR_USE` [UNKNOWN] — what draws the uploaded pixels afterwards; lead: the file is a 1280 x 20 panorama shown as a 320-pixel window on screen rows 110 to 129 (seen once by comparing a frame, not wiki's 640 x 40)
  - Next: find the code that addresses video memory at 0xa0000 + 0x7d00 (latch copies like obj1+0x26f14), cite how it picks the window, and add a check that compares a recorded frame with the file; then fix the viewer's 640 x 40.

### Startup data tables (`MAP.XY`, `WACKY.SDX`, `TRIG.DAT`, `NDIST`, `CARS.SP`, `GIG.MOV`)

- [ ] `mapxy.use` [STATIC] — MAP.XY's two 0x800-byte halves convert each racer's clamped x and y to minimap screen coordinates (y + 0x3c) for a marker draw
  - Gap: not observed. Next: compare a racer marker's drawn position with the table value at its coordinates.
- [ ] `mov.use` [STATIC] — `GIG.MOV` entries are screen offsets (x, y) for one drawn sprite, read by two drawing routines
  - Gap: not observed; which sprite and what advances the entry index are unread. Next: sample the blitter inputs while the sprite is on screen and compare with the table.
- [ ] `floor.table-use` [STATIC] — the floor renderer casts from the position along `TRIG` unit vectors scaled by `NDIST` factors; the same pair feeds the terrain lookup's inputs
  - Gap: read in three routines, not observed; the row/column roles of NDIST in the drawing loops are not traced. Next: record the terrain inputs obj2+0x1d7a4/0x1d7a8 with the angle word and compare with TRIG and NDIST entry 0.
- [ ] `cars.slots` [STATIC] — the `CARS.SP` buffer is 8 driver slots of 12 frames; a routine reads the first 8 frames of a driver's file into a slot and keeps eight frame pointers
  - Gap: not observed; the slot choice, what fills the last 4 frames and how the frames are used in play are untraced. Next: record the pointer records at obj2+0x13c08 and the slot contents after a race loads.
- [ ] `UNKNOWN_STATIC_TABLE_MEANING` [UNKNOWN] — what the six tables mean, and what the game rewrites in the last 8 bytes of five `.SDX` records
  - Gap: layout and run-time placement are proven (`static.layout`, `static.read`); no reader of the live buffers has been read.
  - Next: the remaining TRIG sites (38; three routines read in `floor.table-use`); the CARS readers are read (`cars.slots`), MAP.XY (`mapxy.use`), MOV (`mov.use`), TRIG and NDIST layout and use, and the SDX terrain index (`terrain.sdx-index`) are read.

### Sprites (`SPRITE.ATR`, `.SP`)

- [ ] `atr.kind-use` [STATIC] — the catalogue word +0 is an object kind a routine at obj1+0x13227 branches on (≤ 0, 1, 2, others each go to different code)
  - Gap: read only as branch structure; the routine's purpose (collision with objects?) is not established and nothing was observed.
- [ ] `UNKNOWN_ATR_FIELDS` [UNKNOWN] — what the catalogue words other than size, frames and name mean (+0 pickup type, +2, +8/+0x0a duplicate dimensions, +0x0c selector)
  - Gap: the sprite loader reads only +0, +4, +6, +0x0e and the name; +4/+6 are only shown to multiply, not which is width.
  - Next: what the kinds do (`atr.kind-use`) and the other readers (obj1+0x3ec0, +0x1143a, +0x11455).
- [ ] `sp.draw` [STATIC] — the blitter `FUN_00036fd0` consumes a frame column by column (word +4 columns of word +6 bytes), index 0 transparent
  - Gap: no screen pixel was compared with a frame. Next: after a race starts, compare VRAM rows of a visible sprite with the frame (the VRAM read from `par.upload` works) and add a check.
- [ ] `spw.frame` [STATIC] — frame address = sprite buffer + `.SPW` word +0x0a × (word +4 × word +6); word +8 is the tick counter
  - Gap: not compared with a running frame. Next: record the dword at obj2+0x1d704 at several pauses and check it equals a catalogue pointer plus k frames.

### `.GAM` track configuration

- [ ] `gam.read-rest` [STATIC] — lines 6–7 (+0x0400), line 8 dropped, pairs 2–8 (+0x03e0) into the tables, line 25 stored and set to 1 when non-zero
  - Gap: the game rewrites these after loading (value words differ from file + 0x400, the table holds a derived start grid, the flag word reads 2), so their load-time contents were not seen.
  - Next: a breakpoint-free way to catch load time, e.g. record memory during the load (video capture start/stop around the menu choice) or read the file-read interrupts.
- [ ] `gam.line-reader-tail` [STATIC] — the line reader has no end-of-file test (a file without a final CR is read past its end) and writes its NUL over the CR
  - Gap: read in full; nothing was run that reads past the end of a file. Next: an experiment with a `.GAM` whose last line has no CRLF.
- [ ] `UNKNOWN_GAM_NUMBERS` [UNKNOWN] — meaning of lines 6–7, the eight coordinate pairs (only the first survives as a start position; the rest of the live table is a derived grid), the flag on line 25 and lines 26–28
  - Next: readers of obj2+0x28b0a / +0x28b0e, the word tables obj2+0x1d7cc / +0x1d7e0, obj2+0x28b60 and obj2+0x28b5a / +0x28b4e / +0x28b4c.

### Audio (`AUDIOHED.FX`, `AUDIOT.FX`)

- [ ] `audio.mode-select` [STATIC] — which values of obj2+0x17404 call the bank loader and which bank each takes (7 observed: slots 0 to 25; 2 would take slots 26 to 51)
  - Gap: with the CFG mode dword set to 2 the check rejects it and the bank-load routine and loader never run (`audio.device-gate-run`), so the second-bank path has not run and does not look reachable; it stays STATIC (the test itself is read, not executed).
  - Next: only a changed library check or a changed mode dword after start-up would reach it; none among the 11 direct references to the dword (indirect stores are not excluded).
- [ ] `audio.record-init` [STATIC] — the loader sets record dwords +0x10 to 0xffffffff and +0x14 to 0; the running game rewrites them
  - Gap: only the initialisation is read; the live values at the title screen differ.
  - Next: the readers and writers of the table at obj2+0x1a9c8.
- [ ] `audio.device-gate` [STATIC] — the start-up calls the library check then init with the sound mode; 2 (check), 2/3/4 (init) and values above 7 are rejected
  - Gap: the dispatch tables are read; modes 2 and 3 are observed (`audio.device-gate-run`), mode 4 and values above 7 are not run; indirect stores to the mode dword are not excluded.
- [ ] `UNKNOWN_AUDIO_MODE_VALUES` [UNKNOWN] — what devices 0, 1, 5 and 6 are and what the routine at obj1+0x2168 loads for them (7 is the PC speaker, 2/3/4 are rejected)
  - Next: read the players behind the other dispatch entries (devices 0, 1, 6 share obj1+0x39615, 5 is obj1+0x37d34), what `SETUP.EXE` writes at 0x786, and the music device check.
- [ ] `audio.speaker-player` [STATIC] — the library's play/is-active dispatch and the PC-speaker player (device 7): length dword as counter, data at chunk+6, one byte per tick x 60 to ports 0x43/0x42/0x61
  - Gap: read in full; the device word, byte mode, table (`audio.speaker-state`) and the per-tick pointer, counter and divisor (`audio.speaker-tick`) are observed; the port writes themselves and the rate unit (the argument 0x8c) are not. Next: a memory or port observation of the writes to ports 0x42/0x43, and a timing measure of the tick rate.
- [ ] `UNKNOWN_AUDIO_CHUNK_FIELDS` [UNKNOWN] — what the 2 skipped header bytes and the second bank's 19 header bytes mean, and how the other players use their chunks
  - Next: read the players behind the other dispatch entries (obj1+0x39615, +0x37d34 and their is-active routines).
- [ ] `audio.record-roles` [STATIC] — the sound records: +0 data pointer, +4 length (bank mode), +8 a parameter for the library's play call, +0xc priority, +0x10 voice handle, +0x14 play counter; read in the reset, is-playing and play routines
  - Gap: not isolated beyond `audio.record-play`; the sound library routines (obj1+0x31bc8, +0x31dd4) are unread.
- [ ] `UNKNOWN_AUDIO_RECORD_FIELDS` [UNKNOWN] — what the record dword +0x08 is for (passed to the play call, 0 in both loaders)
  - Next: read the library play routine obj1+0x31bc8 and the bank-mode player.

## Work items (no claim)

- [ ] Observe the other small data loaders at the right moment: OTT (obj1+0x25988, 3600 bytes, then the loose `WACKYn.TIM` is read into the same buffer at obj2+0x10730), HTT (obj1+0x25b5e, 6624 bytes, buffer obj2+0x17ba8, with `WACKYn.HI`), BIN (obj1+0x25c6a, 4000 bytes, obj2+0x4026) and ING (obj1+0x25e34, 1170 bytes, the same buffer as the first piece of `WACKY.CFG`). In the demo race the OTT and HTT buffers were zero and the BIN buffer matched neither member; the menu, the high-score screens and the exit path are the likely moments.
- [ ] `cmdline.class-one` [STATIC] — `/1` sets the class word to 12, the same as the default
  - Gap: the experiment cannot tell it from no word. Next: find what the class word does, then a run that makes the default differ (e.g. via the saved settings) or accept as static.
- [ ] Take more observations: a second track (the command line has no track word, see `cmdline.words`; to catch a different `.GAM`, a flag-1 palette-cycling track, `.RD` with different counts) and a moment during loading rather than after it. `npm run observe` takes both; reaching another track needs the menus (see `binaries.md`, "Driving the menus"): attract demos and the restored saved game both gave track 2, and editing the saved-game words does not choose a track. Possibly `Two Player Race` or a championship progress word does; not tried. `race-3` is also most likely an attract-mode demo race, not a played one.
- [ ] Trace the code that uses what the loaders store (renderer, physics, AI, lap logic); only the loaders were read for `.M`, `.POS`, `.SIN`, `.RD` and `.GAM`.
- [x] Padded map cells: the 128x128 table is indexed by world coordinates clamped to 0..0xfff (`terrain.lookup`, `terrain.clamp`), so a position outside the 64x64 map reads one of the 12288 padding cells, all of which point at tile 0 (`m.read`); the renderer's own use of the padding was not read.
- [ ] Move the remaining legacy decoders under the rule. Done: `src/archive.js` `parseDat` is built on `src/formats/dat.js`, `parseAudioT` uses `src/formats/audio-bank.js` first (lenient fallback kept for banks of another shape), `src/sprites.js` `parseAtr` is built on `src/formats/atr.js`, `src/tracks.js` `parseRoute` and `parseSpawns` are built on `src/formats/track-files.js` (with an explicit option to keep unknown trailing bytes, which the editor preserves) and `composeTrack` on `parseMap` and `splitTiles` (byte-identical to the old output on all 42 tracks; the viewer's track preview checked in a browser) (checked: tests, `check:assets`, `check:tracks`, `check-track-editor`, both pages in a browser for the first three). Left: `src/pcx.js` (the viewer reads arbitrary PCX files, the traced decoder is game-style only), `parseGam` (the editor edits the text line by line; the strict parser requires CRLF, which the game also does, so tightening it is a decision), `spriteLayout`/`rawFrame` in `src/sprites.js`, `src/data-formats.js`, `src/audio.js` (`.KLM`, `.MID`, the `.VOC` sample decoding whose rate rule is the wiki's; `src/formats/voc.js` has the structure), `src/synthesis.js`. Then delete the legacy ones that nothing uses.
- [x] PCX behaviour carried into the viewer: the legacy `decodePcx` now lets RLE runs cross a scanline (an overshoot is still an error) and the viewer has a "Game palette (6-bit VGA)" toggle (`>> 2` from `pcx.palette-scale`, expanded for display with the usual `v << 2 | v >> 4`, a display convention that is not proven)
- [x] Viewer and editor moved onto `src/vfs/`: the viewer's picker, drop and dev-server loads all go through `loadVfs` (`openPicked` / `openDevGame`), the editor reads a picked, dropped or dev-server archive through the same adapters (checked in a browser: viewer 630 assets from `WACKY.DAT` alone via the picker input, editor 42 tracks, no console errors). The viewer's and editor's own decoders are still the legacy modules, not `src/formats/*` (see the work item on moving them)
- [ ] Analyse what `SETUP.EXE`, `MANUAL.EXE` and `WWHELP.EXE` do and what `MANUAL.EXE`'s 17016-byte overlay and `WWHELP.EXE`'s second MZ at 27230 hold (layouts are recorded in `binaries.md`).
- [ ] Remove the stale raw `WW.EXE` entry from the Ghidra project (nothing uses it; the LE-aware import is `/obj1.bin`). Not done: it is deletion in a project the user keeps open.
- [ ] Review the sixteen `src/verify/checks/*.js` files yourself if you want your own sign-off; all carry `reviewed: {by: 'main-session'}`.

## Done

- [x] `dat.uppercase-range` PROVEN (`gamslot-2`, check `obs-uppercase`): the lookup upper-cases exactly the bytes 0x61 to 0x7a of the requested name in place; the bytes at 0x40, 0x5b, 0x60 and 0x7b stay
- [x] `terrain.clamp` PROVEN (`terrain-4`, check `obs-terrain`): with row and column forced at the lookup's entry to values on each side of both limits, every result equals the one the position clamped to 0..0xfff predicts
- [x] `dat.entry-notfound` PROVEN (`miss-1`, check `obs-miss`): an execute breakpoint on the lookup's not-found path stops for the missing name with the walk index equal to the entry count (577) and a zero first byte in the entry there
- [x] `audio.speaker-tick` PROVEN (`tick-1`, `tick-2`, check `obs-tick`): at execute-breakpoint stops on the tick handler's tone path, the player's pointer, counter, divisor (60 x byte) and priority all follow from chunk + 6, the length dword and the bank
- [x] `audio.device-gate-run` PROVEN (`gate-2`, `gate-3`, check `obs-gate`): execute breakpoints in protected mode show mode 2 rejected by the library check and mode 3 by the init, with the bank-load routine and loader never run, and the device word equal to the mode
- [x] `audio.speaker-state` PROVEN (`speaker-1`, check `obs-speaker`): with the CFG sound mode set to 7 the library's device word at obj2+0x3fe8 equals the mode, the PC-speaker player is idle in byte mode with no callback and its 256-word table is 60 times its index
- [x] `gam.trailing-space`, `dat.notfound-behavior` PROVEN by experiment (`gamslot-1`, check `obs-gamslot`): a trailing space on a `.GAM` name line is kept (`BACK2.PCX ` + NUL), the exact-compare lookup misses, and the game carries on silently with the bytes that follow the previous read (the sky picture became the bytes after `2.SIN`)
- [x] `ai.state-machine`, `ai.race-speeds` PROVEN (`aistate-1`, check `obs-aistate`): over 30 pauses racers 1 to 7 move through states 0, 1, 2 with the counter relations of the rules, and the speed words are table indices replaced once by values of a copy of `VEL.TAB` (36, 40, ..., 60)
- [x] `audio.record-play` PROVEN (`audio-1`, check `obs-audio`): of the 26 sound records 10 hold a voice handle and every one of them has a counted play; every never-played record has handle -1; the player routines are read as `audio.record-roles`
- [x] `cars.frames` PROVEN (`cars-frames`): `CARS.SP` is 8 slots of 12 frames of 38 x 28 and the eleven driver sprite files are whole numbers of those frames
- [x] `trig.layout`, `ndist.layout` PROVEN (`trig-ndist`): `TRIG.DAT` is 1920 unit vectors in 16.16 (one duplicate at entry 1351), `NDIST` is 320 runs of 70 increasing positive dwords (115 to 1122)
- [x] `ai.speed-setup` PROVEN (`start-1`, check `obs-aistart`): right after racer init every computer racer is in state 0 with first-phase counter 0x18, speed +8 = L, +0xa = L + 0x3c - 10 (7 - n), +0xc = L - 4 - 10 (7 - n) and second-phase counters 22..60, L being the word at obj2+0x28b84 (89)
- [x] `ai.route-follow` PROVEN (`progress-1`, check `obs-route`): in a demo race racers 1 to 7 stand exactly on points of the rasterised `.RD` route in all 24 samples (168 positions), racer 0 never; computer racers walk the route's point array instead of using physics. Read in full as `ai.step-rules` (STATIC); the route's compass word is copied into a racer heading word
- [x] `racer.start-grid` PROVEN (`start-1`, check `obs-start`): in a demo race (obj2+0x1ec74 = 0, grid flag 0) the eight start-table entries are the first `.GAM` pair's line of positions (x0 + 0x50 at index 4, down by 0x14, wrapping 0 to 7, y = y0) and racers 0 to 7 start at them; the other seven pairs of the file are overwritten
- [x] `rd.record-references`, `pos.quarter-references` PROVEN (`exe-references`): the relocation table, which lists every absolute address in `WW.EXE`, names the route record buffer only at words +0, +2, +4, +6 and +0x0a (six sites, all in the loader) and the `.POS` trailer quarter only at the loader's own write; this strengthens the STATIC `rd.unused-words` and `pos.quarter-unreferenced`, whose remaining gap is reads through computed addresses
- [x] `cmdline.words` PROVEN by experiment (`cmdline-1` to `cmdline-4`, check `obs-cmdline`): the words TURBO, JUMP, HOG, ICE, FIRE set bits 1, 2, 4, 8, 0x10 of a mask at obj2+0x84f0 (copied to three more places), NOW sets a flag, /1 /2 /3 set a class word to 12, 6, 0 (last wins), /DEBUG sets a word; no word chooses a track. What the bits do is open
- [x] `dat.entry-tail` PROVEN (`obs-lookup`, from `race-3` and `buffers-1`): of the 23 members the game demonstrably loaded, 22 have leftover bytes after the NUL of their directory entry's name, so the lookup compares only up to the NUL
- [x] `gam.atoi`, `gam.line-reader` PROVEN by experiment (`gamtext-1` to `gamtext-4` and `ctype-1`, check `obs-gamtext`): the run copy's archive was given edited `.GAM` lines (rebuilt from your archive and hash-checked by the check; `npm run make-test-archive`), and the words the game stored match the claimed reader (CR ends a line, the next byte is swallowed, LF inside a line does not end it) and converter (leading class-0x02 characters skipped, one sign, class-0x20 digits, 16-bit word)
- [x] `small.read` PROVEN (`buffers-1`, check `obs-buffers`): `VEL.TAB`, `VEL2.TAB`, `VIEW` and `SLP` are read whole into obj2+0x1e8c4, +0x1e584, +0xb7f8 and +0xe858 (CRC-32 equal in a running race); `.VOC` structure `voc.layout` PROVEN (`voc-members`, 36 members, with a strict parser `src/formats/voc.js`)
- [x] `terrain.sdx-index` PROVEN (`surface-1`, check `obs-surface`): the terrain value indexes the `WACKY.SDX` records; in 24 pauses the car record holds the value, the record's address and its file dword and word
- [x] `pos.progress-live` PROVEN (`progress-1`, check `obs-progress`): in 24 pauses of a demo race every racer's stored grid value is the `.POS` cell at its world position (`(x - 0x400) >> 5`, 64 columns, 0 off the course) and its two ranking keys are `lap × 1024 + value` and `value + trailer × lap`
- [x] `UNKNOWN_SP_PIXEL_ORDER` resolved into `sp.draw` and `spw.frame` (STATIC, from `FUN_00036fd0` and the object preparation routine at obj1+0x4398); the viewer's column-major default agrees
- [x] `par.upload` PROVEN (`vram-1`, check `obs-vram`): the 0x6400 `.PAR` bytes sit in video memory at offset 0x7d00 in plane order (plane p, offset k holds file byte 4k + p), uploaded by `FUN_00036f55`
- [x] `audio.load`, `audio.alias` PROVEN (`audio-1`, check `obs-audio`): with the CFG sound mode 7 the game reads `AUDIOT.FX` whole into the buffer at the dword obj2+0x1eb14 and builds 26 records at obj2+0x1a9c8 that follow from the bank layout (pointer, length, priority 27 - k); records 0 to 7 are copies of record 20. Mode 2 was refused by the game's device check, so that branch stays `audio.mode-select` (STATIC)
- [x] `cfg.read` PROVEN (`race-3`, check `obs-race`): `WACKY.CFG` is read as three pieces (0x492, 0x18, 0x630 bytes, 2778 in all) to obj2+0x1ee1c, +0x1b6d8 and +0x17128, and live memory equals the installed file except six blocks the game writes; the sound-mode dword at obj2+0x17404 is file offset 0x786
- [x] `setup.exe.layout`, `manual.exe.layout`, `wwhelp.exe.mz`, `dos4g.stub-header`, `mz.dos-header` PROVEN (`other-exes`): the three other executables located and laid out; `locateLe` now tolerates an overlay
- [x] `atr.layout`, `atr.read`, `sp.read` PROVEN: `SPRITE.ATR` layout (36/36 entries match their `.SP` sizes), the catalogue load and the per-object sprite loader (the sprites loaded are exactly the `.SPW` object ids); strict parser `src/formats/atr.js`
- [x] `static.layout`, `static.read` PROVEN: the startup loader `FUN_00028180` reads `MAP.XY`, `WACKY.SDX`, `TRIG.DAT`, `NDIST`, `CARS.SP` and `GIG.MOV`; all six regions equal their members in the running game except the tails of five SDX records (run-time state); strict size parsers in `src/formats/static-tables.js`
- [x] `rd.route` PROVEN: the route loader rasterises every segment (x1, y1, x2, y2 = file words +0, +2, +4, +6, each +0x400) into a point array, and the live table (start pointer, point count, compass) and 58 segments' points equal the in-process rasterisation (`src/formats/route.js`); `rd.read-rest` resolved into it and `rd.unused-words`
- [x] `UNKNOWN_POS_GRID_USE` resolved into `pos.progress` and `pos.quarter-unreferenced`
- [x] `terrain.lookup` PROVEN (`terrain-3`, check `obs-terrain`): the terrain-property lookup `FUN_00037b04` confirmed at 60 live positions; it settles what the masks do (they select which of the two `.SIN` dwords applies, so `UNKNOWN_TILE_MASK_MEANING` is resolved), the `.SIN` kept layout (two dwords), and the `+0x400` coordinate bias (map pixels to world coordinates; the map starts at table cell 32)
- [x] `spw.layout`, `spw.read`, `par.read` PROVEN: the `.SPW` and `.PAR` loaders were found (`FUN_00021490`, the track-start routine `FUN_00017928`) and confirmed in the running game; a strict `.SPW` parser exists (`parseSpw`); `UNKNOWN_TRACK_OTHER_LOADERS` resolved into `UNKNOWN_SPW_FIELDS` and `UNKNOWN_PAR_USE`
- [x] `dat.directory-read`, `dat.entry-lookup`, `dat.entry-size`, `pcx.rle-rule`, `pcx.member-split`, `pcx.palette-scale`, `tiles.sheet-split`, `tiles.buffer`, `m.read`, `pos.read`, `sin.read`, `rd.read`, `gam.read` promoted to PROVEN by the first running-game observation (`race-3`, check `obs-race`, 2026-10-03); statements narrowed to what was seen, the rest split into the STATIC claims above
- [x] `ww.exe.relocation` PROVEN (`load-2`, check `obs-load`): object bases in guest memory and the relocated fixup sites
- [x] First DOSBox observation tooling: `npm run observe`, `tools/dosbox/live.mjs`, `src/verify/obs.js`, record validation (numeric-only, no asset bytes), orphan and missing-record errors in `verify`
- [x] `UNKNOWN_DAT_ENTRY_NAME_TAIL` resolved into `dat.entry-compare` (name compare read in full); `UNKNOWN_GAM_LINE_READER` resolved into `gam.line-reader` and `gam.atoi`
- [x] Wrong `obj2` offsets for the `0x88xxx` Ghidra addresses (`.POS` trailer, `.GAM` words, route count, entry index) found by the observation and corrected everywhere
- [x] `UNKNOWN_WW_DAT_READER` resolved into the `dat.*` claims; LE loader, `dat.layout`, `pcx.layout`, `pcx.header-observed`, `m.layout`, `pos.layout`, `sin.layout`, `rd.layout`, `track.file-set`, `gam.layout`, `tiles.mask-values` PROVEN
- [x] Ghidra import of WW.EXE objects verified (`npm run ghidra:verify`)
- [x] Browser file-access adapters (`src/vfs/core.js`, `dev.js`, `picker.js`) with tests
- [x] Lint requires every `src/formats/hypotheses/` module to mark its decodes as WF or UNKNOWN
