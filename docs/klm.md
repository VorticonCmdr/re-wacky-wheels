# KLM — AdLib music

## Header

| Offset | Type | Field |
| --- | --- | --- |
| 0 | UINT16LE | Ticks/second |
| 2 | UINT8 | Unknown |
| 3 | UINT16LE | Song-data offset |
| 5 | BYTE[] | Instruments |

Each instrument is 11 bytes, in OPL register order: 40,43,60,63,80,83,20,23,E0,E3,C0 (hex).

## Commands

Low nibble selects channel for channel commands.

| Command | Following bytes | Meaning |
| --- | --- | --- |
| 0x0n | 0 | Note off |
| 0x1n | 2 for n=0–5; 0 for n=6–10 | Frequency note/percussion |
| 0x2n | 1 | Volume |
| 0x3n | 1 | Instrument index |
| 0x4n | 0 | Note on; retained frequency |
| 0xFD | UINT8 | Delay ticks |
| 0xFE | UINT16LE | Delay ticks |
| 0xFF | 0 | End |

Frequency bytes target A0+n,B0+n. Percussion 6–10: bass,snare,tom,cymbal,hi-hat. Volume maps to carrier attenuation `(127-v)/2`. Delay seconds=`ticks/tempo`. Format knowledge is incomplete; score-display tick resolution is not reliably stored.

KLM supplies music when General MIDI is not selected.

## Verification notes

The supplied archive’s 16 KLM songs use two frequency bytes for channel 6 as well as channels 0–5. Treating 0x16 as having no following bytes desynchronizes parsing. The viewer handles 0x10–0x16 with two bytes and 0x17–0x1A with none; every local song parses through its final 0xFF. This is an implementation observation that differs from the source table above.

## Sources

- [KLM format](https://moddingwiki.shikadi.net/wiki/KLM_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02. [Format index](README.md).
