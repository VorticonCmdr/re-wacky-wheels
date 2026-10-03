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
- The sprite loader reads only +0, +4, +6, +0x0e and the name; the other words are accounted for by `atr.derived-words` and the kind word by `atr.kind-effects` below (the wiki's pickup names for the kinds are leads).
- [PROVEN] (`atr-derived`, `atr.derived-words`): in all 36 records word `+2` is 10, words `+8` and `+0x0a` repeat `+4` and `+6`, word `+0x0c` is a shape code (28 x 28 is 1, 14 x 28 is 2, 32 x 24 is 3, no other shape occurs) and word `+0` takes the values 0 to 7. What the kind word does stays open (`UNKNOWN_ATR_FIELDS`, `atr.kind-use`).
- [STATIC] (`atr.kind-effects`): the per-frame object pass `FUN_00022bf4` branches on the kind word: 0 (or below) is an obstacle that wrecks a fast car, 1 a one-off pickup tied to a flag word, 2 a counter pickup that adds 4 up to 99, 3 to 7 a held item taken only when none is held; the `.SPW` word +2 is set to 0xffff when a pickup is taken. Read, not run; the game's names for the car words are not established here.

## Sources

- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
