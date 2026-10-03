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

## Verification notes

- [STATIC] (`midi.player`): the game's sequencer in the sound library reads a file as follows: `MThd` (length dword, format word at +8 which must be 0 or 1, track count word which must not be 0, division word), then `MTrk` chunks; deltas are variable-length, a status byte is optional (running status), meta events carry a one-byte length (only `0x2f` end of track and `0x51` tempo are acted on, tempo as `60000000 / microseconds * division / 60` calls a second), and channel events take the byte counts 0x8n, 0x9n, 0xan, 0xbn: 2, 0xcn, 0xdn: 1, 0xen: 2; sysex is not handled. Controller 126 swallows one more byte. `src/formats/midi.js` reads files this way. Read, not run.
- [PROVEN] (`midi-songs`, `midi.songs`): all 16 archive files obey that grammar: header length 6, format 1 (format 0 for `MAINMENU.MID`), 1 to 19 tracks, division 120, 122986 events (112745 in running status), channel kinds 0x9, 0xb, 0xc, 0xd, 0xe (notes end as note on with velocity 0), controllers 1, 7, 10 and 64, meta types 0x03, 0x21, 0x2f, 0x51, 0x58, 0x59; no sysex.

- [PROVEN] (`obs-midi`, `midi.driver-state`, records `midi-1` to `midi-5`): with the SC55 configuration (General MIDI on the MPU-401) the sequencer's 0x1c-byte track records, read while `MAINMENU.MID` and `DANCE.MID` played, hold pointers that rest exactly on events right after a delta in the grammar above, with at most that delta left and the running status in force; an ended track's pointer is one byte past its chunk (a delta is read from the next chunk's tag). The notes and controllers handed to the driver were not observed.

## Sources

- [MID format](https://moddingwiki.shikadi.net/wiki/MID_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02. [Format index](README.md).
