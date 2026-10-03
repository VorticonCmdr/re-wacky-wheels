// The 36 digitized effects in WACKY.DAT. Only their file structure is claimed here; the sample-rate
// rule and the codec bytes are the Creative spec's (leads in docs/voc.md) and are not interpreted.
export default [
  {
    id: 'voc.layout', tag: 'PROVEN',
    statement: 'In the user\'s WACKY.DAT all 36 .VOC members have the same structure: the 19 bytes "Creative Voice File" then 0x1a, a 16-bit header size of 26 at offset 20 (the header really is 26 bytes), a 16-bit version at 22 (0x010a in every file) and a 16-bit check value at 24 equal to the complement of the version plus 0x1234, then blocks of a 4-byte header (one type byte and a little-endian length in the other three, whose top byte is 0 in every file, so this archive cannot show whether the length is 2 or 3 bytes wide) followed by that many bytes, ended by a single 0 byte that is the last byte of the file. Every file has exactly one block of type 1 (sound data: two bytes, a divisor and a codec byte that is 0, then the samples); MOTOR.VOC alone also has a block of type 6 (2 bytes, 0xffff) before it and a type 7 block (no data) after it. What the divisor and codec bytes mean to the game is not established.',
    value: { magic: 'Creative Voice File', markerAt: 0x13, marker: 0x1a, headerSizeAt: 0x14, versionAt: 0x16, checksumAt: 0x18, headerBytes: 0x1a, checksumBase: 0x1234, blockHeaderBytes: 0x04, terminator: 0x00, soundBlock: 0x01, repeatStart: 0x06, repeatEnd: 0x07, pcm8: 0x00, infiniteRepeat: 0xffff },
    evidence: { checks: ['voc-members'] },
    leads: ['docs/voc.md', 'Creative Voice File format (ModdingWiki VOC Format)'],
  },
];
