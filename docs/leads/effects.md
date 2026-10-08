<!-- WF: output of a subagent's read of the disassembly on 2026-10-04 (analysis/ww/obj1.asm, obj1.bin, obj2.bin, plus the user's WACKY.DAT members read with a script for file-data tables); a lead, not evidence. The maintainer has not re-read it. Nothing here was run in DOSBox. Citations are instruction offsets in obj1 written (obj1+0x...) ; they are not fingerprinted with `npm run cite`. -->

# Special-effect sprites in the race: loaders, cuts, draw sites (WF lead, 2026-10-04)

Tag for everything below: **WF**. Method: grep and read of `analysis/ww/obj1.asm`; data-object addresses written `[0x...]` or `obj2+0x...`; file-data facts (WACKY.SDX, EFFECTS.SP, the INF files, SPRITE.ATR) were read from the user's archive and are labelled "file data". Picture content is described in words only, no pixels are reproduced here, and descriptions of what a picture looks like are my own reading (inferred), never authoritative. A bare `(obj1+0x1234)` names the instruction(s) the statement was read from; `a..b` is a range that was read through. "Inferred" marks a meaning concluded from usage.

Three results change what earlier notes say, so they come first:

1. **AJ.SP and PUF.SP are not dust puffs.** They are driver car files (four 38 x 28 frames each, cut by the start-up loader and used as driver pictures), see section 10. The wheel puffs and splashes are pieces of **EFFECTS.SP**, selected per surface through **WACKY.SDX**, see section 2.
2. **EFFECTS.SP is not "28 frames" of explosions or an ice cube.** It is 23 pieces (file data: tiled exactly, 0..29836, no gap) of 20 x 12 and 10 x 9 puffs, a 12 x 24 splash, a 38 x 28 x 4 bubble set and a 32 x 24 x 8 set, each picked through the 30 records of WACKY.SDX (section 2).
3. **HOGMIS.SP is cut differently from docs/leads/pickups.md section 2**: three of its 4-frame blocks are not shots; they are drawn twice at the lower rear of the player's own car by obj1+0x14afc. I read them as exhaust puffs and flames (inferred); docs/leads/fire-items.md reads the same blocks as the car's "rear wheels" (section 6.4 and 14).

## 0. Summary

| Member (bytes) | Buffer (obj2) | Cut | What it holds | Drawn in a race by | Single-player race, human car |
| --- | --- | --- | --- | --- | --- |
| EFFECTS.SP (29836) | `[0x1d820]` (running cursor `[0x1d80c]`) | by WACKY.SDX record: 23 pieces | wheel dust, splash, bubble set, pit overlay | obj1+0x14e5f..0x1527d (via 0x14bcc), obj1+0x16ad2..0x16b89 | yes |
| SPARK.SP (360) | `[0x1eb38]` | 4 frames of 10 x 9 (90 bytes) | sparks at the car's side | obj1+0x152f2..0x153ae | yes |
| CRACK.SP (5208) | `[0x1eb1c]` | one picture 84 x 62 | cracked-surface picture (inferred look), plus 7 drawn lines | obj1+0x12034 (called at obj1+0x1fc75) | yes, after a single-player crash |
| HOGMIS.SP (6084) | `[0x1d748]` and 10 pointers | 26 pictures of 18 x 13 (234 bytes) | shot pictures, explosion, and three 4-frame blocks at the player's car rear (read as exhaust, inferred) | obj1+0x1632c, obj1+0x14afc | yes (rear pictures, own shots) |
| GENEF.SP (14692) | `[0x1eb50]` | 6 x (28x23), 3 x (15x13), 8 x (38x28), 2 x (28x11), 12x13, 11 digits 7x9, 19x14 | starter lion, wreck frames, tyre pictures, timer digits, results pictures | obj1+0x166a8, 0x155d4, 0x16a3c, 0x14bcc | yes (lion, tyre pictures, digits) |
| DOPE.SP (11895) | `[0x1ea90]` (shared with GIGGLES) | 2 x (80x72) + 25 x 15 | the "dope" face and a speech bubble | obj1+0x3858 (called at obj1+0x1fc49) | only by a key-hold trigger |
| HANDLE.SP (3680) | `[0x1d6cc]` | 8 frames of 20 x 23 | menu selection icons | obj1+0x55c0 (menus, in-race Esc menu) | not in the race scene |
| ACTION.SP (1506) | `[0xa980]` (scratch) | one picture 251 x 6 | scaled text strip of the start-up sequence | obj1+0x243a0 (from obj1+0x248f4) | not in the race |
| AJ.SP / PUF.SP (4256 each) | `[0x1d70c]` / `[0x1d6c4]` | 4 frames of 38 x 28 each | driver car files | menus, HUD driver picture | see section 10 |
| ICONS.SP, LAP.SP, GIGGLES.SP, OFONT.SP, WFONT1.SP | see section 12 | | HUD and text | HUD routines (docs/leads/hud.md) | HUD |
| 38X28.INF ... 18X13.INF, 251X6.INF | INF data from `[0x1d844]` (inside the buffer `[0x1d750]`), pointers obj2+0xe470.. | 10 size classes each | scale tables for the scaled blitter | obj1+0x27487 | all scaled pictures |

## 1. Machinery the draws share

### 1.1 Start-up loader and buffers

- Every start-up member below is opened by name with `mov eax,name` then the routine obj1+0x418c, and read with obj1+0x32c68 (eax = buffer, edx = bytes, ecx = the file handle `[0x1d584]`) (obj1+0x3a74..0x3c37, obj1+0x36f8..0x3844).
- Loader sites (name offset in obj2, bytes read, buffer pointer variable): GIGGLES.SP 0x298, 0xb6e0, `[0x1ea90]` (obj1+0x36fb, buffer at obj1+0x370f); DOPE.SP 0x2b0, 0x2e77, `[0x1ea90]` (obj1+0x378c, buffer obj1+0x37a0); WFONT1.SP 0x2c4, 0x1ffe, `[0x1d6c0]` (obj1+0x3a7c); AJ.SP 0x2d0, 0x10a0, `[0x1d70c]` (obj1+0x3aa0); PUF.SP 0x2d8, 0x10a0, `[0x1d6c4]` (obj1+0x3ac4); HANDLE.SP 0x2e0, 0xe60, `[0x1d6cc]` (obj1+0x3ae8); LAP.SP 0x2ec, 0x4c56, `[0x1d834]` (obj1+0x3b0c); HOGMIS.SP 0x2f4, 0x17c4, `[0x1d748]` (obj1+0x3b30); SPARK.SP 0x300, 0x168, `[0x1eb38]` (obj1+0x3b54); OFONT.SP 0x30c, three consecutive reads of 0xf40 into `[0x1d6bc]`, 0xebc into `[0x1ea7c]`, 0x2240 into `[0x1d6d4]` (obj1+0x3b78, reads at obj1+0x3b82, 0x3ba6, 0x3bc0; the three sizes add up to 16444, the member size, file data); GENEF.SP 0x318, 0x3964, `[0x1eb50]` (obj1+0x3bd0); CRACK.SP 0x324, 0x1458, `[0x1eb1c]` (obj1+0x3bf4); ICONS.SP 0x330, 0x15c6, `[0x1ea88]` (obj1+0x3c18).
- The buffers are allocated once by obj1+0x236c8 with the same sizes: `[0x1eb1c]` 0x1458 (obj1+0x23c76), `[0x1ea88]` 0x15c6 (obj1+0x23bf0), `[0x1d748]` 0x1900, larger than the member's 0x17c4 (obj1+0x23c33), `[0x1d6c0]` 0x1ffe (obj1+0x23e45), `[0x1d6bc]` 0xf40 (obj1+0x23e88), `[0x1d6d4]` 0x2240 (obj1+0x23ecb), `[0x1ea90]` 0xb6e0 (obj1+0x23f0e), `[0x1ea7c]` 0xebc (obj1+0x23f51), `[0x1d70c]` and `[0x1d6c4]` 0x10a0 (obj1+0x23f94, 0x23fd7), `[0x1d6cc]` 0xe60 (obj1+0x2401a), `[0x1d834]` 0x4c56 (obj1+0x2405d), `[0x1eb38]` 0x168 (obj1+0x240a0), `[0x1eb50]` 0x3964 (obj1+0x240e3), the 80000-byte scratch `[0xa980]` 0x13880 (obj1+0x23bad).
- ACTION.SP is read later, by the INF loader obj1+0x18038 (name 0x1590, 0x5e2 bytes, into the scratch buffer `[0xa980]`) (obj1+0x1805b..0x1807c). EFFECTS.SP is opened by obj1+0x1754c at race load (name 0x1554) (obj1+0x1758b).

### 1.2 The race frame, ticks and mode gates

- One race-loop iteration (loop top obj1+0x21021) first draws the current player's scene through obj1+0x18998 once (obj1+0x210b2, guarded by the word `[0x1ed6c]` at obj1+0x2108b), then calls obj1+0x1f794 (obj1+0x210c0), which advances the tyre-effect state machine (obj1+0x1f7aa..0x1f919), draws the second player's scene in two-player modes, then the HUD (obj1+0x1fb6e), the DOPE overlay and the crack, and ends with obj1+0x161fc (obj1+0x1fb73). It then waits until `[0x1e720] - [0x1e724]` reaches the limit word `[0x1ea5c]` (obj1+0x21108..0x2111c), increments the race tick word `[0x1ec64]` (obj1+0x2114c), runs input and the logic, and updates the shots with obj1+0x1602c (obj1+0x227a0).
- **"Tick" or "frame" in this document means one iteration of that loop** (the `[0x1ec64]` increment at obj1+0x2114c). Every counter below is advanced either once per loop (calls of obj1+0x153d8, obj1+0x161fc, obj1+0x1602c, obj1+0x3858) or by comparing `[0x1ec64]` differences. The wall-clock length of a tick is the frame limiter `[0x1ea5c]` in 136 Hz units (`[0x1e720]`, docs `race.start-rules`); it was not traced here.
- Scene order of obj1+0x18998: floor and sky obj1+0x187ec, racers into the entry list obj1+0x155d4, map objects obj1+0x15a78, the player's own car obj1+0x16a3c, the starter obj1+0x166a8 (only while `[0x28c38]` is set), the shots obj1+0x1632c, then the sorted draw obj1+0x153d8 (obj1+0x189b4..0x189e4; the same sequence is at obj1+0x1f75a..0x1f78a in the link or demo frame obj1+0x1f4a8 and at obj1+0x1f9f5..0x1fa27 for the second player inside obj1+0x1f794).
- Mode words (read as used, see docs/leads/menus.md for how they are set): `[0x28bdc]` nonzero is the two-player race, `[0x28be2]` the two-player shoot-out, `[0x1ec74]` a linked game. "Single-player race" below means all three are 0. `[0x28be0]` is the active flag of the player whose scene is being drawn (`[0x1eb80 + 2 * [0x28b7e]]`) (obj1+0x153de..0x153f7); `[0x28b7e]` is the player index. The second player is drawn `[0x1ed30]` rows higher (0x64, stored at obj1+0x799c) in the two-player modes (e.g. obj1+0x14c33..0x14c48).
- `[0x28c44]` is the starter mode: 0 waiting, 1 counting, 2 racing (docs `race.start-rules`; set to 2 by obj1+0x166e5 or at load, obj1+0x20172).

### 1.3 The draw entry list

- The scene routines append 0x28-byte entries after the base 0x19a28 (obj1+0x189aa). Fields as written: +0 width, +2 height, +4 x, +6 y, +8 pointer into an INF size table (after its header), +0xc frame pointer, +0x10 distance key, +0x14 byte skip for the clipped bottom rows, +0x18 racer or player index (-1 for statics), +0x1c contact flag (a racer's word +2 or a map record's word +2, set by the contact tests elsewhere and cleared each frame by obj1+0x161fc: obj1+0x159ea, obj1+0x15dde, obj1+0x1622a, obj1+0x162cc), +0x1e row relation (1, 2 or 3), +0x20 side zone (3, 4, 5), +0x22 object index, +0x24 kind (0 the player's own car, 1 a racer, -1 a map object or shot or starter) (statics obj1+0x15dc2..0x15e43, racers obj1+0x159d4..0x15a42, shots obj1+0x16603..0x1667b, starter obj1+0x169b7..0x16a30, player obj1+0x16e4d..0x16eb6).
- obj1+0x153d8 sorts the entries by the +0x10 key (obj1+0x15430..0x15484, swap routine obj1+0x26f8c), runs the contact pass obj1+0x12bf4 (obj1+0x15486), and draws them in order: the entry whose index equals `[0x28c12]` (the player's own, found at obj1+0x12c34..0x12c64) goes to obj1+0x14bcc (obj1+0x154b0), every other entry is drawn with the scaled blit obj1+0x27487 (obj1+0x15580..0x15585) when `[0x28be0]` is set (obj1+0x154ba).
- The player's own entry has the key 0x7c (obj1+0x16e6c), width and height from the INF table of size class 0, x = 0xa0 - width / 2 (obj1+0x16dc1..0x16dcf; 141 for the 38-wide car, which equals the literal 0x8d at obj1+0x14d49) and y = the row word `[0xbdf8]` minus the height (obj1+0x16b14, obj1+0x16d77); `[0xbdf8]` is filled at run time and reads 0 in obj2.bin, the existing claim `view.player-car-draw` (docs/leads/player-anim.md) gives it as 193 (the row-table entry for distance 0x7c), so the 28-row car's top row would be 165 (not re-derived here). The literal row 0xa8 (168) used by the pit overlay (section 2.4) is a separate constant, 3 rows lower. While the car moves and the race is on (`[0x28c44]` = 2) the y is one row less every other frame (car word +0x68 toggles, obj1+0x16d8c..0x16dbb): the car jiggles by one row. Everything the effect code below draws "relative to the entry" follows that.
- Hop: car word +0xa is 1 while rising (+0x10 grows by 8 a frame up to +0xe, 0x28 at hop start obj1+0x142f3), 2 while falling (+0x10 shrinks by 8), 3 for one frame on landing (obj1+0x14c61..0x14cb8, obj1+0x153be); the car's drawn y is reduced by +0x10 rows while it is in the air, i.e. it is drawn higher on the screen (obj1+0x14c8f..0x14ce0).

### 1.4 Blitters used by the effects

- **Transparent blit** obj1+0x26fd0 (the sp.draw routine): x = word `[0x28b32]`, y = `[0x28b34]`, columns `[0x28b36]`, rows `[0x28b26]`, source = dword `[0x1d704]`, column-major, index 0 skipped, written to page `[0x28b24]` plane by plane (obj1+0x26fd6..0x2707d).
- obj1+0x2707e is the same blit that advances the source pointer by `[0x1d878]` after every column (obj1+0x27109), used by the bottom-clipped caller **obj1+0x1404**: it shortens the row count so that the picture ends at row 0xc7, and sets `[0x1d878]` to the number of cut bytes (obj1+0x1409..0x1478).
- **Scaled blit** obj1+0x27487: source pointer `[0x1d704]`, INF table pointer `[0x1d838]`; per output column it adds one dword of the table to the source pointer before the first row and one more after every row, and reads one source byte per output pixel, skipping index 0 (obj1+0x274fd..0x2755c); with `[0x1d878]` nonzero it takes the variant that skips that many table bytes per column (obj1+0x27561..0x275c6).

### 1.5 INF size tables

- Loader obj1+0x18038 (called with eax = 1 from obj1+0x18399 in the start-up table loader obj1+0x18180, and with eax = 0 from obj1+0x2491a and obj1+0x24e95): with eax = 1 it reads ACTION.SP and the file named at obj2+0x159c (251X6.INF) as table set 0; with eax = 0 it reads six files named by the records copied at obj1+0x23847..0x238d8 from obj2+0x1bf4, 0x1c00, 0x1c0c, 0x1c18, 0x1c24, 0x1c30 with the sizes 0x519c, 0x3c28, 0x1e38, 0x3a70, 0xffc, 0x1324 (obj1+0x18056..0x18176).
- Format (file data: parsed record by record, the 10 records of each file end exactly at the member size except in 18X13.INF, whose member has 92 trailing bytes; the loader reads exactly 10 records, so those bytes are never read, and the size 0x1324 = 4900 in the name table is the figure summed for the buffer allocation, obj1+0x238de..0x23946): 10 records, each a word w (output columns), a word h (output rows), then (h + 1) x w dwords (obj1+0x180e9..0x1814f, record pointers stored at `[ebp + 4 * record + 0xe470]`, `ebp` = 0x50 per file, obj1+0x180e2). The dwords are the source-pointer increments the scaled blit adds (section 1.4).
- Sets and sizes (file data, w x h of the 10 records): set 0 38X28.INF at obj2+0xe470: 38x28, 35x26, 32x24, 29x21, 26x19, 23x17, 20x15, 17x12, 14x10, 11x8; set 1 28X28.INF at +0xe4c0: 28, 26, 24, 21, 19, 17, 15, 12, 10, 8 (square); set 2 14X28.INF at +0xe510: 14x28, 13x26, 12x24, 11x21, 10x19, 8x17, 7x15, 6x12, 5x10, 4x8; set 3 32X24.INF at +0xe560: 32x24, 29x22, 27x20, 24x18, 22x16, 19x14, 17x12, 14x11, 12x9, 9x7; set 4 15X13.INF at +0xe5b0: 15x13, 14x12, 13x11, 11x10, 10x9, 9x8, 8x7, 7x6, 5x5, 4x4; set 5 18X13.INF at +0xe600: 18x13, 17x12, 15x11, 14x10, 12x9, 11x8, 9x7, 8x6, 6x5, 5x4. 251X6.INF (set 0 during the start-up sequence): 251x6, 231x6, 211x5, 191x5, 171x4, 151x4, 131x3, 110x3, 90x2, 70x2.
- The size class used by a map object is read from the catalogue entry's word +0x0c times 0x50 (obj1+0x15c43..0x15c67); file data of SPRITE.ATR agrees (the 32 x 24 hedgehog files have 3, the 28 x 28 objects 1, the 14 x 28 objects 2). The class (0..9) of a racer, shot or starter is `clamp((distance - 0x7c) / 0x46, 0, 9)` (obj1+0x15772..0x15795, obj1+0x164ad..0x164d0). Sets 4 (15x13) and 5's non-shot uses were not traced.

### 1.6 Sound numbers the effects start

Numbers are the argument of the play routine obj1+0x1c04 (is-playing check obj1+0x1bbc). The names are those docs/leads/racer-states.md gives by VOC order (not re-derived here): 0xa START (obj1+0x166fc, GO), 0xb GLASS (the crack, obj1+0x1fc62..0x1fc70), 0xc WARP (hop start, obj1+0x142cf..0x142d4), 0xd BOOM (crash, obj1+0x133ba..0x133bf), 0xe HORN (pit state, obj1+0x16ad2..0x16aeb), 0xf SPLASH (pit entry and exit, obj1+0x14212, obj1+0x16b7f), 0x10 PLIP (the surface-5 splash, obj1+0x1516c..0x15185), 0x12 PUF (a shot ends, obj1+0x16188), 0x15 CLANG (wall or object contact, obj1+0x136f5), 0x16 SWIPE (racer contact, tyre pickup, obj1+0x136fc, obj1+0x132f2), 0x17 DROP (landing after a hop, obj1+0x14cb3..0x14ccc), 0x18 BACKFIRE (the throttle-start block of section 6.4, obj1+0x14b2f..0x14b48).

## 2. EFFECTS.SP and WACKY.SDX: wheel dust, splashes and the pit pictures

### 2.1 Loader and table

- WACKY.SDX is read by obj1+0x18180 (name obj2+0x15b0): a word count into `[0x28b7c]` (obj1+0x181ea..0x181ff), then count x 0x12e bytes to obj2+0x141f8 (obj1+0x18204..0x18221); the count is decremented afterwards (obj1+0x18279). File data: count 30, so 30 records; the record index is the **terrain value under the car** (obj1+0x1419a..0x141b4 store `[0x1e568]` in car word +0x56 and the record address 0x141f8 + `[0x1e568]` x 0x12e in car dword +0x76; docs/sdx.md already has this).
- Record layout as the code reads it (offsets from the record start, file data for the contents): +0x00..0x7f one byte per **track number** (index track - 1) for picture 1; +0x80..0xff the same for picture 2 (obj1+0x175cf, obj1+0x176c2: the bytes are tested at `0x141f7 + record*0x12e + track` and `0x14277 + ...`); +0x100 dword file offset of picture 1; +0x104 dword offset of picture 2 (obj1+0x175f7, obj1+0x176e4); +0x108 word bytes per frame of picture 1, +0x10a width, +0x10c height, +0x112 frame count (obj1+0x1761d, obj1+0x14fb6..0x14fcb, obj1+0x14f3f); +0x114, +0x116, +0x118, +0x11e the same four for picture 2 (obj1+0x15108, obj1+0x15147..0x1514e, obj1+0x150eb); +0x120 dword and +0x124 word as docs/sdx.md; +0x126 dword and +0x12a dword are **run-time pointers to the loaded pictures** (stores at obj1+0x17669, obj1+0x176ad, obj1+0x17754, obj1+0x17794). That explains docs/sdx.md's "tail rewritten at run time": the file holds zeros there (file data). The words +0x10e, +0x110 (10, 6 in a picture-1 record) and +0x11a, +0x11c (5, 4) are never read by any displacement access I found (grep over obj1.asm).
- The flag bytes are 1, 3 or 0 (file data). The loader loads a picture only where its byte is 1 (obj1+0x175cf, obj1+0x176c2); a byte of 3 means "no picture of its own, keep the last one" (draw side, section 2.3). The two flag arrays of every record are identical (file data), so for every record picture 1 and picture 2 are loaded for the same tracks. Records 2, 3, 8, 10, 23, 24, 25, 28 and 29 carry 3 on all 42 track bytes and have no pictures (offsets 0); records 0, 1, 4..7, 9, 11..22, 26, 27 carry 1 on a track-dependent subset.
- Track number `[0x1e728]`: the race number `[0x28b88]` plus 0, 5, 10, 0x15, 0x1a or 0x1f chosen by `[0x28bb6] + [0x1ecb4] - 1` (obj1+0x7a6b..0x7b52), or 7 (obj1+0x7ac6) when `[0x1ec80]` is set.
- The loader keeps a table of the offsets it has already read (41 slots for each picture, initialised to -1 at obj1+0x17558..0x17574) and reuses the pointer when two records name the same offset (obj1+0x175dd..0x17609, obj1+0x1769a..0x176ad); otherwise it seeks to the member start + offset (obj1+0x17642), reads `stride x frames` bytes to the running cursor `[0x1d80c]` (start `[0x1d820]`, obj1+0x17576..0x17586) and advances it (obj1+0x1764c..0x1768b). It is called at race load, right after the sprite-set loader obj1+0x179e8 (obj1+0x7d6a, obj1+0x7d6f).

### 2.2 The 23 pieces (file data)

The record fields name 23 distinct pieces; sorted by offset they tile 0..29836 exactly, with no gap and no overlap, and 29836 is the member's size. Sizes are from the SDX fields, not from code constants. "Pic 1/Pic 2" is which picture slot of which record (surface = terrain value) points at the piece.

| Offset | Bytes | Frames x (w x h) | Used as |
| --- | --- | --- | --- |
| 0 | 720 | 3 x (20 x 12) | surface 0 pic 1, surface 20 pic 1 |
| 720 | 270 | 3 x (10 x 9) | pic 2 of surfaces 0, 14, 16, 17, 20 |
| 990 | 720 | 3 x (20 x 12) | pic 1 of 1, 5 |
| 1710 | 270 | 3 x (10 x 9) | pic 2 of 1 |
| 1980 | 720 | 3 x (20 x 12) | pic 1 of 4, 9, 12, 27 |
| 2700 | 270 | 3 x (10 x 9) | pic 2 of 4, 9, 27 |
| 2970 | 576 | 2 x (12 x 24) | pic 2 of 5 |
| 3546 | 4256 | 4 x (38 x 28) | pic 1 of 6 |
| 7802 | 6144 | 8 x (32 x 24) | pic 2 of 6 |
| 13946 | 720 | 3 x (20 x 12) | pic 1 of 7, 19 |
| 14666 | 270 | 3 x (10 x 9) | pic 2 of 7, 19 |
| 14936 | 720 | 3 x (20 x 12) | pic 1 of 11, 13, 18 |
| 15656 | 270 | 3 x (10 x 9) | pic 2 of 11, 18 |
| 15926 | 270 | 3 x (10 x 9) | pic 2 of 12 |
| 16196 | 270 | 3 x (10 x 9) | pic 2 of 13 |
| 16466 | 720 | 3 x (20 x 12) | pic 1 of 14, 16, 17, 26 |
| 17186 | 4256 | 4 x (38 x 28) | pic 1 of 15 |
| 21442 | 6144 | 8 x (32 x 24) | pic 2 of 15 |
| 27586 | 720 | 3 x (20 x 12) | pic 1 of 21 |
| 28306 | 270 | 3 x (10 x 9) | pic 2 of 21 |
| 28576 | 720 | 3 x (20 x 12) | pic 1 of 22 |
| 29296 | 270 | 3 x (10 x 9) | pic 2 of 22 |
| 29566 | 270 | 3 x (10 x 9) | pic 2 of 26 |

In words (inferred): the 20 x 12 and 10 x 9 pieces are small dust-like puffs, the 12 x 24 pair is a splash with a drop shape, the 38 x 28 x 4 set is a field of bubbles and the 32 x 24 x 8 set shows an upright object rising out of a splash; all frames are column-major 8-bit with index 0 transparent (the blit above).

### 2.3 Draws (inside obj1+0x14bcc, the player's own entry)

All of this is drawn only for the player's own entry, only when `[0x28be0]` is set, and every picture is drawn with the transparent blit obj1+0x26fd0 (obj1+0x14ff3..0x15001, obj1+0x151ec..0x1525b). **AI cars and the other player's car in two-player modes get none of it** (their entries go to the scaled blit, section 1.3).

- **Gates** (obj1+0x14e5f..0x14e85): car word +0xa == 0 (not hopping), +0x44 == 0 (not in the pit state, section 2.4) and +0x7e == 0 (not crashed). Then the record address is taken from car dword +0x76 (obj1+0x14e8b..0x14e97).
- **Which branch**: the entry's frame pointer `[0x1d704]` (= entry +0xc, obj1+0x14c28..0x14c2e) is compared with the six dwords at `[0x1d884]` (player 0, obj2+0x10660) or `[0x1d888]` (player 1, obj2+0xe728), eight bytes apart (obj1+0x14e9c..0x14ed7). The six dwords are the player's car frames **1, 2, 3, 5, 6, 7** of its driver slot (slot record obj2+0x13c08 + slot x 0x98, frame k at +4k), each followed at +4 by a word: frame 1 -> 17 (0x11), frame 2 -> 10 (0xa), frame 3 -> 0, frame 5 -> 18 (0x12), frame 6 -> 8, frame 7 -> 1 (stored at obj1+0x7506..0x7548 and obj1+0x7560..0x7580, built once per driver by obj1+0x73c4; player 1's table is built from the other driver). A match sets `[0x28bfa]` = 1 (obj1+0x14ec2). Frames 0, 4 and 8 up to 11 are not in the table.
- **Picture selection** (both branches): if the record's flag byte for the current track (`[0x1e728]`) is 3, the cached image id car word +0x6e and cached record car dword +0x72 are used instead of the record's own (obj1+0x14ee5..0x14f08 for picture 1, obj1+0x15090..0x150b4 for picture 2); otherwise the id is the low word of the record's offset (+0x100, obj1+0x14f0a; +0x104, obj1+0x150b6). If the id differs from the cached one the frame counter car word +0x7a is reset to 0 and frame 0 (pointer record +0x126, or +0x12a) is shown (obj1+0x14f1e..0x14f2f, obj1+0x150ca..0x150db); if it is the same the counter is incremented, wraps to 0 when it equals the frame count (record +0x112, or +0x11e) and the frame is pointer + counter x stride (+0x108, or +0x114) (obj1+0x14f31..0x14f6e, obj1+0x150dd..0x1511a). So the animation advances **one frame per drawn race frame**, cycling over the 3 frames, and restarts when the surface's picture changes. At the end of the draw the id (low word) and the record pointer `[0x1d89c]` that was used are stored to car +0x6e and +0x72, and the same record pointer to +0x76 (obj1+0x15260..0x1527a).
- **Nothing is drawn while the car's step word +0x26 is 0** (obj1+0x14f73..0x14f8b, obj1+0x1511f..0x15137; +0x26 is looked up from the speed word +0x42 at obj1+0x196c9..0x196d5); the counter +0x7a is reset to 0 then.
- **Branch 1, steering frames (a match)**: one picture-1 frame (20 x 12 for most records), columns = record +0x10a, rows = record +0x10c, at x = entry x + the matched word, y = entry y + 0x10 (obj1+0x14f90..0x14fcb, minus `[0x1ed30]` for the second player in the two-player modes, obj1+0x14fd1..0x14fe0). No `[0x28c44]` test: drawn from the first frame of the race.
- **Branch 2, other frames (no match)**, in this order: (a) the car-rear pictures of section 6.4 (obj1+0x15042..0x15086); (b) picture 2: columns = record +0x116, rows = record +0x118; if the rows equal 0x18 (only record 5's 12 x 24 splash) the sound 0x10 is played unless already playing (obj1+0x1516c..0x15185) and the picture is drawn twice, at (entry x + 1, entry y + 4) and 0x18 columns to the right, **only when `[0x28c44]` == 2** (obj1+0x15195..0x151f9); otherwise (the 10 x 9 puffs) it is drawn twice at (entry x, entry y + 0x14) and (entry x + 0x1c, entry y + 0x14), again only when `[0x28c44]` == 2 (obj1+0x151fb..0x15253). For the 38-wide car the two 10-wide puffs sit at the car's left and right edge near its bottom (inferred from the offsets).
- No test of braking or of the hop key was found in these draws: the trigger is a surface with a picture, car step word +0x26 != 0, on the ground, and the car frame. A hop (car +0xa != 0) suppresses all of it (obj1+0x14e6a).
- Which surfaces have which pieces is in section 2.2; the record flag bytes decide per track which surfaces have a picture loaded. The draw code does not test a flag byte of 0 (obj1+0x14ee5..0x14f0a only compares with 3); what a surface without a loaded picture does was not traced (its pointer slots are 0 in the file).

### 2.4 The pit surfaces (terrain values 6 and 0xf)

- Entry (obj1+0x141d1..0x14291, in the player move routine): when the terrain value `[0x1e568]` is 6 or 0xf (obj1+0x141d1, 0x141da) and the car is on the ground (+0xa == 0), not already in the pit state (+0x44 == 0) and not crashed (+0x7e == 0) (obj1+0x141ec..0x14207): sound 0xf (obj1+0x14212); `[0x28bd8]` = the value (obj1+0x14228); racer word +0x5c (obj2+0xaaec + racer x 0x68) = 1 and racer words +0x28, +0x2a cleared (obj1+0x14238..0x1424a); car word +0x5a = 1, +0x5c = 0, +0x5e = 0, +0x44 = 1 (obj1+0x14258..0x14271); car dword +0x60 = record +0x126 (picture 1: 4 frames of 38 x 28) and +0x64 = record +0x12a (picture 2: 8 frames of 32 x 24) (obj1+0x1427f..0x1428e).
- Overlay (obj1+0x14cec..0x14dc8): while car +0x5a != 0 and not crashed, a picture-1 frame (`[car+0x60] + [car+0x5c] x 0x428`, 38 x 28) is drawn at the literal position **(0x8d, 0xa8) = (141, 168)** (minus `[0x1ed30]` for the second player in two-player modes) (obj1+0x14d37..0x14dad); +0x5c is incremented after each draw and at 4 the word +0x5a is cleared (obj1+0x14db2..0x14dc8): **4 frames, one per race frame**. With +0x5a == 1 the car itself is not drawn while +0x5c < 2 and is drawn (scaled blit obj1+0x27487) under the overlay from +0x5c == 2; with +0x5a == 2 it is drawn throughout (obj1+0x14d02..0x14d37, obj1+0x14d22..0x14d32).
- Pit state (car +0x44 != 0), in the car routine obj1+0x16a3c: sound 0xe is started if not already playing (obj1+0x16ad2..0x16aeb); the car's picture is picture-2 frame `[car+0x64] + 0x300 x [car+0x5e]` with the size table of set 3, class 0 (`[0xe560]`, 32 x 24), frame counter +0x5e counting 0..7 and wrapping (obj1+0x16af0..0x16b2e), one frame per race frame. The state ends when the terrain value (car +0x56) differs from `[0x28bd8]` and is not 3 (obj1+0x16b34..0x16b54): then racer +0x5c = 0, car +0x44 = 0, +0x5c = 0, **+0x5a = 2** (so the 4-frame overlay plays once more) and sound 0xf (obj1+0x16b5a..0x16b84).
- In the two-player modes the other player's pit picture is drawn from that player's HUD record (words +0x846e, dword +0x8474, `[0xe560]` table) in obj1+0x15823..0x15882.
- A car that stands still on terrain value 5 is drawn 4 rows shorter and 4 rows lower (obj1+0x16e2b..0x16e4a).

## 3. SPARK.SP

- Loader and buffer: section 1.1 (`[0x1eb38]`, 0x168 = 360 bytes). **It is not cut into pointers**: the frame pointer is advanced by 0x5a (90) per frame (obj1+0x155c7). Frames are 10 columns x 9 rows (obj1+0x15384, obj1+0x1538d), so **4 frames** (360 / 90); this contradicts the viewer's curated 12 x 10 x 3 in docs/sp.md (also 360 bytes).
- State in the car record: word +0x46 (0 none, 3 left, 4 right), word +0x48 frame counter, dword +0x4a frame pointer.
- **Triggers** (all set `+0x48 = 0`, `+0x4a = [0x1eb38]`):
  - Contact with an entry whose contact flag +0x1c is set, with the player's collision word +0x7c set, which is neither a consumed pickup nor the head-on or rear-end crash (obj1+0x131d5..0x131f6, obj1+0x13441..0x1345b, jump to obj1+0x1369f): the car's words +0x3c and +0x20 are cleared and, when set, its speed word +0x42 is zeroed (obj1+0x136b2..0x136d7); sound 0x15 for a map object, 0x16 for a racer (`[0x28bf6]`, obj1+0x136eb..0x13701); the side word is taken from the entry's zone +0x20: 3 -> 3, 4 -> 3, 5 -> 4, zones 1 and 2 store nothing (obj1+0x13706..0x13772). The same code restarts the animation at every contact frame.
  - Terrain value 3 under either of two feeler points of the player move routine obj1+0x137e4: the point built from `[0x1d61c]`/`[0x1d5ec]` sets `[0x1e570]` and the one built from `[0x1d618]`/`[0x1d5e8]` sets `[0x1e56c]` (terrain lookup obj1+0x27b04, value 3 tested at obj1+0x13a39, 0x13aa6, 0x13f01, 0x13f6e). The routine has two paths: when the move line walker reports a wall (`[0x28bae]` == 1, obj1+0x138ac..0x13933) the first path runs (feelers at obj1+0x139cf..0x13aaf, sparks at obj1+0x13af6..0x13bd3), otherwise the second (feelers at obj1+0x13ea7..0x13f81, sparks at obj1+0x13fbe..0x1409b). `[0x1e570]` starts right sparks (+0x46 = 4) and `[0x1e56c]` left sparks (+0x46 = 3), each with sound 0x15, **only if +0x46 is 0** (obj1+0x13b03..0x13b30, obj1+0x13ba6..0x13bd3, obj1+0x13fcb..0x13ff8, obj1+0x1406e..0x1409b); the heading `[0x1d5d4]` is then turned by 0x12 away from the wall and the car moved one step (obj1+0x13b33..0x13b99, obj1+0x13bd6..0x13c3f, obj1+0x13ffb..0x14061, obj1+0x1409e..0x14107); in the first path the speed word +0x42 is also zeroed (obj1+0x13c3f..0x13c44).
- **Draw** (obj1+0x152f2..0x153ae, inside obj1+0x14bcc, after the tyre strips): when +0x46 != 0 and `[0x28be0]` is set: 10 x 9 frame `[car+0x4a]`, y = entry y + 0x10 (minus `[0x1ed30]` for the second player), x = entry x for +0x46 = 3, entry x + 0x1e for +0x46 = 4, otherwise entry width / 2 - 1 + entry x (never stored: nothing writes another value). Transparent blit obj1+0x26fd0.
- **Timing** (obj1+0x1559f..0x155c7, end of obj1+0x153d8, once per race frame): +0x48 is incremented; at 4 the effect stops (+0x46 = 0, +0x4a back to `[0x1eb38]`), otherwise +0x4a += 0x5a. So frame 0 is drawn in the frame the contact happened (the contact pass runs before the draws), then frames 1, 2, 3: **4 frames, one per race frame**.
- The contact pass obj1+0x12bf4 is skipped entirely while car +0x7e or `[0x28c3c]` is set (obj1+0x12c7c..0x12c94), but in the frame in which a crash starts the same pass runs on into the spark code (obj1+0x13422..0x13441, obj1+0x135fb), so a crash also starts sparks (inferred from the flow; not observed).
- Modes: all modes; the sparks are for the viewing player's own car only.

## 4. CRACK.SP and the single-player crash sequence

### 4.1 What is drawn

- Routine **obj1+0x12034**, called from the HUD tail of obj1+0x1f794 (obj1+0x1fc75). It draws the 84 x 62 picture `[0x1eb1c]` (84 x 62 = 5208 = the member size) with the transparent blit at **(0x76, 0x5a) = (118, 90)**, columns 0x54, rows 0x3e (obj1+0x12121..0x12151). It then sets the colour byte `[0x28ce9]` to 0x14 (obj1+0x1203b) and draws **7 line segments** with the line routine obj1+0x11f04 (Bresenham, arguments x1 `[0x28ba4]`, x2 `[0x28ba6]`, y1 `[0x28bc2]`, y2 `[0x28bc4]`, each pixel by obj1+0x27bf0) (obj1+0x12156..0x1221f). The stack table (obj1+0x12042..0x12119) read as (x1, x2, y1, y2):

| Seg | x1 | x2 | y1 | y2 |
| --- | --- | --- | --- | --- |
| 0 | 0x77 (119) | 0x16 (22) | 0x5f (95) | 0x29 (41) |
| 1 | 0xa8 (168) | 0xb9 (185) | 0x5a (90) | 0x35 (53) |
| 2 | 0xc6 (198) | 0xf7 (247) | 0x5d (93) | 0x2b (43) |
| 3 | 0xf7 (247) | 0x128 (296) | 0x2b (43) | 0x38 (56) |
| 4 | 0xc3 (195) | 0xf1 (241) | 0x91 (145) | 0xb2 (178) |
| 5 | 0xf1 (241) | 0xd7 (215) | 0xb2 (178) | 0xc2 (194) |
| 6 | 0x78 (120) | 0x2c (44) | 0x86 (134) | 0xa9 (169) |

(The first group is passed directly, the other six by the loop `edx` = 0x10, 0x40 with three calls each: obj1+0x12182, 0x121b2, 0x121e3, 0x12217, 0x1221c..0x1221f. The argument order x1, x2, y1, y2 is confirmed by segments 2/3 and 4/5 chaining end to start.) The lines are drawn into the current draw page every frame, after the HUD.
- **Gate** (obj1+0x1fc4e..0x1fc75): drawn when the word `[0x28c42]` is greater than 1, i.e. states 2, 3 and 4 of the crash sequence below; the first time (`[0x28c56]` == 0) sound 0xb is played and `[0x28c56]` set to 1 (obj1+0x1fc58..0x1fc70); `[0x28c56]` is cleared at race set-up (obj1+0x200e9). The code is in the part of obj1+0x1f794 that runs in every mode (it is after the second-player block, which single-player skips: obj1+0x1f923..0x1f935, 0x1fb86..0x1fb98), but `[0x28c42]` only becomes nonzero in the single-player crash:
- **Trigger of the crash sequence** (`[0x28c42]` = 1, also `[0x28c32]` = 0 and `[0x28c1a]` = the player's entry y):
  - Head-on map object (obj1+0x1334d..0x13441): kind 0 object (catalogue word +0 <= 0, obj1+0x1323d), car words +0x7e, +0xa, +0x44 all 0, `[0x28be2]`, `[0x28bdc]`, `[0x1ec74]`, `[0x1edb0]` all 0, speed word +0x42 >= 0x64, and the entry's zone +0x20 == 3 (the object's centre column within 4 of the car's, obj1+0x12d08..0x12d25): sound 0xd, car +0x7e = 1, +0x20, +0x3c, +0x18, +0x42, +0x44 cleared, `[0x28c42]` = 1 (obj1+0x133ba..0x1343b).
  - Contact with a racer entry (+0x24 > 0) at speed >= 0x64 with car +0x7e == 0 (obj1+0x13474..0x13498), where in the shoot-out and two-player modes only entries with index <= 1 count (obj1+0x134a5..0x134be) and linked or `[0x1edb0]` games never (obj1+0x134c0..0x134d4), and the other racer's frame word +0x38 (+ 2 x player) must be 0, 1 or 7 (obj1+0x134d8..0x13505): the car is not hopping and not in the pit state (obj1+0x13522..0x13532), sound 0xd, the other racer's +0x56 = 0, +2 = 2 (wrecked) and +0x58 = 0, the car's +0x7e = 1 and speed cleared (obj1+0x13538..0x1357d); `[0x28c42]` = 1 only when `[0x28be2]`, `[0x28bdc]` and `[0x1ec74]` are all 0 (obj1+0x135b5..0x135fb), otherwise the two-player reset of obj1+0x13600..0x1369f.
- **States** (the car routine obj1+0x16a3c, one step per race frame):
  - State 4 skips the car draw entirely (obj1+0x16a47..0x16a4f).
  - State 1: the car frame is taken from the eight pointers at obj2+0x1b328 (index `[0x28c32]` cycling 0..7) while `[0x28c1a]` falls by 6 per frame until it is <= 0x72 (obj1+0x16bd9..0x16c3d); then state 2, frame table obj2+0x1b2d8, `[0x1e72c]` = now.
  - State 2: held until `[0x1ec64] - [0x1e72c]` >= 0xb (11 frames) (obj1+0x16c57..0x16c89); then state 3.
  - State 3: frames from obj2+0x1b2d8 (counter up to the word `[0x28c4e]`), `[0x28c1a]` grows by 4 per frame up to 0xc7 (obj1+0x16c8b..0x16ceb); then state 4 and `[0x1e72c]` = now.
  - The picture is the car frame through the entry list at y = `[0x28c1a]` (obj1+0x16deb..0x16e29). The two tables are filled from the driver slot record at race load (obj1+0x7588..0x75e2); which driver frames they are was not traced.
  - Life lost: in state 4, when `[0x1ec64] - [0x1e72c]` >= 0xd (13 frames) and the draw page word `[0x28b24]` is 0x3e80 (obj1+0x214be) the main loop copies the page, decrements the car word +0x6c (unless `[0x1d998]`, obj1+0x214e0..0x214ee) and shows the lap or continue screen obj1+0x19e0c; with +0x6c == 0 the race ends (obj1+0x214a2..0x21507).
  - `[0x28c42]` is cleared at race set-up (obj1+0x20206). So the crack appears when the flying car reaches the top (state 2), stays through the fall and the 13-frame wait, and is gone when the race restarts.
- Modes: the crack and this sequence exist only in the single-player race (`[0x28c42]` is set to 1 only with all of `[0x28be2]`, `[0x28bdc]`, `[0x1ec74]` zero, obj1+0x13376..0x13397 and obj1+0x135b5..0x135d0). For the human car in the other modes the wreck frames of section 11 are used (obj1+0x16d19..0x16d58, only when `[0x28c42]` is 0).

## 5. Tyre stack: the strips that fly to the car, and the tyre on the car

No member of its own: the effect uses two pieces of GENEF.SP (section 11), the strips being three copies of the first: the full tyre 28 x 11 at GENEF offset 13269 (`[0x1c52c]`, obj1+0x40c8) and the tyre with a cut-out top 28 x 11 at offset 12961 (`[0x1c528]`, obj1+0x40be) (both 28 x 11 from the literals 0x1c and 0xb at obj1+0x152ac, 0x152ba, 0x14e3e, 0x14e4c). This is the visible effect `docs/leads/pickups.md` reports for the kind-1 object (`pickup.tyres-observed`).

- **Trigger** (obj1+0x132d6..0x13348): a kind-1 map object (catalogue word +0 == 1) touched while `[0x28c8c]` == 0 and `[0x28bdc]` == 0 (the two-player race flag only; `[0x28be2]` is not tested): sound 0x16, the record's word +2 = 0xffff (consumed), `[0x28c8c]` = 0xffff, the three words at obj2+0x20ae8, +0x20aea, +0x20aec = the entry's y (+6), +0x0b, +0x16, and the cached word `[0x28c9e]` = 0 (cx is zeroed at obj1+0x13338; every other store of `[0x28c9e]` in obj1+0x12bf4 writes back an unchanged cx). A new pickup therefore removes the tyre on the car.
- **State machine** `[0x28c8c]`, in obj1+0x1f794, once per race frame (obj1+0x1f7aa..0x1f919): 0xffff -> 1 (obj1+0x1f7b8..0x1f7c4);
  - state 1: word 0 (obj2+0x20ae8) -= 0x1e down to 0x72, word 1 (+0x20aea) -= 0x14 down to 0x80, word 2 (+0x20aec) -= 0xa down to 0x8e (clamped, obj1+0x1f7f8..0x1f842); when all three are at 0x72, 0x80, 0x8e -> state 2 (obj1+0x1f84b..0x1f880);
  - state 2: word 2 += 0x1e up to 0xb1, word 1 += 0x14 up to 0xc7, word 0 += 0xa up to 0xc7 (obj1+0x1f885..0x1f8d9); when word 2 equals 0xb1 the flag `[0x28c9e]` is set to 1 (obj1+0x1f8d9..0x1f8e4); when words are (0xc7, 0xc7, 0xb1) -> state 3 (obj1+0x1f8ed..0x1f905);
  - state 3 -> 0 on the next call (obj1+0x1f910).
  - Clear: `[0x28c8c]` and `[0x28c9e]` are 0 at race set-up (obj1+0x20114, obj1+0x2011d).
  - Duration: the number of frames in states 1 and 2 follows from the step sizes and the object's row (state 2 from 0x72/0x80/0x8e takes 9 frames: word 0 needs (0xc7 - 0x72) / 10 steps); state 3 is one call.
- **Strips draw** (obj1+0x15283..0x152f0, inside obj1+0x14bcc, only for `[0x28c8c]` 1, 2 or 3, not 0 or 0xffff): the 28 x 11 full-tyre picture at x = **the player's entry x + 5**, y = each of the three words in turn, with the bottom-clipped blit obj1+0x1404 (rows past 0xc7 are cut); drawn only when `[0x28be0]` is set. The three strips are three copies of the same picture.
- **Tyre on the car** (obj1+0x14ddf..0x14e5a): while `[0x28c9e]` != 0, `[0x28be0]` set, and the car is not crashed (+0x7e) nor in the pit state (+0x44): the cut-out-top 28 x 11 picture at (entry x + 5, entry y + 0xc), y reduced by the hop height `[car+0x10]` (drawn higher) while hopping (obj1+0x14e2c..0x14e3e); transparent blit. It is drawn after the car and before the ground effects. (The same drawing exists as the routine obj1+0x14a9c, which has no direct caller.)
- No gameplay effect of the strips was found (as in pickups.md); the car's speed and grip are untouched in the code read (`pickup.tyres-observed` agrees).

## 6. HOGMIS.SP

### 6.1 Cut (corrected)

- Loader section 1.1; cut at obj1+0x3d60..0x3dc4. Each pointer is stored **before** the `add` that gives its block length, so the lengths are those of the following add: 26 pictures of 0xea = 234 bytes (18 columns x 13 rows, from the literals 0x12 and 0xd at obj1+0x14b89, 0x14b92):

| Pointer | File offset | Frames | Meaning |
| --- | --- | --- | --- |
| `[0x1d748]` | 0 | 3 | shot explosion (obj1+0x161d3, frames 3, frame bytes 0xea at obj1+0x161c7..0x161cd) |
| `[0x1d740]` | 702 | 3 | hedgehog shot (obj1+0x14535) |
| `[0x1d73c]` | 1404 | 1 | fireball (obj1+0x14581, 0x145af) |
| `[0x1d738]` | 1638 | 1 | thrown item (obj1+0x14660) |
| `[0x1d734]` | 1872 | 1 | thrown item (obj1+0x146ae) |
| `[0x1d730]` | 2106 | 1 | thrown item (obj1+0x146fc) |
| `[0x1d72c]` | 2340 | 1 | thrown item (obj1+0x1474a) |
| `[0x1d724]` | 2574 | 4 | car-rear picture, idle (read as exhaust puff, inferred; obj1+0x14b14) |
| `[0x1d720]` | 3510 | 4 | car-rear picture, throttle start (read as backfire rings, inferred; obj1+0x14b4d) |
| `[0x1d71c]` | 4446 | 4 | car-rear picture, speed above 100 (read as a flame ball, inferred; obj1+0x14b62) |
| `[0x1d728]` | 5382 | 3 | ice shot (obj1+0x14783), up to the member end 6084 |

702 + 702 + 5 x 234 + 3 x 936 + 702 = 6084, which checks (the last block, up to the member end, is 702 = 3 frames, not 4). Which shot picture belongs to which item is as docs/leads/pickups.md section 2 reads the fire routine (sprite pointer stores at obj1+0x14535, 0x14581, 0x14660, 0x146ae, 0x146fc, 0x1474a, 0x14783); the names in the table above are from there, not re-derived.
- **Correction of docs/leads/pickups.md:** it gives the fireball 3 frames, the ice 4 frames and calls `[0x1d724]` "one unused" frame. The stores at obj1+0x3d65..0x3dc4 give the block lengths in the table; the fireball's animation period 1 and the ice's 3 (spawner words) agree with them, and the three 4-frame blocks are drawn by obj1+0x14afc at the player's car rear (6.4).

### 6.2 Shot pictures

- Obj1+0x1632c walks the 61 shot records at 0x1f2b0 (0x22 bytes, loop `si` 0..0x3c, obj1+0x16335..0x16691) and, for each active record (word +4 != 0) whose world point passes the box and cone tests (obj1+0x1636c..0x163a8), projects it exactly like a racer (obj1+0x163ae..0x164d0) and queues an entry (+0x24 = -1) with the size table `[eax*4 + 0xe600]` (set 5, 18X13.INF), row from the table obj2+0xbd00 (obj1+0x164d0..0x164e8) and the frame pointer **sprite pointer (+0x1a) + frame index (+0xe) x frame bytes (+0x12)** (obj1+0x1665e..0x1667b). It is drawn by the scaled blit like any other entry (section 1.3).
- **Frame step and explosion** (obj1+0x16048..0x16066, once per race frame, from obj1+0x227a0): word +0xe is incremented, wraps to 0 when it reaches word +0x10 (the frame count), and a record in the exploding state +6 == 0xff is freed at that wrap (obj1+0x16056..0x16062). The end of a shot (obj1+0x16188..0x161dd) plays sound 0x12, decrements the owner's in-flight word (floored at 0, obj1+0x161a4..0x161ba), sets +6 = 0xff, +0x10 = 3, +0x12 = 0xea, +0xe = 0 and the sprite to `[0x1d748]`: **the explosion shows its 3 frames, one per race frame, then the record is freed**. Hit rules, spawn, travel and ranges are in pickups.md sections 2 to 4 and the claims `item.*`; not repeated.
- Modes: all modes for shots a human fires (the fire routine is only reached for the human frames, obj1+0x225de, obj1+0x22718).

### 6.3 The wreck frames of racers

Not HOGMIS but the same kind of picture; they are GENEF frames, section 11.

### 6.4 The three car-rear pictures (read as exhaust puffs and flames; meaning inferred)

What the code establishes: obj1+0x14afc draws one of three 4-frame, 18 x 13 blocks twice, side by side, at the lower rear of the player's own car, chosen by the throttle state and the speed. **That they are exhaust (puffs, backfire, flame) is my reading, not read from code.** docs/leads/fire-items.md (section 8 table) calls the same blocks "the rear wheels of the player's car"; it agrees on the cut, the sizes, the draw site and the gating, and differs only in the name. My evidence for "exhaust": the sound started with the start-cycle block is number 0x18, named BACKFIRE in docs/leads/racer-states.md's list (section 1.6); the block is chosen by the throttle flag and the speed (idle 0..10, a 4-frame cycle that starts when the throttle is pressed, above 100), which a wheel picture would not need; and in the three blocks, viewed in words only, the idle block is a small round puff that drifts and grows over its 4 frames, the start block is a ring that grows, hollows and breaks into small rings, and the fast block is a round ball with a bright centre that pulses; none looks like a wheel. Both namings are inferences and nothing was observed in the running game.

- Routine **obj1+0x14afc** (only caller obj1+0x15086, in branch 2 of section 2.3, after the car frame test failed; so only when the car's frame is not 1, 2, 3, 5, 6 or 7): called with eax = car word +0x42 (speed), ebx = the entry x, edx = the entry y, ecx = racer word +0x54 (flame frame 0..3) and the pushed racer word +0x62 (obj1+0x15060..0x15086). It is called only when `[0x28c3c]` == 0 (that word is set to 1 at obj1+0x216d3 in the block that tests the car's lap word; inferred: the race is over) and racer word +0x58 == 0 (not hit) (obj1+0x15042..0x1505e).
- Picture choice (obj1+0x14b01..0x14b71): with the pushed word 0 and speed 0..10, block `[0x1d724]` (obj1+0x14b09..0x14b19); with the word 1 (and not in the pit state, obj1+0x14b23..0x14b2d) sound 0x18 is started if not already playing (obj1+0x14b2f..0x14b48) and block `[0x1d720]` is chosen (obj1+0x14b4d); with a word above 1 neither; then, whatever was chosen, speed above 0x64 chooses `[0x1d71c]` (obj1+0x14b5c..0x14b6c). Normal speed is capped at 0x64 (obj1+0x19666..0x19673), 0xa0 is set by the boost (obj1+0x14315) and the contact push raises it up to 0xbe (obj1+0x1d4a1..0x1d4c5), so the third block shows in the boost (and after such a push).
- Draw (obj1+0x14b71..0x14bc7): when `[0x28be0]` is set and a block was chosen: frame = block + `[racer+0x54]` x 0xea, 18 columns x 13 rows, drawn twice with the transparent blit at (entry x + 5, entry y + 0xb) and (entry x + 0x10, entry y + 0xb).
- State words (racer record obj2+0xaa90 + racer x 0x68): +0x54 advances once per race frame for all 8 racers in obj1+0x161fc and wraps from 4 to 0 (obj1+0x162d2..0x162df, called at obj1+0x1fb73); +0x62 is incremented at every such wrap while nonzero (obj1+0x162e5..0x162ec); the control routine sets +0x62 = 1 and +0x54 = 0 when the throttle flag `[0x28b40]` is set and +0x62 was 0 (obj1+0x1967d..0x19690, in the accelerate branch obj1+0x19624..0x19673) and clears +0x62 to 0 when `[0x28b40]` is clear and +0x62 > 2 (obj1+0x195c7..0x195e5). Reading these together (inferred): pressing the throttle shows the 4 start frames of `[0x1d720]` with sound 0x18 once, then nothing, and the idle flames loop at a standstill or crawl and the third block shows above speed 100.
- Modes: the human car in every mode; AI racers get none of these pictures (their entries go to the scaled blit).

## 7. DOPE.SP

- Not part of normal play. It shares the buffer `[0x1ea90]` with GIGGLES.SP (0xb6e0 = 46816 bytes; the reaction figure's 7 blocks of 0x1a20 bytes at obj2+0x1b210..0x1b228 are cut from it at obj1+0x3c8e..0x3ccf, four frames of 0x688 = 1672 = 38 x 44 each, hud.md section 5, obj1+0x1ab5c..0x1ab69).
- **Ported (2026-10-08, claim `dope.scene` STATIC, `src/game/dope.js`): the main session read the trigger, the loader, the draw and the timeline below itself from the disassembly. One correction to this lead: when `[0x1ead8]` is already 1 the loader jumps to obj1+0x37dd, so it skips only the two file reads and still restarts the animation words (every trigger replays the scene). The trigger also needs the brake flag `[0x28b44]` held in every counted call, not only at the end (obj1+0x19502..0x19543 clears the counter when it is 0): left and the brake together for 54 calls.**
- Loader obj1+0x3780: skips the file reads if the flag word `[0x1ead8]` is already 1 (obj1+0x3783..0x378a); it reads DOPE.SP over the GIGGLES data (obj1+0x378c..0x37ab) and, if the sound flag `[0x1ecf8]` is set, BELCH.VOC (name 0x2b8, 0xd99 bytes) into `[0x1eaec]` (obj1+0x37b0..0x37d8; the GIGGLES loader obj1+0x36f8 loaded QUACK.VOC, 0xe3a bytes, into the same `[0x1eaec]`, obj1+0x371f..0x374c), sets `[0x1ead8]` = 1 (obj1+0x3832) and initialises the animation words (obj1+0x37dd..0x3844). The function obj1+0x36f8 reloads GIGGLES and clears `[0x1ead8]` (obj1+0x374c); it is called at start-up (obj1+0x3a77) and by the main-menu code when `[0x1ead8]` is set on return from a race (obj1+0x100db..0x100e8). **As read, the reaction figure's pictures in the same race after the trigger are read from DOPE data, not GIGGLES** (the HUD indexes `[0x1ea90]` through obj2+0x1b210); not observed.
- Cut (file data and code literals): two frames of 0x1680 = 5760 = 80 columns x 72 rows (obj1+0x3861..0x387b: frame offset `[0x1eb18]` x 5760; literals 0x48 and 0x50 at obj1+0x3888, 0x389d) at the start, then one 25 x 15 picture (375 bytes) at +0x2d00 (`[0x1eb30]`, obj1+0x3819..0x3828; literals 0x19, 0xf at obj1+0x38d4, 0x38e9). 2 x 5760 + 375 = 11895. In words (inferred): a large face and an oval speech bubble.
- **Trigger** (obj1+0x19415..0x19541, in the human control routine obj1+0x190a0): the word `[0x1ed24]` is incremented in each frame in which the steer-left flag `[0x28b8c]` is set, the car's step word +0x26 is 0 and `[0x28c38]` is nonzero (obj1+0x19415..0x19430), and cleared when left is not held (obj1+0x1946a), when the car moves or `[0x28c38]` is 0 (obj1+0x19438), when `[0x28b40]` is set (obj1+0x194b2..0x194bc) and when `[0x28b44]` is 0 (obj1+0x19502..0x19543). With `[0x28be2]`, `[0x28bdc]`, `[0x1ec74]` all 0 (obj1+0x194e1..0x19500), `[0x28b44]` nonzero, `[0x28c38]` nonzero, `[0x1ed40]` 0 and `[0x1ed24]` >= 0x36 (54): `[0x1ed40]` = 1, the loader obj1+0x3780 runs and `[0x1ed24]` = 0 (obj1+0x19502..0x19541). `[0x28c38]` is the starter flag: set at load (obj1+0x2014c) and by the starter projection (obj1+0x16a19), cleared at obj1+0x166ba when `[0x28c44]` is nonzero. `[0x28b8c]` is set from the byte `[0x28cd5]` (obj1+0x19336..0x1934a; swapped with the right flag while inverted controls, obj1+0x1934a..0x1937d). The function obj1+0x375c, which would also set `[0x1ed40]` after `[0x1ed24]` reaches 0x36, has no direct caller (grep).
- **Draw**: obj1+0x3858 is called every race frame while `[0x1ed40]` != 0 (obj1+0x1fc40..0x1fc49), in the part of obj1+0x1f794 after the HUD. Face: frame `[0x1eb18]` (0 or 1) at x = `[0x1ea98]` = 0x78, y = `[0x1eb0c]` with the bottom-clipped blit obj1+0x1404 (obj1+0x3882..0x38b2). Bubble (when `[0x1ea8c]` != 0): 25 x 15 at x = `[0x1ea94]` = 0xb0 plus or minus 1 alternating each frame, y = `[0x1ea9c]` (obj1+0x38c4..0x3935).
- **Timeline** (state word `[0x1eaf4]`, jump table at obj1+0x3848 -> 0x397a, 0x39b0, 0x3a26, 0x3a50, dispatch obj1+0x3964..0x3972): initial y `[0x1eb0c]` = 0xc7 (obj1+0x37f1), x 0x78 (obj1+0x37fb); state 0: y -= 8 per frame until <= 0x70, then y = 0x70, timestamp = now, state 1 (obj1+0x397a..0x39af); state 1: after 0x10 frames (obj1+0x39b0..0x39c0) frame 1, state 2, bubble on at y + 0x25 (obj1+0x39cb..0x39f6), and BELCH.VOC is played when `[0x1ecf8]` is set (obj1+0x39fb..0x3a1d); the bubble's y falls by 2 per frame to 0x6e and then switches off (obj1+0x3925..0x395a); state 2: after 0x14 frames frame 0, state 3 (obj1+0x3a26..0x3a4f); state 3: y += 4 per frame; past 0xc7 `[0x1ed40]` = 0 (obj1+0x3a50..0x3a63). So it rises about 11 frames, waits 16, shows frame 1 and the bubble for 20, then sinks about 22 frames.
- Modes: single-player race only (the trigger test), human player.

## 8. HANDLE.SP

- Loader obj1+0x3ae8 (`[0x1d6cc]`, 3680 bytes); cut at obj1+0x3f83..0x3fba into 8 consecutive pointers obj2+0xa518..0xa534, 0x1cc = 460 bytes apart: **8 frames of 20 x 23** (literals 0x14 and 0x17 at obj1+0x5b09, 0x5b1f); 8 x 460 = 3680. The viewer's curated 160 x 23 is the same bytes (8 frames side by side).
- Draw: the list-menu routine obj1+0x55c0 draws frame `[index x 4 + 0xa518]` and frame `[index x 4 + 0xa528]` (frame index + 4) with the transparent blit at two x positions (obj1+0x5b02..0x5b4c, repeated at obj1+0x5f01..0x5f58 for the variant with the second font); 31 callers (the menus: obj1+0x6454, 0x64d4, ... and, inside the race loop function obj1+0x1fd8c, obj1+0x21a7a, 0x21b99, 0x2230b, i.e. the in-race Esc menu). These are the menu selection icons docs/leads/menus.md already identifies (`menu.screen-model`); **not part of the race scene**, only of the in-race menus. (docs/leads/hud.md says the code was not found; it is this routine.)
- The obj2+0xa508 block that obj1+0x11490 and obj1+0x179e8 copy (obj1+0x11493, obj1+0x17b09) was not read for what it holds.

## 9. ACTION.SP and the INF files

- ACTION.SP: 1506 = 251 x 6 (the viewer's curated size; the table 251X6.INF has width 251 and 6 rows for class 0, file data), a single picture of a thin strip of lettering (inferred from the shape: a 6-row line of text in three colour indices 0, 133, 202). Loaded by obj1+0x18038 with eax = 1 (call from obj1+0x18399, the end of the start-up table loader obj1+0x18180, called from obj1+0x26770) into the scratch buffer `[0xa980]` (obj1+0x1805b..0x1807c), with 251X6.INF as table set 0 (obj1+0x180b7).
- Drawn by obj1+0x243a0 (call at obj1+0x24c08) through the size class `clamp((eax - 0x7c) / 0x46, 0, 9)` of set 0 and the scaled blit (obj1+0x243ac..0x24446); the caller obj1+0x248f4 is the start-up sequence (called from obj1+0x26784; at its end it loads the six car tables with eax = 0, obj1+0x24e95, replacing 251X6 in set 0, and obj1+0x2491a does the same early when `[0x1ecbc]` is set). **Not drawn in a race**, and its buffer is reused as scratch (obj1+0x7e66).
- INF files: section 1.5. Uses seen in the race: set 0 (38 x 28) for the player's car and racers (obj1+0x16b8e, obj1+0x155d4 via `[0xe470 + 4 * class]`, obj1+0x157a6), set 3 (32 x 24) for the pit picture (`[0xe560]`, section 2.4) and the hedgehog objects, set 5 (18 x 13) for the shots (`[0xe600]`, obj1+0x164e1), sets 1 and 2 for the 28 x 28 and 14 x 28 objects through the catalogue word +0x0c (section 1.5).

## 10. AJ.SP and PUF.SP

- Loaders obj1+0x3aa0 and obj1+0x3ac4 (4256 = 4 x 0x428 bytes each into `[0x1d70c]` and `[0x1d6c4]`); cut at obj1+0x3f31..0x3f54 (AJ: obj2+0xa878, 0xa87c, 0xa880, 0xa884) and obj1+0x3f59..0x3f7e (PUF: obj2+0xa538, 0xa53c, 0xa540, 0xa544), 0x428 = 1064 bytes apart: **four 38 x 28 frames each** (the same frame size as a driver slot, docs/sp.md `cars.frames`; the AJ pointers sit just before the WFONT1 tile table at obj2+0xa888, the PUF pointers just before the OFONT table at obj2+0xa548). **They are not dust puffs.**
- Users of the pointers (obj2+0xa538 + 4k for PUF: obj1+0x4336 in obj1+0x4324, obj1+0x1a7a9 in obj1+0x1a740, obj1+0x1ab53 in obj1+0x1a92c, obj1+0x1cc39 in obj1+0x1bff0; obj2+0xa878 + 4k for AJ: obj1+0xa6fb, 0xa988, 0xae48, 0xba1c in obj1+0xa380 (the player set-up)). The HUD use (obj1+0x1ab4b..0x1ab53) picks `[(3 - k) x 4 + 0xa538]` for a 38 x 28 picture (rows 0x1c at obj1+0x1abdd) when the HUD record dword +0x84d4 is nonzero, instead of the GIGGLES block (obj1+0x1ab5c..0x1ab69). Whether that is the driver's reaction picture for those two drivers, and in which race modes, was not traced.
- The per-driver loader obj1+0x73c4 (reads a driver's own file into the car buffer, obj1+0x73f8..0x7483) is where the other drivers' files come from.

## 11. GENEF.SP

- Loader obj1+0x3bd0, buffer `[0x1eb50]` (14692 = 0x3964). Cut at obj1+0x400f..0x411e (offsets in the file; the sums check to 13733 for the digits start and 14692 for the end):

| Pieces | File offset | Bytes each | Pointers | Size (code literals) | Draw sites |
| --- | --- | --- | --- | --- | --- |
| 6 | 0 | 644 | `[0x1c800]`..`[0x1c814]` | 28 x 23 (0x1c, 0x17: obj1+0xd964, 0xd974) | results screens: obj1+0xd95e (in obj1+0xd704), obj1+0x1ce90 (in obj1+0x1bff0) |
| 3 | 3864 | 195 | `[0x1eb24]`, `[0x1eb28]`, `[0x1eb2c]` | 15 x 13 (0xf, 0xd: obj1+0xccf4, 0xcd07) | obj1+0xcce4 (in obj1+0xcb44), obj1+0x1cf7a |
| 8 | 4449 | 1064 | `[0x1eb40]`, `[0x1eb44]`, `[0x1eb48]`, `[0x1c7f0]`, `[0x1c7f4]`, `[0x1c7f8]`, `[0x1c7fc]`, `[0x1eae8]` | 38 x 28 | see below |
| 2 | 12961, 13269 | 308 | `[0x1c528]`, `[0x1c52c]` | 28 x 11 | the tyre pictures, section 5 |
| 1 | 13577 | 156 | `[0x1eae4]` | 12 x 13 (0xc, 0xd: obj1+0xec48, 0xec56) | menu screens: obj1+0xec51 (in obj1+0xe760), obj1+0x1f0d4 (in obj1+0x1e4b8); meaning not read |
| 11 | 13733 | 63 | `[0x1d6d8]` and ten more, one per ASCII `'0'`..`':'` | 7 x 9 | the timer digits, docs/leads/hud.md |
| 1 | 14426 | 266 | `[0x1eb60]` | 19 x 14 (266 = 19 x 14; literal sizes in hud.md section 5) | HUD in linked games (hud.md) |

- The first three 38 x 28 frames are the **starter lion** (`[0x1eb40] + 4 x frame`, frame word `[0x28c5e]` 0, 1, 2) drawn as a billboard by obj1+0x166a8 when `[0x28c38]` is set: the world point `[0x28c4a]`, `[0x28c4c]` is projected with size class of set 0 (`[0xe470 + 4 x class]`, obj1+0x168a3..0x168c9); the frame word becomes 1 at 17 (0x11) frames and 2 at 34 (0x22) frames after the start tick `[0x1eba8]` while `[0x28c44]` is 1, and the state becomes 2 with sound 0xa (obj1+0x166b0..0x16708, `race.start-rules`). Set at load only when `[0x28be2]` and `[0x1ec74]` are 0 (obj1+0x20139..0x2015e), so also in the two-player race, not in the shoot-out or a linked game.
- The next four 38 x 28 frames (`[0x1c7f0 + 4k]`, k 0..3) are the **wreck animation**: racers with word +2 == 2 draw frame `[+0x56 x 4 + 0x1c7f0]` and are not drawn once +0x56 > 3 (obj1+0x157b4..0x157d1, obj1+0x157bb..0x157c0); +0x56 is advanced once per race frame only when `[0x28be2]` and `[0x28bdc]` are 0 (obj1+0x16288..0x162a5). For the human car the same frames are used when car +0x7e is set and `[0x28c42]` is 0, with the racer word +0xaae6 as the counter (obj1+0x16d06..0x16d58) and the draw is skipped above frame 3 in the multi-player modes (obj1+0x16a80..0x16aa7). The eighth frame `[0x1eae8]` is drawn over car index `[0x28c68]` for player 1 in the function obj1+0x4380 (obj1+0x46a5..0x46b8; called from the list menus obj1+0x5ef5, 0xa9a4, 0xadfe, 0xba86); not in a race.
- The tyre pieces are drawn by the effect of section 5.

## 12. ICONS.SP, LAP.SP, GIGGLES.SP, OFONT.SP, WFONT1.SP: loaders and cuts only

Their draw routines are documented in docs/leads/hud.md, docs/leads/menus.md and the claims `hud.*`, `text.*`; only the loader and cut were read here.

- **ICONS.SP** (5574): cut at obj1+0x3cd4..0x3d5e: six pictures of 0x222 = 546 (26 x 21) to `[0x1c0b0..0x1c0c4]`, the 0x31e = 798 panel (42 x 19) at `[0x1ea84]`, ten 0x96 = 150 digits (10 x 15) to `[0x1c1d8..0x1c1fc]` (loop obj1+0x3d21..0x3d5e); 6 x 546 + 798 + 10 x 150 = 5574. HUD draws: docs/leads/hud.md sections 3 and 4.
- **LAP.SP** (19542): cut at obj1+0x3dc9..0x3e82: from LAP + 0x13f0 ten pieces of 0x27e (22 x 29) (obj1+0x3dd5..0x3e12), then two 0x550 pieces `[0xe720]` (at 0x2cdc), `[0xe724]` (80 x 17), `[0x1d83c]` at 0x377c (0x616 = 38 x 41), `[0x1d814]` at 0x3d92 (0x4d3 = 65 x 19), `[0x1d810]` at 0x4265 (0x487 = 61 x 19), ten 0x5a digits (10 x 9) from 0x46ec (obj1+0x3e14..0x3e7b); the place pictures are cut again from LAP and from LAP + 0x166e per screen mode at obj1+0x7a24..0x7a69. This agrees with the corrected offsets in docs/leads/hud.md.
- **GIGGLES.SP** (46816): section 7; 7 blocks of 0x1a20 bytes, four frames of 0x688 (38 x 44) each. docs/sp.md's curated 133 x 44 x 8 is the same bytes.
- **OFONT.SP** (16444): three reads (section 1.1): 0xf40 -> `[0x1d6bc]` cut into 61 glyphs of 0x40 (8 x 8) at obj2+0xa778 + 4k (obj1+0x3fbc..0x400d, the table the 8 x 8 text routine obj1+0x48f4 uses, obj1+0x4ad5); 0xebc -> `[0x1ea7c]`, a 92 x 41 picture (0x5c, 0x29 at obj1+0x1b134, 0x1b142; 92 x 41 = 3772) drawn at (4, 0x9b) in the HUD when `[0x1d998]` is 2 or 3 (obj1+0x1b110..0x1b150); 0x2240 -> `[0x1d6d4]` cut into 137 glyphs of 0x40 at obj2+0xa548 + 4k (obj1+0x3c3c..0x3c8c).
- **WFONT1.SP** (8190): 42 tiles of 0xc3 = 195 (15 x 13) at obj2+0xa888 + 4k (obj1+0x3ed2..0x3f2f; docs/leads/menus.md `text.menu-observed`).

## 13. What is drawn for the human player, by mode

| Effect | Single-player race | Two-player race / shoot-out | Linked game (same code, not traced separately) | Other |
| --- | --- | --- | --- | --- |
| Wheel dust (EFFECTS, 20 x 12 or 10 x 9) | yes (straight-frame puffs once `[0x28c44]` = 2) | yes, per player view | yes | AI cars: none |
| Splash 12 x 24 on surface 5 | yes, sound 0x10 | yes | yes | |
| Pit overlay and pit car (surfaces 6, 0xf) | yes | yes (other player's pit picture also from the HUD record) | yes | |
| Sparks | yes | yes | yes | |
| Car-rear pictures of 6.4 (read as exhaust) | yes (not after finishing, not when hit) | yes | yes | AI cars: none |
| Crash flight and crack | yes | no (wreck frames instead) | no | |
| Tyre strips and tyre on car | yes | not in the two-player race (`[0x28bdc]` gate at pickup); shoot-out not excluded by the gate | not excluded by the gate | |
| Dope overlay | trigger only here | no | no | |
| Starter lion | yes | two-player race yes, shoot-out no (mode 2 at once) | no | |
| Shot pictures, explosion | yes (own shots) | yes | yes | |
| Wreck frames (GENEF) | AI racers only (4 frames, then not drawn) | both | | |
| HANDLE | not in the race scene (in-race Esc menu, menus) | | | |
| ACTION | not in a race (start-up sequence) | | | |

## 14. Corrections and contradictions with existing docs

- docs/sp.md: SPARK.SP curated 12 x 10 x 3 vs code 10 x 9 x 4 (section 3); GIGGLES curated 133 x 44 x 8 equals the code's 28 pictures of 38 x 44 (same bytes, section 7). HANDLE.SP 160 x 23 is consistent (8 x 20 x 23).
- docs/leads/pickups.md section 2: HOGMIS block lengths and the "unused" block (section 6.1); section 1's kind-1 description is right but incomplete (the tyre-on-car picture and its flag `[0x28c9e]`, section 5).
- docs/leads/pickups.md sections 4 and 7 name the sounds 0x18 and 0x19 "freeze loop" sounds (inferred there); sound 0x18 is also started with the throttle-start block (section 6.4), so that naming is at least not the only use of 0x18.
- docs/leads/fire-items.md (section 8 table and its list of corrections) reads `[0x1d724]`, `[0x1d720]`, `[0x1d71c]` as "the rear wheels of the player's car". The cut (offsets 2574, 3510, 4446, 4 frames of 234 bytes), the draw site (obj1+0x14afc..0x14bc7) and the gating agree with section 6.4 here; only the meaning differs. Section 6.4 gives my evidence for exhaust puffs and flames (sound 0x18 BACKFIRE, the throttle and speed gating, the look of the pictures) and marks it as inferred; neither reading was observed.
- docs/sdx.md: the records are surface data **and** EFFECTS.SP picture descriptors; the "tail rewritten at run time" (+0x126, +0x12a) are the pointers to the loaded pictures (section 2.1).
- docs/inf.md: the INF format is known (section 1.5).
- docs/leads/hud.md: "HANDLE.SP: did not find the code that draws it" - it is the menu routine obj1+0x55c0 (section 8); "SPARK.SP not found among the HUD routines" - it is drawn in obj1+0x14bcc (section 3).

## 15. Uncertain / not read

- The meaning of the terrain values 5, 6 and 0xf (a splash, a pit), and which surfaces are road or grass: only the record index and the pictures were read (docs/surfaces.md).
- Whether a surface whose picture is not loaded on the current track (flag byte 0) can be driven on and what the draw does then: the draw does not test it (section 2.3); the pointer slots are 0 in the file.
- What the car does at race start before any surface with a picture was driven (the cache words car +0x6e, +0x72 start from the previous race or 0).
- The words +0x10e, +0x110, +0x11a, +0x11c of an SDX record (10, 6 and 5, 4 in the file): no reader found.
- The contents of the crash-flight frame tables obj2+0x1b2d8 and obj2+0x1b328 (filled from the driver slot record, obj1+0x7588..0x75e2) and the word `[0x28c4e]`; docs/leads/finish-ui.md section 4.3 reads them as frames of the driver's own file (not re-read here).
- `[0xbdf8]` (the car's base row) is run-time data (0 in obj2.bin); the value 193 is taken from the existing claim `view.player-car-draw`, not re-derived. Why the pit overlay's literal row is 0xa8 = 168 and not the entry's top row was not examined.
- The wall-clock length of a race frame (`[0x1ea5c]`, the 136 Hz timer): every duration above is in race frames.
- The word `[0x28c3c]` is set to 1 at obj1+0x216d3 in the block that tests the car's lap word (race finished); its exact meaning was not traced.
- Which button `[0x28b44]` and which key byte `[0x28cd5]` are, and so whether the DOPE trigger needs a particular key pair; the repetition guard `[0x1ead8]`; the helper obj1+0x375c has no direct caller (grep, could be reached through an indirect jump).
- The effect of a frozen (ice-hit) racer: racer word +0x58 = 2 or 3 selects the normal driver frame (obj1+0x157d3..0x157e1), no dedicated picture was found. The ice shot's own 3-frame picture is `[0x1d728]` (6.1). No "ice cube" picture was identified anywhere.
- Sound numbers are given as numbers (the sound routine obj1+0x1c04). The names in section 1.6 are copied from docs/leads/racer-states.md, which derives them from the order of the name list at obj1+0x10; I did not trace the loader that walks that list.
- The users of GENEF pieces in menu and results screens (obj1+0xd704, 0xcb44, 0xe760, 0x1e4b8, 0x1bff0) were read only far enough to give sizes; their layout and triggers were not.
- The 15 x 13 INF set's users, the block obj2+0xa508 copied at obj1+0x11490 and obj1+0x179e8, the PUF or AJ HUD flag (+0x84d4), and the hop and landing sounds (0xc, 0x17) beyond the draw sites above.
- Not run: nothing here was observed in the running game. Candidates for observation: crash into an obstacle at speed 100 or more (state words obj2+0x28c42, 0x28c1a, 0x28c32 and the crack page), a tyre pickup (obj2+0x20ae8..0x20aec, 0x28c8c, 0x28c9e), a wall scrape (car +0x46, +0x48), the dust pictures on two surfaces (car +0x6e, +0x72, +0x7a, the entry's frame pointer), the start of acceleration (racer +0x54, +0x62).
