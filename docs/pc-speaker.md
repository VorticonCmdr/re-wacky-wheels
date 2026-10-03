# AudioT — PC-speaker chunks

| Type | Field |
| --- | --- |
| UINT32LE | Data length N |
| UINT16LE | Priority |
| BYTE[N] | Tone data |
| UINT8 | Terminator |

Tone bytes are inverse-frequency values: divisor=`byte*60`; zero silences the speaker. Generic AudioT playback processes approximately 140 bytes/second; Wacky Wheels timing is unverified here.

## Verification notes

- [PROVEN] (`audio-bank`, `audio.bank-layout`): in the user's archive the first bank (slots 0 to 25) is a 6-byte header, N payload bytes (N = the first dword) and one trailing 0 byte, matching the table above. That the payload is inverse-frequency tone data, what the priority is, and the playback rate are leads: no check reads them. The first bank is the one the game loads with sound mode 7 (`audio.load`); mode 7 is the PC-speaker device (see the next two notes).
- [STATIC] (`audio.speaker-player`): the game's device-7 player reads the length dword as a byte counter, starts at chunk+6 (the 2 bytes after the length are skipped, so the wiki's "priority" word is not read by the player; the priority is an argument of the play call), and its timer handler takes one byte per tick, multiplies by 60 through a table (`divisor = byte x 60`, 0 = silence), writes it to the PC timer (ports 0x43/0x42) and switches the speaker through port 0x61. The tick handler is registered with the rate argument 140, matching the wiki's about 140 bytes per second; both are read, not observed.
- [PROVEN] (`obs-speaker`, `audio.speaker-state`): in the running game with the sound mode set to 7 the library's device word equals the mode (so mode 7 is the device the dispatch sends to this player), the player is idle in byte mode with no completion callback, and its table holds `60 x index` for all 256 byte values, as `audio.speaker-player` reads it. No tone was playing when the words were read, so the tick handler and the port writes are still only read.
- [PROVEN] (`obs-tick`, `audio.speaker-tick`): with an execute breakpoint on the first instruction of the tone path of the tick handler, every stop in the running game (sounds playing, mode 7) has the player's pointer inside one first-bank chunk's data, the counter equal to the chunk length minus the bytes consumed since chunk + 6, the divisor equal to 60 times the byte just read, and the stored priority that of a record pointing at the chunk. So the wiki's rule (`divisor = byte x 60`, tone data starting after a 6-byte header, the first dword as the length) is how the game plays these chunks; the priority word of the wiki's header is not read (the priority is an argument of the play call). Still read, not observed: the port writes themselves and the tick rate of 140 per second.

## Sources

- [AudioT PC sounds](https://moddingwiki.shikadi.net/wiki/AudioT_Format#PC_Sounds)

Read on 2026-10-02. [Format index](README.md).
