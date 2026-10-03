# AudioT — AdLib effect chunks

| Type | Field |
| --- | --- |
| UINT32LE | Data length N |
| UINT16LE | Priority |
| BYTE[16] | Instrument |
| UINT8 | Octave/block |
| BYTE[N] | Sound data |
| UINT8 | Terminator |
| ASCIIZ | Optional Muse name |

Instrument/data interpretation requires the linked source’s AdLib-effect reference.

## Verification notes

- [PROVEN] (`audio-bank`, `audio.bank-layout`): in the user's archive the second bank (slots 26 to 51) is a 23-byte header, N payload bytes (N = the first dword) and a 10-byte trailer; the 23 matches 4 + 2 + 16 + 1 above and the trailer matches the terminator plus the name field (a 0 byte then NUL-padded text, mostly `Default`). That the payload bytes are AdLib register data, and what priority, instrument and block are, are leads from the table above: no check reads them. The second bank has not been seen in use (`audio.mode-select`).

## Sources

- [AudioT AdLib sounds](https://moddingwiki.shikadi.net/wiki/AudioT_Format#Adlib_Sounds)

Read on 2026-10-02. [Format index](README.md).
