// How the game reads WACKY.CFG at start-up. The layout of the file's saved-game fields is a lead in
// docs/cfg.md; only what the reader does and what the running game held is claimed here.
export default [
  {
    id: 'cfg.read', tag: 'PROVEN',
    statement: 'Observed in the running game (record race-3; the record holds the SHA-1 of the WACKY.CFG that the observation tool was pointed at, which matches an installed file; that the game was started from that very file is the tool operator\'s statement, not checked): the configuration reader (the routine containing obj1+0x25f1b) opens WACKY.CFG, requires its size to be 0xada (2778) bytes (obj1+0x26020), and reads it as three consecutive pieces: 0x492 bytes to obj2+0x1ee1c, 0x18 bytes to obj2+0x1b6d8 and 0x630 bytes to obj2+0x17128 (obj1+0x26041, +0x26057, +0x2606d). The installed file has that size, and in the running game every 16-byte block of the three regions equals the file\'s except six (file offsets 0x30, 0x86a, 0x87a, 0x89a, 0x8aa, 0x8ba): the game writes there at run time (a lead: the saved-game fields of docs/cfg.md lie in 0x866 to 0x95f). After the reads the reader compares the word at obj2+0x17430 (file offset 0x7b2) with 0xfa (obj1+0x26072); the installed files hold 0xfa there. What the game does on a mismatch, and which blocks it writes at other moments, is not established.',
    value: { size: 0xada, parts: [{ object: 2, offset: 0x1ee1c, bytes: 0x492 }, { object: 2, offset: 0x1b6d8, bytes: 0x18 }, { object: 2, offset: 0x17128, bytes: 0x630 }], block: 0x10, differingAt: [0x30, 0x86a, 0x87a, 0x89a, 0x8aa, 0x8ba], checkWord: { at: 0x7b2, value: 0xfa } },
    evidence: { checks: ['obs-race'], obs: ['race-3'], at: ['WW.EXE:obj1+0x26020 fp=b46f0921', 'WW.EXE:obj1+0x26030 fp=d6e67835', 'WW.EXE:obj1+0x26046 fp=607f8bff', 'WW.EXE:obj1+0x2605c fp=a0332995', 'WW.EXE:obj1+0x26072 fp=ed99ecc1'] },
    leads: ['docs/cfg.md'],
  },
  {
    id: 'cfg.default-keys', tag: 'PROVEN',
    statement: 'In all three installed WACKY.CFG files (the game folder and its SB16 and SC55 folders) the second of the three pieces the game reads (cfg.read: file offset 0x492, 0x18 bytes, read to obj2+0x1b6d8) holds twelve little-endian 16-bit words: the first six, 0x4b, 0x4d, 0x38, 0x1d, 0x50, 0x39, for player 1 and the next six, 0x20, 0x21, 0x1e, 0x1f, 0x22, 0x23, for player 2. These are IBM PC scancodes: Left arrow, Right arrow, Alt, Ctrl, Down arrow, Space, and D, F, A, S, G, H. The order is the order of SETUP.EXE\'s key menu (steer left, steer right, button 1 accelerate, button 2 fire, button 3 brake, button 4 hand brake turn; setup.race-options, input.buttons).',
    value: { files: 3, piece: 1, tableAt: 0x1b6d8, players: [[0x4b, 0x4d, 0x38, 0x1d, 0x50, 0x39], [0x20, 0x21, 0x1e, 0x1f, 0x22, 0x23]], words: 6, wordBytes: 2 },
    evidence: { checks: ['cfg-keys'] },
    leads: ['docs/cfg.md'],
  },
  {
    id: 'cfg.key-names', tag: 'PROVEN',
    statement: 'In all three installed WACKY.CFG files the third piece holds, from file offset 0x7b4, twelve 14-byte entries (the dword at 0x7b2 holds the 0xfa version word, cfg.read, in its first two bytes) with the NUL-padded name of each key of the key table (cfg.default-keys), in the order of the key words: LEFT CURSOR, RIGHT CURSOR, ALT, CTRL, DOWN CURSOR, SPACE, D, F, A, S, G, H. The names are the ones SETUP.EXE gives the scancodes: its key table builder (obj1+0x11c2 to +0x189b) is a run of `mov edi, record; mov esi, name; movsd...` blocks, with each record holding the name copied from obj2 (up to 13 bytes, padded with spaces in SETUP) and the scancode byte stored by a `mov byte [record + 0x28], scancode`, and the check decodes the instruction bytes that way and compares every key word of the CFG with its name. How SETUP uses the table beyond that, and the keys without a record, are not read.',
    value: { tableAt: 0x7b4, entries: 12, entryBytes: 14, from: 0x11c2, to: 0x189b, movEdi: 0xbf, movEsi: 0xbe, movLength: 5, store: [0xc6, 0x05], storeLength: 7, recordCodeOffset: 0x28, nameBytes: 13 },
    evidence: { checks: ['cfg-key-names'] },
    leads: ['docs/cfg.md'],
  },
];
