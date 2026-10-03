# TIM — time-trial records

wacky1.tim=12HP; wacky2.tim=6HP. 30×120-byte records:

| Offset | Type | Field |
| --- | --- | --- |
| 0 | CHAR[20][4] | Lap names |
| 80 | UINT32LE[4] | Lap times |
| 96 | CHAR[20] | Overall name |
| 116 | UINT32LE | Overall time |

Names are null-terminated. Times use tenths/second, maximum 36000. Groups contain five tracks; regular bronze/silver/gold precede bonus groups. Defaults: [OTT](ott.md).

## Verification notes

Source ambiguity: the sixth group repeats “bonus bronze.” It likely means bonus gold, but this has not been verified.

## Sources

- [High-score formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_High_Score_Files)

Read on 2026-10-02. [Format index](README.md).

- [STATIC] (`setup.score-reset`): `SETUP.EXE`'s "Reset score tables" deletes `WACKY1.TIM`, `WACKY2.TIM`, `WACKY1.HI`, `WACKY2.HI` and `WACKY.DTT` from the game directory (DOS delete). The installed folder holds `WACKY1.TIM`, `WACKY1.HI` and `WACKY.DTT`. Read, not run.
