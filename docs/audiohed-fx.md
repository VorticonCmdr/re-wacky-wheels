# FX — AUDIOHED offset table

audiohed.fx contains UINT32LE offsets into [AUDIOT](audiot-fx.md). N+1 offsets describe N slots; `size[i]=offset[i+1]-offset[i]`. Empty slots have equal adjacent offsets.

## Verification notes

Local observation: audiohed.fx is 316 bytes: 79 offsets and 78 slots. Of these, 25 are empty. This differs from the overview’s claim of 54 unnamed files; nonempty slots need classification, including possible tags.

## Sources

- [AudioT format](https://moddingwiki.shikadi.net/wiki/AudioT_Format)

Read on 2026-10-02. [Format index](README.md).
