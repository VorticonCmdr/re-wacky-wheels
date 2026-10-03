// PCX images as WW.EXE consumes them (STATIC, from disassembly) and as WACKY.DAT stores them
// (PROVEN, by the pcx-members check). Sites are object-relative and pre-fixup. In the code read
// (the image loader obj1+0x7060, two decoders, one palette site) the header is skipped without
// being examined, a fixed 320x200 picture is decoded, and the palette comes from the last 0x300
// bytes of the member. The other 36 call sites of the decoder and their loaders are untraced.
export default [
  {
    id: 'pcx.rle-rule', tag: 'PROVEN',
    statement: 'The linear-buffer decoder (Ghidra FUN_000376d7, obj1+0x76d7) reads a byte b from the stream: if (b & 0xC0) == 0xC0 it is a run of (b & 0x3F) copies of the next byte, otherwise one literal pixel, filling a fixed 0x140 by 0xC8 picture. Observed in the running game (record race-3): the four sheets it decoded for track 2 (the tile buffer) equal the in-process decode of the same members under this rule.',
    value: { runMask: 0xc0, countMask: 0x3f, width: 0x140, height: 0xc8 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x276fa fp=0bd668a7', 'WW.EXE:obj1+0x2772f fp=c16f5a2f', 'WW.EXE:obj1+0x2770f fp=94d4873c', 'WW.EXE:obj1+0x2771d fp=ca1503c3'] },
    leads: ['docs/pcx.md (ModdingWiki PCX: bytes >= 0xC0 repeat the next byte value&0x3F times)'],
  },
  {
    id: 'pcx.rle-rule-vga', tag: 'STATIC',
    statement: 'The decoder that writes to VGA planes (Ghidra FUN_000375cd, obj1+0x75cd) uses the same rule and the same fixed 0x140 by 0xC8 picture as pcx.rle-rule. Both decoders keep a column counter that resets inside the run loop, so a run continues across a row boundary, and neither special-cases a zero run count. Not observed: this decoder, run continuation across rows and zero counts have not been seen at run time (no archive file has such a run).',
    value: { runMask: 0xc0, countMask: 0x3f, width: 0x140, height: 0xc8 },
    evidence: { at: ['WW.EXE:obj1+0x27606 fp=e7beb88c', 'WW.EXE:obj1+0x2766b fp=3cc02678', 'WW.EXE:obj1+0x27644 fp=73cdbd1d', 'WW.EXE:obj1+0x27659 fp=1f23ab78'] },
  },
  {
    id: 'pcx.member-split', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): the image loader\'s slot-1 buffer holds exactly the member\'s bytes between the 0x80-byte header and the 0x300-byte palette (member size - 0x380 bytes, the 0x0C marker included; CRC-32 equal for the sky picture), and the palette buffer holds the last 0x300 bytes of the first tileset\'s member shifted right by 2 (pcx.palette-scale). The loader (Ghidra FUN_00027060, obj1+0x7060) reads the header into a stack buffer it never reads again (disassembly read in full); other PCX loaders are untraced.',
    value: { header: 0x80, headerAndPalette: 0x380, palette: 0x300 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x1709b fp=1487fc70', 'WW.EXE:obj1+0x170ab fp=c841f862', 'WW.EXE:obj1+0x170c3 fp=5120fa76', 'WW.EXE:obj1+0x2673e fp=9d6172c5', 'WW.EXE:obj1+0x26743 fp=c218b6cb'] },
  },
  {
    id: 'pcx.palette-scale', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): the palette buffer holds each of the 0x300 palette bytes of the first tileset\'s member shifted right by 2 (6-bit VGA values), not the raw bytes. The conversion is Ghidra FUN_00026ec4 (obj1+0x6ec4), two SAR by 1 per byte. Not observed: the VGA DAC itself (the code that writes the DAC ports is unread), so what DOSBox or hardware then shows is not established.',
    value: { shift: 0x02, bytes: 0x300 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x16ecc fp=c66fde7e', 'WW.EXE:obj1+0x16edf fp=114fc300'] },
  },
  {
    id: 'tiles.sheet-split', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): each decoded 320x200 sheet is stored as 0x36 tiles of 0x20 x 0x20 pixels, 10 per sheet row, left to right then top to bottom, each tile as 0x20 consecutive 0x20-byte rows (the live tile buffer equals the in-process split of the same sheets). The slicer is Ghidra FUN_000376d7 (obj1+0x76d7), cited below. Mask sheets show slots 54 to 59 as filler (tiles.mask-values).',
    value: { count: 0x36, size: 0x20, columns: 0x0a },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x27775 fp=30ceb296', 'WW.EXE:obj1+0x27782 fp=9d2265be', 'WW.EXE:obj1+0x2778c fp=3d178ac0', 'WW.EXE:obj1+0x27797 fp=e1ddfa21', 'WW.EXE:obj1+0x277a0 fp=bdb2da80'] },
    leads: ['CLAUDE.md / src/tracks.js composeTrack (54 tiles per sheet, 10 columns)', 'docs/sin.md (108 tile-property records = 2 x 54)'],
  },
  {
    id: 'pcx.layout', tag: 'PROVEN',
    statement: 'Every PCX member of WACKY.DAT (116 in the user\'s archive) is 0x80 header bytes, an RLE stream, and 0x300 palette bytes. The stream decodes under the pcx.rle-rule rule to exactly 0x140 x 0xC8 pixels and leaves exactly one byte, the marker 0x0C, immediately before the palette. No run crosses a row and none has a zero count. Agrees with pcx.rle-rule and pcx.member-split.',
    value: { header: 0x80, palette: 0x300, marker: 0x0c, runMask: 0xc0, countMask: 0x3f, width: 0x140, height: 0xc8 },
    evidence: { checks: ['pcx-members'] },
    leads: ['docs/pcx.md'],
  },
  {
    id: 'pcx.header-observed', tag: 'PROVEN',
    statement: 'In every PCX member of the user\'s WACKY.DAT the header bytes are identical in these fields: manufacturer 10 at +0, version 5 at +1, encoding 1 at +2, 8 bits per plane at +3, 1 plane at +65, 320 bytes per row (uint16) at +66, and the image box in +4..+11 spans 320 x 200. The image loader obj1+0x7060 does not examine them (pcx.member-split; other loaders untraced), so this describes the files, not necessarily the game.',
    value: { manufacturerAt: 0x00, manufacturer: 0x0a, versionAt: 0x01, version: 0x05, encodingAt: 0x02, encoding: 0x01, bitsAt: 0x03, bits: 0x08, planesAt: 0x41, planes: 0x01, strideAt: 0x42, stride: 0x140, boxAt: 0x04 },
    evidence: { checks: ['pcx-members'] },
    leads: ['docs/pcx.md (ModdingWiki header table)'],
  },
];
