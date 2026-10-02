# SPW — object placement

UINT16LE count; 12-byte records:

`UINT16LE objectid,unknown1,x,y,unknown2; INT16LE unknown3`

objectid indexes [ATR](atr.md); coordinates span 0–2048. Unknowns normally zero.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
