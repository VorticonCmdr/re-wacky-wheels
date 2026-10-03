// The terrain-property lookup (Ghidra FUN_00037b04, obj1+0x27b04, read in full) and how it was
// confirmed in the running game (record terrain-3). Sites are object-relative and pre-fixup.
export default [
  {
    id: 'terrain.lookup', tag: 'PROVEN',
    statement: 'Given a world row and column (the dwords at obj2+0x1d7a8 and obj2+0x1d7a4), the lookup takes the cell (row >> 5, column >> 5) in the 128-wide pointer table, recovers the tile id as (pointer - tileBase) >> 10, indexes the .SIN table with id * 8, and reads the mask pixel of that tile at ((row & 0x1f) << 5) + (column & 0x1f) in the mask region 0x1B000 bytes after the tile pixels. The result, stored at obj2+0x1e568, is the first dword of the 8-byte entry when the mask pixel is 0 and the second dword otherwise. Observed in the running game (record terrain-3): in 60 samples at 60 distinct positions over 13 tile ids, with both mask values, the stored result equals this computation from the archive\'s .M, .SIN and mask sheets. World coordinates are map pixels plus 0x400 (the map starts at table cell 32 = 0x20 x 0x20), which is the bias the .RD, .SPW and .GAM loaders add.',
    value: { inputsObject: 2, rowOffset: 0x1d7a8, columnOffset: 0x1d7a4, resultOffset: 0x1e568, cellBits: 0x05, tileShift: 0x0a, entryBytes: 0x08, maskZeroOffset: 0x00, maskOneOffset: 0x04, maskRegion: 0x1b000 },
    evidence: { checks: ['obs-terrain'], obs: ['terrain-3'], at: ['WW.EXE:obj1+0x27b4f fp=57566fad', 'WW.EXE:obj1+0x27b62 fp=4515fe40', 'WW.EXE:obj1+0x27b7a fp=f2f771c9', 'WW.EXE:obj1+0x27b7d fp=b3bb510b', 'WW.EXE:obj1+0x27b88 fp=13fff3a6', 'WW.EXE:obj1+0x27b8f fp=c409b749', 'WW.EXE:obj1+0x27b96 fp=7fcf3f7d'] },
    leads: ['docs/sin.md (ModdingWiki: property choices for mask indices 0/1)', 'docs/pcx.md (a_ma* are per-pixel property masks)'],
  },
  {
    id: 'terrain.clamp', tag: 'PROVEN',
    statement: 'Observed in the running game (record terrain-4: an execute breakpoint at the terrain lookup\'s entry, obj1+0x27b04, where the row and column inputs at obj2+0x1d7a8 and +0x1d7a4 were overwritten with forced values, the routine single-stepped out and the result at obj2+0x1e568 read; 19 forced pairs, each coordinate set to values below 0, at 0, at 0xffe, 0xfff and 0x1000, above 0xfff and far outside): every result equals the one the position clamped to 0..0xfff on each axis predicts (cell computed from the clamped values, the 128x128 table\'s padding cells at tile 0). The disassembly compares with 0xfff and with 0 at obj1+0x27b10 and the following instructions; stepping showed row -7 become 0 and column 123456 become 0xfff in the registers.',
    value: { limit: 0xfff },
    evidence: { checks: ['obs-terrain'], obs: ['terrain-4'], at: ['WW.EXE:obj1+0x27b10 fp=ec3ad705'] },
  },
];
