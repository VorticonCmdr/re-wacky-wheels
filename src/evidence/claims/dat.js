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
    id: 'dat.notfound-behavior', tag: 'PROVEN',
    statement: 'Experiment in the running game (record gamslot-1, see gam.trailing-space): when the sky picture is asked for by a name that matches no member ("BACK2.PCX " with a trailing space; the compare is exact up to the NUL, dat.entry-compare), the game does not stop. The failed lookup does not move the file position, so the next reads continue from where the previous read ended: the game\'s sky buffer holds the 33339 bytes that start 0x80 bytes (one PCX header) after the end of the member read just before, 2.SIN, i.e. the archive bytes at 3462824 inside 3.RD, and not BACK2.PCX\'s stream. A request for a missing name therefore yields wrong data, silently.',
    value: { previousMember: '2.SIN' },
    evidence: { checks: ['obs-gamslot'], obs: ['gamslot-1'], at: ['WW.EXE:obj1+0x41a9 fp=bc85a927'] },
    leads: ['docs/dat.md'],
  },
  {
    id: 'dat.entry-notfound', tag: 'PROVEN',
    statement: 'Observed in the running game (record miss-1: the first demo race with the sky-name line of 2.GAM edited to "back2.pcx ", the run archive rebuilt and hash-compared by the check; an execute breakpoint on the lookup\'s not-found path, obj1+0x41b2 of the routine Ghidra calls FUN_0001418c): the lookup, asked for "BACK2.PCX " (no member has that name), took that path once; the walk index word at obj2+0x28b00 was 577, the archive\'s entry count, so the walk ended on the entry after the last; that entry (obj2+0x5080 plus 577 x 0x16) starts with a 0 byte and the last loaded entry does not. So a name that is not in the archive is not found by walking past the loaded entries onto the zeroed one; the game then continues without seeking (dat.notfound-behavior).',
    value: { endMarker: 0x00, missPath: 0x41b2, walkIndexAt: 0x28b00, tableAt: 0x5080 },
    evidence: { checks: ['obs-miss'], obs: ['miss-1'], at: ['WW.EXE:obj1+0x41a9 fp=bc85a927'] },
    leads: ['docs/dat.md'],
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
    id: 'dat.uppercase-range', tag: 'PROVEN',
    statement: 'Experiment in the running game (record gamslot-2: a copy of the user\'s archive with line 5 of 2.GAM set to the eight bytes 0x40 0x41 0x5a 0x5b 0x60 0x61 0x7a 0x7b, rebuilt and hash-checked by the check; the first demo race): after the archive lookup the game\'s copy of that line (the slot at obj2+0xa4e0) holds 0x40 0x41 0x5a 0x5b 0x60 0x41 0x5a 0x7b and a 0 byte. So the in-place upper-casing of the requested name changes exactly the bytes 0x61 to 0x7a (by subtracting 0x20), and the bytes next to that range, and the upper-case letters, stay as they are.',
    value: { lowerFirst: 0x61, lowerLast: 0x7a, caseDelta: 0x20, slotAt: 0xa4e0, planted: [0x40, 0x41, 0x5a, 0x5b, 0x60, 0x61, 0x7a, 0x7b] },
    evidence: { checks: ['obs-uppercase'], obs: ['gamslot-2'], at: ['WW.EXE:obj1+0x32dd0 fp=8ca3cb2d'] },
    leads: ['docs/dat.md'],
  },
  {
    id: 'dat.entry-compare', tag: 'STATIC',
    statement: 'The lookup compares the requested name with the entry name using Ghidra FUN_00042df0 (obj1+0x32df0; read in full), a word-wise string compare that decides on the bytes up to the first NUL and returns 0 for equal strings (that the bytes after an entry name\'s first NUL are not decisive is observed: dat.entry-tail). The requested name is first upper-cased in place by Ghidra FUN_00042dd0 (obj1+0x32dd0), whose effect is observed in dat.uppercase-range.',
    evidence: { at: ['WW.EXE:obj1+0x32df0 fp=03a5de48', 'WW.EXE:obj1+0x32dd0 fp=8ca3cb2d'] },
    leads: ['docs/dat.md (wiki: null-padded names; refuted for 496 entries, see Verification notes)'],
  },
  {
    id: 'dat.sentinel-bytes', tag: 'PROVEN',
    statement: 'In the user\'s WACKY.DAT the 22-byte stretch after the directory (file offset 2 + 22 x count, the gap before the first member) is an entry whose first byte is 0, whose name field from its second byte on repeats the last directory entry\'s name field from its second byte (the last entry is "WWREG.BIN", the sentinel holds a 0 byte and then "WREG.BIN"), and whose length and offset fields are zero. So it is the end-marker entry the lookup would stop on, with the name tail of the previous entry left behind; the game does not load it (dat.directory-read: it reads only count x 0x16 bytes, so the lookup\'s zero-first-byte end marker ends on zeroed memory), and nothing of the port depends on it (patchArchive keeps the bytes). Why the packer leaves the tail (an entry buffer reused with its first byte and numeric fields cleared is the reading that fits) cannot be answered from the files: the packer is not available, and the question is closed (2026-10-05) rather than left as an open claim.',
    value: { endMarker: 0x00, nameBytes: 0x0e, tailFrom: 0x01 },
    evidence: { checks: ['dat-sentinel'] },
    leads: ['docs/dat.md'],
  },
];
