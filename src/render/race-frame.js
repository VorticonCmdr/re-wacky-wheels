// The picture of a single player race frame without the pause menu: the scene, the overhead map, the HUD or the demo's banner and logo, the finish labels, the message and the crack. The page draws it
// into the canvas and the checks draw it in node to compare it with the frames of the running game; `state.detail` is the detail level of the frame.
import { duckRules } from '../game/duck.js';
import { archiveMembers } from '../game/track-data.js';
import { renderScene } from './scene.js';
import { drawCrack } from './crack.js';
import { demoModel } from '../game/demo.js';
import { drawDemoSky, drawDemoLogo, drawDemoText } from './demo.js';
import { drawLabels, drawMessage } from './finish.js';
import { renderHud, drawMinimap } from './hud.js';
import { driverName } from '../game/sounds.js';
import { PLAYER_SLOT } from '../game/player-car.js';
import { minimapOn, minimapPicture, minimapRace, minimapDots, minimapAllowed } from '../game/minimap.js';
import { speedDigits, timerText, hudGates, counterDigits, lapText, unseenGlyphs } from '../game/hud.js';

export function drawRaceFrame(state, index) {
  renderScene(state, index, state.detail, sceneSky(state));
  drawRaceOverlays(state, index);
}

// The sky of the frame: the page picture is the slide's sky and horizon (demo.flow); null for the track's own.
export const sceneSky = state => (state.demo?.pictures ? fb => drawDemoSky(fb, state.demo.pictures[state.demo.page - 1]) : null);

// Everything the race frame draws over the scene: the overhead map, the HUD or the demo's banner and logo, the finish labels, the message and the crack.
export function drawRaceOverlays(state, index) {
  if (minimapAllowed({ duck: state.duck, demo: state.demo, slides: demoModel().modes.slides }) && minimapOn(state.menu.settings)) { // the overhead map: the picture of the race, its rectangle kept from the first frame, the racers' dots (hud.minimap-draw)
    if (!state.minimap) { const race = minimapRace({ cup: state.cup, demo: state.demo?.spec, track: state.world.name }); state.minimap = { picture: minimapPicture(archiveMembers(state.dat), race), saved: null }; if (!race.known) state.unproven.add('the overhead map\'s picture in the page\'s free race (the game has none: it takes the Bronze cup\'s picture of the track\'s place)'); }
    if (state.minimap.picture) drawMinimap(index, state.minimap, minimapDots([{ x: state.car.px, y: state.car.py }, ...(state.minimapOthers ?? (state.ai ? state.ai.racers.slice(1) : []))], state.world.mapxy)); // `minimapOthers`: the page's link race lists the other human and the computer racers itself
  }
  const gates = hudGates(state.menu.settings), text = state.laps.shown && !state.figure && !state.finished ? lapText(state.laps.lap, state.total, false) : null, unseen = text ? unseenGlyphs(text) : [];
  if (unseen.length) state.unproven.add(`the lap text glyphs ${unseen.join(' ')} (from the character map, not seen on screen)`);
  if (!gates.speedometer || !gates.timer) state.unproven.add('the SPEEDOMETER and CLOCK DISPLAY switches hiding the HUD');
  if (state.duck) renderHud(index, state.hudArt, { duck: { ammo: counterDigits(state.hud.counter), score: counterDigits(state.duck.score), timer: timerText(Math.max(duckRules().timer - state.hud.ticks, 0)) }, name: driverName(state.humanSlot ?? PLAYER_SLOT), held: state.car.held }); // the duck game's HUD (duck.hud)
  else if (!state.demo) {
    const wrongWay = state.laps.wrongShown ?? null; // the demos (the mode word not 0) never draw the sign (hud.wrong-way)
    if (wrongWay !== null) state.unproven.add('the WRONG WAY sign (hud.wrong-way: read from the code, not compared with the running game)');
    renderHud(index, state.hudArt, { banner: counterDigits(state.hud.counter), name: driverName(state.humanSlot ?? PLAYER_SLOT), figure: state.figureDraw, lap: text, place: state.place, held: state.car.held, speed: gates.speedometer ? speedDigits(state.hud.shown) : null, timer: gates.timer && !state.finished ? timerText(state.hud.timerShown) : null, wrongWay });
  }
  else {
    if (state.demo.mode === demoModel().modes.attract) { renderHud(index, state.hudArt, { banner: counterDigits(state.hud.counter), name: driverName(state.humanSlot ?? PLAYER_SLOT), place: state.place, held: state.car.held, timer: gates.timer && !state.finished ? timerText(state.hud.timerShown) : null }); drawDemoText(index, state.hudArt.ofont); } // the attract mode's banner and, with the CLOCK DISPLAY switch on, the timer, without the speedometer and the lap text (demo.flow; a DOS screen of the track 4 demo with the clock on shows 00:00:0)
    drawDemoLogo(index, state.hudArt.ofont);
  }
  if (state.labels?.length) drawLabels(index, state.hudArt.ofont, state.world, state.labels); // the first three finishers (race.finish-flow)
  if (state.message) drawMessage(index, state.hudArt.ofont, state.message); // the praise for the human's place, drawn by the HUD every frame once it is on
  if (state.fx?.cracked) drawCrack(index, state.world); // the crack of a single-player crash, over the HUD (effects.crash)
}
