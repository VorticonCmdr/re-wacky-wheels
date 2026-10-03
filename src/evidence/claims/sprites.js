// The sprite catalogue and sprite pixel files: layout in the archive (PROVEN, atr-sprites check) and
// how the game loads them (PROVEN, observed in the running game, record race-3). Sites are
// object-relative and pre-fixup. Pixel order and the meaning of most catalogue fields are unproven.
export default [
  {
    id: 'atr.layout', tag: 'PROVEN',
    statement: 'In the user\'s WACKY.DAT, SPRITE.ATR is a 2-byte little-endian count (36) followed by exactly count records of 0x28 bytes; in every record the words at +4, +6 and +0x0e multiply to the pixel size (the wiki names them width, height and frames; the product is symmetric in the first two, so which is which is not shown here), the name at +0x10 is a NUL-terminated string in a 0x18-byte field that runs to the end of the record, and the archive member with that name exists and is exactly that many bytes long (36 of 36). Agrees with atr.read and sp.read.',
    value: { countBytes: 0x02, recordBytes: 0x28, widthAt: 0x04, heightAt: 0x06, framesAt: 0x0e, nameAt: 0x10, nameBytes: 0x18 },
    evidence: { checks: ['atr-sprites'] },
    leads: ['docs/atr.md'],
  },
  {
    id: 'atr.read', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): the loader (obj1+0x3e87) reads the SPRITE.ATR count into the word at obj2+0x28b82 and the records, count x 0x28 bytes, into the table at obj2+0x12998. In the table the first 0x24 bytes of every record equal the file\'s (CRC-32 equal); the dword at +0x24 is written by the sprite loader (sp.read) for the sprites it loads, and in the other records it is the file\'s (zero) bytes.',
    value: { countOffset: 0x28b82, tableOffset: 0x12998, pointerAt: 0x24 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x3e87 fp=06c60c3d', 'WW.EXE:obj1+0x3e96 fp=5dbacc65', 'WW.EXE:obj1+0x3ea6 fp=cd70e851', 'WW.EXE:obj1+0x3ec1 fp=6aae9d07'] },
    leads: ['docs/atr.md'],
  },
  {
    id: 'sp.read', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3, track 2): the per-object sprite loader (Ghidra FUN_00021310, obj1+0x11310) visits the catalogue entries in index order and, for each whose index equals the word at +0 of some .SPW record (spw.read), looks up the .SP member named at +0x10, reads exactly width x height x frames bytes (the entry\'s words at +4, +6, +0x0e) to the running cursor, stores the buffer address in the dword at +0x24 of the entry and advances the cursor by that size. The sprites loaded are exactly those entries; their buffers are contiguous from the dword at obj2+0x1eb20 to the cursor at obj2+0x1eb4c, and equal the .SP files in index order (CRC-32 equal). The first loaded entry whose word at +0 is 2 is remembered in the dword at obj2+0x1eda4. Sites: obj1+0x1134c, +0x1134f, +0x11360, +0x1136f, +0x11375, +0x11395, +0x1139d, +0x113b9.',
    value: { startOffset: 0x1eb20, cursorOffset: 0x1eb4c, trackedOffset: 0x1eda4, trackedType: 0x02, typeAt: 0x00 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x1134c fp=e482be6d', 'WW.EXE:obj1+0x1134f fp=87eb36fe', 'WW.EXE:obj1+0x11360 fp=984269bc', 'WW.EXE:obj1+0x1136f fp=0a94aaf0', 'WW.EXE:obj1+0x11375 fp=0d225419', 'WW.EXE:obj1+0x11395 fp=6829de9f', 'WW.EXE:obj1+0x1139d fp=cb05a1ca', 'WW.EXE:obj1+0x113b0 fp=1ad7c73c', 'WW.EXE:obj1+0x113b9 fp=e8aa952e'] },
    leads: ['docs/atr.md', 'docs/sp.md', 'docs/spw.md (object id = sprite-catalogue index)'],
  },
  {
    id: 'atr.kind-use', tag: 'STATIC',
    statement: 'Besides the sprite loader (sp.read, which compares word +0 with 2), the code at obj1+0x13227 to obj1+0x13261 reads the catalogue word +0 of each object\'s sprite (the table at obj2+0x12998, 0x28 bytes a record, indexed by the object\'s sprite id) and branches on it: a value of 0 or less goes to separate code (obj1+0x1334d) that tests several state words before doing anything, 1 goes to its own code (obj1+0x132d6), 2 sets a flag that makes the general path run (obj1+0x13261) and every other value takes the general path. So word +0 is an object kind that selects different handling in this routine, and the .SPW sprite id selects it. What the routine does with each kind is atr.kind-effects. Not observed at run time.',
    value: { tableOffset: 0x12998, recordBytes: 0x28, kindWord: 0x00, lowBranchAtOrBelow: 0x00, kindOne: 0x01, kindTwo: 0x02 },
    evidence: { at: ['WW.EXE:obj1+0x13227 fp=c9bff52c', 'WW.EXE:obj1+0x1322d fp=db62448c', 'WW.EXE:obj1+0x13243 fp=90d0b5e9', 'WW.EXE:obj1+0x13261 fp=59cf3270'] },
    leads: ['docs/atr.md'],
  },
  {
    id: 'cars.frames', tag: 'PROVEN',
    statement: 'In the user\'s WACKY.DAT the driver sprites are 38 x 28 frames of 0x428 (1064) bytes: CARS.SP is 102144 bytes = 8 slots of 12 frames (0x31e0 bytes a slot), and each driver\'s own file (AJ.SP, PUF.SP, SHARK.SP, ELE.SP, DIGGER.SP, CAMEL.SP, RINGO.SP, MOOSE.SP, PELICAN.SP, TIGER.SP, PANDA.SP) is a whole number of such frames: 4, 4, 16, 16, 16, 20, 20, 24, 24, 17 and 18. The frame size is the one the viewer assumes for these names; the catalogue SPRITE.ATR has no entry of this size.',
    value: { width: 0x26, height: 0x1c, slots: 0x08, framesPerSlot: 0x0c, slotBytes: 0x31e0, readFrames: 0x08, readBytes: 0x2140, drivers: ['AJ.SP', 'PUF.SP', 'SHARK.SP', 'ELE.SP', 'DIGGER.SP', 'CAMEL.SP', 'RINGO.SP', 'MOOSE.SP', 'PELICAN.SP', 'TIGER.SP', 'PANDA.SP'], driverFrames: { 'AJ.SP': 4, 'PUF.SP': 4, 'SHARK.SP': 16, 'ELE.SP': 16, 'DIGGER.SP': 16, 'CAMEL.SP': 20, 'RINGO.SP': 20, 'MOOSE.SP': 24, 'PELICAN.SP': 24, 'TIGER.SP': 17, 'PANDA.SP': 18 } },
    evidence: { checks: ['cars-frames'] },
    leads: ['docs/sp.md'],
  },
  {
    id: 'cars.slot-records', tag: 'PROVEN',
    statement: 'Observed in the running game (record cars-1: first demo race, paused a few seconds after racer init): the buffer at the dword obj2+0x1d708 holds CARS.SP whole (CRC-32 equal), and the table of eight 0x98-byte records at obj2+0x13c08 starts, for slot k, with twelve frame pointers: buffer + k x 0x31e0 + j x 0x428 for j = 0 to 11, so a slot is twelve frames of 38 x 28; the rest of each record holds pointers outside the buffer and words that are not pointers. At that moment the slots still hold CARS.SP\'s own frames: the per-driver read of cars.slots had not happened in the attract race.',
    value: { bufferPointerAt: 0x1d708, recordTableAt: 0x13c08, recordBytes: 0x98, inBuffer: 0x0c },
    evidence: { checks: ['obs-cars'], obs: ['cars-1'] },
    leads: ['docs/sp.md'],
  },
  {
    id: 'cars.slots', tag: 'STATIC',
    statement: 'The CARS.SP buffer at obj2+0x1d708 (0x18f00 bytes, read whole by the start-up loader after a lookup of the name at obj2+0x11c0, obj1+0x1053d to +0x10557) is used as eight driver slots of 0x31e0 bytes. The routine around obj1+0x22800 takes a slot index, looks up a per-driver file by the name at obj2+0x1acc, reads 0x2140 bytes (8 frames of cars.frames) of it to the start of that slot, and stores eight frame pointers, 0x428 bytes apart starting at the slot base, in the 0x98-byte record for that slot at obj2+0x13c08 (obj1+0x22822 to +0x22868); a second routine at obj1+0x2287b does the same for the slot kept at obj2+0x1ec6c. The last four frames of every slot are not filled by these reads, and the driver files are not all long enough to fill the eight frames (AJ.SP and PUF.SP have 4). What the slots are used for in play, and the choice of file, are not traced. The buffer, the slot size and the record pointers are observed (cars.slot-records); the per-driver read itself did not happen in the attract race, so it is not observed.',
    value: { bufferPointerAt: 0x1d708, bufferBytes: 0x18f00, slotBytes: 0x31e0, readBytes: 0x2140, pointers: 0x08, frameBytes: 0x428, recordBytes: 0x98, recordTableAt: 0x13c08, nameAt: 0x1acc },
    evidence: { at: ['WW.EXE:obj1+0x1053d fp=119a1f88', 'WW.EXE:obj1+0x1054c fp=f5f0cd55', 'WW.EXE:obj1+0x22822 fp=0689d968', 'WW.EXE:obj1+0x2282d fp=3799e656', 'WW.EXE:obj1+0x22852 fp=54709818', 'WW.EXE:obj1+0x22868 fp=239b275d', 'WW.EXE:obj1+0x2287b fp=aa5a2910', 'WW.EXE:obj1+0x228b2 fp=239b275d'] },
    leads: ['docs/sp.md'],
  },
  {
    id: 'atr.derived-words', tag: 'PROVEN',
    statement: 'In all 36 records of the user\'s SPRITE.ATR: the word at +2 is 10; the words at +8 and +0x0a repeat the words at +4 and +6; the word at +0x0c is a function of those two (28 and 28 give 1, 14 and 28 give 2, 32 and 24 give 3, and no other pair occurs); and the word at +0 takes the values 0 to 7 (all of them occur). So the catalogue holds three sprite shapes, the +0x0c word is a shape code, and the +2 and +8/+0x0a words add no information. What the +0 kind word does is atr.kind-use.',
    value: { records: 0x24, constantAt: 0x02, constant: 0x0a, widthRepeatAt: 0x08, heightRepeatAt: 0x0a, selectorAt: 0x0c, kindAt: 0x00, shapes: [[0x1c, 0x1c, 1], [0x0e, 0x1c, 2], [0x20, 0x18, 3]], kinds: [0, 1, 2, 3, 4, 5, 6, 7] },
    evidence: { checks: ['atr-derived'] },
    leads: ['docs/atr.md'],
  },
  {
    id: 'atr.kind-effects', tag: 'STATIC',
    statement: 'Read in full (Ghidra FUN_00022bf4, obj1+0x12bf4 to +0x137a4, the per-frame pass over the list of drawn objects at obj2+0x19a50, 0x28 bytes an entry, count word obj2+0x28b78, against the player car record obj2+0x1d5b0): for an entry whose word +0x24 is -1 (a static .SPW object, obj1+0x13210) the .SPW record is the 12-byte record at obj2+0x13938 indexed by the entry word +0x22 (obj1+0x13219) and the kind is the catalogue word +0 of that record\'s sprite id (obj1+0x13227). Kind 0 or below (obj1+0x1334d): when the car is not already crashed (car word +0x7e), the entry\'s horizontal zone word +0x20 is 3 and the car word +0x42 is at least 0x64, and no demo or special mode word is set, the car crashes: sound 0xd, car word +0x7e set to 1, words +0x20, +0x3c, +0x18, +0x42 and +0x44 cleared (obj1+0x133af to +0x133f4). Kind 1 (obj1+0x132d6): when the words obj2+0x28c8c and obj2+0x28bdc are 0, plays sound 0x16, sets the object\'s .SPW word +2 to 0xffff, sets obj2+0x28c8c to 0xffff and stores three words at obj2+0x80ae8 that step by 0xb. Kinds 2 to 7 (obj1+0x1324d): skipped when the car word +0x6a is 0x63 or more; otherwise they are taken when the car word +0x16 is 0 or the kind is 2 (obj1+0x1325a): sound from the word obj2+0x88b96, the .SPW word +2 set to 0xffff (obj1+0x1329c), and either (kind 2) the car word +0x6a raised by 4 up to 0x63 (obj1+0x132b6) or (kinds 3 to 7) the car word +0x16 set to the kind (obj1+0x132a8). So the kind word is the object\'s effect on the player car: 0 an obstacle that wrecks a fast car, 1 a one-off pickup tied to the flag word obj2+0x28c8c, 2 a counter pickup that adds 4 (maximum 99), 3 to 7 a held item taken only when none is held. What the car words +0x6a and +0x16 are called in the game (ammunition and the held item, the wiki\'s pickups) is not established here. Not observed at run time.',
    value: { listAt: 0x19a50, countWordAt: 0x28b78, entryBytes: 0x28, staticMarker: 0xffff, spwTableAt: 0x13938, spwRecordBytes: 0x0c, kindAt: 0x00, counterWord: 0x6a, counterCap: 0x63, counterStep: 0x04, heldWord: 0x16, consumedWord: 0x02, consumed: 0xffff, crashWord: 0x7e, crashSound: 0x0d, speedWord: 0x42, crashSpeed: 0x64 },
    evidence: { at: ['WW.EXE:obj1+0x13210 fp=9d231029', 'WW.EXE:obj1+0x13219 fp=2818c54d', 'WW.EXE:obj1+0x13227 fp=c9bff52c', 'WW.EXE:obj1+0x1324d fp=a3cdbe6e', 'WW.EXE:obj1+0x1325a fp=59e2d083', 'WW.EXE:obj1+0x1329c fp=b62caa1d', 'WW.EXE:obj1+0x132a8 fp=04013b89', 'WW.EXE:obj1+0x132b6 fp=b5963edb', 'WW.EXE:obj1+0x132d6 fp=0ba4fd8c', 'WW.EXE:obj1+0x1334d fp=0c67a3da', 'WW.EXE:obj1+0x133af fp=66140522', 'WW.EXE:obj1+0x133f4 fp=b0dc1a1f'] },
    leads: ['docs/atr.md', 'docs/spw.md'],
  },
  {
    id: 'sp.draw', tag: 'STATIC',
    statement: 'The sprite blitter (Ghidra FUN_00036fd0, obj1+0x26fd0) draws the frame whose address is in the dword at obj2+0x1d704 column by column: an outer loop of [obj2+0x28b36] columns (loop at obj1+0x27075) and an inner loop of [obj2+0x28b26] rows (obj1+0x27048); each step reads one byte (lodsb, obj1+0x2703a), skips it if it is 0 and otherwise stores it to the screen (stosb) and moves 0x50 bytes down to the next scan line; the next column starts after a map-mask change (obj1+0x27032). The catalogue sprite path sets [obj2+0x28b36] to the catalogue word +4 and [obj2+0x28b26] to the word +6 (obj1+0x45e6 and the lines after it), so a frame is stored column-major with word +4 columns of word +6 bytes each, and index 0 is transparent. Not observed: no screen pixel was compared with a frame. The routine also reads the per-frame x and y from obj2+0x28b32 / +0x28b34.',
    value: { pointerAt: 0x1d704, columnsAt: 0x28b36, rowsAt: 0x28b26, columnsWord: 0x04, rowsWord: 0x06, transparent: 0x00, lineBytes: 0x50 },
    evidence: { at: ['WW.EXE:obj1+0x26fd0 fp=218f6c6a', 'WW.EXE:obj1+0x27021 fp=c4c29838', 'WW.EXE:obj1+0x27032 fp=322a082f', 'WW.EXE:obj1+0x2703a fp=34464957', 'WW.EXE:obj1+0x45e6 fp=57bd1182'] },
    leads: ['docs/sp.md', 'docs/atr.md'],
  },
  {
    id: 'spw.frame', tag: 'STATIC',
    statement: 'The routine that prepares objects for drawing (it loops over the .SPW table at obj2+0x13938, 12 bytes a record, from obj1+0x4398) puts the address of the frame to draw into the dword at obj2+0x1d704 as the sprite buffer pointer (catalogue dword +0x24) plus the record\'s word +0x0a times (catalogue word +4 times word +6) (obj1+0x43e0 to obj1+0x4412). So the .SPW word +0x0a is a frame index and the word +8 is a counter it advances (obj1+0x442a increments word +8; obj1+0x4453 and obj1+0x448e increment word +0x0a, which wraps to 0 at the catalogue frame count in word +0x0e (obj1+0x449c, catalogue +0x0e) or after 7 in the other branch; word +8 is reset to 0 afterwards, obj1+0x44b4). Not observed against a running frame.',
    value: { tableOffset: 0x13938, recordBytes: 0x0c, counterWord: 0x08, frameWord: 0x0a, pointerWordAt: 0x24, widthWord: 0x04, heightWord: 0x06, framesWord: 0x0e },
    evidence: { at: ['WW.EXE:obj1+0x43e0 fp=6b1165e5', 'WW.EXE:obj1+0x4402 fp=c6320196', 'WW.EXE:obj1+0x440c fp=f7357418', 'WW.EXE:obj1+0x442a fp=9fee0b5e', 'WW.EXE:obj1+0x4488 fp=79ca7e65'] },
    leads: ['docs/spw.md', 'docs/atr.md'],
  },

  {
    id: 'sp.loader-sizes', tag: 'PROVEN',
    statement: 'The program loads 14 sprite files of the archive with a size fixed in its code: each of these code sites does `mov eax, name` (the name of the .SP member in the data object) and, in the next instruction, `mov edx, size`, and the archive member is exactly that many bytes (the sites are in the value; all are within the start-up loaders at obj1+0x36fb to +0x3c18 except CARS.SP at obj1+0x1053d and ACTION.SP at obj1+0x1805b): GIGGLES.SP 46816, DOPE.SP 11895, WFONT1.SP 8190, AJ.SP and PUF.SP 4256, HANDLE.SP 3680, LAP.SP 19542, HOGMIS.SP 6084, SPARK.SP 360, CRACK.SP 5208, GENEF.SP 14692, ICONS.SP 5574, CARS.SP 102144 and ACTION.SP 1506. So these files are loaded whole into buffers and their sizes are the game\'s, but the sizes do not give the width and height of a frame. OFONT.SP, EFFECTS.SP, the medal sprites and the other driver files are loaded by code of another shape and are not covered.',
    value: { codeObject: 1, dataObject: 2, movEax: 0xb8, movEdx: 0xba, movLength: 5, members: 14, loaders: [{ name: 'GIGGLES.SP', site: 0x36fb, size: 46816 }, { name: 'DOPE.SP', site: 0x378c, size: 11895 }, { name: 'WFONT1.SP', site: 0x3a7c, size: 8190 }, { name: 'AJ.SP', site: 0x3aa0, size: 4256 }, { name: 'PUF.SP', site: 0x3ac4, size: 4256 }, { name: 'HANDLE.SP', site: 0x3ae8, size: 3680 }, { name: 'LAP.SP', site: 0x3b0c, size: 19542 }, { name: 'HOGMIS.SP', site: 0x3b30, size: 6084 }, { name: 'SPARK.SP', site: 0x3b54, size: 360 }, { name: 'GENEF.SP', site: 0x3bd0, size: 14692 }, { name: 'CRACK.SP', site: 0x3bf4, size: 5208 }, { name: 'ICONS.SP', site: 0x3c18, size: 5574 }, { name: 'CARS.SP', site: 0x1053d, size: 102144 }, { name: 'ACTION.SP', site: 0x1805b, size: 1506 }] },
    evidence: { checks: ['sp-loaders'] },
    leads: ['docs/sp.md'],
  },
];
