# MOV — devil motion

gig.mov: UINT16LE N, followed by N+1 `(INT16LE x,INT16LE y)` records. Coordinates are relative; positive right/down. Approximately 0.1 seconds/position. Default N=80; increasing length may crash.

## Verification notes

Local observation: 326 bytes, with N=80; matches 2+81×4.

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
