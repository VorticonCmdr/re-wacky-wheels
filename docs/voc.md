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

## Sources

- [VOC format](https://moddingwiki.shikadi.net/wiki/VOC_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02. [Format index](README.md).
