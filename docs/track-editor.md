# Track workshop

Open `track.html` through Vite, or follow **Track workshop** from the asset viewer. In development, the editor automatically reads the ignored `game/` directory. A hosted build uses **Open WACKY.DAT** or drag and drop; file contents stay in the browser.

## Build a track

1. Choose a numbered track using the selector or previous/next buttons. Modified tracks have an **edited** marker. Switching tracks keeps their independent edits and undo histories.
2. Choose a tile from either of the two original tilesets. Use the search to find a tile number, or **Used in track** to narrow the palette.
3. Paint with **Brush**, drag a **Box**, or **Fill** a connected area. Choose a larger brush for broad changes. **Pick** and Alt-click sample tiles from the map. A continuous stroke is one undo step, including fast pointer movements.
4. Scroll to zoom around the pointer. Space-drag, the middle/right mouse button, or **Pan** move the view. Click or drag the overview to jump around. **Fit** or `0` shows the whole track.
5. Use **Route** to drag AI waypoints. Clicking away from a waypoint inserts a new node into the nearest segment. Arrows indicate travel direction. Delete removes the selected node; **Close AI route loop** joins the final endpoint to the first node. Existing disconnected segments are preserved unless explicitly edited.
6. Choose an **Object** from the palette, then click to place it. Drag existing markers to move them; the inspector exposes exact pixel coordinates and object type. Duplicate or delete the selection as needed. Existing unknown object fields survive edits.
7. Use **Start** to move the start flag. Optional snapping places objects and waypoints at tile centers. Layer controls show/hide the grid, route, objects and start flag. On tablet-sized screens, **Details** opens these controls.

Coordinates use original track pixels, with a 32-pixel tile size and 2,048-pixel map width/height. Object markers indicate the stored anchor, rather than predicting the game's projected sprite footprint. Tile properties and collision behavior come from the original mask files; the editor does not change those masks.

## Keep and export your work

- **Undo/redo** stores up to 80 edits for each track, including resets and project restoration. Esc cancels an active gesture.
- Browser drafts save after edits when local storage is available. Reopening the same original archive offers **Restore draft** or **Discard**. Resolve this choice before editing, so the recovered draft cannot be overwritten accidentally. Storage failures are reported; use **Save project** as a portable backup.
- **Save project** downloads a JSON document containing all modified tracks. Use **Open project** with the same original archive to resume. Projects are validated completely before any edits are applied. Importing a project adds its changes to the current session; it does not clear other edited tracks.
- **Export edited DAT** downloads `WACKY-EDITED.DAT`, including changes across all edited tracks. It never writes to the originals. The DOS game loads tracks from its archive; loose `.m`/`.rd`/`.spw` files do not override it. To try the export in DOS, use a separate installation copy and name the edited archive `WACKY.DAT` there.
- **Save track image** exports the current tile surface as a full-size PNG, without editor overlays.

Modified archive payloads are appended and their directory entries updated. This preserves unmodified payloads, shared original data, archive gaps and unreferenced bytes. File order and names stay unchanged. Only `.m` (tiles), `.gam` (start), `.rd` (AI route), and `.spw` (objects) can change. GAM spacing/line endings, uninterpreted fields, and record trailing bytes are retained.

## Current limits

This is an editor for the documented track components, not a running racing game. Major route/layout changes need the `.pos` wrong-way progress grid and the `shrink*.pcx` thumbnail updated before playing in DOS. Their source versions are preserved; the POS layout has unexplained extra bytes. The editor does not regenerate these files, change tilesets or property masks, animate palette cycling, or edit uncertain `.sin` fields. It also does not test edited tracks inside DOS.

## Shortcuts

| Action                           | Shortcut                  |
| -------------------------------- | ------------------------- |
| Brush / box / fill / pick        | B / R / F / I             |
| Route / object / start / pan     | V / O / S / H             |
| Temporary pan                    | Space + drag              |
| Temporary tile pick              | Alt + click               |
| Zoom / fit                       | Scroll or +/− / 0         |
| Undo / redo                      | Ctrl/⌘ Z / Ctrl/⌘ Shift Z |
| Save project                     | Ctrl/⌘ S                  |
| Duplicate selected object        | Ctrl/⌘ D                  |
| Delete selected object/waypoint  | Delete                    |
| Cancel gesture / clear selection | Esc                       |
| Help                             | ?                         |

`npm test` runs synthetic fixtures without original assets. `npm run check:tracks` verifies roundtrips, edit/undo/draft restoration, and archive preservation against your own local originals, entirely in memory.
