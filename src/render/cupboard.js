// The cup board screen: the picture of the selected cup with the working palette (race.cup-board).
import { decodePcxMember } from '../formats/pcx.js';

export function loadBoards(members, files) {
  return { pictures: files.pictures.map(name => decodePcxMember(members.get(name))), palette: decodePcxMember(members.get(files.palette)).vga };
}

// The picture's indices go to the frame buffer; the palette to use is the board's working palette.
export const renderBoardPicture = (fb, boards, cup) => fb.set(boards.pictures[cup - 1].indices); // @math the cups count from 1
