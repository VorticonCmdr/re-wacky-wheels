// WACKY.DAT directory: what WW.EXE does with it (STATIC, from disassembly) and what the archive's
// bytes then prove (PROVEN, by the dat-directory check). Offsets in `at` are object-relative and
// pre-fixup; Ghidra shows the same sites with obj2 addresses (obj2+0x5080 appears as 0x65080).
// Callee identities (fread/fseek/strcmp-like routines at obj1+0x32c68, +0x32e91, +0x32df0) are
// inferred from argument use only; their bodies have not been read.
export default [
  {
    id: 'dat.directory-read', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): the table at obj2+0x5080 holds exactly the entries that follow the 2-byte count in WACKY.DAT (count x 0x16 bytes, CRC-32 equal), and the 22 bytes after it are zero, so the archive\'s own 22-byte sentinel entry is not loaded. The opener (Ghidra FUN_00014128, obj1+0x4128) does this with two reads: a 2-byte count (EDX=2, EBX=1 at obj1+0x414c), then count*0x16 bytes (IMUL at obj1+0x4168) into the table. The code sign-extends the count (MOVSX at obj1+0x4164; read from disassembly only, no negative count occurs).',
    value: { countBytes: 0x02, entrySize: 0x16, tableObject: 2, tableOffset: 0x5080 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x414c fp=0a3c7214', 'WW.EXE:obj1+0x4164 fp=d480e91b', 'WW.EXE:obj1+0x416b fp=b42c128e'] },
    leads: ['docs/dat.md (ModdingWiki: 2-byte count, 22-byte entries)'],
  },
  {
    id: 'dat.entry-lookup', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): by-name lookups are case-insensitive and leave the file at the member\'s data. The requested name is upper-cased in place (the palette-source buffer holds A_F3.PCX while the slot it was copied from still holds A_f3.pcx), and the data read after every lookup the record covers (tileset and mask sheets, the sky picture, the POS, SIN and RD files) is the bytes of the member whose entry name, at entry+0, matches, starting at the dword at entry+0x12 plus 2. Code: Ghidra FUN_0001418c (obj1+0x418c), seek at obj1+0x41e9 and +0x41f4.',
    value: { nameAt: 0x00, offsetAt: 0x12, seekBias: 0x02 },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x41e9 fp=47b0a754', 'WW.EXE:obj1+0x41f4 fp=9a403e60'] },
  },
  {
    id: 'dat.entry-notfound', tag: 'STATIC',
    statement: 'The same lookup (Ghidra FUN_0001418c) ends the walk as not-found when an entry\'s first byte is 0 (obj1+0x41a9); the table is zero beyond its count*0x16 loaded bytes (dat.directory-read), so a name that is not in the archive reaches that zeroed entry. Not observed: no lookup in the record fails.',
    value: { endMarker: 0x00 },
    evidence: { at: ['WW.EXE:obj1+0x41a9 fp=bc85a927'] },
  },
  {
    id: 'dat.entry-size', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3): the image loader reads exactly (member size - 0x380) bytes for the sky picture (the slot buffer holds those bytes, CRC-32 equal, and the bytes after them are not the file\'s palette bytes that follow), where member size is the dword at entry+0x0e of the looked-up entry. Several code sites read that dword; the shortest is Ghidra FUN_00014238 (obj1+0x4238). Its meaning as the member length is proven by dat.layout.',
    value: { sizeAt: 0x0e },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x4242 fp=8caf5f6d'] },
  },
  {
    id: 'dat.layout', tag: 'PROVEN',
    statement: 'WACKY.DAT is a 2-byte little-endian count at 0, then count 22-byte entries from file offset 2: a NUL-terminated name at +0, a uint32 member length at +0x0e, a uint32 member offset at +0x12 measured from file offset 2. Members tile the archive: sorted by offset each ends exactly where the next begins and the last ends at EOF, and the first begins one entry (22 bytes) after the directory end. Also agrees with dat.directory-read, dat.entry-lookup and dat.entry-size.',
    value: { countAt: 0x00, countBytes: 0x02, entrySize: 0x16, sizeAt: 0x0e, offsetAt: 0x12, offsetBias: 0x02 },
    evidence: { checks: ['dat-directory'] },
    leads: ['docs/dat.md'],
  },
  {
    id: 'dat.entry-tail', tag: 'PROVEN',
    statement: 'Observed in the running game (records race-3 and buffers-1): the archive lookup finds a member whatever follows the first NUL of its directory entry\'s name field. The members the game demonstrably loaded are the tileset, mask and sky pictures named in race-3, the loaded track\'s seven files, SPRITE.ATR, WACKY.SDX, MAP.XY, TRIG.DAT, NDIST, CARS.SP, GIG.MOV and the four members of buffers-1. Of those 23 distinct members, 22 have non-zero bytes after the NUL in their entry (all but SPRITE.ATR) (the entry of 2.GAM, for example, holds the leftover characters "42.PCX" after its name), and a compare of the whole 14-byte field would not find them. So the compare stops at the NUL, as a C string compare does. 496 of the 577 entries have such a tail.',
    value: { loaded: 0x17, tailed: 0x16, fixedMembers: ['SPRITE.ATR', 'WACKY.SDX', 'MAP.XY', 'TRIG.DAT', 'NDIST', 'CARS.SP', 'GIG.MOV'] },
    evidence: { checks: ['obs-lookup'], obs: ['race-3', 'buffers-1'] },
    leads: ['docs/dat.md (wiki: null-padded names; refuted for 496 entries)'],
  },
  {
    id: 'dat.entry-compare', tag: 'STATIC',
    statement: 'The lookup compares the requested name with the entry name using Ghidra FUN_00042df0 (obj1+0x32df0; read in full), a word-wise string compare that decides on the bytes up to the first NUL and returns 0 for equal strings (that the bytes after an entry name\'s first NUL are not decisive is observed: dat.entry-tail). The requested name is first upper-cased in place by Ghidra FUN_00042dd0 (obj1+0x32dd0): a-z become A-Z, nothing else changes (the in-place effect is observed in dat.entry-lookup).',
    value: { lowerFirst: 0x61, lowerLast: 0x7a, caseDelta: 0x20 },
    evidence: { at: ['WW.EXE:obj1+0x32df0 fp=03a5de48', 'WW.EXE:obj1+0x32dd0 fp=8ca3cb2d'] },
    leads: ['docs/dat.md (wiki: null-padded names; refuted for 496 entries, see Verification notes)'],
  },
  {
    id: 'UNKNOWN_DAT_SENTINEL_ENTRY', tag: 'UNKNOWN',
    statement: 'The 22 bytes after the directory (file offset 2 + 22*count) belong to no member; in the user\'s archive they begin with a 0 byte followed by "WREG.BIN". The running game does not load them (dat.directory-read: the 22 bytes after its table are zero, because it reads only count*0x16 bytes); the lookup\'s zero-first-byte end marker therefore ends on zeroed memory. Whether the packer writes the sentinel on purpose is not established.',
    evidence: {},
    leads: ['dat.entry-lookup (end marker at obj1+0x41a9)'],
    todo: 'Nothing in the game reads the file sentinel; decide whether it matters for rewriting archives (src/track-model.js patchArchive keeps it byte-for-byte).',
  },
];
