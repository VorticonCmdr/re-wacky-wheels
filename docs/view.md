# VIEW — apparent-distance table

Wiki: 320 INT16LE values describing a parabolic segment; affects perceived object/driver distance.

## Verification notes

Local observation: 1280 bytes, versus 640 implied by the wiki. Initial values resemble 32-bit integers; do not silently treat the documented width as reliable.

## Verification notes

- [PROVEN] (`obs-buffers`, `small.read`): the game reads the archive member `VIEW` whole (1280 bytes) into the buffer at obj2+0xb7f8; in a running race the buffer equals the member (CRC-32 equal). What the values mean is not established (lead above).

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
