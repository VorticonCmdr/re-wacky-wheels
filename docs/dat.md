# DAT — WACKY.DAT archive

Most game assets reside in this uncompressed archive. It has no magic signature, encryption, or subdirectories.

## Layout

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | UINT16LE | File count N |
| 2 | Entry[N] | Directory |

Each directory entry occupies 22 bytes:

| Relative offset | Type | Meaning |
| --- | --- | --- |
| 0 | BYTE[14] | Null-padded DOS filename |
| 14 | UINT32LE | Payload size |
| 18 | UINT32LE | Stored offset |

The actual payload position is `stored_offset + 2`, relative to the archive start. Directory filenames use DOS 8.3 names, including the dot. Entries can theoretically share payloads; gaps can contain unreferenced data.

## Reading and editing

Check directory bounds, ASCII filenames, and payload ranges. Repack modified assets into WACKY.DAT: the game does not prefer loose files in its working directory. Recompute sizes and offsets when payload lengths change. The pre-release archive was called WACKY.LID.

## Verification notes

Local observation: the supplied WACKY.DAT has 577 directory entries; all declared payload ranges fit within the archive.

## Sources

- [DAT format](https://moddingwiki.shikadi.net/wiki/DAT_Format_(Wacky_Wheels))

Read on 2026-10-02. [Format index](README.md).
