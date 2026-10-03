# PAR — horizon images

Headerless 640×40 indexed 8bpp pixels: 25600 bytes. Uses the primary track palette; no rotation or flipping.

## Verification notes

Tags as in [evidence.md](evidence.md).

- [PROVEN] (`track-files`, claim `track.file-set`): all 42 `.PAR` members are exactly 0x6400 bytes (25,600 = 640 x 40).
- [PROVEN] (observed in the running game, `par.read`): the game reads the file unchanged into the slot-2 image buffer (CRC-32 equal) and keeps a pointer to it at obj2+0x1eb54. The reader is the track-start routine `FUN_00017928`.
- [PROVEN] (observed, `obs-vram`, `par.upload`): the routine `FUN_00036f55` copies the 0x6400 bytes into video memory at 0xa0000 + 0x7d00 in plane order; read back plane by plane, plane p at offset k holds file byte 4k + p, for all four planes. That is the off-screen part of an unchained mode. The width is not fixed by the upload (320 x 80 and 640 x 40 are both 25600 bytes); the viewer's 640 x 40 is still the wiki's lead.
- [UNKNOWN] what draws it afterwards: `UNKNOWN_PAR_USE`. Lead (seen once, a frame of a paused demo race compared pixel by pixel with the file, 2026-10-03; not a check): screen rows 110 to 126 equal file bytes `[1280 * (y - 110) + 320, +320)` on 229 to 309 of 320 pixels per row (the rest is covered by cars and HUD). So the file looks like a **1280 x 20** panorama with a 320-pixel window on screen rows 110 to 129, not the wiki's 640 x 40 that this page's first lines and the viewer assume.

## Sources

- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
