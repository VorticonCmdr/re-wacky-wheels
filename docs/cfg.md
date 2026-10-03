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

- [PROVEN] (`obs-race`, `cfg.read`): the game reads `wacky.cfg` as three consecutive pieces after requiring a size of 0xada (2778) bytes: file offsets 0 to 0x491 go to obj2+0x1ee1c, 0x492 to 0x4a9 to obj2+0x1b6d8 and 0x4aa to 0xad9 to obj2+0x17128. In a running race the memory equals the installed file except six 16-byte blocks (file offsets 0x30, 0x86a, 0x87a, 0x89a, 0x8aa, 0x8ba) that the game writes at run time; those lie among the saved-game fields in the table above (a lead, not a claim). After the reads the game compares the word at file offset 0x7b2 with 0xfa; all installed files hold 0xfa there.
- [STATIC] The sound mode used by the audio loader is the dword at file offset 0x786 (obj2+0x17404). The three installed variants (root, `SB16/`, `SC55/`) all hold 0 there; values tried by hand in the DOSBox run copy gave: 1 "MVSOUND.SYS not loaded.", 2 to 4 "Invalid Sound Fx device.", 5 "UltraSound card not found", 6 "Could not detect Sound Source.", 7 start with the AudioT bank loaded (2026-10-03, leads); `SB16/` is byte-identical to the root file and `SC55/` differs at 0x78a, 0x792, 0x7a2 and 0x7a3 (what those mean is not established; `UNKNOWN_AUDIO_MODE_VALUES`).
- [STATIC] (`audio.device-gate`): the start-up calls the sound library's check with this dword, then its init; both reject 2 and every value above 7, and the init also rejects 3 and 4 (the DOSBox run printed "Invalid Sound Fx device." for 2, 3 and 4); whether the bank loader runs before the check is not read. The 11 direct references to the dword in `WW.EXE` are 9 compares and 2 loads, none a store. 7 is the PC-speaker player (`audio.speaker-state`).
- [PROVEN] (`obs-gate`, `audio.device-gate-run`): execute breakpoints on the library routines, armed in protected mode, show that with mode 2 the check runs and rejects it and the init, the bank-load routine and the bank loader never run, and with mode 3 the check passes, the init runs and rejects it, and again the bank-load routine and loader never run. The library's device word equalled the mode each time. So the second-bank path (mode 2) is not reachable in the shipped `WW.EXE` with an unmodified sound library check; mode 4 shares the init's rejection with mode 3 in the table but was not run.
- [STATIC] (`audio.device-numbers`, read in `SETUP.EXE`): the dword at file offset 0x786 is the sound-effects device and the one at 0x78a the music device; both take the position in `SETUP.EXE`'s card list: 0 Sound Blaster, 1 Pro AudioSpectrum, 2 Adlib, 3 General midi, 4 WaveBlaster, 5 Gravis UltraSound, 6 Sound Source, 7 PC speaker; -1 is none. Words 0x78e and 0x792 pair with them and are not read.
- [STATIC] (`setup.race-options`, read in `SETUP.EXE`): file offset 0x3c is the full-screen detail level (1 high, 2 medium, 3 low) and 0x3e the engine choice (1 is the 12 horsepower engines, `VEL.TAB`; 2 the 6 horsepower engines, `VEL2.TAB`); the game copies them to `obj2+0x28c20` and `obj2+0x1ea58`.
- [STATIC] (`setup.sound-options`, read in `SETUP.EXE` and `WW.EXE`): after the device words come the number of voices (file offset 0x796: 2, 4, 6 or 8, default 4), the mixing bits (0x79a: 8 or 16, default 8), a word 0x79e (default 1, not read by the game), the MIDI address (0x7a2, 0 unless a General MIDI port was chosen; the SC55 copy holds 816 = 0x330) and the MIDI menu position (0x7a6, default 7). The game passes voices, mixing bits and the effects device to the sound library's init and the music device and MIDI address to its music init. All three installed files hold 8 voices and 16 bits.
- [STATIC] (`setup.volume-detail`, read in `SETUP.EXE` and `WW.EXE`): file offset 0x7aa is the sound-effects volume (default 240), 0x7ae the music volume (250), 0x85c the engine sound volume (default 100; the installed files hold 115) and 0x860 the split-screen detail level (1 high, 2 medium, 3 low); the low word of the dword at 0x7b2 must be 0xfa (a version stamp).
- So far the settings words of the third piece are 0x786 to 0x7b2, the key names 0x7b4 to 0x85b and 0x85c to 0x860 (not 0x862 and 0x864, default 0, unread); 0x4aa to 0x785 hold the modem and serial settings (see the `cfg.modem-defaults` line); the second piece is the key table; the saved-game words (0x866 onward) are the table above.
- [PROVEN] (`cfg-keys`, `cfg.default-keys`): the second piece the game reads (file offset 0x492, 0x18 bytes) is the key table, six 16-bit PC scancodes per player: player 1 `0x4b 0x4d 0x38 0x1d 0x50 0x39` (Left, Right, Alt, Ctrl, Down, Space), player 2 `0x20 0x21 0x1e 0x1f 0x22 0x23` (D, F, A, S, G, H), in all three installed files; the order is `SETUP.EXE`'s key menu order.
- [PROVEN] (`cfg-key-names`, `cfg.key-names`): from file offset 0x7b4 the third piece holds twelve 14-byte entries (NUL-padded) with the name of each key word: `LEFT CURSOR`, `RIGHT CURSOR`, `ALT`, `CTRL`, `DOWN CURSOR`, `SPACE`, `D`, `F`, `A`, `S`, `G`, `H`, matching the names `SETUP.EXE`'s key table builder gives those scancodes (decoded from its instruction bytes). The version word at 0x7b2 is the two bytes before them.
- [PROVEN] (`cfg-modem`, `cfg.modem-defaults`): the modem and serial words that `SETUP.EXE`'s defaults routines store (24 dwords and 10 strings) are in all three installed files at the stored address minus 0x7c56: baud values 0x2580, 0x4b00, 0x9600, 0xe100 and 0x1c200 (0x4c2 to 0x4d2), flags at 0x4f6 and 0x4fa, four 12-byte COM records from 0x5ca (number, port, interrupt: 1/0x3f8/4, 2/0x2f8/3, 3/0x3e8/4, 4/0x2e8/3), the dial prefix `ATDT` (0x53e), the hang-up string `AT Z H0` (0x57e), the serial link entry `SERIAL`/`LINK` (0x60a, 0x620) and six `BLANK` phone book entries of 0x30 bytes (0x63a to 0x72a), and 0x2580 at 0x960. The modem init string at 0x4fe is the user's (`AT &F &C1 &D1 &K0 &Q6 S36=3`), not SETUP's default `AT &F &K0 %C0`. What each word means is a lead from SETUP's menus.
- [STATIC] (`input.buttons`): words 2 to 5 of a key table are buttons 1 to 4 (accelerate, fire, brake, hand brake turn) in the words `obj2+0x28b40` to `+0x28b46`; the game port 0x201 sets the same words.
- [STATIC] (`input.joystick`): the first piece's words 0x1c to 0x26 are player 1's stick calibration (centre x and y, left, right, up and down thresholds) and 0x2e the player 1 "use the joystick" flag; the third piece's 0x4b2 to 0x4bc are player 2's calibration, 0x4ae its "use the keyboard" flag, 0x4aa and 0x4ac the two "4 button pad" flags and 0x862 and 0x864 the "DOWN as brake, UP as hand brake turn" options. All installed files hold 0 except 0x4ae (1): both players use the keyboard.
- [STATIC] (`setup.joystick-calibration`): `SETUP.EXE` makes those words from three positions the player holds the stick at (centre, top left, bottom right): the centre is twice the centre counts and each threshold half the distance from the centre to its extreme in those doubled units.
- [STATIC] (`input.key-handler`, `input.steer-flags`): the keyboard interrupt writes 1 or 0 to the high byte of the key table word whose low byte is the scancode (a code above 0x52 is a release); key table words 0 and 1 of player 1 are the steering keys, left subtracting from the heading and right adding to it, right winning when both are down.
- [PROVEN] (`obs-keys`, `input.key-state`, records `keys-1` to `keys-7`): holding Left, Right, Alt+Ctrl+Space+Down, D+F+A+S+G+H, Up and Enter+F10 in the running game set the high byte of exactly those key table words (1 while held), the last-code byte and the five fixed flag bytes as `input.key-handler` says, and releasing everything cleared them and left the release code (`0xc4`) in the last-code byte.
- [STATIC] (`demo.input-byte`): in a recorded demo the controls come from one byte (`obj2+0x28cef`: left 1, right 2, accelerate 4, fire 8, brake 0x10, hand brake turn 0x20), which overrides the keyboard; the steering bytes could therefore not be observed through keys in the attract-mode demo.
- [PROVEN] (experiment, `obs-cmdline`, `cmdline.words`): `WW.EXE` also reads command-line words, case-insensitively: `TURBO`, `JUMP`, `HOG`, `ICE` and `FIRE` set bits 1, 2, 4, 8 and 0x10 of one mask, `NOW` sets a flag, `/2` and `/3` set a class word to 6 and 0 (the last one wins; `/1` sets 12, the default, `cmdline.class-one`) and `/DEBUG` sets a debug word. There is no word that chooses a track. What the bits and the class word do is not established.

Source discrepancy: horsepower/pack offsets are two bytes apart, conflicting with the blanket INT32LE description. Confirm field widths before writing; a four-byte write could overlap the adjacent setting.

## Sources

- [Configuration format](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Configuration_Format)

Read on 2026-10-02. [Format index](README.md).
