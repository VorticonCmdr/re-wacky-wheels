# M — track surface

4096 bytes: row-major 64×64 tile indices. Tiles are 32×32 pixels; two tilesets provide 54 tiles each.

## Verification notes

Source discrepancy: the track page gives secondary indices 54–106 while the graphics page gives 54–107. The local 1.m starts with 0x6B (107), confirming that 107 occurs in this archive.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
