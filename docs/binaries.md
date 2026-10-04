# Binaries

Citations name an executable, an LE object, and an object-relative offset in the **pre-fixup** object image, with a fingerprint: `WW.EXE:obj<N>+0x<off> fp=<crc32>` (see [evidence.md](evidence.md#citations)). Everything else in this file is derived from that form.

## WW.EXE

User's copy: 650437 bytes, sha1 `ea41ea5ec1be24e2cbec15dbee3a04263b04a8d4`. Claims `ww.exe.*` pin this build.

| Fact | Tag | Check |
| --- | --- | --- |
| DOS/4G-bound LE program. The bound MZ is at file offset 157268 (`e_lfanew` = 0x2AA8 → LE header at 168188). The other MZ signatures at 0, 113034, 136600 and 160956 do not lead to a valid LE header. | [PROVEN] | `le-locate` (with discriminator) |
| LE offsets in the header are relative to the LE signature, but the data-pages offset (0x27600) is relative to the bound MZ. The 82 pages (4096 bytes each, the last 113 bytes) end exactly at EOF. | [PROVEN] | `le-pages` |
| The page map is the identity map 1..82 with no flags, using 3-byte big-endian page numbers. Reading the entries as uint32 LE (the LX layout) does not give the identity map. | [PROVEN] | `le-pages` (with discriminator) |
| obj1: base 0x10000, vsize 0x4BE2E, flags 0x2045, pages 1–76. obj2: base 0x60000, vsize 0x33100, flags 0x2043, pages 77–82; obj2 extends past its stored pages, and the rest is zero-filled. | [PROVEN] | `le-pages` |
| The entry is obj1+0x311A8 (`fp=12c4b465`): `EB 78`, a short jump over "WATCOM C/C++32 Run-Time system. (c) Copyright by WATCOM…". The initial ESP is obj2+0x33100, the end of obj2. | [PROVEN] | `le-entry` (with discriminators) |
| There are 17430 fixups: 13701 with source 0x07/flags 0x10, 3728 with source 0x07/flags 0x00, and 1 with source 0x02. Every record is an internal reference with an 8-bit object number and no source lists. The parser rejects any other encoding as not established. | [PROVEN] | `le-fixups` |
| At every source-0x07 fixup site, the pre-fixup uint32 equals the object-relative target offset (17429/17429). 13 records have negative source offsets, i.e. sites straddling a page boundary. | [PROVEN] | `le-fixups` |
| The strings "RATIONAL DOS/4G" and "WATCOM C/C++32 Run-Time" are present. | exploratory (`strings`, 2026-10-03); no claim yet | — |

The cpu field is 2 and the os field is 1. Their meanings (80386; the LE "OS/2" value that DOS/4G uses) come from the LE specification and are leads only.

### Address conventions (derived, never cited alone)

| Space | obj1 | obj2 | Conversion |
| --- | --- | --- | --- |
| Citation | `obj1+0x<off>` | `obj2+0x<off>` | canonical |
| Ghidra | 0x10000 + off | 0x60000 + off | the LE-declared object bases (`toGhidra`/`fromGhidra` in `src/formats/le.js`) |
| DOSBox (live) | base1 + off | base2 + off | DOS/4G picks the bases at run time; they are a property of the session, not of the file. Under dosbox-automation 0.84.0-vc1 (the bridge's config, 64 MB) both runs recorded so far had obj1 at 0x1EC000 and obj2 at 0x239000. Find them with `npm run observe` (it votes over file pages, below), never from a single byte search. |

### Ghidra import

*Status 2026-10-03: executed and verified. `npm run ghidra:import` produced `/obj1.bin` in the project, and `npm run ghidra:verify` (read-only headless, `VerifyWwImport.java`) confirms blocks obj1 (0x10000, 310830 bytes, r-x) and obj2 (0x60000, 209152 bytes, rw-), all 17429 32-bit fixup sites holding their flat targets, every other byte equal to the dump, and `le_entry` at 0x411a8. Auto-analysis found 836 functions. The project also still holds an older `WW.EXE` entry (the raw file, not LE-aware) that nothing here uses. This verifies the import tooling, not facts about the game.*

1. `npm run dump:le` writes `analysis/ww/obj1.bin` and `obj2.bin` (pre-fixup, zero-filled to the virtual size), `fixups.json` and `layout.json`, all in-process via `src/formats/le.js`.
2. Close the `wackywheels` project in the Ghidra GUI. Headless import needs the project lock.
3. `npm run ghidra:import` runs `analyzeHeadless ghidra wackywheels` with the raw `BinaryLoader` (x86:LE:32:default) at obj1's base. The pre-script `tools/ghidra/ImportWwObjects.java`:
   - adds obj2;
   - applies the type-0x07 fixups (32-bit flat target = target object base + target offset) as relocations;
   - records the single selector fixup without applying it;
   - labels `le_entry`.
4. `npm run ghidra:verify` re-checks the import against `analysis/ww` (close the project in the GUI first; headless needs the lock, or use the open instance through the Ghidra MCP).
5. Ghidra shows bytes at fixup sites **post-fixup**. Fingerprints use pre-fixup bytes, so always produce citations with `npm run cite`. It warns when a fixup site overlaps the fingerprinted 16 bytes.

## Other executables

Layout only, apart from `SETUP.EXE`'s sound-card table (`audio.device-numbers`; `DISASM_DIR=analysis/setup npm run disasm` reads its dumped objects): what each program does is not analysed (see [TODO.md](TODO.md)). `npm run dump:le -- --exe NAME` dumps the objects of the two LE programs for Ghidra; the citation form is the same (`SETUP.EXE:obj1+0x...` once something is cited).

| Program | Format | Facts | Tag | Check |
| --- | --- | --- | --- | --- |
| `SETUP.EXE` | DOS/4G-bound LE, same stub offsets as WW.EXE | 391343 bytes; bound MZ at 157268, LE header at 168188; 42 pages (last 2139), no overlay; obj1 base 0x10000, vsize 0x242FE, flags 0x2045, pages 1-37; obj2 base 0x40000, vsize 0x343C0, flags 0x2043, pages 38-42; entry obj1+42216 | [PROVEN] (`setup.exe.layout`) | `other-exes` (with discriminators) |
| `MANUAL.EXE` | DOS/4G-bound LE with an overlay | 305676 bytes; bound MZ at 217764, LE header at 228412; 12 pages (last 3312) then a 17016-byte overlay that is a symbol table naming `C:\WORK\XVIEW\xview.c` ([PROVEN] `manual.xview`); the program is the script viewer Xview (its script words are numbered 0 to 8, [STATIC] `manual.script`) (by Allen H. Blum III, 1997) that runs `COMMANDS.TXT` ([PROVEN] `manual.xview`, check `manual-xview`); obj1 base 0x10000, vsize 0x9C30, flags 0x2005, pages 1-10; obj2 base 0x20000, vsize 0x4330, flags 0x2003, pages 11-12; entry obj1+7024 | [PROVEN] (`manual.exe.layout`) | `other-exes` |
| `WWHELP.EXE` | plain 16-bit MZ, no DOS/4G | 36353 bytes; header image of 12151 bytes (375 in the last of 24 pages), no relocations, SS:SP 1200:128, CS:IP 735:14; a second MZ signature at 27230; the image is followed by 24202 appended bytes and carries the `LZ91` packer signature, with the plain title "Wacky Wheels v1.1 Technical Help" at 0x8c91 ([PROVEN] `wwhelp.packed`, check `wwhelp-packed`); the packed image decodes to 18538 bytes ([PROVEN] `lzexe.decode`, `wwhelp.image`, check `obs-wwhelp`) of SimpleWare's "Simply Docs" viewer, which shows the 13-page technical help when run | [PROVEN] (`wwhelp.exe.mz`, field offsets `mz.dos-header`) | `other-exes` |

- All three LE programs, and WW.EXE, carry the same DOS/4G stub header at file offset 0 (116 bytes in the last of 123 pages, 78 relocations, SS:SP 289:832, CS:IP 445:9090): [PROVEN] (`dos4g.stub-header`).
- `locateLe` accepts a program whose pages end before end of file (an overlay) and returns the overlay size; WW.EXE's own check still asserts that its pages end exactly at EOF.


### Observing the running game

`tools/dosbox/` drives the dosbox-automation REST API (`GET /api/v1/memory/{offset}/{len}` returns raw bytes without auth when the bridge config allows it); `src/verify/obs.js` loads and validates what it writes.

1. Run a copy of the game, not your install: `run.bat` deletes and overwrites `WACKY.CFG`. This project uses `analysis/dosbox/WACKY/` (git-ignored, inside the bridge's allowed mount base): copy `WW.EXE`, `WACKY.DAT`, `WACKY.CFG` (from `SB16/`), `WACKY.DTT`, `WACKY1.HI`, `WACKY1.TIM`; mount the parent as `C:`; `SET APOGEECD=C:\WACKY\`; `CD WACKY`; `WW`.
2. Press a key at "Press any key when ready..", wait for the menu, wait: left alone, the menu starts an attract-mode demo race, which is a fully loaded race on track 2 (the earlier `race-3` record was most likely taken this way; a played race needs input, see step 5). Pause (`debug_pause`) so the state is stable.
3. `npm run observe -- load --id <id> --moment "<what the game was doing>"` or `-- race ...` writes `src/evidence/obs/<id>.json`: numeric-only (addresses, counts, CRC-32s, short name labels; `validateObs` rejects long strings and byte-like arrays). A record is evidence only through a check that lists it under `obs` and cross-validates it against the in-process decode (`obs-load`, `obs-race`).
4. How the tool finds the bases: for every stored 4 KiB page of every object it searches a window of guest memory for a 32-byte anchor, verifies the whole page with fixup-site bytes masked out, and votes for `address - page offset`. Candidates are then told apart by whether sampled fixup sites hold `base + target` (the relocated image) rather than the raw target offset: a second, un-relocated copy of the image sits at 0x1C2A60 and would otherwise tie the vote. Searching for the entry-point bytes is **not** reliable: that page is rewritten by the startup code (the entry fingerprint was found 0x100 higher than the page-aligned base).
5. Driving the menus (learned 2026-10-03, DOSBox 0.84.0-vc1): one tool call costs roughly a thousand emulated frames, longer than the menu's idle time-out, so single key taps between calls end up in the attract-mode demo (labelled "DEMO MODE", always track 2 in every demo seen). Arm timed events instead with `input_sequence` using `frame` numbers (key down and key up each, 20 to 30 frames apart; Esc leaves a demo, Enter selects). A `Restore saved game` / `Start new game` prompt appears when the saved-game "enabled" dword of the run copy's `WACKY.CFG` (file offset 0x866) is 1; restoring it does not choose the track (the game rewrites laps, class, cup and track itself: track 2 again). The sound-device dword (file offset 0x786) of the run copy decides what the start-up check does (see `UNKNOWN_AUDIO_MODE_VALUES`); mode 7 loads the AudioT bank (`npm run observe -- audio ...` at the title screen). Edit only the copy under `analysis/dosbox/WACKY/`; restore it afterwards (the installed `game/**/WACKY.CFG` has the same SHA-1 as the pristine copy).
6. Experiments with edited inputs: `npm run make-test-archive -- --member 2.GAM --edit 25="text" ...` writes a copy of your archive with lines of one member replaced (appended, directory entry updated) into the run copy; start the game, then `npm run observe -- gamtext --id <id> --member 2.GAM --edit ... ` (the same edits) records the words the game stored. The record holds the edits and the SHA-1 of the archive the game ran from; the check (`src/verify/checks/obs-gamtext.js`) rebuilds that archive from yours with `src/verify/patch.js` and refuses a mismatch. Restore the run copy's `WACKY.DAT` afterwards (the installed archive is never written).
7. Sound observations (2026-10-03): the run copy's `WACKY.CFG` from `SB16/` has sound mode 0 and music device 0; with `SET BLASTER=A220 I7 D1 H5 T6` before `WW` the attract-mode demo plays Sound Blaster effects and AdLib music, and `observe -- voices` and `observe -- klm` read the library's voice records and the music driver's tables from the paused game. Keys are named `KBD_left`, `KBD_leftalt`, `KBD_space`, ...; `POST /api/v1/input/sequence` takes `{type:'key', key, pressed, frame}` events (a sequence left pending while the game is paused blocks the next one with 409: `replay_cancel`); `tools/dosbox/keys-run.mjs` holds groups of keys and records `keys`. For General MIDI music copy the run copy's `WACKY.CFG` from `SC55/` (music device 3, MIDI address 0x330; restore the `SB16/` file afterwards) and restart the bridge's DOSBox; `observe -- midi` then reads the sequencer's track records. A played race is not needed for these; the attract demo overrides the keyboard steering (`demo.input-byte`).
8. A played race (2026-10-03): with the run copy as above, Enter taps (hold 30 frames, 70 frames apart; `KBD_enter` and `KBD_leftctrl` both work) take the title, the gate scene, the main menu (Single Player Racing), vehicle, class, laps, race type, cup and track screens to the race; then `observe -- drive --phases ...` holds key groups and samples the car at random pauses (the demo word `obj2+0x28c0c` is 0 in a played race). Execute breakpoints only fire the first time a code block runs: one added after the race code has already run never fires, and one armed before the race fired once and then no more at the player routine, so per-call sampling by breakpoint failed and random pauses were used instead.
9. Pitfalls found the hard way: a `0x88xxx` Ghidra address is `obj2 + 0x28xxx` (subtract 0x60000); `Uint8Array.indexOf` takes a number, not a byte sequence (use a `Buffer`); the DOSBox debugger API takes 16-bit offsets, so it cannot set a breakpoint at a flat 32-bit address, and observations here are taken from a paused game rather than traced.

9. A second track in a played race (2026-10-04): after leaving a race through the Esc menu (Esc, Down, Enter) the main menu keeps its cursor where it was; with the cursor on WACKY WHEELS INFO, Up Up Up and Enter showed the track preview SILVER WHEELS (a different map: water and a pier) and, after Enter, a normal played race on track 7 (`obj2+0x1d770` reads `7`, the mode words `obj2+0x1ec74`, `+0x28c0c` and `+0x28be2` are 0, 7 computer cars). Which menu choice maps to which track and cup was not worked out; the Info sub-menu (ORDERING, INSTRUCTIONS, FAMOUS DRIVERS, CREDITS, LEAVE THIS MENU) is reached with Enter on WACKY WHEELS INFO and left with Esc. `tools/dosbox/countdown-run.mjs` restarts whichever race is current (Esc, Down, Enter, Enter, Enter) and pauses it in the countdown.
