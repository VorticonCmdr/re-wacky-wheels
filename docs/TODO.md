# TODO

How this file works (`test/evidence.test.js` enforces the first two rules):

- Every claim that is not `PROVEN` has exactly one **unchecked** line of the form ``- [ ] `claim-id` [TAG] ...`` under *Open claims*.
- A checked line (``- [x] `claim-id` ...``) may only name a claim that is `PROVEN` or no longer exists. When a claim is promoted, tick it and move it to *Done* in the same commit as the registry tag and the docs line.
- Work items that are not claims go under *Work items* with plain ``- [ ]`` lines (no claim id in backticks at the start).
- `Gap` says what is not established; `Next` is the concrete step that would close it. Negative findings say what was checked (tool, address, date), never "does not exist".

## Open claims

### Archive (`WACKY.DAT`)

- [ ] `dat.entry-notfound` [STATIC] — the lookup ends as not-found at an entry whose first byte is 0 (obj1+0x41a9)
  - Gap: no lookup in the recorded race fails, so the not-found path was never seen at run time.
  - Next: observe a lookup of a missing name (e.g. through the game's `/DEBUG` option, which prints a message on failed lookups) or accept it as static.
- [ ] `dat.entry-compare` [STATIC] — the compare function is a NUL-terminated string compare after an in-place upper-case of a-z (obj1+0x32df0, +0x32dd0)
  - Gap: the tail-insensitivity is observed (`dat.entry-tail`); the function internals and the exact upper-casing range (only a-z) are read, not exercised (every name looked up in the records is already upper or lower ASCII letters).
  - Next: an experiment with a planted name such as `a_f3.pcx` containing a non-letter byte in the 0x5b to 0x60 range.
- [ ] `UNKNOWN_DAT_SENTINEL_ENTRY` [UNKNOWN] — whether the packer writes the 22-byte sentinel after the directory on purpose
  - Gap: the game does not load it (the 22 bytes after its table are zero), so it is irrelevant to the game; only archive rewriting cares.

### Images (PCX, tiles, masks)

- [ ] `pcx.rle-rule-vga` [STATIC] — the decoder that writes VGA planes (obj1+0x75cd) uses the same rule; runs continue across rows; a zero count is not special-cased
  - Gap: this decoder, run continuation and zero counts were not observed (no archive file has such a run). Only the linear-buffer decoder was confirmed (`pcx.rle-rule`).
  - Next: capture VRAM right after a full-screen PCX is drawn (needs a code breakpoint at a 32-bit offset, which the DOSBox API does not offer) or accept as static.
- [ ] `terrain.clamp` [STATIC] — the lookup clamps row and column to 0..0xfff (obj1+0x27b10)
  - Gap: no sampled position is near the edges of the range (60 samples, all inside), so the clamp itself was not seen at run time.
  - Next: a sample taken while a car is off the map edge, or accept as static.

### Track files (`.M`, `.POS`, `.SIN`, `.RD`, `.SPW`, `.PAR`)

- [ ] `pos.progress` [STATIC] — the progress lookup and lap logic (`FUN_0001260c`, `FUN_00012b44`): grid cell at `((y-0x400)>>5, (x-0x400)>>5)`, 0 off the course, lap counted when the previous value is the trailer and the new one is 1, ranking key `progress + trailer * laps`
  - Gap: the lookup and the ranking keys are observed (`pos.progress-live`: 24 pauses, 8 racers, every one consistent); what stays STATIC is the lap counting itself (a lap is counted when the previous value is the trailer and the new one is 1; racers in the recording were all on lap 2) and the flag-word branch. The wiki's wrong-way warning was not located.
  - Next: a recording that spans a lap crossing (and a racer with the flag word set), or find the wrong-way code.
- [ ] `pos.quarter-unreferenced` [STATIC] — the trailer's quarter at obj2+0x28ba0 has one reference, the loader's write
  - Gap: stamped negative finding (Ghidra MCP `get_xrefs_to` 0x00088ba0, block obj2, 836 functions analysed, 2026-10-03): nothing found reads it by a direct address; a computed-pointer read is not ruled out.
- [ ] `rd.unused-words` [STATIC] — the `.RD` loader never reads record words +0x08 and +0x0c (the wiki's angle and distance)
  - Gap: the observed route table does not depend on them (`rd.route`); another reader of the record buffer at obj2+0x1ee0c is not ruled out.
- [ ] `racer.init` [STATIC] — `FUN_00016f90` resets 24 racer records (0x68 bytes) and, for racers 0 to 7, sets x and y from the `.GAM` start tables and the heading word from the first route compass word
  - Gap: read in full; the racer words after start were not compared with the tables (the start moment was not recorded).
- [ ] `racer.start-grid` [STATIC] — in the branch where obj2+0x1ec74 is 0 the routine rebuilds seven table entries from pair 0 (x + 0x50 down by 0x14, same y)
  - Gap: which branch the game takes was not seen.
- [ ] `UNKNOWN_RD_FIELD_USE` [UNKNOWN] — what the AI does with the rasterised route and the compass word
  - Next: read `FUN_00028cac`, `FUN_00016d68` and the readers of the racer word at obj2+0xaaaa (`FUN_00016f90` is read: `racer.init`).
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
- [ ] `UNKNOWN_STATIC_TABLE_MEANING` [UNKNOWN] — what the six tables mean, and what the game rewrites in the last 8 bytes of five `.SDX` records
  - Gap: layout and run-time placement are proven (`static.layout`, `static.read`); no reader of the live buffers has been read.
  - Next: the TRIG / NDIST / CARS pointer readers (obj2+0x1d6a0 / +0x1d660 / +0x1d708: 38, 9 and 7 sites) and obj2+0x1b548 (MOV: obj1+0x1a859, +0x1ac00); MAP.XY (`mapxy.use`) and the SDX terrain index (`terrain.sdx-index`) are read.

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
- [ ] `gam.line-reader-tail` [STATIC] — the line reader writes a NUL over the CR, keeps trailing spaces and has no end-of-file test
  - Gap: read in full; not isolated by the experiment. Next: plant a trailing space in a name line (the lookup should then fail with a visible error) and a file without a final CR.
- [ ] `UNKNOWN_GAM_NUMBERS` [UNKNOWN] — meaning of lines 6–7, the eight coordinate pairs (only the first survives as a start position; the rest of the live table is a derived grid), the flag on line 25 and lines 26–28
  - Next: readers of obj2+0x28b0a / +0x28b0e, the word tables obj2+0x1d7cc / +0x1d7e0, obj2+0x28b60 and obj2+0x28b5a / +0x28b4e / +0x28b4c.

### Audio (`AUDIOHED.FX`, `AUDIOT.FX`)

- [ ] `audio.mode-select` [STATIC] — which values of obj2+0x17404 call the bank loader and which bank each takes (7 observed: slots 0 to 25; 2 would take slots 26 to 51)
  - Gap: with the CFG mode dword set to 2 the game stops at start-up with "Invalid Sound Fx device." (2026-10-03), so the second-bank path has not run.
  - Next: the device values 2, 3 and 4 are all rejected as "Invalid Sound Fx device." in the DOSBox run (see `UNKNOWN_AUDIO_MODE_VALUES`); find out from the dispatch at obj1+0x31510/0x31530/0x31624 whether any setup reaches the second-bank path or the test for 2 is dead code.
- [ ] `audio.record-init` [STATIC] — the loader sets record dwords +0x10 to 0xffffffff and +0x14 to 0; the running game rewrites them
  - Gap: only the initialisation is read; the live values at the title screen differ.
  - Next: the readers and writers of the table at obj2+0x1a9c8.
- [ ] `UNKNOWN_AUDIO_MODE_VALUES` [UNKNOWN] — which sound device each value of obj2+0x17404 means and what the routine at obj1+0x2168 loads for the other values
  - Known: obj2+0x17404 is `WACKY.CFG` file offset 0x786 (`cfg.read`); the shipped files all hold 0 there; the start-up check prints, by value (2026-10-03, leads): 1 "MVSOUND.SYS not loaded.", 2/3/4 "Invalid Sound Fx device.", 5 "UltraSound card not found", 6 "Could not detect Sound Source.", 0 and 7 start (7 loads the bank). The device dispatch at obj1+0x31510 and later looks like Apogee's sound manager (strings "Fx ok.", "Invalid Sound Fx device.", "DPMI Error in FX_MAN."), with device values 0 to 7; that is a lead, not a claim.
  - Next: read the per-device modules behind the dispatch tables (the messages above identify 1, 5 and 6), what `SETUP.EXE` writes at 0x786, and what the same check does for the music device (the `Checking Music Hardware` line, a different config dword).
- [ ] `UNKNOWN_AUDIO_CHUNK_FIELDS` [UNKNOWN] — what the chunk header bytes after the length dword mean and how the player uses them
  - Next: trace the readers of the record table at obj2+0x1a9c8.
- [ ] `UNKNOWN_AUDIO_RECORD_FIELDS` [UNKNOWN] — what the dwords +0x08, +0x0c, +0x10 and +0x14 of the 26 sound records mean
  - Next: the sound player (readers and writers of the table).

## Work items (no claim)

- [ ] Observe the other small data loaders at the right moment: OTT (obj1+0x25988, 3600 bytes, then the loose `WACKYn.TIM` is read into the same buffer at obj2+0x10730), HTT (obj1+0x25b5e, 6624 bytes, buffer obj2+0x17ba8, with `WACKYn.HI`), BIN (obj1+0x25c6a, 4000 bytes, obj2+0x4026) and ING (obj1+0x25e34, 1170 bytes, the same buffer as the first piece of `WACKY.CFG`). In the demo race the OTT and HTT buffers were zero and the BIN buffer matched neither member; the menu, the high-score screens and the exit path are the likely moments.
- [ ] `cmdline.class-one` [STATIC] — `/1` sets the class word to 12, the same as the default
  - Gap: the experiment cannot tell it from no word. Next: find what the class word does, then a run that makes the default differ (e.g. via the saved settings) or accept as static.
- [ ] Take more observations: a second track (the command line has no track word, see `cmdline.words`; to catch a different `.GAM`, a flag-1 palette-cycling track, `.RD` with different counts) and a moment during loading rather than after it. `npm run observe` takes both; reaching another track needs the menus (see `binaries.md`, "Driving the menus"): attract demos and the restored saved game both gave track 2, and editing the saved-game words does not choose a track. Possibly `Two Player Race` or a championship progress word does; not tried. `race-3` is also most likely an attract-mode demo race, not a played one.
- [ ] Trace the code that uses what the loaders store (renderer, physics, AI, lap logic); only the loaders were read for `.M`, `.POS`, `.SIN`, `.RD` and `.GAM`.
- [x] Padded map cells: the 128x128 table is indexed by world coordinates clamped to 0..0xfff (`terrain.lookup`, `terrain.clamp`), so a position outside the 64x64 map reads one of the 12288 padding cells, all of which point at tile 0 (`m.read`); the renderer's own use of the padding was not read.
- [ ] Move the remaining legacy decoders under the rule. Done: `src/archive.js` `parseDat` is built on `src/formats/dat.js`, `parseAudioT` uses `src/formats/audio-bank.js` first (lenient fallback kept for banks of another shape), `src/sprites.js` `parseAtr` is built on `src/formats/atr.js` (checked: tests, `check:assets`, `check:tracks`, both pages in a browser). Left: `src/pcx.js` (the viewer reads arbitrary PCX files, the traced decoder is game-style only), `src/tracks.js` (`parseGam`, `parseRoute`, `parseSpawns`, `composeTrack`; the strict parsers reject files the editor accepts today), `spriteLayout`/`rawFrame` in `src/sprites.js`, `src/data-formats.js`, `src/audio.js` (`.KLM`, `.MID`, the `.VOC` sample decoding whose rate rule is the wiki's; `src/formats/voc.js` has the structure), `src/synthesis.js`. Then delete the legacy ones that nothing uses.
- [x] PCX behaviour carried into the viewer: the legacy `decodePcx` now lets RLE runs cross a scanline (an overshoot is still an error) and the viewer has a "Game palette (6-bit VGA)" toggle (`>> 2` from `pcx.palette-scale`, expanded for display with the usual `v << 2 | v >> 4`, a display convention that is not proven)
- [x] Viewer and editor moved onto `src/vfs/`: the viewer's picker, drop and dev-server loads all go through `loadVfs` (`openPicked` / `openDevGame`), the editor reads a picked, dropped or dev-server archive through the same adapters (checked in a browser: viewer 630 assets from `WACKY.DAT` alone via the picker input, editor 42 tracks, no console errors). The viewer's and editor's own decoders are still the legacy modules, not `src/formats/*` (see the work item on moving them)
- [ ] Analyse what `SETUP.EXE`, `MANUAL.EXE` and `WWHELP.EXE` do and what `MANUAL.EXE`'s 17016-byte overlay and `WWHELP.EXE`'s second MZ at 27230 hold (layouts are recorded in `binaries.md`).
- [ ] Remove the stale raw `WW.EXE` entry from the Ghidra project (nothing uses it; the LE-aware import is `/obj1.bin`). Not done: it is deletion in a project the user keeps open.
- [ ] Review the sixteen `src/verify/checks/*.js` files yourself if you want your own sign-off; all carry `reviewed: {by: 'main-session'}`.

## Done

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
