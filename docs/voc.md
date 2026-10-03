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
- [lead] The sample-rate rule (`1000000 / (256 - divisor)`), the codec numbers and block types 2 to 5, 8 and 9 are the wiki's; no check reads them, and the viewer's decoder in `src/audio.js` still uses them untraced. The game's sound library may play at other rates.

## Sources

- [VOC format](https://moddingwiki.shikadi.net/wiki/VOC_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02. [Format index](README.md).
