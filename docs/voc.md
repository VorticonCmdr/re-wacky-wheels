# VOC — digitized effects

Wacky Wheels stores 36 VOC effects inside WACKY.DAT. The wiki warns that replacements must not exceed the original file size. VOC effects are used for SoundBlaster, Sound Source, and Gravis Ultrasound selections; Pro AudioSpectrum behavior is unverified.

## Header

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | CHAR[19] | Creative Voice File (19 bytes) |
| 19 | UINT8 | 0x1A |
| 20 | UINT16LE | Header size; usually 26 |
| 22 | UINT16LE | Version |
| 24 | UINT16LE | Checksum: `(~version+0x1234)&0xFFFF` |

## Blocks

UINT8 type, then UINT24LE payload length; type 0 is a single-byte terminator.

Types: 1=legacy audio,2=continuation,3=silence,4=marker,5=text,6=repeat-start,7=repeat-end,8=extended settings,9=new audio.

Type 1: UINT8 frequency divisor, UINT8 codec, sample bytes. Rate=`1000000/(256-divisor)`.

Type 9: UINT32LE rate; UINT8 bits,channels; UINT16LE codec; UINT32LE reserved; samples. Codec 0 is unsigned 8-bit PCM; codec 4 is signed 16-bit PCM. Preserve block boundaries and codec compatibility.

## Verification notes

Tags as in [evidence.md](evidence.md).

- [PROVEN] (`voc-members`, `voc.layout`): all 36 `.VOC` members of the user's archive have the 26-byte header above (version 0x010a, valid check value), then blocks of a 4-byte header and their data, ended by a single 0 byte that is the last byte of the file. Each has exactly one type-1 block (a divisor byte, a codec byte that is 0, then the samples); `MOTOR.VOC` alone has a type-6 block (count 0xffff, i.e. repeat forever) before it and an empty type-7 block after it. The archive cannot show whether the block length field is 2 or 3 bytes wide (no length reaches 65536). A strict structural parser is `src/formats/voc.js`.
- [STATIC] (`voc.library-player`): the game's sound library walks the blocks itself: a type-1 block's rate is `0xf424000 / (0x10000 - (byte << 8))`, that is `1000000 / (256 - byte)` rounded down; only blocks with codec 0 play (type 9 only as 8-bit mono, codec 0); silence, marker, text and extended blocks are skipped; a repeat plays its blocks count + 1 times, 0xffff for ever. The viewer's decoder `src/formats/voc-audio.js` follows these rules. Read, not run.
- [PROVEN] (`obs-voices`, `voc.rate-observed`, records `voices-1`, `voices-2`): in the running game with a Sound Blaster (sound mode 0, `BLASTER=A220 I7 D1 H5 T6`) the library's voice records hold 8000 (PLIP, time constant 131), 10000 (BACKFIRE, 156) and 10989 (MOTOR, 165), the integer `0xf424000 / (0x10000 - (byte << 8))`; after one byte of the loaded PLIP buffer was changed to 180 in memory a restarted voice held 13157, the rounded-down 1000000 / 76 (rounding would give 13158), which is also the rate `GIG4.VOC` now decodes at.

## Sources

- [VOC format](https://moddingwiki.shikadi.net/wiki/VOC_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02. [Format index](README.md).
