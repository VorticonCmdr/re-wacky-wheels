# AudioT — PC-speaker chunks

| Type | Field |
| --- | --- |
| UINT32LE | Data length N |
| UINT16LE | Priority |
| BYTE[N] | Tone data |
| UINT8 | Terminator |

Tone bytes are inverse-frequency values: divisor=`byte*60`; zero silences the speaker. Generic AudioT playback processes approximately 140 bytes/second; Wacky Wheels timing is unverified here.

## Verification notes

- [PROVEN] (`audio-bank`, `audio.bank-layout`): in the user's archive the first bank (slots 0 to 25) is a 6-byte header, N payload bytes (N = the first dword) and one trailing 0 byte, matching the table above. That the payload is inverse-frequency tone data, what the priority is, and the playback rate are leads: no check reads them. The first bank is the one the game loads with sound mode 7 (`audio.load`); which sound device mode 7 is, is not established (`UNKNOWN_AUDIO_MODE_VALUES`).

## Sources

- [AudioT PC sounds](https://moddingwiki.shikadi.net/wiki/AudioT_Format#PC_Sounds)

Read on 2026-10-02. [Format index](README.md).
