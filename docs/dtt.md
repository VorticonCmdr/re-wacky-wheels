# DTT — duck-shoot scores

wacky.dtt: four records, each CHAR[20] name then INT32LE score (24 bytes). Missing file regenerates from executable defaults.

## Sources

- [High-score formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_High_Score_Files)

Read on 2026-10-02. [Format index](README.md).

- [STATIC] (`setup.score-reset`): `SETUP.EXE`'s "Reset score tables" deletes `WACKY1.TIM`, `WACKY2.TIM`, `WACKY1.HI`, `WACKY2.HI` and `WACKY.DTT` from the game directory (DOS delete). The installed folder holds `WACKY1.TIM`, `WACKY1.HI` and `WACKY.DTT`. Read, not run.
