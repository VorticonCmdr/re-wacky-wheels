# PCX — indexed graphics

## Binary structure

128-byte header; multibyte fields are little-endian.

| Offset | Type | Field |
| --- | --- | --- |
| 0 | UINT8 | Manufacturer=0x0A |
| 1 | UINT8 | Version |
| 2 | UINT8 | Encoding; 1=RLE |
| 3 | UINT8 | Bits/plane |
| 4,6,8,10 | UINT16LE | xmin,ymin,xmax,ymax |
| 12,14 | UINT16LE | DPI |
| 16 | BYTE[48] | Small palette |
| 64 | UINT8 | Reserved |
| 65 | UINT8 | Plane count |
| 66 | UINT16LE | Bytes/plane/row |
| 68 | UINT16LE | Palette interpretation |
| 70,72 | UINT16LE | Screen size |
| 74 | BYTE[54] | Padding |

Dimensions are `max-min+1`. Decode padded rows using the stored stride. RLE bytes ≥0xC0 repeat the next byte `value&0x3F` times; smaller bytes are literal. Encode literal 0xC0 as C1 C0. VGA palette: marker 0x0C followed by 256 RGB triplets after image data.

## Wacky Wheels usage

`a_f*`: tiles; `a_ma*`: per-pixel property masks. Primary tileset supplies the race palette. Preserve indices: masks use 0/1; cycling uses beach.pcx. Palette remapping can break animation.

## Verification notes

Tags as in [evidence.md](evidence.md); citations are against the user's WW.EXE ([binaries.md](binaries.md)). Parser: `src/formats/pcx.js` (`decodePcxMember`, `splitTiles`). The legacy `src/pcx.js` still serves the viewer, the editor and loose PCX files with other sizes (the manual pages belong to MANUAL.EXE, not the game).

- [PROVEN] (`pcx-members`, claim `pcx.layout`): all 116 PCX members of the supplied WACKY.DAT are `0x80` header bytes, an RLE stream, and `0x300` palette bytes. The stream decodes to exactly 320 x 200 pixels and leaves exactly one byte, `0x0C`, before the palette. No run crosses a row or has a zero count. Run flags `0x80` and `0xE0`, count masks `0x1F` and `0x7F`, header sizes 127/129, palette sizes 767/769, marker `0x0B`, width 319 and height 201 all fail on the archive.
- [PROVEN] (claim `pcx.header-observed`): every header has manufacturer 10, version 5, encoding 1, 8 bits, 1 plane, 320 bytes per row, and a box of 320 x 200. These are properties of the files; the image loader does not examine them.
- [PROVEN] (observed in the running game, `obs-race`): the live tile buffer for track 2 equals the in-process decode and split of the four sheets, so the linear-buffer decoder follows the rule (`pcx.rle-rule`: run if `(b & 0xC0) == 0xC0`, count `b & 0x3F`, fixed 320 x 200) and the slicer cuts 54 tiles of 32 x 32, 10 per row (`tiles.sheet-split`). The slot buffer of the sky picture holds exactly the member between header and palette, marker included (`pcx.member-split`), and the palette buffer holds the last 0x300 bytes shifted right by 2 (`pcx.palette-scale`).
- [STATIC] (`pcx.rle-rule-vga`): the decoder that writes VGA planes uses the same rule; runs continue across rows and a zero count is not special-cased. Not observed. Only the decoder, loader and palette routines read so far are covered; the other 36 call sites of the first decoder and their loaders are untraced.
- **Not established:** what the VGA DAC then shows. The palette reaches the DAC through code that is unread, so DOSBox's 6-to-8-bit scaling and any fades are unknown. A full-frame comparison of the Apogee logo screen against `APOG1.PCX` matched only 8,940 of 64,000 pixels under four candidate conversions, and no single PCX explained it (best 38,886): that screen is a composite of animation over a background, so it is not evidence either way.
- **Differences from the wiki lead.** The wiki's header table and "dimensions are max-min+1" describe the files correctly but are not used by the code read: the loader skips the header and the decoders hard-code 320 x 200. The 0x0C marker is not checked as a marker by the code read: the loader's `size - 0x380` read includes it in the stream buffer, and the decoders stop before reaching it. Palette values in the files are 8-bit (maximum bytes 252 to 255), and the game quantises them to 6 bits.
- [PROVEN] (`tiles.mask-values`, observed `terrain.lookup`): `a_ma*` sheets are per-pixel masks that hold only 0 and 1 in the 54 used slots and 255 elsewhere; the game uses each mask pixel to choose between the two properties of the tile's `.SIN` entry (see [sin.md](sin.md)).
- Not yet checked here: the wiki's remark that `a_f*` hold tiles (they are the tilesets named by `.GAM` lines 1 and 2), that the primary tileset supplies the race palette (it does: the palette source is the first tileset), and that cycling uses `beach.pcx`.

## Sources

- [PCX format](https://moddingwiki.shikadi.net/wiki/PCX_Format)
- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
