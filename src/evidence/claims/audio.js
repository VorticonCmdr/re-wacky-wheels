// The sound-effect bank (AUDIOHED.FX + AUDIOT.FX): its layout in the user's archive is PROVEN by a
// data check; how the game loads it is PROVEN from a run with sound mode 7 (record audio-1), and which
// modes select which bank is STATIC.
export default [
  {
    id: 'audio.bank-layout', tag: 'PROVEN',
    statement: 'In the user\'s WACKY.DAT, AUDIOHED.FX is 79 little-endian dwords (78 slots plus one) and AUDIOT.FX is the bank they index. Slots 0 to 25 and 26 to 51 hold sounds and tile AUDIOT.FX from offset 0 without gaps; slots 52 to 77 are empty (all at the end of slot 51). Every sound of slots 0 to 25 is a 6-byte header (its first dword is the payload length), that many payload bytes, then one trailing 0 byte; every sound of slots 26 to 51 is a 23-byte header (first dword the payload length), that many payload bytes, then a 10-byte trailer that starts with a 0 byte and holds NUL-padded printable text (mostly "Default"). In each bank some sound\'s last payload byte is not 0, so the trailer is not part of the payload. The last slot of each bank has the 4 bytes "!ID!" after its trailer. AUDIOT.FX ends with one more "!ID!" that no slot owns, and the last offset (index 78) points to the "!ID!" ending slot 51, 4 bytes before slot 52\'s offset (so subtracting offsets gives -4 for slot 77: not a size). What the header bytes after the length dword and the trailer text mean is not established.',
    value: { offsetBytes: 0x04, slots: 0x4e, bankSlots: 0x1a, firstHeader: 0x06, firstTrailer: 0x01, secondHeader: 0x17, secondTrailer: 0x0a, lengthAt: 0x00, tag: '!ID!' },
    evidence: { checks: ['audio-bank'] },
    leads: ['docs/audiohed-fx.md', 'docs/audiot-fx.md (ModdingWiki AudioT format: PC speaker, AdLib and tag banks)'],
  },
  {
    id: 'audio.load', tag: 'PROVEN',
    statement: 'Observed in the running game (record audio-1: WACKY.CFG sound mode 7, title screen, before any sound): the routine Ghidra FUN_00011f98 (obj1+0x1f98) looks up AUDIOHED.FX (name at obj2+0x224) and AUDIOT.FX (name at obj2+0x230), reads AUDIOT.FX whole into a buffer whose address is the dword at obj2+0x1eb14 (the live buffer equals the archive member, CRC-32 equal), and builds 26 records of 0x18 bytes at obj2+0x1a9c8. In record k the dword at +0 is the buffer address plus the AUDIOHED offset of slot k (except the aliased records of audio.alias), the dword at +4 is the first dword of that chunk (its length), the dword at +8 is 0 and the dword at +0x0c is 27 - k. The dwords at +0x10 and +0x14 are written by the running game (audio.record-init); the recording holds other values in them. Which mode values call the routine, and what mode 2 does, is audio.mode-select.',
    value: { headName: 0x224, bodyName: 0x230, bufferPointerAt: 0x1eb14, recordTable: 0x1a9c8, recordBytes: 0x18, records: 0x1a, pointerAt: 0x00, lengthAt: 0x04, zeroAt: 0x08, priorityAt: 0x0c, priorityFirst: 0x1b },
    evidence: { checks: ['obs-audio'], obs: ['audio-1'], at: ['WW.EXE:obj1+0x1f98 fp=c5a5487e', 'WW.EXE:obj1+0x1f9c fp=d165e078', 'WW.EXE:obj1+0x2032 fp=c0d205e3', 'WW.EXE:obj1+0x2040 fp=56a2502f'] },
    leads: ['docs/audiohed-fx.md'],
  },
  {
    id: 'audio.alias', tag: 'PROVEN',
    statement: 'Observed in the running game (record audio-1): after the records are built, the same routine (obj1+0x2075 to obj1+0x20e4, two passes) copies the pointer and length dwords of record 20 (offset 0x1e0 in the table) into records 0 to 7. In the user\'s bank, slots 0 to 7 hold sounds with a length of 0 (audio.bank-layout), so these eight records then share record 20\'s sound.',
    value: { source: 0x14, firstTarget: 0x00, count: 0x08, sourceOffset: 0x1e0 },
    evidence: { checks: ['obs-audio'], obs: ['audio-1'], at: ['WW.EXE:obj1+0x2075 fp=d1027373', 'WW.EXE:obj1+0x207c fp=a028e5db', 'WW.EXE:obj1+0x20d3 fp=d30cd731'] },
  },
  {
    id: 'audio.record-init', tag: 'STATIC',
    statement: 'The loader initialises the dword at +0x10 of every record to 0xffffffff and the dword at +0x14 to 0 (obj1+0x2040, +0x204a, +0x2054). The running game later writes both (in record audio-1 they hold other values in some records), so what they mean is not established (UNKNOWN_AUDIO_RECORD_FIELDS).',
    value: { noneAt: 0x10, none: -1, flagAt: 0x14, flag: 0x00 },
    evidence: { at: ['WW.EXE:obj1+0x2040 fp=56a2502f'] },
  },
  {
    id: 'audio.mode-select', tag: 'STATIC',
    statement: 'The routine that calls the bank loader (obj1+0x2124) does so only when the word at obj2+0x1ee4e is not 0 (obj1+0x213e) and the dword at obj2+0x17404 is 7 or 2 (obj1+0x214c, obj1+0x2155); the loader takes slots from base 26 if that dword is 2 (obj1+0x2007) and from base 0 otherwise, so mode 7 uses slots 0 to 25 (observed, audio.load) and mode 2 would use slots 26 to 51. Mode 2 was tried once (2026-10-03, DOSBox 0.84.0-vc1, WACKY.CFG file offset 0x786 set to 2): the game printed "Invalid Sound Fx device." at start-up and returned to DOS, so the second-bank path has not been observed. That dword is file offset 0x786 of WACKY.CFG (cfg.read).',
    value: { enableWordAt: 0x1ee4e, modeAt: 0x17404, secondBankMode: 0x02, otherMode: 0x07, secondBankBase: 0x1a, modeFileOffset: 0x786 },
    evidence: { at: ['WW.EXE:obj1+0x2007 fp=981faa91', 'WW.EXE:obj1+0x213e fp=519c8527', 'WW.EXE:obj1+0x214c fp=feb4f86f'] },
    leads: ['docs/cfg.md'],
  },
  {
    id: 'UNKNOWN_AUDIO_MODE_VALUES', tag: 'UNKNOWN',
    statement: 'What the values of the dword at obj2+0x17404 stand for is not established: 2 selects the second bank and 7 the first (audio.load), and the recorded sessions had 0, which skips this routine, but which sound device each value means and what the routine at obj1+0x2168 loads for the other values is not read. Where it comes from is known: the dword is file offset 0x786 of WACKY.CFG (obj2+0x17404 lies in the third piece, cfg.read: 0x17404 - 0x17128 + 0x4aa). Seen once on 2026-10-03 (DOSBox 0.84.0-vc1, no sound hardware beyond the DOSBox defaults, screen text read after "Checking FX Hardware....", not numeric records, so leads only): with the dword set to 0 the game starts (digital sound-effect path); 1 prints "MVSOUND.SYS not loaded."; 2, 3 and 4 print "Invalid Sound Fx device."; 5 prints "UltraSound card not found"; 6 prints "Could not detect Sound Source."; 7 starts and loads the bank (audio.load). Each failure returns to DOS. Not claimed, only seen in the installed files: all three hold 0 there, and the SC55 variant differs from the other two at file offsets 0x78a (3 instead of 0), 0x792 (4 instead of 1) and 0x7a2/0x7a3 (48, 3 instead of 0, 0).',
    evidence: {},
    todo: 'Read the per-device modules the dispatch at obj1+0x31510/0x31530/0x31624 reaches (the error strings above identify devices 1, 5 and 6), read obj1+0x2168..0x2483, and read what SETUP.EXE writes at WACKY.CFG offset 0x786 (and 0x78a, 0x792).',
    leads: ['docs/cfg.md'],
  },
  {
    id: 'UNKNOWN_AUDIO_RECORD_FIELDS', tag: 'UNKNOWN',
    statement: 'What the dwords at +0x08, +0x0c (27 - k at start), +0x10 and +0x14 of the 26 sound records mean is not established; in a recording at the title screen +0x10 and +0x14 had been rewritten in some records (for example 24 and 1 in record 0, 46 and 5 in record 8).',
    evidence: {},
    todo: 'Trace the readers and writers of the record table at obj2+0x1a9c8 (the sound player).',
  },
  {
    id: 'UNKNOWN_AUDIO_CHUNK_FIELDS', tag: 'UNKNOWN',
    statement: 'What the header bytes after the length dword mean (2 of the 6 bytes of the first bank, 19 of the 23 of the second) and what the trailers are (a 0 byte; ten bytes of NUL-padded text) and how the sounds are played is not established; only the length dword is read by the loader.',
    evidence: {},
    todo: 'Trace the code that reads records at obj2+0x1a9c8 (the player) and what it does with the chunk bytes.',
    leads: ['docs/pc-speaker.md', 'docs/adlib-sfx.md'],
  },
];
