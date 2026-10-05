// The menu that Esc opens in a race (race.pause-menu, STATIC): BACK TO RACE, LEAVE RACE, SAVE AND QUIT and RESTART RACE, drawn over the frozen race frame with the list menus' bars and
// selection icons. The cursor and the icons move as in the list menus (menu.cursor-observed, menu.animation-observed).
import { K } from '../evidence/k.js';
import { createChoice, stepChoice, choiceView } from './choice.js';
import { pauseItems as duckPauseItems } from './duckflow.js';

const PAUSE = () => K({ escWord: 0x28cec, finishWord: 0x28c3c, crashWord: 0x7e, cameraWord: 0x28c42, items: ['BACK TO RACE', 'LEAVE RACE', 'SAVE AND QUIT', 'RESTART RACE'], strings: 0x1a64, restart: 0x1abc, tableAt: 0x1bc3c, centre: 108, menuRoutine: 0x55c0, back: 1, leave: 2, save: 3, restartItem: 4 }, 'race.pause-menu');

// Whether Esc may open the menu: not after the finish and not while the car is wrecked (obj1+0x2212e to +0x22146).
export const canPause = (finished, crashed) => !finished && !crashed;

// The duck game's menu has only BACK TO ZONE and LEAVE ZONE (duck.flow, obj1+0x221ce to +0x222f2).
export const createPause = (duck = false) => createChoice(duck ? [duckPauseItems().back, duckPauseItems().leave] : PAUSE().items, PAUSE().centre);

// One step of the menu (8 counts of the 136 Hz clock) with the key the game reads in it ('up', 'down', 'enter', 'escape' or none). Returns the next state and the choice
// ('back', 'leave', 'save', 'restart') or null.
export function stepPause(p, key) {
  const P = PAUSE(), out = stepChoice(p, key);
  if (out.chosen === 'escape') return { pause: out.choice, chosen: 'back' }; // not observed: Esc is taken as BACK TO RACE
  return { pause: out.choice, chosen: out.chosen === null ? null : ['back', 'leave', 'save', 'restart'][out.chosen - P.back] };
}

export const viewOf = choiceView;
