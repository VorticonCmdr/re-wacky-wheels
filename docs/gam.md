# GAM — track configuration

ASCII, CRLF; 25 or 28 lines.

| Lines | Meaning |
| --- | --- |
| 1–2 | Primary/secondary tilesets |
| 3–4 | Property-mask files |
| 5 | Sky PCX |
| 6–8 | Unknown; 1250,1500,1 |
| 9–10 | Start X,Y |
| 11–24 | Unknown |
| 25 | Palette-cycling flag |
| 26–28 | Cycling delays |

Lines 1–4 omit `a_`; line 5 does not. Cycling uses beach.pcx; delays cover step/restart for 148,161–164 and step for 168–175.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
