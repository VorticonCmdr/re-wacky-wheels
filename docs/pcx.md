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

## Sources

- [PCX format](https://moddingwiki.shikadi.net/wiki/PCX_Format)
- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
