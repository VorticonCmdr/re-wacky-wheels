// The DOS text screen the game leaves on (exit.screen-observed, exit.screen-select): the 80 x 25 cells of WWREG.BIN (WWSW.BIN for a shareware archive) in the 16 colours of the VGA text mode.
import { b800Cells } from '../data-formats.js';

const COLOURS = ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff']; // @math the 16 colours of the text mode

// The screen as an element: a grid of 80 columns of 12 x 16 pixel cells.
export function exitScreen(data) {
  const box = document.createElement('div');
  Object.assign(box.style, { display: 'grid', gridTemplateColumns: 'repeat(80, 12px)', gridAutoRows: '16px', width: '960px', margin: '0 auto', font: '15px/16px monospace', background: '#000', whiteSpace: 'pre' }); // @math 80 columns of 12 pixels, rows of 16
  for (const cell of b800Cells(data)) {
    const span = document.createElement('span');
    span.textContent = cell.character; Object.assign(span.style, { color: COLOURS[cell.foreground], background: COLOURS[cell.background], textAlign: 'center', overflow: 'hidden' });
    box.append(span);
  }
  return box;
}
