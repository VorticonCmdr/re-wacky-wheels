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

- [STATIC] (`klm.player`): the game's AdLib music driver (sound library, `obj1+0x3a4b3`) is read in full. Each tick call counts a delay down or runs commands: `0xfd` byte / `0xfe` word delays (n calls), `0xff` back to the start; otherwise kind (high nibble) and channel (low nibble): 0 note off, 1 frequency (channels 0 to 6 two bytes, channel 8 four bytes, channels 7, 9 and 10 none; channels 6 to 10 also key their rhythm bit), 2 volume (one byte), 3 instrument (one byte), 4 note on (no bytes), kinds above 4 ignored. The volume is applied as `0x3f - (2 * level * volume + 0x7f) / 0xfe` to the carrier (and the modulator of additive instruments), where the level is `0x3f` minus the instrument's total level, not the wiki's `(127 - v) / 2`; the percussion channels 7 to 10 load only the modulator fields of their instrument and take their `0xc0` from nothing. The viewer's decoder `src/formats/klm.js` follows this, including the reset and initialisation writes. Read, not run.
- [PROVEN] (`klm-songs`, `klm.songs`): all 16 archive songs obey that grammar: tick rate 280, 7 to 24 instruments of 11 bytes, 113964 commands and 19202 delays (370476 ticks) ending exactly with `0xff` at the end of the file; the frequency command never occurs on channel 8.
- [PROVEN] (`klm-tables`, `klm.opl-tables`): the driver's operator slot map, register offsets and rhythm key bits in `WW.EXE`'s data object are the OPL2 layout (channel 6 bass drum, 7 snare, 8 tom, 9 cymbal, 10 hi-hat).

The supplied archive’s 16 KLM songs use two frequency bytes for channel 6 as well as channels 0–5. Treating 0x16 as having no following bytes desynchronizes parsing. The viewer handles 0x10–0x16 with two bytes and 0x17–0x1A with none; every local song parses through its final 0xFF. This is an implementation observation that differs from the source table above.

## Sources

- [KLM format](https://moddingwiki.shikadi.net/wiki/KLM_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02. [Format index](README.md).
