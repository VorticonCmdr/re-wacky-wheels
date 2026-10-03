# VIEW — apparent-distance table

Wiki: 320 INT16LE values describing a parabolic segment; affects perceived object/driver distance.

## Verification notes

- [STATIC] (`view.object-projection`): the buffer holds one dword per screen column, 16384 at the centre column 160 and 14185 at column 0 (symmetrical), a per-column factor that the object projection multiplies the distance by (then `>> 14`) to get a depth; it is not exactly 16384 x cos of the column angle for a 30 degree half angle (checked against round(16384 x cos(atan((x - 160) x tan 30 / 160))): 309 of the 320 columns differ, by up to 104).


Local observation: 1280 bytes, versus 640 implied by the wiki. Initial values resemble 32-bit integers; do not silently treat the documented width as reliable.

## Verification notes

- [PROVEN] (`obs-buffers`, `small.read`): the game reads the archive member `VIEW` whole (1280 bytes) into the buffer at obj2+0xb7f8; in a running race the buffer equals the member (CRC-32 equal). What the values mean is not established (lead above).

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
