# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser port of the file formats behind the 1994 DOS game *Wacky Wheels*: a read-only asset viewer (`viewer.html`) and a track workshop/editor (`track.html`), built with Vite + vanilla JavaScript (no framework). A first playable slice exists (`play.html`: the floor renderer and the straight-road car, `docs/port.md`); the rest of the game is not ported yet — see `docs/next-steps.md` for the roadmap.

No original game assets are committed to this repo. `game/` (gitignored) holds the user's own local install of `WACKY.DAT` for development and the `check:*` scripts; the production build and hosted site never read it. Visitors to the hosted site supply their own archive via file picker/drag-and-drop.

## Evidence discipline (read docs/evidence.md first)

The goal is a faithful port of the game, and the project runs on evidence tags: [PROVEN] (a reviewed check in `src/verify/checks/` re-executes it and passes in `npm run verify`), [STATIC] (cited from the binary, not confirmed live), [WF] (subagent workflow output — a lead, never a fact), [UNKNOWN] (`UNKNOWN_<ID>`). ModdingWiki/spec material is a *lead*, never a tag. The maintainer is the user and the main session, never a subagent; anything a subagent reports about a binary is WF.

- THE RULE: every constant traces to a disassembly citation or a validated observation, or is omitted/rendered as a visible `UNKNOWN()` placeholder. Constants enter `src/{formats,render,audio,game,verify/checks}` only as `K(value, claimId)`; `npm run lint` rejects other numeric literals except 0/1 and lines tagged `// @math <reason>` or `// @spec <claimId>`.
- Citations: `WW.EXE:obj<N>+0x<off> fp=<crc32 of 16 pre-fixup bytes>`; produce them with `npm run cite`, never from a Ghidra or DOSBox address alone (docs/binaries.md).
- Ghidra: cite disassembly only, never decompiler output; load the `ghidra-evidence` skill before concluding from xrefs or a negative search; negative findings name tool, address, technique and date.
- Never pre-extract assets to data files; `src/` never reads `analysis/`.
- A tag flip changes the registry, the docs line and `docs/TODO.md` together; refuted leads stay in docs with their refuting evidence.

## Commands

```sh
npm install
npm run dev              # Vite dev server at 127.0.0.1, serves game/ via /__game/* middleware
npm test                 # node --test test/*.test.js — synthetic fixtures, no game files needed
npm run check:assets     # decodes every member of a local WACKY.DAT + AudioT + synthesizes all songs
npm run check:tracks     # verifies all local tracks: roundtrip, edit/undo, draft restore, archive export
npm run check:race       # runs the page's race frames headless on every local track (src/game/race.js): countdown, drive, finish; a smoke test, not evidence
npm run check:duck       # runs the duck game's race frames headless on the twelve zone tracks of a local WACKY.DAT (smoke test; scripts/check-duck.js)
npm run check:versus     # runs the two player shoot-out headless on the twelve zone tracks of a local WACKY.DAT (smoke test; scripts/check-versus.js)
npm run lint             # THE RULE: constants lint over src/ (acorn)
npm run verify           # re-executes every check against local game files, re-hashes citations
npm run mutate           # perturbs every PROVEN value via K(); any surviving mutation fails
npm run cite -- 0x411a8  # Ghidra address or objN+0xOFF -> canonical citation with fingerprint
npm run dump:le          # WW.EXE objects/fixups -> analysis/ww/ for Ghidra (npm run ghidra:import)
npm run observe -- race --id race-3 --moment "..."   # record the paused running game (needs a DOSBox bridge; docs/binaries.md)
npm run make-test-archive -- --member 2.GAM --edit 25="text"   # an experiment input: your archive with edited lines, written to the run copy (docs/binaries.md)
npm run build            # vite build -> dist/index.html, dist/viewer.html, dist/track.html
npm run preview          # serve the production build locally
```

- `check:assets` and `check:tracks` auto-discover `WACKY.DAT` under `game/`, or accept an explicit path: `npm run check:assets -- /path/to/WACKY.DAT`.
- Run a single test file directly: `node --test test/track-model.test.js`.
- Node >= 22.12 required (see `engines` in `package.json`).

## Architecture

### Evidence layer

- `src/evidence/` — `registry.js` (claim schema validation), `k.js` (`K`, `withSteps`, the `__DR_MUTATE__` hook), `unknown.js`, `crc32.js`, `claims/*.js` (all listed in `claims/index.js`), `obs/` (numeric DOSBox observation records).
- `src/verify/` — `run.js` (verify runner; checks export `{id, claims, reviewed, run, discriminate?}`), `mutate.js`, `expect.js` (checks read claim values through K), `checks/*.js`.
- `src/formats/le.js` — locates the DOS/4G-bound LE program in WW.EXE, assembles pre-fixup objects, parses the fixup encodings WW.EXE is proven to use. `src/vfs/node.js` opens the user's game folder in node.
- Evidence-backed decoders so far (all constants via `K`, strict, tested against synthetic fixtures and checked against the user's archive): `src/formats/dat.js` (WACKY.DAT directory), `src/formats/pcx.js` (game-style 320x200 PCX, 6-bit VGA palette, tile-sheet split), `src/formats/track-files.js` (`.M`, `.POS`, `.SIN`, `.RD`), `src/formats/gam.js` (`.GAM`). The viewer and editor reach them through thin adapters that keep the old API: `src/archive.js` (`parseDat` is built on `src/formats/dat.js`; `parseAudioT` tries `src/formats/audio-bank.js` first and falls back to a lenient reader for banks of another shape) `src/sprites.js` (`parseAtr` is built on `src/formats/atr.js`) and `src/tracks.js` (`parseRoute` and `parseSpawns` are built on `src/formats/track-files.js`, keeping unknown trailing bytes; `composeTrack` on `parseMap` and `splitTiles`, byte-identical to the old output on all 42 tracks). Still on untraced legacy code: the general PCX fallback in `src/pcx.js`, the lenient fallback of `parseGam` in `src/tracks.js`, `src/data-formats.js` (its time-trial and duck-shoot views read through `src/formats/scores.js`, claims `tim.layout`, `dtt.layout`; the `.HI`/`.HTT` and other views are still leads), `src/audio.js` (AdLib sound effects, PC speaker and the note pairing of MIDI, whose file parsing is `src/formats/midi.js` (claims `midi.player`, `midi.songs`); its `decodeVoc` is `src/formats/voc-audio.js` (claim `voc.library-player`) and its `parseKlm` is `src/formats/klm.js` (claims `klm.player`, `klm.opl-tables`, `klm.songs`), both built on the game's own routines), `src/synthesis.js`, and `spriteLayout`/`rawFrame` in `src/sprites.js`.
- Running-game observations: `tools/dosbox/` (REST client, base finder, `observe.mjs`), records in `src/evidence/obs/`, validated by `src/verify/obs.js` and cross-checked by `obs-load` / `obs-race`. Run a copy of the game, never your install (docs/binaries.md).
- Port: `src/render/floor.js`, `src/game/{track-data,car}.js` and `play.html` / `src/play.js`; constants enter only through `K` (claims `floor.model` and `car.model`), `port-floor` and `port-carmodel` replay the observed frames and steps through them, and `src/game` never imports `src/formats/hypotheses/` (the page plugs those in). See `docs/port.md`.
- `src/vfs/` — one file-access interface (`core.js`: `open` by basename, `openPath` by exact path) with node, dev-server (`dev.js`) and file-picker (`picker.js`) adapters; the viewer and editor load through them in every mode (picker, drop, dev server).
- `docs/TODO.md` is a checkbox list: one unchecked ``- [ ] `claim-id` [TAG]`` line for every claim that is not PROVEN (a test keeps it in sync), plus work items and a *Done* section. Add a line whenever a new STATIC/WF/UNKNOWN claim or an open question appears; tick it and move it to *Done* when the claim is promoted.
- Migration in progress (roadmap in docs/evidence.md): the legacy decoders below still live in `src/*.js` with untraced constants; as each moves into `src/formats/` its constants become claims (UNKNOWN/leads until a check promotes them) and lint starts covering it.

### Layered decoders, independent of UI

`src/` strictly separates binary format decoding from rendering/playback so a future game port can reuse the decoders directly:

- `src/binary.js` — shared primitives: `bytes()`/`view()` coerce input to `Uint8Array`/`DataView`, `need()` bounds-checks before every read (throws rather than reading OOB — this is how corrupt/truncated files surface as errors instead of crashes), `ascii()` decodes windows-1252/CP437 strings, `hexDump()` for raw previews.
- `src/archive.js` — top-level containers: `parseDat` (the `WACKY.DAT` archive: 2-byte count + 22-byte directory entries) and `parseAudioT` (the `AUDIOHED.FX`/`AUDIOT.FX` sound bank pair, split into PC-speaker/AdLib/tag thirds).
- `src/data-formats.js` — small structured/record formats dispatched by extension through `inspectData(name, data)`: `.atr`, `.gam`, `.rd`, `.spw`, `.bmc`, `.sin`, `.hi`/`.htt`, `.tim`/`.ott`, `.dtt`, `.cfg`, plus CP437/B800 text-screen decoding (`b800Cells`, `cp437`) for `.bin` exit screens.
- `src/tracks.js` — track-specific formats: `parseGam` (25-line text config; reads through the traced `src/formats/gam.js` first, with a lenient fallback for files in another shape), `parseRoute` (`.rd` AI waypoints), `parseSpawns` (`.spw` objects), and `composeTrack` (reconstructs the 2048×2048 tile surface from the 64×64 `.m` map against two 54-tile PCX tilesets; tile stride is 10 columns per 320px sheet).
- `src/sprites.js` — `.atr` sprite catalogue (`parseAtr`) plus `spriteLayout`, which falls back through known driver dimensions, a curated per-name table, then size-based heuristics for sprites with no catalogue entry. `rawFrame` extracts one column-major frame.
- `src/pcx.js` — indexed PCX decoding/palette handling (`decodePcx`, `toRgba`, `grayscalePalette`): `decodePcx` uses the traced game decoder (`src/formats/pcx.js`) first and falls back to a lenient general decoder (untraced ZSoft header fields) for PCX files of other shapes, such as the loose manual pages.
- `src/audio.js` — `.voc` PCM decoding, PC-speaker chunk decoding, `.klm`/`.mid` parsing into instrument + timed register-write event lists, `encodeWav`.
- `src/synthesis.js` — renders parsed KLM/MIDI event lists to PCM: `renderOpl` (via `vendor/opl3.js`, a pure-JS FM emulator with no game data) and `renderMidi` (approximate synth, not a GM soundfont).
- `src/audio-worker.js` — runs synthesis off the main thread so long renders stay cancellable.

Decoders generally take raw bytes and return plain data (typed arrays, record arrays); they throw `Error` with a descriptive message on any structural problem (bad magic, truncation, overlap, invalid enum) rather than guessing. Uncertain/undocumented fields are surfaced as labeled raw values instead of being assigned invented meaning — this matters because several formats (`.sin`, `.pos`) have known discrepancies with the upstream wiki reference (see `docs/`).

### Track editing model (`src/track-model.js`)

Separate from the raw decoders in `src/tracks.js`, this module manages *editable* track state:

- `createTrack(byName, stem)` loads the four files behind a track number (`.m`/`.gam`/`.rd`/`.spw`) into a mutable in-memory structure (`map`, `start`, `route`, `objects`) alongside the untouched `original` bytes.
- `snapshot`/`restore` capture and reapply full editor state (used for undo/redo and draft recovery), with `restore` fully validating shape/ranges before mutating anything.
- `trackChanges(track)` diffs current state against `original` and returns only the files that actually changed.
- `patchArchive(original, changes)` rewrites a `WACKY.DAT` buffer: unmodified members, archive gaps, and byte order are preserved byte-for-byte; only changed `.m`/`.gam`/`.rd`/`.spw` payloads are appended with updated directory offsets. `check:tracks` asserts this against real archives, including that the original buffer is never mutated.

### Pages

- `viewer.html` / `src/viewer.js` — loads an archive (dev: `/__game/manifest` + `/__game/file` endpoints added by the `localGameFiles` Vite plugin in `vite.config.js`; prod: file/folder picker or drop), categorizes entries, and renders format-specific views by dispatching on file extension to the decoders above.
- `track.html` / `src/track-editor.js` — the largest module (~1500 lines); canvas-based tile painting (brush/box/fill/pick), AI route and object editing, pan/zoom, undo/redo, localStorage draft recovery, and project/archive export. See `docs/track-editor.md` for the user-facing behavior and shortcuts this module implements.
- `index.html` — landing page linking the two.

`vite.config.js` builds all three HTML entry points with relative asset paths (`base: './'`) so `dist/` can be hosted under a GitHub Pages subpath, and emits `THIRD_PARTY_NOTICES.txt` into the build.

### Format documentation

`docs/*.md` — one reference per file format/extension, sourced from ModdingWiki with local verification notes and explicitly marked unknown fields. `docs/README.md` indexes them; `docs/track-editor.md` is the editor's user guide. Check these before touching a decoder — they record *why* a field is handled a certain way, including places where the upstream wiki is wrong or incomplete (e.g. KLM channel 6 having two frequency bytes, not the documented 0–5 boundary).

## Working conventions

- Tests (`test/*.test.js`) use hand-built synthetic binary fixtures (see the `le16`/`le32`/`pcx()` helpers in `test/formats.test.js`) — never copyrighted game files — so `npm test` runs with no local assets. `check:assets`/`check:tracks` are the integration-style checks that require a real `WACKY.DAT` and are not run in environments without one.
- When adding support for a new field or format, prefer surfacing it as a labeled raw value over guessing its meaning, matching the existing decoders and `docs/` notes.
- Decoders should keep failing loudly (`throw new Error(...)`) on malformed input rather than silently producing partial/wrong data — this is how `check:assets` catches archive-wide regressions.
