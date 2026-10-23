# Wacky Wheels · browser port

The project includes `viewer.html`, a read-only asset garage, and `track.html`, a track workshop built with HTML, CSS and vanilla JavaScript. Vite handles local development and static builds. The playable racing game is ported in part (see `docs/next-steps.md` for what is left), alongside the viewer and track editor.

## How to play

The game is not bundled: you bring your own copy of Wacky Wheels (1994, Beavers/Kingsley's Adventure; the shareware release works too).

1. Open the hosted site (the game page, `index.html`) or run it locally with `npm run dev`.
2. Click **Open WACKY.DAT** and pick the `WACKY.DAT` from your Wacky Wheels folder, or drop the file onto the page. It is read in your browser and never uploaded. (In local development, **Load local game** reads it from `game/`.)
3. Use the game's own menus to choose a mode, track and engine, then race.

| Key | Action |
| --- | --- |
| Left / Right | Steer |
| Alt, Up or A | Accelerate |
| Down or Z | Brake |
| Space | Hand-brake turn |
| Ctrl | Fire a hog or drop the held item (partly ported) |
| R | Restart the race |
| F1-F6 / 1-6 | Taunts |

Keys can be remapped in the game's key setup. For two players over the network, see COMM-BAT PLAY below. Display and graphics options (Original or Enhanced rendering, 2x, wide view, CRT look) are in the game's options menu. Add `?debug` to the page address for the developer side panel. The asset garage (`viewer.html`) and the track workshop (`track.html`) are linked from the page header.

## Run locally

Use Node 22.12+ (or a newer supported LTS release).

```sh
npm install
npm run dev
```

Open the address printed by Vite and select **Load local game**. The development server finds `WACKY.DAT` anywhere inside `game/`, and loads its neighboring PCX images and saved-score/configuration files. The existing installation at `game/WackyWhe/WACKY/` works without rearranging it.

Alternatively, use **Open files**, **Open folder**, or drop `WACKY.DAT` onto the viewer. These inputs read files locally in the browser and work in both development and the production build. For a complete collection, select the installed WACKY directory, including its DAT and loose assets.

**Playing against another person** (COMM-BAT™ PLAY in the main menu, a deviation from the DOS game: WebRTC in the places of the modem and the serial cable, `docs/comm-bat.md`): WEBRTC PEERJS needs nothing but the page (a four digit code through PeerJS's free cloud server); WEBRTC LOCAL pairs the pages of one address on the local network, which needs the page to be served by `npm run serve:lan` (after `npm run build`) or `npm run dev:lan`. Both players need the same `WACKY.DAT`.

`game/` is ignored by Git. The build never copies it into `dist/`. No original game assets, extracted copies, sound samples, or palettes are embedded in the source.

## Viewer features

- Search and filter the complete DAT directory, loose originals, and nested PC-speaker/AdLib effects; inspect bytes and download unchanged files.
- Decode PCX images with their indexed palettes; change palettes, switch to the game's 6-bit VGA palette (what the game's palette routine keeps), and export PNGs.
- Animate catalogued SP sprites, with frame scrubbing, transparency, zoom, and editable dimensions/offsets for other raw sheets. Export all sprite frames as one PNG sheet, with automatic or fixed-column layouts and the current palette, pixel order and transparency. PAR horizon images are also supported.
- Reconstruct track surfaces using their GAM-selected tilesets. Toggle AI routes, object markers, tile grids, and view POS progress heatmaps.
- Play VOC PCM sound effects and their original loop markers; synthesize PC-speaker and AdLib effects.
- Render KLM with its original instruments through an OPL emulator. Render MIDI notes with an approximate synthesizer. Render in a cancellable worker; preview 30 seconds, 2 minutes, or the full song, and export WAV.
- Read high-score tables, sprite attributes, routes, spawns, demo controls, and known saved-game fields. Plot motion, trig, acceleration and numeric tables. Render B800 exit screens.

## Track workshop

Open **Track workshop** from the viewer, or visit `track.html`. It automatically loads your local originals in development, and accepts your own WACKY.DAT on static hosting. Paint tiles with a variable-size brush, rectangles and flood fill; sample tiles; zoom, pan and navigate with a minimap. Edit AI waypoints, object placement/types, and start positions with optional tile-center snapping. Each track keeps its own undo/redo history.

Browser drafts offer recovery after reopening. Download portable projects or export an edited DAT containing changes across all modified tracks. Originals and unknown fields remain untouched. Wrong-way progress grids, thumbnail previews and property masks are preserved rather than regenerated, so major layout changes still need those updated before racing in DOS. Read the [editor guide and shortcuts](docs/track-editor.md).

## Accuracy and current limits

Not every original layout is fully understood. Uncatalogued SP sheets can contain mixed-size frames, so their initial dimensions are estimates and can be adjusted. Select the appropriate track/screen palette for raw sprites. POS has unexplained extra bytes; SIN and several projection tables conflict with the wiki. Their uncertain fields are labelled rather than assigned guessed meanings. Unknown metadata is available as raw bytes/numeric or byte-intensity previews.

MIDI timbres are an approximate preview, not a General MIDI soundfont reproduction; pitch bends and most expressive controllers are not synthesized yet. KLM rhythm handling is experimental. VOC supports 8-bit unsigned and 16-bit signed PCM; other Creative codecs fail explicitly. B800 uses browser glyphs rather than the exact BIOS font. Track palette cycling is reported but not animated. This viewer does not run DOS executables or inspect the distribution ISO.

Read the [format references](docs/README.md). Implementation observations:

- Tile stride is 10 columns for a 320px PCX, with 54 usable tiles per sheet.
- The original KLM files have two frequency bytes for channel 6, unlike the wiki’s 0–5 boundary. Parsing all 16 local songs verifies command alignment through their final 0xFF.
- Local AudioT has 78 slots: 26 PC-speaker, 26 AdLib, and a digital bank containing empties and a tag. The viewer exposes 52 sound-effect entries, including silent placeholders.

## Validation

```sh
npm test
npm run check:assets
npm run check:tracks
npm run check:link
npm run build
npm run preview
```

Unit tests use synthetic binary fixtures, so they run without copyrighted files. `check:assets` validates every archive member handled by a documented decoder and smoke-renders all local songs. The separate `check:tracks` command verifies all local track roundtrips, edit/undo/project restoration, and archive preservation. Both require your own game files; pass a different DAT path as an argument if needed.

## GitHub Pages deployment

`.github/workflows/pages.yml` runs `npm ci`, `npm test` and `npm run build` on every push to `main` and publishes `dist/` to GitHub Pages. In the repository settings, set **Pages > Source** to **GitHub Actions** once. The site is then served at `https://<user>.github.io/re-wacky-wheels/`; the relative asset links (`base: './'`) work under that subpath. Nothing from `game/` is built or uploaded, and the workflow needs no original files.

## Project layout

`src/` separates file decoders from rendering and playback so the later game port can reuse them. `vendor/opl3.js` supplies a pure JavaScript FM emulator; it contains no game data. See [third-party notices](THIRD_PARTY_NOTICES.md).

Format research: [ModdingWiki’s Wacky Wheels overview](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels), with credits to its reverse engineers including Phil Carter, Klas Arvidsson, and Malvineous.
