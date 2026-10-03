# SLP — visibility table

Wiki: INT16LE table, probably controlling whether objects lie inside the field of view. Semantics remain tentative.

## Verification notes

Local observation: 7680 bytes; initial eight bytes are 00 00 00 00 EA 00 00 00. Element width needs verification.

## Verification notes

- [PROVEN] (`obs-buffers`, `small.read`): the game reads the archive member `SLP` whole (7680 bytes) into the buffer at obj2+0xe858; in a running race the buffer equals the member (CRC-32 equal). What the values mean is not established (lead above).

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
