# FX — AUDIOT sound archive

`AUDIOT.FX` stores uncompressed, unnamed chunks; [AUDIOHED](audiohed-fx.md) supplies boundaries. Evidence tags as in [evidence.md](evidence.md).

## Verification notes

- [PROVEN] (`audio-bank`, `audio.bank-layout`): in the user's archive the file is 3109 bytes. Slots 0 to 25 are a 6-byte header (the first dword is the payload length), that many payload bytes and one trailing 0 byte; slots 26 to 51 are a 23-byte header (first dword the payload length), that many payload bytes and a 10-byte trailer that starts with a 0 byte and holds NUL-padded text (mostly `Default`; `ALIEN2`, `B1..NC01` and `ALTOSAX` also occur). The last chunk of each bank (slots 25 and 51) has the 4 bytes `!ID!` after its trailer, and the file ends with one more `!ID!` that no slot owns. The check tells this split from the equal-total alternatives (7+0, 5+2, 33+0, 22+11, ...): the trailer is never payload. The header bytes after the length dword and the trailer text are unexplained ([UNKNOWN] `UNKNOWN_AUDIO_CHUNK_FIELDS`). A strict parser is `src/formats/audio-bank.js`. This confirms the 6 and 23 header sizes of the legacy `parseAudioT` (which did not know the trailers).
- [PROVEN] (`obs-audio`) With sound mode 7 the game holds the whole file in memory and uses slots 0 to 25 of it (`audio.load`); see [AUDIOHED](audiohed-fx.md). The second bank (slots 26 to 51) has not been seen in use: mode 2 is refused by the game's device check in the DOSBox run.
- Lead only (ModdingWiki): the first bank is [PC-speaker](pc-speaker.md) and the second [AdLib](adlib-sfx.md) data, with corresponding indices. The loader's choice of slot 26 for mode 2 and 0 for mode 7 does not by itself say which device either is.

## Sources

- [AudioT format](https://moddingwiki.shikadi.net/wiki/AudioT_Format)
- [Music and sound effects](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Music_and_Sound_Effects)

Read on 2026-10-02, verified 2026-10-03. [Format index](README.md).
