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
];
