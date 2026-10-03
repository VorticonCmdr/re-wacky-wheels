// The startup data members: layout in the archive (PROVEN, static-tables check) and how the loader
// (Ghidra FUN_00028180, obj1+0x18180) places them in memory (PROVEN, observed in the running game,
// record race-3). What the tables mean is not established (see the UNKNOWN claims). Sites are
// object-relative and pre-fixup.
export default [
  {
    id: 'static.layout', tag: 'PROVEN',
    statement: 'In the user\'s WACKY.DAT: MAP.XY is 0x1000 bytes (two halves of 0x800), WACKY.SDX is a 2-byte little-endian count followed by exactly count records of 0x12e bytes, GIG.MOV is a 2-byte count followed by count 4-byte entries and 4 more bytes, TRIG.DAT is 0x3c00 bytes, NDIST is 0x15e00 bytes and CARS.SP is 0x18f00 bytes. Agrees with static.read, whose loader reads exactly these sizes.',
    value: { mapXyBytes: 0x1000, sdxCountBytes: 0x02, sdxRecordBytes: 0x12e, movCountBytes: 0x02, movEntryBytes: 0x04, movExtraBytes: 0x04, trigBytes: 0x3c00, ndistBytes: 0x15e00, carsBytes: 0x18f00 },
    evidence: { checks: ['static-tables'] },
    leads: ['docs/xy.md', 'docs/sdx.md', 'docs/mov.md', 'docs/trig-dat.md', 'docs/ndist.md', 'docs/sp.md'],
  },
  {
    id: 'static.read', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): the startup loader (Ghidra FUN_00028180, obj1+0x18180) reads MAP.XY as two 0x800-byte blocks to obj2+0x202cc and obj2+0x1faca; reads the WACKY.SDX count into the word at obj2+0x28b7c (then decrements it: 29 for 30 records) and the records to obj2+0x141f8; reads TRIG.DAT, NDIST and CARS.SP whole into the buffers whose addresses are the dwords at obj2+0x1d6a0, obj2+0x1d660 and obj2+0x1d708; and reads the GIG.MOV count into the word at obj2+0x28b80 and its count*4+4 bytes to obj2+0x1b548. Every region equals its archive member (CRC-32 equal), except that the last 8 bytes of some of the 30 SDX records (not all) differ from the file: the game rewrites them after loading. The first 294 bytes of every record are the file\'s. Which tails are rewritten depends on the moment and is not part of the claim.',
    value: { mapXy: { firstOffset: 0x202cc, secondOffset: 0x1faca, halfBytes: 0x800 }, sdx: { countOffset: 0x28b7c, tableOffset: 0x141f8, recordBytes: 0x12e, tailFrom: 0x126 }, trig: { pointerOffset: 0x1d6a0, bytes: 0x3c00 }, ndist: { pointerOffset: 0x1d660, bytes: 0x15e00 }, cars: { pointerOffset: 0x1d708, bytes: 0x18f00 }, mov: { countOffset: 0x28b80, tableOffset: 0x1b548, entryBytes: 0x04, extraBytes: 0x04 } },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x18183 fp=3cd708fd', 'WW.EXE:obj1+0x18197 fp=1b5ad8a7', 'WW.EXE:obj1+0x181a7 fp=8678c1d5', 'WW.EXE:obj1+0x181c1 fp=82be62b8', 'WW.EXE:obj1+0x181ea fp=53250895', 'WW.EXE:obj1+0x1820b fp=9794a421', 'WW.EXE:obj1+0x18211 fp=5bd2003a', 'WW.EXE:obj1+0x18279 fp=4581f215', 'WW.EXE:obj1+0x18285 fp=a1386de6', 'WW.EXE:obj1+0x182bd fp=3a8750b5', 'WW.EXE:obj1+0x182d3 fp=933e5413', 'WW.EXE:obj1+0x18301 fp=a9e33b1a', 'WW.EXE:obj1+0x18321 fp=be4652f3', 'WW.EXE:obj1+0x1832b fp=1622b413', 'WW.EXE:obj1+0x1834a fp=4a2f6cf3', 'WW.EXE:obj1+0x1835e fp=9ddfb152', 'WW.EXE:obj1+0x1836e fp=13aecd70'] },
    leads: ['docs/xy.md', 'docs/sdx.md', 'docs/mov.md', 'docs/trig-dat.md', 'docs/ndist.md', 'docs/sp.md'],
  },
  {
    id: 'mapxy.use', tag: 'STATIC',
    statement: 'The routine around obj1+0x1a529 to obj1+0x1a617 (loop over the racers, count = the word at obj2+0x28c40 plus 1) reads each racer\'s world x and y words (obj2+0xaaa6 and +0xaaa8 plus 0x68 per racer), subtracts 0x400 from both (obj1+0x1a57e, +0x1a584: world to map pixels), clamps the results to 0..0x7ff (obj1+0x1a59e, +0x1a5ad; a negative result is replaced by the register di, whose value was not traced), looks x up in the first MAP.XY half (the byte table at obj2+0x202cc, obj1+0x1a5c9) and y in the second (obj2+0x1faca, obj1+0x1a5da), adds 0x3c to the y result (obj1+0x1a5e5) and calls the marker drawing routine (obj1+0x27bf0) with the two results as screen x and y at obj2+0x28b32 and +0x28b34. So MAP.XY is a pair of 0x800-entry coordinate converters from map pixels to minimap positions, used to place one marker per racer, as the wiki says. The marker colour byte at obj2+0x28ce9 is 0xff for one racer (the one whose index equals ecx), 0x5a for the others and 0x54 in two-player cases (obj1+0x1a529 to +0x1a569); what those mean was not traced. Not observed at run time.',
    value: { firstOffset: 0x202cc, secondOffset: 0x1faca, entries: 0x800, origin: 0x400, yBias: 0x3c, countOffset: 0x28c40 },
    evidence: { at: ['WW.EXE:obj1+0x1a57e fp=40b27d13', 'WW.EXE:obj1+0x1a59e fp=6ef38f18', 'WW.EXE:obj1+0x1a5c9 fp=32d56882', 'WW.EXE:obj1+0x1a5da fp=0eaf1ebf', 'WW.EXE:obj1+0x1a5e5 fp=d3e71d0d'] },
    leads: ['docs/xy.md'],
  },
  {
    id: 'small.read', tag: 'PROVEN',
    statement: 'Observed in the running game (record buffers-1, attract-mode demo race on track 2): the track-start code looks up four archive members by the names kept at obj2+0x22f8 (VEL.TAB), +0x2308 (VEL2.TAB), +0x2314 (VIEW) and +0x2324 (SLP) and reads each whole into a buffer: VEL.TAB (400 bytes) at obj2+0x1e8c4, VEL2.TAB (400) at obj2+0x1e584, VIEW (1280) at obj2+0xb7f8 and SLP (7680) at obj2+0xe858 (reads at obj1+0x26617, +0x2663d, +0x26699 and +0x266dc). Each live buffer equals its member (CRC-32 equal). What the four tables mean (the wiki calls them velocity tables, a view table and a slope table) is not established. The loaders of OTT, HTT, BIN and ING (obj1+0x25988, +0x25b5e, +0x25c6a, +0x25e34) were found but their buffers held no matching data at this moment (the OTT and HTT regions were zero, the BIN region was something else), so nothing is claimed about them.',
    value: { regions: [{ member: 'VEL.TAB', offset: 0x1e8c4, nameOffset: 0x22f8 }, { member: 'VEL2.TAB', offset: 0x1e584, nameOffset: 0x2308 }, { member: 'VIEW', offset: 0xb7f8, nameOffset: 0x2314 }, { member: 'SLP', offset: 0xe858, nameOffset: 0x2324 }] },
    evidence: { checks: ['obs-buffers'], obs: ['buffers-1'], at: ['WW.EXE:obj1+0x265cf fp=2bb8d87b', 'WW.EXE:obj1+0x26617 fp=8ca94e63', 'WW.EXE:obj1+0x2661c fp=c489f768', 'WW.EXE:obj1+0x2663d fp=0dc666be', 'WW.EXE:obj1+0x26684 fp=38c368ed', 'WW.EXE:obj1+0x26699 fp=a3cfce5c', 'WW.EXE:obj1+0x266c7 fp=a18b050f', 'WW.EXE:obj1+0x266dc fp=53d3bd8f'] },
    leads: ['docs/tab.md', 'docs/view.md', 'docs/slp.md'],
  },
  {
    id: 'cmdline.words', tag: 'PROVEN',
    statement: 'Experiment in the running game (records cmdline-1 to cmdline-4: the game started as "WW" with no words, "turbo jump", "hog ICE fire /2 now" and "/2 /3 /debug"): the start-up code (obj1+0x2618d to obj1+0x262c6) compares each command-line word, case-insensitively, with fixed strings. TURBO adds 1 to the dword at obj2+0x84f0, JUMP adds 2, HOG 4, ICE 8 and FIRE 0x10, so those five words set bits of one mask (28 for hog, ice and fire), which is copied to obj2+0x85f4, +0x1ed64 and +0x1ed68; NOW sets the dword at obj2+0x1ecbc to 1; /2 and /3 set the dword at obj2+0x1ed08 to 6 and 0 (with "/2 /3" the last word wins; /1 is cmdline.class-one); /DEBUG sets the word at obj2+0x28bea to 1 (the code also prints "Debug ON" from obj2+0x2200, obj1+0x262b0; the message was not read from the screen). Without words every one of these is 0 except the class, which is 12. There is no word that chooses a track. What the mask bits, NOW, and the class values do in the game is not established (the strings "12 HP" and "6 HP" exist in the data).',
    value: { maskAt: 0x84f0, maskCopyAt: [0x85f4, 0x1ed64, 0x1ed68], words: [{ text: 'TURBO', bit: 0x01 }, { text: 'JUMP', bit: 0x02 }, { text: 'HOG', bit: 0x04 }, { text: 'ICE', bit: 0x08 }, { text: 'FIRE', bit: 0x10 }], nowText: 'NOW', nowAt: 0x1ecbc, classAt: 0x1ed08, classes: [{ text: '/2', value: 0x06 }, { text: '/3', value: 0x00 }], debugText: '/DEBUG', debugAt: 0x28bea },
    evidence: { checks: ['obs-cmdline'], obs: ['cmdline-1', 'cmdline-2', 'cmdline-3', 'cmdline-4'], at: ['WW.EXE:obj1+0x26199 fp=58beb1df', 'WW.EXE:obj1+0x261ae fp=8a210546', 'WW.EXE:obj1+0x261b7 fp=669a32a9', 'WW.EXE:obj1+0x26227 fp=caf295ac', 'WW.EXE:obj1+0x26246 fp=5a27c541', 'WW.EXE:obj1+0x26265 fp=86a83bcd', 'WW.EXE:obj1+0x26284 fp=8dec2936', 'WW.EXE:obj1+0x2629e fp=6a54a12f'] },
    leads: ['docs/cfg.md'],
  },
  {
    id: 'cmdline.class-one', tag: 'STATIC',
    statement: 'The word /1 sets the dword at obj2+0x1ed08 to 12 (obj1+0x26246 to +0x26258), which is also the value it has when no word is given, so the experiment of cmdline.words cannot tell /1 from no word. Not observed to have an effect.',
    value: { text: '/1', value: 0x0c, classAt: 0x1ed08 },
    evidence: { at: ['WW.EXE:obj1+0x26246 fp=5a27c541'] },
  },
  {
    id: 'UNKNOWN_STATIC_TABLE_MEANING', tag: 'UNKNOWN',
    statement: 'What the six startup tables mean is not established: the wiki calls MAP.XY a minimap lookup, WACKY.SDX particle data, TRIG.DAT a circular lookup, NDIST a projection table, CARS.SP the driver sprites and GIG.MOV devil motion; two readers are read: MAP.XY converts racer coordinates to minimap positions (mapxy.use) and the terrain value indexes the SDX records (terrain.sdx-index, 30 per-surface records), so the SDX is data per surface type; and what the game rewrites in the last 8 bytes of five SDX records is unknown.',
    evidence: {},
    leads: ['docs/xy.md', 'docs/sdx.md', 'docs/mov.md', 'docs/trig-dat.md', 'docs/ndist.md', 'docs/sp.md'],
    todo: 'Read the TRIG / NDIST / CARS pointer readers (38, 9 and 7 sites) and obj2+0x1b548 (MOV: obj1+0x1a859, +0x1ac00), and what reads the SDX fields beyond the copies in terrain.sdx-index.',
  },
];
