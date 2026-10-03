# TAB — acceleration curves

200 INT16LE speeds: vel.tab=12HP,vel2.tab=6HP. Last value sets maximum speed; negative speeds reverse travel. AI adapts competitively; speedometer caps at 99.

## Verification notes

Local observation: both files are 400 bytes.

## Verification notes

- [PROVEN] (`obs-buffers`, `small.read`): the game reads the archive member `VEL.TAB` and `VEL2.TAB` whole (400 bytes each bytes) into the buffer at obj2+0x1e8c4` and obj2+`0x1e584; in a running race the buffer equals the member (CRC-32 equal). What the values mean is not established (lead above).

## Sources

- [Miscellaneous formats](https://moddingwiki.shikadi.net/wiki/Miscellaneous_Wacky_Wheels_File_Formats)

Read on 2026-10-02. [Format index](README.md).
