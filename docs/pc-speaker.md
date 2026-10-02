# AudioT — PC-speaker chunks

| Type | Field |
| --- | --- |
| UINT32LE | Data length N |
| UINT16LE | Priority |
| BYTE[N] | Tone data |
| UINT8 | Terminator |

Tone bytes are inverse-frequency values: divisor=`byte*60`; zero silences the speaker. Generic AudioT playback processes approximately 140 bytes/second; Wacky Wheels timing is unverified here.

## Sources

- [AudioT PC sounds](https://moddingwiki.shikadi.net/wiki/AudioT_Format#PC_Sounds)

Read on 2026-10-02. [Format index](README.md).
