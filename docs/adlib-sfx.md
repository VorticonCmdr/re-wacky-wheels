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

## Sources

- [AudioT AdLib sounds](https://moddingwiki.shikadi.net/wiki/AudioT_Format#Adlib_Sounds)

Read on 2026-10-02. [Format index](README.md).
