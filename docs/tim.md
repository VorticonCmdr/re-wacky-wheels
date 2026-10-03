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

- [PROVEN] (`score-files`, `tim.layout`, `score.defaults`, `score.references`): the layout above holds in the installed `WACKY1.TIM` and the archive defaults `WAC1.OTT` and `WAC2.OTT` (30 records of 120 bytes, names of 16 padded characters in 20-byte fields, the four lap times of a record never decrease, laps 148 to 683, overall times 934 to 3254); the installed `WACKY1.TIM` is exactly `WAC1.OTT`, which the loader reads when the file is missing; the program names the table only at record offsets 0x0, 0x50, 0x54 and 0x74.
- [STATIC] (`score.insert`): a new best lap enters the four sorted times at the first one it is not above and pushes the later laps and names down; a new overall time replaces the one at +0x74 when it is not above it. That the times are tenths of a second remains the wiki's lead.

Source ambiguity: the sixth group repeats “bonus bronze.” It likely means bonus gold, but this has not been verified.

## Sources

- [High-score formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_High_Score_Files)

Read on 2026-10-02. [Format index](README.md).

- [STATIC] (`setup.score-reset`): `SETUP.EXE`'s "Reset score tables" deletes `WACKY1.TIM`, `WACKY2.TIM`, `WACKY1.HI`, `WACKY2.HI` and `WACKY.DTT` from the game directory (DOS delete). The installed folder holds `WACKY1.TIM`, `WACKY1.HI` and `WACKY.DTT`. Read, not run.
