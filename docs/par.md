# PAR — horizon images

Headerless 640×40 indexed 8bpp pixels: 25600 bytes. Uses the primary track palette; no rotation or flipping.

## Verification notes

Tags as in [evidence.md](evidence.md).

- [PROVEN] (`track-files`, claim `track.file-set`): all 42 `.PAR` members are exactly 0x6400 bytes (25,600 = 640 x 40).
- [PROVEN] (observed in the running game, `par.read`): the game reads the file unchanged into the slot-2 image buffer (CRC-32 equal) and keeps a pointer to it at obj2+0x1eb54. The reader is the track-start routine `FUN_00017928`.
- [PROVEN] (observed, `obs-vram`, `par.upload`): the routine `FUN_00036f55` copies the 0x6400 bytes into video memory at 0xa0000 + 0x7d00 in plane order; read back plane by plane, plane p at offset k holds file byte 4k + p, for all four planes. That is the off-screen part of an unchained mode. The width is not fixed by the upload (320 x 80 and 640 x 40 are both 25600 bytes); the viewer's 640 x 40 is still the wiki's lead.
- [PROVEN] (`obs-horizon`, claim `horizon.render-observed`): the floor routine `obj1+0x27e94` copies 20 rows from the uploaded pixels with the video latches (graphics controller write mode 1) to the screen rows 110 to 129, reading at the pointer `obj2+0x1d860`, which starts at 0xa0000 + 0x7d00 and moves within 0xa7d00 to 0xa7df0; read as 1280 pixels a row, screen pixel (c, 110 + j) is file byte `1280 j + 4 o + c` with o the pointer minus 0xa7d00, so the file is a 1280 x 20 panorama (two 640-pixel rows of the file make one panorama row), not 640 x 40. The window follows the car's turning (code reading), not the absolute heading.

## Sources

- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
