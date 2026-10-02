# BMC — demo controls

Demo-driving macro, stored as numbered BMC members in WACKY.DAT.

## Layout

UINT16LE record count, followed by three-byte records:

| Relative offset | Type | Field |
| --- | --- | --- |
| 0 | INT16LE | Duration |
| 2 | UINT8 | Action bitfield |

Duration 0x100 is approximately 23 seconds. Values ≤0 behave like 1; maximum positive duration is 0x7FFF.

| Bit | Action |
| --- | --- |
| 0x01 | Left |
| 0x02 | Right |
| 0x04 | Accelerate |
| 0x08 | Fire |
| 0x10 | Brake |
| 0x20 | Handbrake |
| 0x40 | End/restart sequence |
| 0x80 | Unknown |

Combine compatible bits; 0x22 performs a right handbrake turn. End with 0x40 to avoid playback continuing into unrelated previously loaded actions. The documented demo files are tracks 1–5 and 7. Jump/turbo combinations are not documented as supported.

## Sources

- [BMC format](https://moddingwiki.shikadi.net/wiki/BMC_Format)

Read on 2026-10-02. [Format index](README.md).
