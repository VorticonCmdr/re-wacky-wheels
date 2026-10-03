# ATR — sprite catalogue

sprite.atr: INT16LE count; 40-byte entries.

| Relative offset | Type | Meaning |
| --- | --- | --- |
| 0 | INT16LE | Pickup type |
| 2 | INT16LE | Unknown; usually 10 |
| 4,6 | INT16LE | Width,height |
| 8,10 | INT16LE | Duplicate dimensions |
| 12 | INT16LE | Size selector |
| 14 | INT16LE | Animation frames |
| 16 | CHAR[24] | Null-padded filename |

Selectors: 1=28×28,2=14×28,3=32×24. Pickup types: 0=none,1=tires,2=hedgehogs,3=fireballs,4=devils,5=bomb,6=oil,7=inverted-hog,8=ice.

## Verification notes

Tags as in [evidence.md](evidence.md). Parser: `parseAtr` in `src/formats/atr.js`; the legacy `parseAtr` in `src/sprites.js` still serves the viewer.

- [PROVEN] (`atr-sprites`, claim `atr.layout`): `SPRITE.ATR` is a 2-byte count (36) plus exactly count records of 0x28 bytes. The words at +4, +6 and +0x0e multiply to the size of the `.SP` member named at +0x10 in all 36 records (the member exists and has exactly that many bytes); the name is NUL-terminated inside a 0x18-byte field that runs to the record's end, and the wiki's duplicate dimensions at +8 and +0x0a equal +4 and +6 in all 36. The product is symmetric in +4 and +6, so the archive does not say which is width and which is height; the wiki's order (width first) is a lead.
- [PROVEN] (observed in the running game, `atr.read`, `sp.read`): the loader reads the count and the records into a table; its sprite loader then reads, for each catalogue entry whose index equals the word at +0 of some `.SPW` record, exactly width x height x frames bytes of the named `.SP` file to a running cursor, storing the buffer address in the dword at +0x24 of the entry (in the name field's unused tail). For track 2 that is 10 sprites, 24,608 bytes, contiguous, and equal to the files in index order. The first loaded entry whose word at +0 is 2 is remembered.
- [UNKNOWN] the other words: `UNKNOWN_ATR_FIELDS` (the wiki's pickup types, "usually 10" word and size selector). The sprite loader reads only +0, +4, +6, +0x0e and the name.

## Sources

- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
