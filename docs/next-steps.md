# Recommended next steps

The viewer and track workshop are implemented, with 27 passing unit tests and checks against all 42 original tracks. The build includes both pages and excludes `game/`. Browser interaction verification remains outstanding because the browser tool's security check was unavailable. Gameplay has not been implemented yet.

The recommended next milestone is **drive a car around one track and test editor changes immediately**. Keep the first prototype small enough to compare with the original game before expanding it.

| Priority | Recommendation | Useful completion check |
| --- | --- | --- |
| 1 | **Add a top-down driving prototype and a Playtest button.** Create `index.html` with one car, keyboard controls, acceleration/braking, steering, pause and reset. The editor should launch it with the current in-memory track, including unsaved edits. Use a fixed simulation step so movement stays consistent across frame rates. | Paint a track, launch Playtest without exporting a DAT, drive around it, and return to the editor with all edits intact. Initial handling can be explicitly approximate until compared with DOS. |
| 2 | **Verify the workshop in a real browser.** Exercise brush strokes, fill, rectangles, route insertion/deletion, object dragging, undo/redo, draft recovery and export/reimport. Check a small screen and a keyboard-only path. Resume browser automation when its security check is available. | An edit survives track switching, project reopening and an exported-DAT reload; narrow layouts expose every essential control. Automated binary checks remain a separate form of verification. |
| 3 | **Extract a shared game-data/session layer.** Centralize archive loading, track loading, tileset/palette caching and draft handoff for the viewer, editor and playtest. Keep decoders independent of page controls and rendering. | Each page opens the same user-supplied archive and sees the same decoded track data; hosted builds still work with file import and contain no original assets. |
| 4 | **Resolve gameplay-critical format uncertainties.** Verify `.sin` property offsets and values, property-mask PCX semantics, and the extra two bytes in `.pos`. Compare carefully controlled edits in a separate DOS installation with observed behavior. Record verified facts separately from hypotheses. | Known original tiles produce confirmed surface effects, and the progress grid's byte layout is established before implementing collision/terrain rules or rewriting it. |
| 5 | **Complete track dependencies and validation.** Add a progress-grid view/editor after its format is verified, regenerate `shrink*.pcx` previews, and expose route continuity, zero-length segments and start/progress consistency problems. Provide editable repair suggestions. | A substantially changed course has coherent progress information, a matching preview and a continuous AI route. Test edited archives in a separate DOS copy if original-game compatibility is a goal. |
| 6 | **Build the original-style racing view.** Add a perspective floor renderer, following camera, sky/horizon and direction-dependent driver sprites using the existing decoded assets. Start with Canvas and measure performance before deciding whether a faster renderer is needed. | One original track is recognizable from the driver's view, objects have sensible depth/occlusion, and the simulation behaves consistently when rendering slows down. |
| 7 | **Finish one complete time trial.** Implement start/countdown, ordered checkpoint crossings, laps, wrong-way handling, timing, finish/results and restart. Add local best times, engine/effect audio and music controls. | A player can finish a race, receive a result and restart. Cutting across the course or crossing the finish line backwards cannot falsely complete a lap. |
| 8 | **Add competitors and race interactions.** Follow `.rd` routes with opponent cars; then implement object collisions, pickups, weapons and race positions. Check each behavior against the original before declaring it faithful. | Opponents finish a lap without teleporting between disconnected segments, and standings account for both lap count and progress along the course. |
| 9 | **Prepare GitHub Pages delivery.** Add a build/test workflow and Pages deployment when the remote repository is ready. Verify relative paths under a repository subpath and the first-run file-loading experience. Keep asset-dependent checks local and run synthetic tests in CI. | A clean clone builds without `game/`; a hosted visitor supplies their own WACKY.DAT and can use the viewer, editor and playable milestone. |

## Editor improvements worth doing after the first playtest

- Add multi-tile selection, copy/paste and reusable stamps for common track sections.
- Add a track thumbnail browser and named project tracks, without guessing how DOS stores display names.
- Add before/after comparison and a clear summary of everything included in an export.
- Improve touch gestures and keyboard navigation after observing actual browser interactions.

## Format research

The upstream [track-format reference](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format) describes the route, progress, tile properties, object placement and preview files, but marks the documentation as incomplete. Its `.sin` field widths sum to 10 bytes despite the declared 12-byte stride. Our local [SIN](sin.md) and [POS](pos.md) notes record those discrepancies and the observed POS length; they are the starting point for verification, not a completed gameplay specification.

The list above is a proposed implementation sequence. It does not claim that original physics, collisions, lap rules or rendered gameplay have already been reproduced.
