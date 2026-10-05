# AudioT — PC-speaker chunks

| Type | Field |
| --- | --- |
| UINT32LE | Data length N |
| UINT16LE | Priority |
| BYTE[N] | Tone data |
| UINT8 | Terminator |

Tone bytes are inverse-frequency values: divisor=`byte*60`; zero silences the speaker. The game's player reads one byte a tick at 1193182 / 8514 = 140.14 ticks a second ([STATIC] `audio.speaker-rate`; the handler's period 8514 is observed, [PROVEN] `audio.timer-observed`).

## Verification notes

- [PROVEN] (`audio-bank`, `audio.bank-layout`): in the user's archive the first bank (slots 0 to 25) is a 6-byte header, N payload bytes (N = the first dword) and one trailing 0 byte, matching the table above. That the payload is inverse-frequency tone data, what the priority is, and the playback rate are leads: no check reads them. The first bank is the one the game loads with sound mode 7 (`audio.load`); mode 7 is the PC-speaker device (see the next two notes).
- [STATIC] (`audio.speaker-player`): the game's device-7 player reads the length dword as a byte counter, starts at chunk+6 (the 2 bytes after the length are skipped, so the wiki's "priority" word is not read by the player; the priority is an argument of the play call), and its timer handler takes one byte per tick, multiplies by 60 through a table (`divisor = byte x 60`, 0 = silence), writes it to the PC timer (ports 0x43/0x42) and switches the speaker through port 0x61. The tick handler is registered with the rate argument 140, matching the wiki's about 140 bytes per second; both are read, not observed.
- [PROVEN] (`obs-speaker`, `audio.speaker-state`): in the running game with the sound mode set to 7 the library's device word equals the mode (so mode 7 is the device the dispatch sends to this player), the player is idle in byte mode with no completion callback, and its table holds `60 x index` for all 256 byte values, as `audio.speaker-player` reads it. No tone was playing when the words were read, so the tick handler and the port writes are still only read.
- [PROVEN] (`obs-tick`, `audio.speaker-tick`): with an execute breakpoint on the first instruction of the tone path of the tick handler, every stop in the running game (sounds playing, mode 7) has the player's pointer inside one first-bank chunk's data, the counter equal to the chunk length minus the bytes consumed since chunk + 6, the divisor equal to 60 times the byte just read, and the stored priority that of a record pointing at the chunk. So the wiki's rule (`divisor = byte x 60`, tone data starting after a 6-byte header, the first dword as the length) is how the game plays these chunks; the priority word of the wiki's header is not read (the priority is an argument of the play call). Still read, not observed: the port writes themselves and the tick rate of 140 per second.

- [STATIC] (`audio.speaker-rate`) and [PROVEN] (`obs-digital`, `audio.timer-observed`, record `digital-1`, 2026-10-05): the player's tick handler is registered with the rate 140 at the library's timer service, which stores the period 0x12305e / 140 = 8514 timer counts; in a running game (mode 7) the service's list holds the speaker handler with period 8514 next to the game's clocks (136, 10 and 1 a second) and an AdLib music handler (280 a second), and the timer's reload value is the smallest period, 4257. The timer interrupt calls a handler whenever the accumulated reload values reach its period, so the handler runs 1193182 / 8514 = 140.14 times a second; the viewer and the page play the tones at that rate.
- [STATIC] (`audio.digital-flag`) and [PROVEN] (`audio.digital-observed`): in the sound modes 7 and 2 the game loads no VOC sample and its digital sound flag is 0; the sites that play the engine loop, the horn, the taunts' voices and the duck game's quacks test it, so those are silent on the PC speaker. [PROVEN] (`audio.calls-observed`, records `calls-7` and `calls-0`): in a mode 7 race the engine start and the horn routine were entered and left at the flag test with their registers unchanged, while in a mode 0 control run they ran their bodies. [PROVEN] (`audio.skips-observed`, records `calls2-7` and `calls2-0`): the easter egg's belch (neither loaded nor played), the first player's taunt voice and the duck game's quack stopped short of their flag tests in a mode 7 run (the DOPE scene and the taunt figure were on screen), against a mode 0 control where every site past the test ran. [PROVEN] (`audio.taunts-observed`, records `taunts-7` and `taunts-0`): in a two player race both players' taunts were accepted in both modes (the key routine serves both players), but the voice handle and flag words of both stayed 0 in the mode 7 and were set in the mode 0.
- [PROVEN] (`audio.no-alias`): the sound NO (number 26) is a copy of record 18 (PUF) in the mode 7, so it plays PUF's tones; the drivers' voices 0 to 7 are record 20's (`audio.alias`).

## Sources

- [AudioT PC sounds](https://moddingwiki.shikadi.net/wiki/AudioT_Format#PC_Sounds)

Read on 2026-10-02. [Format index](README.md).
