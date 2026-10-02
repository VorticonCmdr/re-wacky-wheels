# Wacky Wheels · browser port

The first milestone is `viewer.html`: a read-only asset garage built with HTML, CSS and vanilla JavaScript. Vite handles local development and static builds. The playable racing game is the next milestone; this repository currently contains the asset viewer, not a complete gameplay port.

## Run locally

Use Node 22.12+ (or a newer supported LTS release).

```sh
npm install
npm run dev
```

Open the address printed by Vite and select **Load local game**. The development server finds `WACKY.DAT` anywhere inside `game/`, and loads its neighboring PCX images and saved-score/configuration files. The existing installation at `game/WackyWhe/WACKY/` works without rearranging it.

Alternatively, use **Open files**, **Open folder**, or drop `WACKY.DAT` onto the viewer. These inputs read files locally in the browser and work in both development and the production build. For a complete collection, select the installed WACKY directory, including its DAT and loose assets.

`game/` is ignored by Git. The build never copies it into `dist/`. No original game assets, extracted copies, sound samples, or palettes are embedded in the source.

## Viewer features

- Search and filter the complete DAT directory, loose originals, and nested PC-speaker/AdLib effects; inspect bytes and download unchanged files.
- Decode PCX images with their indexed palettes; change palettes and export PNGs.
- Animate catalogued SP sprites, with frame scrubbing, transparency, zoom, and editable dimensions/offsets for other raw sheets. PAR horizon images are also supported.
- Reconstruct track surfaces using their GAM-selected tilesets. Toggle AI routes, object markers, tile grids, and view POS progress heatmaps.
- Play VOC PCM sound effects and their original loop markers; synthesize PC-speaker and AdLib effects.
- Render KLM with its original instruments through an OPL emulator. Render MIDI notes with an approximate synthesizer. Render in a cancellable worker; preview 30 seconds, 2 minutes, or the full song, and export WAV.
- Read high-score tables, sprite attributes, routes, spawns, demo controls, and known saved-game fields. Plot motion, trig, acceleration and numeric tables. Render B800 exit screens.

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
npm run build
npm run preview
```

Unit tests use synthetic binary fixtures, so they run without copyrighted files. `check:assets` validates every archive member handled by a documented decoder and smoke-renders all local songs. It requires your own game files; pass a different DAT path as an argument if needed.

## Future GitHub Pages deployment

`npm run build` produces static `dist/index.html` and `dist/viewer.html`, plus relative asset links (`base: './'`) that work under a repository subpath. Deploy **only `dist/`** when a GitHub repository is ready. No remote or deployment has been configured yet.

Visitors supply their own originals through **Open files** or **Open folder**. **Load local game** is a development-only convenience; static hosting cannot read the ignored directory on your computer. A future Pages workflow can run `npm ci`, `npm test`, and `npm run build` without needing the original files.

## Project layout

`src/` separates file decoders from rendering and playback so the later game port can reuse them. `vendor/opl3.js` supplies a pure JavaScript FM emulator; it contains no game data. See [third-party notices](THIRD_PARTY_NOTICES.md).

Format research: [ModdingWiki’s Wacky Wheels overview](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels), with credits to its reverse engineers including Phil Carter, Klas Arvidsson, and Malvineous.
