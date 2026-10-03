# FX — AUDIOHED offset table

`AUDIOHED.FX` holds UINT32LE offsets into [AUDIOT](audiot-fx.md). N+1 offsets describe N slots; `size[i]=offset[i+1]-offset[i]` for slots 0 to 51. Evidence tags as in [evidence.md](evidence.md).

## Verification notes

- [PROVEN] (`audio-bank`, `audio.bank-layout`): in the user's archive the file is 79 dwords, i.e. 78 slots. Slots 0 to 25 and 26 to 51 hold sounds and tile `AUDIOT.FX` from 0 without gaps; slots 52 to 77 are empty (all offsets equal to the end of slot 51). **The last offset (index 78) is not the end of slot 77**: it is 4 bytes *before* slot 52's offset, at the `!ID!` tag that ends slot 51, so subtracting offsets gives −4 for slot 77. This is why the legacy `parseAudioT` skips out-of-order offsets.
- [PROVEN] (observed with `WACKY.CFG` sound mode 7, `obs-audio`, `audio.load`, `audio.alias`): the loader `FUN_00011f98` reads both files, keeps `AUDIOT.FX` whole in a buffer (address at obj2+0x1eb14; the live buffer equals the archive member) and builds 26 records of 0x18 bytes at obj2+0x1a9c8: pointer = buffer + the slot's offset, length = the chunk's first dword, priority 27 − k. Records 0 to 7 then take record 20's pointer and length (the empty slots 0 to 7 are never played from their own chunks). It does not read slots 26 to 77 in this mode; other readers of the buffer were not traced. The code frees the header buffer after the records are built (the call at obj1+0x211a); that it is gone from live memory is not checked.
- [STATIC] (`audio.mode-select`, `audio.record-init`): the loader is only called for mode 7 or 2 (obj2+0x17404, file offset 0x786 of `WACKY.CFG`) and takes slots 26 to 51 for mode 2. Mode 2 was refused by the game's device check ("Invalid Sound Fx device.", 2026-10-03), so that path has not run.
- The earlier note that 25 of the 78 slots are empty counted slots 52 to 76 (size 0); slot 77 subtracts to −4. Slots 0 to 7 and 26 to 33 are not empty by byte size (they have headers) but carry a zero-length payload. The overview's claim of 54 unnamed files does not describe this file.

Open: [TODO.md](TODO.md) (`UNKNOWN_AUDIO_MODE_VALUES`).

## Sources

- [AudioT format](https://moddingwiki.shikadi.net/wiki/AudioT_Format) (lead only; its three banks are PC speaker, AdLib and tags, the file here has two banks of sounds and an empty third)

Read on 2026-10-02, verified 2026-10-03. [Format index](README.md).
