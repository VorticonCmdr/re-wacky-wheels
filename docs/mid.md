# MID — Standard MIDI music

Wacky Wheels uses MID music when General MIDI is selected in setup.exe. Playback requires a MIDI synthesizer.

## Structure

Multibyte header/chunk integers are big-endian.

| Type | Field |
| --- | --- |
| BYTE[4] | MThd |
| UINT32BE | Header-body length; usually 6 |
| UINT16BE | Format 0,1,2 |
| UINT16BE | Track count |
| UINT16BE | Timing division |

Each track starts with MTrk and UINT32BE data length. Events consist of a variable-length delta time, status, and event-specific data. Variable-length integers use seven payload bits/byte, most significant group first; bit 7 indicates continuation.

Channel statuses 0x80–0xEF cover note off/on, pressure, controllers, program changes, and pitch bend. Running status can omit repeated channel-status bytes. System-exclusive and meta events have variable payloads.

For quarter-note timing, convert ticks using the header division and tempo; default tempo is 500000 microseconds/quarter-note until overridden. A set high bit in timing division indicates SMPTE timing, requiring separate handling. MIDI encodes musical events rather than recorded PCM audio.

## Sources

- [MID format](https://moddingwiki.shikadi.net/wiki/MID_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02. [Format index](README.md).
