# Wacky Wheels file-format references

One reference per extension, distinct named layout, or embedded sound format listed by [ModdingWiki](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels). These are concise technical summaries; linked sources contain additional detail.

Read on 2026-10-02. UINT/INT specify unsigned/signed integer widths; LE/BE specify byte order. Binary sizes derived from the documented fields are arithmetic deductions. Unknown fields and source inconsistencies are explicitly marked.

Local observations refer to `game/WackyWhe/WACKY/WACKY.DAT` in this installation. They establish sizes/bytes only, not behavior in the running game. No game files were modified.

| Reference | File format |
| --- | --- |
| [dat.md](dat.md) | DAT — WACKY.DAT archive |
| [gam.md](gam.md) | GAM — track configuration |
| [m.md](m.md) | M — track surface |
| [pos.md](pos.md) | POS — wrong-way grid |
| [rd.md](rd.md) | RD — computer-driver route |
| [sin.md](sin.md) | SIN — tile properties |
| [spw.md](spw.md) | SPW — object placement |
| [atr.md](atr.md) | ATR — sprite catalogue |
| [sp.md](sp.md) | SP — raw sprites |
| [par.md](par.md) | PAR — horizon images |
| [pcx.md](pcx.md) | PCX — indexed graphics |
| [bmc.md](bmc.md) | BMC — demo controls |
| [bin.md](bin.md) | BIN — B800 exit screens |
| [audiohed-fx.md](audiohed-fx.md) | FX — AUDIOHED offset table |
| [audiot-fx.md](audiot-fx.md) | FX — AUDIOT sound archive |
| [pc-speaker.md](pc-speaker.md) | AudioT — PC-speaker chunks |
| [adlib-sfx.md](adlib-sfx.md) | AudioT — AdLib effect chunks |
| [klm.md](klm.md) | KLM — AdLib music |
| [mid.md](mid.md) | MID — Standard MIDI music |
| [voc.md](voc.md) | VOC — digitized effects |
| [hi.md](hi.md) | HI — race high scores |
| [htt.md](htt.md) | HTT — default race scores |
| [dtt.md](dtt.md) | DTT — duck-shoot scores |
| [tim.md](tim.md) | TIM — time-trial records |
| [ott.md](ott.md) | OTT — default trial records |
| [cfg.md](cfg.md) | CFG — settings and saved games |
| [ndist.md](ndist.md) | NDIST — projection table |
| [slp.md](slp.md) | SLP — visibility table |
| [view.md](view.md) | VIEW — apparent-distance table |
| [trig-dat.md](trig-dat.md) | TRIG.DAT — circular lookup |
| [ing.md](ing.md) | ING — WACKY.ING auxiliary data |
| [mov.md](mov.md) | MOV — devil motion |
| [tab.md](tab.md) | TAB — acceleration curves |
| [inf.md](inf.md) | INF — unknown sprite metadata |
| [sdx.md](sdx.md) | SDX — WACKY.SDX particle data |
| [xy.md](xy.md) | XY — MAP.XY minimap lookup |
| [surfaces.md](surfaces.md) | Terrain values and their `WACKY.SDX` slowdown and slide fields, from the archive |
| [driving-model.md](driving-model.md) | The player's driving model as read from `WW.EXE` (frame order, view, throttle and speed, movement, collisions, object kinds) |
| [test-play.md](test-play.md) | Test-playing the original through the DOSBox bridge, and the jev model as a judge (needs the user's API key) |

## Coverage and attribution

HTT/HI and OTT/TIM share layouts; each extension has its own entry. The FX container, its offset table, and its two embedded effect layouts have separate references. DAT is distinguished from the unrelated TRIG.DAT table. Extensionless NDIST, SLP, and VIEW are included. Executables and unrelated distribution files are outside the wiki’s format inventory.

The wiki credits Phil Carter and Klas Arvidsson for track/BMC reverse engineering, and Malvineous for KLM. Source links in every entry preserve attribution and allow checking incomplete details.

The page's own features that the game does not have are described apart from the formats: [comm-bat.md](comm-bat.md) (COMM-BAT PLAY over WebRTC) and [enhancements.md](enhancements.md) (the graphics roadmap; its first milestone, the Enhanced preset, the display options with the CRT look, Stage 3's track atmospheres with clouds, a far range, moving water and lighting with relief, and the HUD layer are in the playtest page, the asset garage and the track editor).
