# Voxel Studio scenery alternatives

Editable Voxel Studio v1 JSON projects, created in a separate 32³ workbench via
the Voxel Studio MCP on 2026-10-23. These are independently specified alternatives,
not exports of the existing procedural scenery function.

- `tyre-stack.json`: 8,972 cells; three offset tyres with explicit shoulder/tread
  layer profiles, hollow centres, inset beads and faded sidewall marks.
- `tyre-post.json`: 8,736 cells; shorter tyre stack and a solid post with grain,
  end rings, a split and a chipped top edge.

Authoring used coordinate batches submitted to `edit_voxels` (revisions 1 and 2),
inspection with `render_view` (front/top, plus right for the post), then export
of the model returned by `get_model`. Voxel Studio is an editor, not a separate
AI model generator: the assistant specified the cells through its MCP tools.
The project's default sample was never used as scenery. No kart projects were
opened or overwritten. The dedicated workbench is at
`/Users/valentin.pletzer/Downloads/models/scenery-workbench.json`; editable copies
of both finished projects are in the adjacent `scenery-studio/` folder.

The race bundles these assets, so Voxel Studio need not run to play. Select
**3D scenery → Voxel Studio** while using the 3D track renderer. Voxel Studio is
the default for live voxel mode. Selection is session-only. Props have a normalized 28-cell
physical width in both modes; model aspect ratio is preserved. Collision and
pickup behavior continue to use the existing game state.

## Remaining track 1 pickups

Four more independent models authored through `edit_voxels` at revisions 3–6
of the same dedicated workbench and exported through `get_model`:

| Sprite | Asset | Cells | Subject |
| --- | --- | ---: | --- |
| H1.SP | matchbox.json | 6792 | Open matchbox, raised flame emblem, pointing glove |
| H12.SP | bomb.json | 3976 | Round bomb, curved fuse, spark, pointing glove |
| H2.SP | reading-hedgehog.json | 4395 | Quills, muzzle, feet, hands and open newspaper |
| H4.SP | yellow-prop-hedgehog.json | 4112 | Hedgehog holding the original yellow prop |

Each was inspected using MCP front/right renders; additional back/top views
were inspected for the hedgehogs. All are actual volumetric geometry, with no
sprite extrusion. These are interpreted models based on the original artwork,
not exact reconstructions of unseen surfaces. Their idle sway uses the object's
existing frame clock; it does not reproduce each individual sprite gesture.
Pickups fit within the source sprite's physical width/height envelope, preserving
aspect ratio. Consumption, positions, collisions and rewards are unchanged.

Studio mode covers all 13 placements (six sprite types) on the stock first track.
Procedural mode retains the two procedural prop types and the four original
animated pickup billboards. JSON assets are bundled for offline production use.


## Weapon alternatives (2026-10-24)

Seven 32³ weapon projects were independently authored through Voxel Studio MCP
`edit_voxels`, inspected with front/right `render_view`, and exported from
`get_model` at revisions 7–13. These are not copies of the 16³ procedural meshes.
The assistant specified the voxel geometry; MCP supplied the shared editor,
revision checking, renders and exported model data.

| Asset | Cells | Features |
| --- | ---: | --- |
| weapon-hog.json | 4836 | Layered quills, eyes, ears, muzzle and four feet |
| weapon-fire.json | 2552 | Layered hot core and four tapering flame tails |
| weapon-devil.json | 2207 | Horns, wings, eyes and fangs |
| weapon-bomb.json | 4402 | Rounded casing, metal collar and curved rope fuse |
| weapon-oil.json | 1148 | Irregular shallow pools, sheen and separate droplets |
| weapon-inverted.json | 4836 | Upside-down hedgehog with exposed feet |
| weapon-ice.json | 3114 | Four pointed crystals with distinct facets |

Editable copies live in `/Users/valentin.pletzer/Downloads/models/scenery-studio/`.
The previous workbench was backed up there before editing. Kart source projects
were untouched. The game bundles these JSONs and does not require MCP at runtime.
**3D weapons → Voxel Studio / Procedural comparison** is independent of scenery.
Models preserve the procedural weapon's maximum physical extent and their own
aspect ratios; the bomb's animated spark follows its authored fuse tip.


## All-track scenery (2026-10-24)

`track-scenery.json` maps 30 additional sprite names to editable 32³ Studio
projects. Authored through `edit_voxels` at revisions 14–43, exported with
`get_model`, and inspected with MCP front renders. No sprite extrusion was used.

- OB2/OB9: single and grouped reeds; OB3: red/white wooden marker.
- OB4: cactus; OB5/OB6/OB7: red/yellow/green barrels.
- OB10/OB11: black/yellow and red/yellow striped markers; OB12: bush;
  OB13: plain wooden post.
- H15: red glove; H16: oil can.
- H5–H11, H14, H17–H25: hedgehog variants with distinguishing accessories,
  including suitcase, goggles, toilet, snorkel, yo-yo, fire hose, horn,
  juggling balls, football, bar, newspaper and platform.

These join the six existing scenery types to cover all 36 stock types across
42 archive layouts. All new models are bundled; offline play needs no editor.
Individual editable copies and the collection are saved in
`/Users/valentin.pletzer/Downloads/models/scenery-studio/`.


## Starter lion (2026-10-24)

`starter-lion.json`: 4,698 voxels, authored with Voxel Studio MCP `edit_voxels`
at revision 44, exported with `get_model`, inspected with front/right renders.
The mane, muzzle, ears, body, feet and traffic-light assembly are volumetric.
`src/voxel/start.js` derives three light states from the exported lens regions;
the active lens has an emissive mesh part. Game countdown timing and visibility
remain authoritative. An editable copy is in the adjacent models/scenery-studio
workspace, alongside the other exported models.
