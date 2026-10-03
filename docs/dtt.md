# DTT — duck-shoot scores

wacky.dtt: four records, each CHAR[20] name then INT32LE score (24 bytes). Missing file regenerates from executable defaults.

## Verification notes

- [PROVEN] (`score-files`, `dtt.layout`, `score.defaults`): `WACKY.DTT` is 4 entries of 24 bytes (20-byte name field, 16 padded characters then zeros; dword score at +20), falling 16, 12, 8, 6, and is exactly the table the game's loader builds in code when the file is missing (names SHAUN, ANDY, NUGGET, RUEBEN from `obj1+0x238`).
- [STATIC] (`score.insert`): a new duck score enters at the first entry it is not below; lower entries move down.

## Sources

- [High-score formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_High_Score_Files)

Read on 2026-10-02. [Format index](README.md).

- [STATIC] (`setup.score-reset`): `SETUP.EXE`'s "Reset score tables" deletes `WACKY1.TIM`, `WACKY2.TIM`, `WACKY1.HI`, `WACKY2.HI` and `WACKY.DTT` from the game directory (DOS delete). The installed folder holds `WACKY1.TIM`, `WACKY1.HI` and `WACKY.DTT`. Read, not run.
