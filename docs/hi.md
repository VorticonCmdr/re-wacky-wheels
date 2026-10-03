# HI — race high scores

wacky1.hi=12HP; wacky2.hi=6HP. 144×46-byte records:

| Offset | Type | Field |
| --- | --- | --- |
| 0 | INT16LE | Unknown |
| 2 | INT16LE | Racer |
| 4 | INT16LE | Score |
| 6 | CHAR[20] | Date |
| 26 | CHAR[20] | Name |

Racers 0–7: Uno,Sultan,Morris,Peggles,Razer,Ringo,Blombo,Tigi. Four scores/group; alternate groups unused. Order: regular then bonus; bronze/silver/gold; amateur/pro/champion. Date/name display limits: 12/14 characters. Missing files restore from [HTT](htt.md).

## Sources

- [High-score formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_High_Score_Files)

Read on 2026-10-02. [Format index](README.md).

- [STATIC] (`setup.score-reset`): `SETUP.EXE`'s "Reset score tables" deletes `WACKY1.TIM`, `WACKY2.TIM`, `WACKY1.HI`, `WACKY2.HI` and `WACKY.DTT` from the game directory (DOS delete). The installed folder holds `WACKY1.TIM`, `WACKY1.HI` and `WACKY.DTT`. Read, not run.
