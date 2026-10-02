# CFG — settings and saved games

wacky.cfg stores setup.exe settings plus single/two-player saves. Offsets below are hexadecimal; the source labels saved fields INT32LE.

| Field | Single | Two-player |
| --- | --- | --- |
| Enabled | 866 | 8DA |
| Laps | 872 | 8E6 |
| Race class | 876 | 8EA |
| Cup | 87A | 8EE |
| Track | 87E | 8F2 |
| Character copies | 86A,8A2 | P1:8DE,916; P2:8E2,91A |
| Opponent characters | 8A6–8BE | 91E–932 |
| Points | 882 | P1:8F6; P2:8FA |
| Opponent points | 886–89E | 8FE–912 |
| Hedgehogs | 8C2 | — |
| Item | 8C6 | — |
| Two-player mode | — | 94E |
| Horsepower | 958 | 95A |
| Pack | 95C | 95E |

Enabled:0/1. Class:1=amateur,2=pro,3=champ,4=trial,5=kid-like. Cup:1=bronze,2=silver,3=gold. Track:1–5. HP:1=12,2=6. Pack:0=regular,3=bonus. Two-player mode:1=head-to-head,2=all-cars. Character IDs follow [HI](hi.md); held items use 0 or 3–8 from [ATR](atr.md).

Settings outside this saved-game table are not specified by the source.

## Verification notes

Source discrepancy: horsepower/pack offsets are two bytes apart, conflicting with the blanket INT32LE description. Confirm field widths before writing; a four-byte write could overlap the adjacent setting.

## Sources

- [Configuration format](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Configuration_Format)

Read on 2026-10-02. [Format index](README.md).
