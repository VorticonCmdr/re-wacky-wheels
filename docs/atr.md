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

Source typo: height2 is described as equal to itself. The first local entry repeats width1 and height1 at offsets 8 and 10; that observation does not establish every entry’s semantics.

## Sources

- [Graphics formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Graphics_Formats)

Read on 2026-10-02. [Format index](README.md).
