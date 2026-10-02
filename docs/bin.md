# BIN — B800 exit screens

wwreg.bin and wwsw.bin use B800 text-screen dumps.

## Layout

Usually 4000 bytes: 80×25 cells, row-major from the upper left. Each cell is two bytes:

| Relative offset | Type | Meaning |
| --- | --- | --- |
| 0 | UINT8 | Character code |
| 1 | UINT8 | Display attributes |

Attribute bits 0–3 select foreground color; bits 4–6 select background. Bit 7 normally enables blinking, or background intensity when blinking is disabled by the display mode. Preserve cell count and attribute bytes when editing the exit screen.

## Sources

- [B800 text](https://moddingwiki.shikadi.net/wiki/B800_Text)
- [Wacky Wheels](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels)

Read on 2026-10-02. [Format index](README.md).
