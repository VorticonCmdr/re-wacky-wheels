# Artwork packs: the authors' reference

An artwork pack is your own art for the race world of the port: new tile sheets, skies, horizon strips and pictures for the karts, the
scenery, the shots and the effects, drawn instead of the archive's in the Enhanced presentation (docs/enhancements.md, Stage 4). A pack is
imported in the asset garage (*Art packs*), kept in your browser (IndexedDB) and drawn with ARTWORK ON (GAME OPTIONS > DISPLAY AND EFFECTS >
DISPLAY OPTIONS > RENDERING, or the playtest page's *Artwork packs*). It never changes the race: the sizes, the distances, the collisions and
the draw order stay the game's.

Packs are your art. The port ships none, and nothing of a pack is ever committed to the repository. The garage's template holds the original
game's art taken from your own WACKY.DAT: keep it on your computer, and share only packs whose every picture you made yourself.

## What a pack replaces, and what it never does

Packs replace art in the race world only:

- the floor's tiles (the tile sheets `A_*.PCX`);
- the sky (BACK1/2/3.PCX, BLANK.PCX), with the wide view's margins;
- the horizon strip (`N.PAR`);
- every picture of the world's draw list: the racers and the ducks, the player's own car (CARS.SP and the driver files, its crash pictures,
  the pit state's picture), the effects drawn after the own car (the rear pictures and the shots of HOGMIS.SP, the wheel dust, the puffs and
  the pit state's splash of EFFECTS.SP, the sparks of SPARK.SP, the tyre strips of GENEF.SP), the objects of SPRITE.ATR, the starter lion
  and the explosions and wrecks of GENEF.SP.

They never replace the HUD, the overhead map, the finish labels (which keep the archive's CARS.SP beside packed racers), the messages, the
crack, the menus, the loading cards, the boards, the winner screen, the credits, the vehicle screen or the start-up screens. Those are drawn
by the reconstructed renderer (`src/render`), which reads the archive as the game does.

## The package

A pack is a `.zip`, a folder, or several files picked together, holding:

- `pack.json`, the manifest (below), at the top or in one folder: the garage finds the shallowest `pack.json` and reads every picture by its
  path relative to it (files picked one by one come without their folders: a picture is then found by its file name, so two pictures of one
  name in different folders need the folder or a zip);
- the PNG pictures the manifest names;
- `NOTICE.txt` (optional): what you want users of your pack to know.

The zip may be stored or deflated (any system's zip tool); zip64 archives, encrypted files and a file of more than 129 MB (`ART.maxFileBytes`:
the largest picture's PNG at 16 bits a sample, uncompressed) are refused. The macOS Finder's `__MACOSX/` and `.DS_Store` are skipped.

## The manifest (`pack.json`)

```json
{
  "format": "wackywheels-artpack",
  "version": 1,
  "name": "Shiny karts",
  "author": "Your name",
  "licence": "CC BY 4.0: drawn by Your name, share it with this notice",
  "source": { "size": 6011238, "crc32": "1a2b3c4d" },
  "entries": [ ... ]
}
```

- `format` and `version` must be exactly these.
- `name`: shown in the garage's list and the playtest page's status.
- `licence` is required: your statement that the art is yours to share, and on which terms. An empty licence refuses the pack. The garage's
  templates say `LOCAL ONLY: contains the original game's art`; an import takes such a pack with a warning and the list marks it *LOCAL
  ONLY*. Never share a pack with that licence.
- `source` (optional) is the WACKY.DAT the pack was made against (its size and CRC-32); a pack imported into another archive only gets a
  warning, since every entry is checked against the archive anyway.
- Unknown keys are ignored.

## Entries

Every entry has:

| Field | Meaning |
| --- | --- |
| `kind` | `tiles`, `sky`, `strip`, `frames` (or `angles`, the kart angle sets, a later milestone) |
| `member` | the archive member it replaces (a strip has `members`) |
| `memberCrc` | the CRC-32 of that member's bytes, 8 hex digits or a number: an entry made for another `A_F3.PCX` is refused |
| `image` | the picture's path in the pack |
| `scale` | p, a whole number from 1 to 8: p x p pack pixels for each pixel of the original |
| `color` | `rgba`, or `indexed` with `palette` |
| `palette` | (indexed only) the tile sheet `A_*.PCX` whose palette the picture's indices are |

### `tiles`

- `member`: a tile sheet, `A_*.PCX`.
- The picture is 320p x 200p, the sheet's own layout: 10 columns of 32p x 32p cells, tiles 0 to 53 left to right, top to bottom; the rows
  below the sixth row of tiles (192p to 199p) are not used.
- Alpha 0 (RGBA) or an index whose tRNS alpha is 0 (indexed) means *the archive's texel*: it stays the archive's palette index, so the beach
  tracks' palette cycle keeps running there.
- The race reads the pack pixel of the texel the floor's ray reaches, at the sample's place inside that texel (nearest): with p > 1 a tile
  shows its finer detail where the floor is near.

### `sky`

- `member`: the sky picture a track's .GAM names (BACK1.PCX, BACK2.PCX, BACK3.PCX; the split screen draws BLANK.PCX behind its strips).
- `margin`: reference columns of extra sky on each side for the wide view (0 for none; 53 covers the 16:9 view on a 4:3 display, 18 on a
  16:10 one).
- The picture is (320 + 2 margin)p x 130p: rows 0 to 109 the sky, rows 110 to 129 the strip's background (what shows through the strip's
  sky-coloured pixels and where the strip pack says *sky here*).
- Alpha 0 means the archive's pixel (in the margins the wide view's own made margins).
- Where your margin is narrower than the view's, the view's made margins show beyond it.

### `strip`

- `members`: the `N.PAR` files of one CRC (many tracks share a strip; the template lists them together).
- `period`: the strip's panorama period: 640 for a strip that repeats every 640 pixels (every track of the original), else 1280. It must be
  the archive's.
- The picture is P p x 20p, one panorama.
- Alpha below 128 (`ART.alphaCut`) means *sky here*: where the archive's strip pixel is one of the strip's sky colours (the sky picture's
  indices of that row) the archive's pixel stays, with its own dither; where the archive has scenery, the sky picture's pixel of that strip
  row shows. Either way it is sky to the effects: the lighting's gradient and the far range go on over it. Any other pixel is your
  scenery.
- The fog's colour stays the archive strip's.

### `frames`

- `member`, `offset` (the first frame's byte offset in the member), `width` x `height` (the logical size: the archive frame's), `count`,
  `stride` (bytes from one frame to the next; default width x height), `columnMajor` (true: every race frame is).
- `columns`: frames in a row of the picture; frame k is in the cell (k mod columns, floor(k / columns)).
- `cell` `[cw, ch]` (default `[width p, height p]`) and `box` `[bx, by]` (default `[0, 0]`): the cells' size, and where the logical box's
  top left sits in the cell. Art may overhang the box inside its cell: it is drawn around the picture at the same scale.
- `anchors` (optional): each frame's ground row (a row of the logical frame, 0 to height - 1).
- Every frame `offset + k stride` must be a picture the race draws (the region registry below). The keys are the byte offsets, never frame
  numbers, so the pieces of GENEF.SP at offsets no frame grid reaches (the lion at 4449, the explosions at 7641) can be replaced.
- Alpha 0 (RGBA) and index 0 or an index whose tRNS alpha is 0 (indexed) are transparent: the art's own silhouette is what is drawn, its
  contact and sun shadows follow it (inside the logical box; overhanging art casts no shadow beyond it).
- The logical size, the distance, the size class (or the smooth size), the place and the collisions stay the archive's: a pack only
  changes what the picture looks like. The race stands the logical box where the archive's frame stands: draw your art on the archive
  frame's ground row (the template's anchors; the garage warns when a frame's lowest opaque row is more than a row off it).

### `angles` (kart angle sets, a later milestone)

`member` CARS.SP, `slot` (a slot of CARS.SP, 0 to 7), `directions` N (a multiple of 8, at most 64), `width` x `height` 38 x 28, `columns`,
`cell`, `box`, `anchor` (default 27). Index 0 is the view of the original entry 0; indices rise as the original entries rise; index (N / 8) f
is the original entry f. The format is checked now; the race draws the sets from the kart angles milestone (M4) on.

## The pictures

- PNG, not interlaced: RGBA, RGB, grey (with or without alpha) at 8 or 16 bits a sample (16 bits keep their high byte), or a palette of 1,
  2, 4 or 8 bits a pixel. The garage reads the bytes as saved: no colour management, no premultiplied alpha.
- At most 16384 pixels a side and 16 million pixels a picture, 64 million a pack (`ART` in `src/enhance/config.js`). A picture's size is
  checked from its header, before its data is read.
- The size must be exactly the kind's (above); the garage says `image 1276 x 800, expected 1280 x 800`.
- **Nearest sampling everywhere**: the race never blends pixels. Each output pixel takes the pack pixel under its own place; inside a
  picture that place is kept inside the p x p pack pixels of the archive texel the archive's picture reads there (its size class's map), so
  at p = 1 every pixel is the pack's pixel of the archive's own texel, and with p > 1 or at 2x the finer pixels show.

## Colours: indexed or RGBA

**Indexed** (`"color": "indexed"`): a palette PNG (colour type 3) whose pixels are the game's palette indices themselves, its PLTE the
palette of `palette` (the 6-bit entries widened to 8 bits, `(v << 2) | (v >> 4)`). Every index the picture uses must have that palette's
colour in the PLTE (a picture whose palette an editor re-sorted is refused). This is the most faithful kind: the palette cycle, the demo's
fade, the strip's sky colours, the relief and every effect work as for the archive. The game's palettes repeat colours (entries 4 and 90 of
A_F1.PCX are index 0's black, and every tile sheet's palette has 38 to 73 such pairs), so the indices cannot be told by colour: keep your
editor in indexed mode with the template's palette.

**RGBA** (`"color": "rgba"`): any colours.

- The demo's fade-in caps each component at the fade's level (an RGBA copy of the palette fades exactly as the palette does).
- Partial alpha blends over the colour beneath (a picture over the floor, the archive's tile under a tile).
- RGBA pixels never take the palette cycle of the beach tracks' water. The templates export the tile pixels of the cycled entries (148,
  161 to 164 and 168 to 175 on the beach tracks) at alpha 0, so the archive's cycling texel shows there; keep them so. On the beach tracks
  the water's wheel dust and puffs (EFFECTS.SP at 990, 1230, 1470, 1710, 1800 and 1890) use those entries too: an RGBA pack of them shows
  their colours still; an indexed pack keeps them cycling.

## The template

The garage's *Art packs* panel exports a template: one member, or the whole race world (every tile sheet a track uses, every sky, every
strip, one entry for each CRC with its members listed, and every group of the region registry), at scale 1, 2 or 4 (nearest), in RGBA
through a palette (by default each member's first track's, else A_F1.PCX's) or indexed. Its pictures are the archive's art; its
`pack.json` is complete (the CRCs, the frames' offsets and cells, the anchors: each frame's lowest opaque row), its licence `LOCAL ONLY`,
and its `NOTICE.txt` says that it holds the original game's art and stays on your computer.

To make a pack: export a template, paint over its pictures (the same sizes; keep the alpha 0 pixels of the tile sheets' cycled entries and
the strip's *sky here* pixels where you want the archive's), remove the entries you do not replace, set your own name and licence, and
import it. The template imports as it is, with no entry refused (a *LOCAL ONLY* warning).

## The region registry

Frames entries may replace exactly the pictures the race draws (`src/enhance/regions.js`), found from the game's own functions:

- CARS.SP: every whole 38 x 28 frame, twelve a slot (the template lays a slot a row); the driver files (TIGER.SP and the others): every
  whole frame (the player's car and its crash pictures);
- DIGGER.SP: the ducks' sixteen frames; GENEF.SP: the starter lion's frames from 4449 and the explosions' from 7641 (1064 bytes apart), the
  tyre strips at 12961 and 13269 (28 x 11);
- every object of SPRITE.ATR, all its frames;
- HOGMIS.SP: every 18 x 13 frame (the shots and the car's rear pictures);
- SPARK.SP: the sparks' four 10 x 9 frames; EFFECTS.SP: the wheel dust and the puffs of every surface, the pit state's picture (32 x 24) and
  its splash overlay (38 x 28).

## What the import checks

An entry is **refused**, with its reason, for:

- an unknown kind, a missing image, a scale outside 1 to 8, a colour other than `rgba` or `indexed`, an indexed entry without its palette;
- a member that is not in the archive, or whose CRC-32 is not the entry's (*made for another A_F3.PCX*);
- frames past the end of the member, or a frame that is no picture the race draws;
- a box that does not fit its cell, anchors outside the frame, `columnMajor` false;
- kart angles: N not a multiple of 8 or above 64, a slot CARS.SP does not have, another size than 38 x 28;
- a strip period that is not the archive's;
- a picture missing from the pack, unreadable, of another size than the kind's, larger than the caps, or (indexed) not a palette PNG or with
  another colour than the palette's at an index it uses;
- the pack's pictures passing 64 million pixels;
- two entries of one key: the later is kept.

A **warning** (the entry is kept) for: a frame whose lowest opaque row, divided by p, is more than a row off its declared anchor or the
archive frame's; a LOCAL ONLY licence; a pack made against another WACKY.DAT.

The whole pack is refused for a missing `pack.json`, a manifest of another format or version, no name, an empty licence, or no entries.
Refused entries are not kept; the report lists every entry as ok, warning or refused.

## Several packs

The garage keeps any number of packs, each on or off, in an order. Where two enabled packs replace the same thing (a tile sheet, a sky, a
strip, a frame), the later one in the order wins; anything no pack replaces is the archive's. *Use in the game* turns ARTWORK on for the
playtest page. The race decodes the enabled packs' pictures when it starts (a race waits for them up to 1.5 s) and keeps up to 128 MB of
them decoded across races; your browser keeps the PNG files as you imported them.
