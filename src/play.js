// The playtest page: the proven renderers and car step of src/render and src/game. Everything is decoded in the browser
// from the player's own WACKY.DAT; nothing is uploaded or stored.
import { duckPicture, gone, skipped, duckRules, duckTrack } from './game/duck.js';
import { createChooser, stepChooser, chooserPalette, defaultTable, tableOf, qualifies, insertScore as insertDuck, introLayout, endLayout, loadingText, entryInfo as duckEntryInfo, duckSong, pauseItems as duckPauseItems } from './game/duckflow.js';
import { loadDuckArt, renderChooser, renderDuckScreen } from './render/duck.js';
import { openDevGame } from './vfs/dev.js';
import { openPicked } from './vfs/picker.js';
import { withSteps } from './evidence/k.js';
import { loadTrack, rgbaPalette, archiveMembers } from './game/track-data.js';
import { renderScene } from './render/scene.js';
import { drawRaceFrame, drawRaceOverlays, sceneSky } from './render/race-frame.js';
import { createEnhancer } from './enhance/index.js';
import { EFFECTS, LEVELS } from './enhance/config.js';
import { applyPreset, change, resetSettings, menuView, nextPreset, toggle, cycleLevel, defaultLevels } from './enhance/settings.js';
import { createDisplay } from './enhance/display.js';
import { describeAtmosphere } from './enhance/atmosphere.js';
import { loadDisplay, saveDisplay, resetDisplay, changeDisplay, displayView, nextAspect, nextScaling, toggleCrt, cycleCrtLevel, defaultCrtLevels, CRT_LEVELS } from './enhance/display-settings.js';
import { loadDevices, saveDevices } from './game/sound-devices.js';
import { composeSplit, drawStrips, renderWinner, flipViewport, drawRaceHud } from './render/versus.js';
import { stripValues, swapSeat } from './game/versus.js';
import { versusKeys, buttonCodes } from './game/versus-keys.js';
import { loadKeys, saveKeys, defaultKeys, inputOf, codesOf, scancodeOf, rebind, namesOf, SLOTS } from './game/keys.js';
import { SHOOT, FLOW as VERSUS_FLOW, RACE as VERSUS_RACE } from './game/versus-rules.js';
import { messageAt, winnerLayout, raceValues, carsBySeat as carsOf } from './game/versus.js';
import { finalPlaces, racePoints } from './game/versus-race.js';
import { frameMs } from './game/clock.js';
import { renderSky, renderHorizon } from './render/sky.js';
import { drawList } from './render/draw-list.js';
import { drawCrack } from './render/crack.js';
import { kidNoticeLines } from './game/cup.js';
import { podiumGroups, startRostrum, rostrumPass, rostrumTicks, rostrumPassTicks, rostrumStartSound } from './game/rostrum.js';
import { loadRostrumArt, renderRostrum, renderRostrumText, renderNotice } from './render/rostrum.js';
import { makeSave, restoreOf } from './game/save.js';
import { exitScreen } from './render/exit.js';
import { startCredits, stepCredits, stepMs } from './game/credits.js';
import { loadCreditsArt, renderCredits } from './render/credits.js';
import { defaultVolumes, startVolume, stepVolume, stepPreview, frameWait, volumeModel, KINDS } from './game/volume.js';
import { loadVolumeArt, renderVolume } from './render/volume.js';
import { demoSpec, demoModel, parseBmc, bmcStart, bmcStep, turnPage, nextRace } from './game/demo.js';
import { drawDemoSky, drawDemoLogo, drawDemoText } from './render/demo.js';
import { enterMenu } from './game/menu.js';
import { hallDefault, insertScore, dateText, startEntry, typeKey, boardLayout as famousLayout } from './game/halloffame.js';
import { loadFamousArt, renderEntry, renderFamous } from './render/famous.js';
import { trialClass, trialDefault, recordIndex as trialIndex, evaluate as trialEvaluate, insertTimes, messagesOf, layout as trialLayout, totalOf, trialEntry as trialEntryInfo, trialMessageCounts, trialMarker, titleOf as trialTitle } from './game/timetrial.js';
import { loadTrialArt, renderTrial, drawMessage as drawTrialMessage } from './render/trial.js';
import { viewSetup } from './game/view.js';
import { objectRecords, objectFrame } from './game/objects.js';
import { playerRecord } from './game/player-car.js';
import { shotRecords } from './game/shots.js';
import { drawLabels, drawMessage, drawBox } from './render/finish.js';
import { drawText } from './render/text.js';
import { decodePcxMember } from './formats/pcx.js';
import { startCup, trackOf, cardText, previewName, bannerOf, fadeSteps, fadeLevel, racesInCup, bonusOffered, noticeTicks, startBonusRace } from './game/cup.js';
import { boardRows, boardLayout, humanFrame } from './game/leaderboard.js';
import { loadBoardArt, renderBoard } from './render/leaderboard.js';
import { createChoice, stepChoice, choiceView } from './game/choice.js';
import { createAudio } from './play-audio.js';
import { createLink } from './play-link.js';
import { INPUT_SIZE, encodeInput, decodeInput, encodeParams, decodeParams, delayFor, raceHash, checkParams } from './net/race.js';
import { driverCount } from './game/drivers.js';
import { ROLE } from './net/packets.js';
import { raceSong, menuSong, boardSong } from './game/sounds.js';
import { boardFiles, enterBoard as enterCupBoardState, stepBoard, boardPass, boardSound } from './game/cupboard.js';
import { loadBoards, renderBoardPicture } from './render/cupboard.js';
import { renderMenu, loadMenuArt, renderMenuOverlay, menuBottom } from './render/menu.js';
import { renderHud, loadHudArt, drawMinimap } from './render/hud.js';
import { driverName } from './game/sounds.js';
import { PLAYER_SLOT } from './game/player-car.js';
import { minimapOn, minimapPicture, minimapRace, minimapDots, minimapAllowed } from './game/minimap.js';
import { createHud, stepHud, advanceTimer, speedDigits, timerText, hudGates, counterDigits, lapText, unseenGlyphs } from './game/hud.js';
import { lapsTotal } from './game/laps.js';
import { parseMov, startFigure, stepFigure } from './game/figure.js';
import { racerRecords, racerFrame } from './game/racers.js';
import { idleFrame, idlePlayer, starterRecord, lionBytes } from './game/start.js';
import { startRace, stepRace, beginIntro, shownCycle } from './game/race.js';
import { menuDef, defaultSettings, bannerOfMenu } from './game/menus.js';
import { createMenu, stepFrame, viewOf, menuPeriod, enterSetup, isSettled, actionAt } from './game/menu.js';
import { createVehicle, stepVehicle, vehicleLayout } from './game/vehicle.js';
import { loadVehicleArt, renderVehicle, renderControlsHelp } from './render/vehicle.js';
import { HELP_KEY } from './game/help.js';
import { classOf, forcedOf } from './game/classes.js';
import { canPause, createPause, stepPause, viewOf as pauseView } from './game/pause.js';

const $ = id => document.getElementById(id);
const state = { running: false, screen: 'menu', menu: createMenu(), menuKey: null, menuHeld: null, menuHeldCode: null, menuAccumulator: 0, menuArt: null, hudArt: null, hud: createHud(), laps: null, total: 0, finished: false, finalTicks: 0, mov: null, figure: null, figureDraw: null, ai: null, place: 8, dat: null, world: null, car: null, camera: null, keys: new Set(), pause: null, pauseKey: null, pauseAccumulator: 0, tick: 0, last: 0, accumulator: 0, unproven: new Set(), steps: [] };
const screen = $('screen'), ctx = screen.getContext('2d'), image = ctx.createImageData(screen.width, screen.height), index = new Uint8Array(screen.width * screen.height);
let rgba = null;
const enh = createEnhancer(); // the Enhanced presentation (docs/enhancements.md): it reads the race state and never writes it; with every effect off the page draws the reference renderer
const display = createDisplay({ source: screen, host: $('screen-box'), closeUp: $('dsp-closeup'), onChange: () => showDisplay() }); // how the finished picture is put on the screen (docs/enhancements.md, Stage 1): it reads the canvas and never draws into it
// A finished picture: into the canvas, then onto the screen through the display.
function show() { ctx.putImageData(image, 0, 0); display.present(); showDisplayStats(); }

function setMessage(text, bad = false) { const m = $('message'); m.textContent = text; m.style.color = bad ? 'var(--bad)' : ''; m.hidden = !text; }

// ---- sound (audio.race-sounds): the sounds the race frames ask for, the engine and the songs of the screens
let tickSounds = []; // the last tick's sounds, for the enhanced presentation's skid marks (playSounds empties the state's list)
function playSounds() {
  tickSounds = state.sounds ?? [];
  const a = state.audio;
  if (!a) { state.sounds = []; return; }
  const L = state.linkPlay, own = L ? { car: L.seat === 0 ? state.car : state.seat2.car, player: L.seat === 0 ? state.player : state.seat2.player, slot: L.slots[L.seat] } : { car: state.car, player: state.player, slot: state.humanSlot }; // in a link race the own car is the player's seat
  for (const e of state.sounds ?? []) { const ev = typeof e === 'object' ? e : { id: e }; a.play({ ...ev, id: ev.id === 'driver' ? own.slot : ev.id }); }
  state.sounds = [];
  if (state.screen === 'race') { if (own.car.crashed || own.player.pending) a.engineStop(); else a.engineSpeed(own.car.speed); }
}

// The song of a screen: the menus the main menu's, the boards the ASHES song, a race the cup's song for the race (the card prefetches it while it shows).
function songFor(screen) {
  if ((screen === 'race' && state.demo) || (screen === 'card' && state.card?.demo)) return menuSong(); // a demo race and its card keep the menu's song (demo.flow)
  if (screen === 'menu' || screen === 'vehicle' || screen === 'famous' || screen === 'credits' || screen === 'volume' || screen === 'keyset' || screen === 'link') return menuSong();
  if (screen === 'cupboard' || screen === 'board' || screen === 'card' || screen === 'notice' || screen === 'hall' || screen === 'duckChooser' || screen === 'duckIntro' || screen === 'duckEnd' || screen === 'shootCard' || screen === 'versusEnd') return boardSong(); // the chooser plays ASHES (duck.flow)
  if (screen === 'race' && (state.duck || state.versus?.kind === 'shootout')) return duckSong(state.duckFlow.zone); // the zone's own song (duck.flow)
  const c = state.cup; return raceSong(c ? c.cup : 1, c ? c.bonus : 0, c ? c.race : 1); // @math a race outside a cup is the first race of the Bronze cup
}
function followMusic() {
  const a = state.audio; if (!a || state.screen === 'exit') return;
  if (state.screen === 'rostrum') { // the song of the rostrum plays once, and when it has ended the main menu's follows (obj1+0x1cad1, +0x1cb9f)
    if (state.musicName !== 'LEADRBRD' && state.musicName !== 'MAINMENU') { a.song('LEADRBRD', false, () => { state.musicName = 'MAINMENU'; a.song('MAINMENU', true); }); state.musicName = 'LEADRBRD'; }
    state.musicScreen = state.screen; return;
  }
  if (state.screen === 'card' && state.cup && state.card?.stage === 'loading') a.prefetch(raceSong(state.cup.cup, state.cup.bonus, state.cup.race));
  if (state.screen === state.musicScreen && !(state.screen === 'race' && state.musicRace !== state.race)) return;
  if (state.screen === 'trialEntry') { if (state.musicName !== 'LEADRBRD') { a.song('LEADRBRD', false); state.musicName = 'LEADRBRD'; } state.musicScreen = state.screen; return; } // the time trial's name entry plays LEADRBRD once (obj1+0x1e724)
  if (state.screen === 'retry' || state.screen === 'entry') return; // the name entry keeps the rostrum's song
  const name = songFor(state.screen);
  if (name !== state.musicName) { a.song(name, true); state.musicName = name; }
  state.musicScreen = state.screen; state.musicRace = state.race;
  if (state.screen !== 'race') a.engineStop();
}

function startTrack() {
  if (state.duo) { // the two player race: head to head forces the class 1, with all cars the three item class menu chooses (versus.race-rules)
    const flow = state.menu.settings.flow, item = state.duo.cars === 2 ? flow.duoClass : 1; // @math the word 2 is RACE WITH ALL CARS, the class 1 is AMATEUR
    state.versusMode = { kind: 'race', cars: state.duo.cars, laps: lapsTotal(flow.laps), class: item, engine: Number($('engine').value), slots: state.duo.slots, scores: [0, 0] }; state.humanSlot = state.duo.slots[0]; state.slots = null;
    startTrackWith({ name: $('track').value, engine: state.versusMode.engine, cls: classOf(item), laps: state.versusMode.laps }); state.versusMode = null; return;
  }
  const item = state.menu.settings.flow.class, forced = forcedOf(item), engine = forced.engine ?? Number($('engine').value); // the kid mode sets the engine, the kid mode and the time trial the laps (setup.forced-items)
  startTrackWith({ name: $('track').value, engine, cls: classOf(item), laps: forced.laps ?? lapsTotal(state.menu.settings.flow.laps) });
}
function startTrackWith({ name, engine, cls, laps, split = Boolean(state.versusMode) }) {
  state.class = cls.class; state.child = cls.child; state.engine = engine; // the class item of the menu: the computer racers' level and the kid mode (race.class-levels)
  startRace(state, { ...loadTrack(state.dat, name, engine, state.humanSlot ?? null, { split }), lion: lionBytes(archiveMembers(state.dat)) }, laps); // a split game's background is BLANK.PCX (versus.layout)
  state.accumulator = 0; state.pause = null; beginIntro(state); enh.reset(); showAtmosphere(); // the camera's fly-in before the countdown (race.intro); a new scene for the enhanced presentation
  if (state.cup && state.carry) { const car = { ...state.car, counter: state.carry.counter, held: state.carry.held }; state.car = car; state.player = { ...state.player, car }; } // the pickups go from one race of a cup to the next (obj1+0x2006a)
  rgba = rgbaPalette(state.world.palette);
  state.audio?.stopAll(); state.audio?.engineStart(); // a race starts with the engine running (obj1+0xd04)
}

// The duck game's race on a zone (duck.race-rules): the zone's track, the 6 hp engine, the class 4, no laps.
function startDuck(zone = 1, bonus = false) {
  const track = String(duckTrack(zone, bonus));
  state.duckMode = { zone, bonus }; state.demo = null; state.cup = null; state.carry = null; state.result = null; state.screen = 'race'; state.keys.clear();
  $('track').value = track;
  startTrackWith({ name: track, engine: duckRules().engine, cls: classOf(1), laps: 1 }); // @math the laps word is unused in the duck game
  state.class = duckRules().level; state.hud = createHud(); state.duckMode = null;
}

// The two player shoot-out on a zone (versus.shootout-rules): the zone's track, the 6 hp engine, the class 4, two humans with the drivers `slots` and no laps.
function startVersus(zone = 1, bonus = false, hits = 5, slots = [PLAYER_SLOT, 0]) {
  const track = String(duckTrack(zone, bonus));
  state.versusMode = { hits, slots, scores: [0, 0] }; state.duckMode = null; state.demo = null; state.cup = null; state.carry = null; state.result = null; state.screen = 'race'; state.keys.clear();
  state.humanSlot = slots[0]; state.slots = null; $('track').value = track;
  startTrackWith({ name: track, engine: SHOOT().engine, cls: classOf(1), laps: 1 }); // @math the laps word is unused in the shoot-out
  state.class = SHOOT().level; state.hud = createHud(); state.versusMode = null;
}

// ---- the duck game's screens (duck.flow): the vehicle screen, the zones menu, the zone chooser, the loading card, the intro, the race, the name entry and the end screen
const DUCK_KEY = 'wackywheels.duck';
function loadDuckTable() { try { const kept = localStorage.getItem(DUCK_KEY); if (kept) return JSON.parse(kept); } catch { /* no storage */ } return defaultTable(); }
function saveDuckTable() { const f = state.duckFlow; if (!f?.dirty) return; try { localStorage.setItem(DUCK_KEY, JSON.stringify(f.table)); f.dirty = false; } catch { /* no storage */ } } // the game writes WACKY.DTT when it leaves for the main menu (obj1+0x10585)
function duckArt() { const f = state.duckFlow; f.art ??= loadDuckArt(archiveMembers(state.dat)); state.famousArt ??= loadFamousArt(archiveMembers(state.dat)); return f.art; }

function afterDuckVehicle(mode = 'duck') {
  state.duckFlow ??= { table: loadDuckTable(), zone: 1, bonus: false, art: null, dirty: false };
  state.duckFlow.mode = mode; // 'shoot': the chooser leads to the shoot-out (versus.flow)
  duckArt();
  if (archiveMembers(state.dat).has('42.GAM')) { state.menu = enterMenu('zones', [{ id: 'main', cursor: 4 }], state.menu.settings); state.screen = 'menu'; state.menuAccumulator = 0; } // the bonus pack's zones are asked when the archive has 42.GAM (obj1+0x6693); @math the cursor of WACKY DUCK SHOOT
  else enterChooser(false);
}

function enterChooser(bonus) {
  const f = state.duckFlow; duckArt();
  f.bonus = bonus; f.chooser = createChooser(f.zone, bonus); f.wait = 0; f.key = null; f.stage = 'choose'; state.duck = null; state.duckMode = null;
  state.screen = 'duckChooser'; state.last = performance.now(); state.keys.clear();
}

function leaveDuck() { saveDuckTable(); state.duck = null; state.duckMode = null; state.audio?.stopAll(); returnToMenu(); }

function stepDuckChooser(now) {
  const f = state.duckFlow;
  if (f.stage === 'loading') { if (now - f.since >= LOADING_MS) { if (f.mode === 'shoot') { enterShootCard(); return; } f.stage = 'intro'; state.screen = 'duckIntro'; state.keys.clear(); } return; }
  f.wait -= Math.min(now - state.last, 250) * 136 / 1000; // @math at most a quarter second at a time; 136 counts a second
  while (f.wait <= 0 && f.stage === 'choose') {
    const out = stepChooser(f.chooser, f.key); f.chooser = out.chooser; f.key = null; f.wait += out.wait;
    if (out.sound !== null) state.audio?.play(out.sound);
    if (out.escape) { leaveDuck(); return; }
    if (out.chosen) { f.zone = out.chosen; f.stage = 'loading'; f.since = now; }
  }
}

function drawDuckChooser() {
  const f = state.duckFlow, vga = renderChooser(index, f.art, f.bonus);
  if (f.stage === 'loading') drawTrialMessage(index, f.art, loadingText()); // the loading card over the chooser's picture
  blit(rgbaPalette(chooserPalette(vga, f.chooser)));
  $('readout').innerHTML = `<dt>Zone</dt><dd>${f.chooser.zone}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the zone chooser of the duck game (duck.flow); the blink of the selected bar follows the code\'s 13 passes.';
}

function drawDuckIntro() {
  const f = state.duckFlow, vga = renderDuckScreen(index, f.art, introLayout(f.table));
  blit(rgbaPalette(vga));
  $('readout').innerHTML = `<dt>Duck shoot</dt><dd>intro, zone ${f.zone}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the intro of the duck game (duck.flow).';
}

function drawDuckEnd() {
  const f = state.duckFlow, vga = renderDuckScreen(index, f.art, endLayout(f.score, f.table));
  blit(rgbaPalette(vga));
  $('readout').innerHTML = `<dt>Duck score</dt><dd>${f.score}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the end screen of the duck game (duck.flow).';
}

function drawDuckEntry() {
  const f = state.duckFlow, E = duckEntryInfo();
  blit(rgbaPalette(renderEntry(index, state.famousArt, f.entry, f.art.background, { text: E.title, y: E.y })));
  $('readout').innerHTML = `<dt>Name entry</dt><dd>${f.entry.name.trim() || '(empty)'}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the duck shoot hall of fame name entry (duck.flow). Type up to 16 letters, digits or spaces; Enter ends.';
}

// The two minutes are up: a score that enters the table asks for a name first, then the end screen (obj1+0x1b5e8 with the end flag).
function endDuck() {
  const f = state.duckFlow; f.score = state.duck.score; state.result = null; state.audio?.stopAll();
  if (qualifies(f.table, f.score)) { f.entry = startEntry(trialEntryInfo().chars); state.screen = 'duckEntry'; } else state.screen = 'duckEnd';
  state.last = performance.now(); state.keys.clear();
}

// The zone's preview after the loading banner (versus.flow): the picture of the zone fades in and waits for a key, then the match starts.
function enterShootCard() {
  const f = state.duckFlow, track = duckTrack(f.zone, f.bonus);
  f.stage = 'preview'; f.picture = decodePcxMember(archiveMembers(state.dat).get(previewName(track))); f.since = performance.now();
  state.screen = 'shootCard'; state.keys.clear(); state.last = performance.now();
}

function drawShootCard(now) {
  const f = state.duckFlow, step = Math.min(Math.floor((now - f.since) / FADE_MS), fadeSteps());
  index.set(f.picture.indices); blit(rgbaPalette(f.picture.vga.map(v => Math.min(v, fadeLevel(step)))));
  $('readout').innerHTML = `<dt>Zone</dt><dd>${f.zone}</dd><dt>Hits</dt><dd>${state.shoot.hits}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the preview picture of a shoot-out zone (versus.flow).';
}

// A player reached the hits: the winner's screen (obj1+0x1bbd8), then the zone chooser again (versus.flow).
function endVersus() {
  const V = state.versus; state.shoot.scores = V.scores; state.result = null; state.audio?.stopAll();
  state.versusEnd = { layout: winnerLayout(V.scores, V.hits, state.shoot.slots), art: { ...duckArt(), cars: archiveMembers(state.dat).get('CARS.SP') } };
  state.screen = 'versusEnd'; state.keys.clear(); state.last = performance.now();
}

// A human finished the two player race (obj1+0x2150c): every racer's cup points are 9 less its place, added to the totals; the leaderboard follows as after a single player race.
function endVersusRace() {
  const places = finalPlaces(state); state.audio?.stopAll(); state.result = null;
  state.totals = (state.totals ?? state.slots.map(() => 0)).map((t, n) => t + racePoints(places[n]));
  enterBoard();
}

function drawVersusEnd() {
  const e = state.versusEnd; blit(rgbaPalette(renderWinner(index, e.art, e.layout)));
  $('readout').innerHTML = `<dt>Match</dt><dd>${state.shoot.scores.join(' : ')}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'The winner screen of the two player shoot-out (versus.flow) matches a grab of the running game; the song of the screen and the key it waits for are not checked.';
}

function finishDuckEntry() {
  const f = state.duckFlow; f.table = insertDuck(f.table, f.entry.name.trim(), f.score); f.dirty = true; f.entry = null; state.screen = 'duckEnd'; state.last = performance.now();
}

// ---- the demo race (demo.flow): ORDERING, INSTRUCTIONS and the attract mode run a race whose controls come from the track's .BMC file
function startDemo(kind, race = null) {
  const spec = demoSpec(kind, race), members = archiveMembers(state.dat), file = members.get(`${spec.track}${demoModel().bmc.suffix}`);
  state.demo = { kind, spec, mode: spec.mode, bmc: bmcStart(file ? parseBmc(file) : []), page: 1, pages: spec.pages.length, pictures: kind === 'attract' ? null : spec.pages.map(n => decodePcxMember(members.get(n))), escape: false };
  state.demoDriver ??= 0; state.humanSlot = state.demoDriver; state.cup = null; state.carry = null; state.result = null; state.screen = 'race'; state.keys.clear();
  $('track').value = String(spec.track); $('detail').value = String(spec.detail);
  startTrackWith({ name: String(spec.track), engine: spec.engine, cls: classOf(spec.class), laps: spec.laps });
  state.fadeIn = { since: null }; // a demo race fades its first frame in from black before it runs (demo.fade-in)
}
function restartDemo() { const d = state.demo; d.bmc = bmcStart(d.bmc.records); startTrackWith({ name: String(d.spec.track), engine: d.spec.engine, cls: classOf(d.spec.class), laps: d.spec.laps }); state.fadeIn = { since: null }; }
function leaveDemo() {
  state.demo = null; state.demoDriver = ((state.demoDriver ?? 0) + 1) % demoModel().drivers; // the counter of the next demo's driver (obj1+0xe5e0)
  state.audio?.stopAll(); state.humanSlot = null; returnToMenu();
}
// The attract mode's loop (obj1+0xe5d0 to +0xe69f): the driver of the next demo is the next one, and the race after this one gets its card (LOADING DEMO over the menu picture) until the race word passes 5.
function nextAttract() {
  const d = state.demo, race = nextRace(d.spec);
  state.demoDriver = ((state.demoDriver ?? 0) + 1) % demoModel().drivers; state.audio?.stopAll();
  if (race === null) { state.demo = null; state.humanSlot = null; returnToMenu(); return; }
  state.snapshot = { index: Uint8Array.from(state.menuArt.title.indices), rgba: state.menuArt.rgba };
  state.demoNext = race; state.demo = null; state.screen = 'menu'; enterCard(true, true);
}
// One frame of a demo race: Esc leaves, the slides turn their page, the end flag leaves the attract mode and restarts a slide's race, else the race runs on the file's controls.
function tickDemo() {
  const d = state.demo, has = k => state.keys.has(k);
  if (d.escape) { leaveDemo(); return; }
  if (d.mode === demoModel().modes.slides) d.page = turnPage(d.page, d.pages, { next: ['ArrowDown', 'ArrowRight', 'Enter', 'Space', 'AltLeft', 'AltRight'].some(has), previous: has('ArrowUp') || has('ArrowLeft') });
  if (state.intro) { stepRace(state, {}); playSounds(); return; } // the intro's passes do not read the demo's controls (race.intro)
  const step = bmcStep(d.bmc); d.bmc = step.state;
  if (step.controls.end) { if (d.mode === demoModel().modes.attract) nextAttract(); else restartDemo(); return; }
  const c = step.controls;
  state.detail = Number($('detail').value); // the steering rate follows the detail level (race.class-setup)
  stepRace(state, { accelerate: c.accelerate, brake: c.brake, left: c.left, right: c.right, spin: c.spin, fire: c.fire });
  playSounds();
}

// The keyboard of the manual (player 1) unless the player set another layout: the arrows steer, Alt accelerates, Down brakes, Space is the hand brake turn and Ctrl fires a hog or drops the held item.
function tickOnce() {
  if (state.demo) { tickDemo(); return; }
  if (state.linkPlay) return tickLink();
  const has = k => state.keys.has(k);
  if (state.versus) { // the two humans of the split screen (versus.js)
    const keys = versusKeys(has, state.menu.settings.keys);
    for (const t of state.tauntQueue ?? []) keys[t.player ? 'p2' : 'p1'].taunt = t.id; state.tauntQueue = [];
    stepRace(state, keys); playSounds(); return;
  }
  state.detail = Number($('detail').value); // the detail level sets the steering rate (race.class-setup)
  stepRace(state, inputOf(has, state.menu.settings.keys, 0)); // the first player's keys: the game's table or the layout set in the keyboard menu (keys.js)
  playSounds();
}

function blit(palette) {
  for (let i = 0; i < index.length; i++) { const p = index[i] * 4; image.data[i * 4] = palette[p]; image.data[i * 4 + 1] = palette[p + 1]; image.data[i * 4 + 2] = palette[p + 2]; image.data[i * 4 + 3] = 255; } // @math RGBA
  show();
}

// The main menu: the picture, the nine items, the selection icons and the two corner cars, all as the game draws them (menu.screen-model).
function drawMenu() {
  const art = state.menuArt;
  renderMenu(index, art, viewOf(state.menu));
  const title = bannerOfMenu(state.menu.id, state.menu.settings);
  if (title) { const b = bannerOf(title.text); drawBox(index, b.x, title.row, b.width, b.height, b.border, b.fill); drawText(index, state.hudArt.ofont, title.text, b.x + b.margin, title.row + b.margin); } // the engine menu's boxed title (menu.engine-banner)
  blit(art.rgba);
  $('readout').innerHTML = `<dt>Menu</dt><dd>${state.menu.id}</dd><dt>Selected</dt><dd>${menuDef(state.menu.id, state.menu.settings).items[state.menu.cursor - 1]}</dd>`;
  $('badge').className = 'badge bad';
  $('badge').textContent = 'Not observed yet and approximated here: the state the menu animations start in, whether a held key repeats, and Esc while the icons animate. SINGLE PLAYER RACING leads through the class, laps, engine and race type menus into the race (the vehicle screen, the cup board and the track preview are not ported: the track chosen on the page is used); the menus of GAME OPTIONS and COMM-BAT PLAY (as far as recorded) work, the other items say they are not ported yet.';
}

// One step of the menu per 8 counts of the 136 Hz clock, with the first key pressed since the last step.
function stepMenuClock(now) {
  state.menuAccumulator += Math.min(now - state.last, 250); // @math at most a quarter second at a time after a pause
  const ms = frameMs(menuPeriod());
  while (state.menuAccumulator >= ms) {
    const key = state.menuKey ?? state.menuHeld, read = isSettled(state.menu), before = state.menu.settings.sound, { menu, chosen, notice } = stepFrame(state.menu, key); state.menu = menu;
    if (menu.settings.sound !== before) { saveDevices(menu.settings.sound); state.audio?.setDevices(menu.settings.sound); } // a device picked in the sound menus (sound-devices.js)
    state.menuKey = null; state.menuAccumulator -= ms;
    if (state.linkPlay && state.menu.id === 'main') { abortLink(); return; } // the host left the setup menus: the link is given up
    if (key === 'escape' && read) state.menuHeld = null; // Esc is read once and the routine waits for its release (obj1+0x626a to +0x628f)
    // a cursor key that is still held is read again at the next pass with the icons settled (menu.input-sampling)
    if (state.idleMenu !== menu.id || key === 'up' || key === 'down') { state.idleMenu = menu.id; state.idle = 0; } else state.idle += 1; // the menu loop's idle count: a cursor key or another menu starts it again (obj1+0x630f, +0x631b)
    if (menu.id === 'main' && state.idle >= demoModel().idle.steps && !chosen) { state.idle = 0; enterCard(true); return; } // 500 idle steps on the main menu start the attract mode (obj1+0xfa9a)
    if (notice) { enterNotice(notice); return; } // the class item's explanation (menu.kid-notice)
    if (menu.settings.detail.single !== Number($('detail').value)) $('detail').value = String(menu.settings.detail.single); // the detail level chosen in the menus is the page's
    if (chosen) { chooseItem(chosen); if (state.screen !== 'menu') return; }
  }
}

// What the page does with an item that is not just another menu: the single player race starts, everything else says it is not ported.
// The Info menu's halls (menu.famous-menus): the board or the hall of fame of a cup, then the menu again.
function returnToMenu() { state.screen = 'menu'; state.keys.clear(); state.menuAccumulator = 0; }
// ---- the saved game (race.save-game): the record of a cup race's start, kept in this browser's storage as the game keeps it in WACKY.CFG
const SAVE_KEY = 'wackywheels.save';
function savedGame() { try { const kept = localStorage.getItem(SAVE_KEY); return kept ? JSON.parse(kept) : null; } catch { return null; } }
function persistSave() {
  if (!state.saveRecord) return false;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.saveRecord)); return true; } catch { return false; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing kept */ } }
function restoreGame(record) {
  const r = restoreOf(record);
  state.humanSlot = r.humanSlot; state.slots = r.slots; state.totals = r.totals; state.cup = r.cup; state.carry = r.carry; state.tries = 3; // @math the tries word is 3 at the race routine's entry (obj1+0x1fe7d)
  state.menu = { ...state.menu, settings: { ...state.menu.settings, flow: { ...state.menu.settings.flow, ...r.flow } } }; $('engine').value = String(r.flow.engine);
  state.vehicleArt ??= loadVehicleArt(state.menuArt, archiveMembers(state.dat)); enterCard();
}

// LEAVE GAME: the game ends on its DOS text screen, WWREG.BIN for an archive that has 42.GAM and WWSW.BIN for a shareware one (exit.screen-select, archive.edition-probe); a key brings the menu back here.
function showExit() {
  const members = archiveMembers(state.dat), registered = members.has('42.GAM'), box = exitScreen(members.get(registered ? 'WWREG.BIN' : 'WWSW.BIN')), stage = $('stage');
  if (display.fullscreen()) document.exitFullscreen?.().catch(() => {}); // the text screen is beside the picture, not in it
  box.id = 'exit'; stage.hidden = true; stage.after(box); state.screen = 'exit'; state.keys.clear(); state.audio?.songStop(); state.audio?.engineStop();
  setMessage('The game has ended. Press any key to return to the main menu.');
}
function leaveExit() { $('exit')?.remove(); $('stage').hidden = false; display.layout(); setMessage(''); state.screen = 'menu'; state.menuAccumulator = 0; state.musicName = null; state.musicScreen = null; state.keys.clear(); }

// CREDITS (menu.credits): the car drives along the lines and the text appears behind it; the routine's steps run on the 136 Hz clock, Esc leaves.
function enterCredits() {
  state.creditsArt ??= loadCreditsArt(state.menuArt, archiveMembers(state.dat));
  state.credits = { c: startCredits(), wait: 0, escape: false, advance: false };
  state.screen = 'credits'; state.last = performance.now(); state.keys.clear();
}
function runCredits(now) {
  const s = state.credits; s.wait += Math.min(now - state.last, CREDITS_CATCH_UP_MS);
  while (s.wait >= stepMs(s.c)) {
    s.wait -= stepMs(s.c);
    const r = stepCredits(s.c, { escape: s.escape, advance: s.advance });
    s.escape = false; s.advance = false;
    if (r.finished) { state.credits = null; returnToMenu(); return; }
    s.c = r.state;
  }
}
function drawCredits() {
  renderCredits(index, state.creditsArt, state.credits.c);
  blit(state.menuArt.rgba);
  $('readout').innerHTML = `<dt>Credits</dt><dd>page ${state.credits.c.page} of 5</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with recorded frames yet: the credits pages (menu.credits, read in full and seen once); the keys that turn a page are approximated.';
}

// VOLUME LEVELS (menu.volume-screen): the three volumes are kept in this browser (the game keeps them in WACKY.CFG); the screen previews the effects and the engine.
const VOLUME_KEY = 'wackywheels.volumes';
function storedVolumes() {
  const D = defaultVolumes();
  try { const kept = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? 'null'); return KINDS.every(k => Number.isInteger(kept?.[k]) && kept[k] >= 0 && kept[k] <= volumeModel().volume.max) ? kept : D; } catch { return D; }
}
function applyVolumes() { for (const k of KINDS) state.audio?.setVolume(k, state.volumes[k]); }
function enterVolume() {
  state.volumeArt ??= loadVolumeArt(state.menuArt, archiveMembers(state.dat));
  state.volume = { s: startVolume(state.volumes), wait: 0, escape: false };
  state.screen = 'volume'; state.last = performance.now(); state.keys.clear();
  state.audio?.engineStart(); // the engine loop plays while the screen is up (obj1+0xd04)
}
function runVolume(now) {
  const v = state.volume; v.wait += Math.min(now - state.last, CREDITS_CATCH_UP_MS);
  while (v.wait >= frameWait()) {
    v.wait -= frameWait();
    const pv = stepPreview(v.s.preview, Boolean(state.audio?.isPlaying(volumeModel().preview.sound)));
    if (pv.play) state.audio?.play({ id: volumeModel().preview.sound });
    const has = k => state.keys.has(k), r = stepVolume({ ...v.s, preview: pv.preview }, { up: has('ArrowUp'), down: has('ArrowDown'), left: has('ArrowLeft'), right: has('ArrowRight'), escape: v.escape });
    v.escape = false; v.s = r.state;
    if (r.changed) {
      state.volumes = { ...state.volumes, ...r.state.volumes };
      state.audio?.setVolume(r.changed, state.volumes[r.changed]);
      if (r.changed !== 'music') { state.audio?.engineStop(); state.audio?.engineStart(); } // a change of the effects or engine volume restarts the engine (obj1+0xd04)
      try { localStorage.setItem(VOLUME_KEY, JSON.stringify(state.volumes)); } catch { /* not kept */ }
    }
    if (r.done) { state.audio?.stopAll(); state.volume = null; returnToMenu(); return; }
  }
}
function drawVolume() {
  renderVolume(index, state.volumeArt, state.volume.s);
  blit(state.menuArt.rgba);
  $('readout').innerHTML = KINDS.map(k => `<dt>${k}</dt><dd>${state.volume.s.volumes[k]}</dd>`).join('');
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with recorded frames yet: the volume screen (menu.volume-screen, read in full; its bars were measured once); the left and right keys are approximated.';
}

function chooseItem(action) {
  if (action.display) { const d = action.display, s = display.settings; if (d.fullscreen || (d.crt && !display.crtReady())) return; setDisplay(d.scaling ? nextScaling(s) : d.aspect ? nextAspect(s) : d.crt ? toggleCrt(s) : d.level ? cycleCrtLevel(s, d.level) : defaultCrtLevels(s)); return; } // GAME OPTIONS > DISPLAY AND EFFECTS > DISPLAY OPTIONS (display-menu.js); FULL SCREEN was done in the key's handler, where the browser allows it; CRT LOOK NONE (no WebGL 2) does nothing
  if (action.graphics) { const g = action.graphics, s = enh.settings; setGraphics(g.preset ? nextPreset(s) : g.toggle ? toggle(s, g.toggle) : g.cycle ? cycleLevel(s, g.cycle) : defaultLevels(s)); return; } // GAME OPTIONS > DISPLAY AND EFFECTS (graphics-menu.js): the same settings as the panel's
  if (action.link) { startLink(action.link); return; } // COMM-BAT PLAY: WEBRTC PEERJS and WEBRTC LOCAL (play-link.js)
  if ('duo' in action && state.linkPlay) { linkMode(action.duo); return; } // the host's choice of the link race
  if (action.race === 1 && state.linkPlay) { hostStart(action.settings.flow); return; }
  if (action.duoMenu) { state.menu = enterMenu('duoMode', [{ id: 'main', cursor: 2 }], state.menu.settings); return; } // TWO PLAYER RACE: head to head or with all cars (versus.race-rules) // @math the cursor of TWO PLAYER RACE
  if ('duo' in action) { state.duo = { cars: action.duo }; state.shoot = null; enterVehicle('duo1'); return; }
  if (action.shoot) { state.duo = null; enterVehicle('shoot1'); return; } // TWO PLAYER SHOOT OUT: the vehicle screens first (versus.flow)
  if ('hits' in action) { state.shoot.hits = SHOOT().hitsMenu[action.hits - 1]; afterDuckVehicle('shoot'); return; } // the zones follow like the duck game's
  if (action.duck) { enterVehicle('duck'); return; } // WACKY DUCK SHOOT: the vehicle screen first (duck.flow)
  if ('duckZones' in action) { enterChooser(action.duckZones); return; }
  if (action.volume) { enterVolume(); return; }
  if (action.rebind) { enterKeySet(action.rebind.player, action.rebind.slot); return; } // a line of a keyboard menu: the prompt for the key (the page's own menus)
  if (action.keysDefault) { setKeys(defaultKeys()); return; } // DEFAULT KEYS: the game's table
  if (action.credits) { enterCredits(); return; }
  if (action.slides) { startDemo(action.slides); return; }
  if (action.leave) { showExit(); return; }
  if (action.restore) { restoreGame(savedGame()); return; }
  if (action.newGame) { clearSave(); enterVehicle('class'); return; } // the first menu of the setup (menu.vehicle-screen)
  if (action.vehicle && savedGame()) { state.menu = enterMenu('restore', [{ id: 'main', cursor: 1 }], state.menu.settings); return; } // a saved game: RESTORE SAVED GAME or START NEW GAME first (obj1+0xfbe1)
  if (action.famous) { enterFamous(action.famous.cup + packOf(), action.famous.cls, 'menu', Number($('engine').value)); return; }
  if (action.hall) { showHall(action.hall.cup, action.hall.race, trialTable(Number($('engine').value)), null, 'view', 'menu', Number($('engine').value)); return; }
  if (action.vehicle) { enterVehicle(action.vehicle); return; }
  if (action.race === 1) { // @math the single player race: the last setup menu starts it; the engine chosen there (item 1 FAST 12 HP, item 2 SLOW 6 HP) is the page's
    $('engine').value = String(action.settings.flow.engine);
    enterCupBoard(); setMessage(''); return;
  }
  const what = action.race ? 'this race mode' : action.leave ? 'leaving the game (close the tab)' : action.pending ?? 'this item';
  setMessage(`${what} is not ported yet.`);
}

// One step of the in-race menu per 8 counts of the 136 Hz clock, with the first key pressed since the last step; the choice acts on the race.
function stepPauseClock(now) {
  state.pauseAccumulator += Math.min(now - state.last, 250); // @math at most a quarter second at a time after a pause
  const ms = frameMs(menuPeriod());
  while (state.pauseAccumulator >= ms && state.pause) {
    const { pause, chosen } = stepPause(state.pause, state.pauseKey); state.pause = pause; state.pauseKey = null; state.pauseAccumulator -= ms;
    if (chosen === 'back') { state.pause = null; state.accumulator = 0; }
    else if ((state.duck || state.versus?.kind === 'shootout') && chosen === 'leave') { state.pause = null; enterChooser(state.duckFlow.bonus); return; } // LEAVE ZONE: back to the chooser without the end screen (duck.flow)
    else if (chosen === 'restart') { state.pause = null; startTrack(); }
    else if (chosen === 'leave' || chosen === 'save') {
      state.pause = null; const saved = chosen === 'save' && persistSave(); // SAVE AND QUIT keeps the record of the race's start and leaves the game (obj1+0x21b4a); the page goes back to the menu
      if (chosen === 'leave' && state.cup) enterCupBoard(); else { state.screen = 'menu'; state.keys.clear(); state.menuAccumulator = 0; }
      setMessage(chosen === 'save' ? (saved ? 'SAVE AND QUIT: the cup is saved; choose SINGLE PLAYER RACING to restore it.' : 'SAVE AND QUIT: only a cup race can be saved.') : '');
    }
  }
}

const sceneA = new Uint8Array(320 * 200), sceneB = new Uint8Array(320 * 200); // @math the screen picture of each viewer
// The split screen (versus.layout): the first viewer's picture below, the second's 100 rows higher, the strips over them, the message of a round's end over both.
function drawVersus() {
  const mode = state.menu.settings.detail.split;
  renderScene(state, sceneA, mode);
  swapSeat(state); renderScene(state, sceneB, mode); swapSeat(state);
  composeSplit(sceneA, sceneB, index);
  versusOverlays(state, index);
  blit(raceRgba());
  versusReadout();
}
// Everything the split screen draws over the two viewers, from the state `s` (the race's, or the enhanced presentation's copy of it).
function versusOverlays(s, fb) {
  const V = s.versus;
  drawStrips(fb, state.hudArt, stripValues(s), { shoot: V.kind === 'shootout' }); // the shoot-out's SCORE words; the race's strips are blank there
  if (V.kind === 'race') drawRaceHud(fb, state.hudArt, raceValues(s), hudGates(state.menu.settings));
  carsOf(s).forEach((c, n) => { if (c.inverted !== 0) flipViewport(fb, n); }); // a car hit by an inverting shot sees its half upside down (versus.layout)
  if (V.message) drawMessage(fb, state.hudArt.ofont, messageAt(V.message.text));
  if (state.pause) renderMenuOverlay(fb, state.menuArt, pauseView(state.pause));
}
function versusReadout() {
  const V = state.versus, [a, b] = [state.car, state.seat2.car];
  $('readout').innerHTML = `<dt>Tick</dt><dd>${state.tick}</dd><dt>Score</dt><dd>${V.scores.join(' : ')} of ${V.hits}</dd><dt>One</dt><dd>${a.cx}, ${a.cy} ${a.heading}</dd><dt>Two</dt><dd>${b.cx}, ${b.cy} ${b.heading}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with the running game beyond the first frame of a round: the two player shoot-out as read from the code (versus.shootout-rules).';
}

function draw() {
  if (enh.active()) { drawEnhanced(); return; }
  if (state.linkPlay && state.versus) { drawLinkRace(); return; }
  if (state.versus) { drawVersus(); return; }
  const mode = Number($('detail').value);
  state.detail = mode; drawRaceFrame(state, index);
  if (state.pause) renderMenuOverlay(index, state.menuArt, pauseView(state.pause)); // the in-race menu over the frozen frame (race.pause-menu)
  blit(raceRgba());
  raceReadout();
}
function raceReadout() {
  const c = state.car, row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  $('readout').innerHTML = row('Tick', state.tick) + row('Throttle', c.throttle) + row('Speed', c.speed) + row('Camera', `${c.cx}, ${c.cy}`) + row('Heading', c.heading);
  $('badge').className = state.unproven.size ? 'badge bad' : 'badge';
  $('badge').textContent = state.unproven.size ? `Not proven yet and approximated here: ${[...state.unproven].join(', ')}.` : 'Every rule used so far is proven (the sky, the horizon, the floor, the straight road, the objects, the player car, the speedometer, the timer, the top banner, the driver name, the laps, the lap text and the reaction figure); the minimap, the held item, the finish and what follows it, the AI cars, pickups and sound are not ported yet.';
}

// The race screens through the Enhanced presentation (src/enhance): the picture between the last two ticks, the effects on the world's
// pixels, the same overlays as the reference renderer drawn from the presented state. `alpha` is how far the clock is toward the next tick.
let gfxShown = 0;
function drawEnhanced() {
  const alpha = Math.min(state.accumulator / frameMs(), 1), palette = raceRgba(), cap = fadeCap(), out = image.data;
  if (state.versus && !state.linkPlay) {
    enh.drawSplit(state, alpha, { index, out, palette, cap, mode: state.menu.settings.detail.split, overlays: versusOverlays });
    show(); versusReadout();
  } else {
    const L = state.linkPlay && state.versus ? state.linkPlay : null;
    if (!L) state.detail = Number($('detail').value);
    const P = enh.drawSingle(state, alpha, { index, out, palette, cap, mode: state.detail, sky: sceneSky(state), seat: L ? L.seat : 0, overlays: (s, fb) => {
      if (L) { const cars = carsOf(s); s.minimapOthers = [{ x: cars[1 - L.seat].px, y: cars[1 - L.seat].py }, ...(s.ai ? s.ai.racers.slice(VERSUS_RACE().firstComputer) : [])]; } // the link race's overlay map: the other human, then the computer racers
      drawRaceOverlays(s, fb);
      if (state.pause) renderMenuOverlay(fb, state.menuArt, pauseView(state.pause)); // the in-race menu over the frozen frame (race.pause-menu)
    } });
    if (!state.minimap && P.minimap) state.minimap = P.minimap; // the overhead map's picture and rectangle are kept from the race's first frame (hud.minimap-draw)
    show();
    if (L) { const [a, b] = carsOf(state); $('readout').innerHTML = `<dt>Link</dt><dd>${L.session.phase}, round trip ${Math.round(L.session.rtt ?? 0)} ms</dd><dt>Frame</dt><dd>${L.session.simFrame}</dd><dt>One</dt><dd>${a.cx}, ${a.cy} ${a.heading}</dd><dt>Two</dt><dd>${b.cx}, ${b.cy} ${b.heading}</dd>`; $('badge').className = 'badge bad'; $('badge').textContent = LINK_BADGE; } else raceReadout();
  }
  const now = performance.now();
  if (now - gfxShown > 500) { gfxShown = now; const s = enh.stats(); $('gfx-stats').textContent = `${enh.settings.smooth ? `Smooth motion shows the race ${Math.round(s.delay)} ms behind its last tick (mean). ` : ''}Draw ${s.ms.toFixed(1)} ms a frame, ${s.particles} particles, ${s.marks} skid mark segments.`; } // @math twice a second
}

// The graphics panel: the preset, the effect switches, the levels and the reset, kept in this browser apart from the game's own settings.
const LEVEL_KEYS = Object.keys(LEVELS);
function showGraphics() {
  const s = enh.settings;
  $('gfx-preset').value = s.preset;
  for (const k of EFFECTS) $(`gfx-${k}`).checked = s[k];
  for (const k of LEVEL_KEYS) $(`gfx-${k}`).value = String(s[k]);
  $('gfx-shadowStrength').disabled = !(s.shadows || s.sceneryShadows || s.sunShadows); $('gfx-fogStrength').disabled = !s.fog; $('gfx-particleAmount').disabled = !s.particles; $('gfx-sunAngle').disabled = !s.sunShadows;
  if (!enh.active()) $('gfx-stats').textContent = 'The reference renderer draws the race.';
  if (state.menu) state.menu = { ...state.menu, settings: { ...state.menu.settings, graphics: menuView(s) } }; // the game menu's DISPLAY AND EFFECTS shows the same settings
}
// The track's atmosphere (src/enhance/atmosphere.js), set in the track editor: what the clouds, the lighting and the fog draw this track with.
function showAtmosphere() { if (state.world) $('gfx-atmosphere').textContent = `Track ${state.world.name}'s atmosphere: ${describeAtmosphere(enh.atmosphereOf(state.world))} (set in the track editor's Atmosphere tab).`; }
function setGraphics(next, control) { enh.configure(next); showGraphics(); control?.blur(); } // a focused control would take the race's keys (Space toggles a box, the arrows move a slider)
$('gfx-preset').addEventListener('change', e => setGraphics(applyPreset(enh.settings, e.target.value), e.target));
for (const k of EFFECTS) $(`gfx-${k}`).addEventListener('change', e => setGraphics(change(enh.settings, k, e.target.checked), e.target));
for (const k of LEVEL_KEYS) { $(`gfx-${k}`).addEventListener('input', e => setGraphics(change(enh.settings, k, Number(e.target.value)))); $(`gfx-${k}`).addEventListener('change', e => e.target.blur()); }
$('gfx-reset').addEventListener('click', e => setGraphics(resetSettings(), e.target));
showGraphics();

// The display panel: the scaling, the shape, full screen, the CRT look and its levels, kept in this browser apart from the graphics settings.
let dspShown = 0;
function showDisplay() {
  const s = display.settings, ready = display.crtReady(), full = display.fullscreen();
  $('dsp-scaling').value = s.scaling; $('dsp-aspect').value = s.aspect; $('dsp-crt').checked = s.crt && ready; $('dsp-crt').disabled = !ready;
  for (const k of CRT_LEVELS) { $(`dsp-${k}`).value = String(s[k]); $(`dsp-${k}`).disabled = !(s.crt && ready); }
  $('dsp-fullscreen').textContent = full ? 'Leave full screen' : 'Full screen'; $('dsp-fullscreen').disabled = !document.fullscreenEnabled;
  showDisplayStats(true);
  if (state.menu) state.menu = { ...state.menu, settings: { ...state.menu.settings, display: displayView(s, { fullscreen: full, crtReady: ready }) } }; // the game menu's DISPLAY OPTIONS (under DISPLAY AND EFFECTS) shows the same settings
}
function showDisplayStats(now = false) {
  const t = performance.now(); if (!now && t - dspShown < 500) return; dspShown = t; // @math twice a second
  const d = display.stats(), r = d.rect;
  $('dsp-stats').textContent = d.mode === 'gl' ? `Drawn by the graphics card at ${r.w} by ${r.h} screen pixels (${(r.w / screen.width).toFixed(2)} by ${(r.h / screen.height).toFixed(2)} for a pixel${r.integer ? ', whole rows' : ''}), ${d.ms.toFixed(2)} ms a frame.` : d.mode === 'css' ? `Scaled by the browser: ${d.lost ? "the graphics card's context was lost (the browser may give it back)" : d.failure && typeof WebGL2RenderingContext === 'function' ? `the graphics card could not be used (${d.failure})` : 'this browser has no WebGL 2'}, so the CRT look and the sharp scaling are not available.` : 'The page as it was: the browser scales the canvas itself.';
}
function setDisplay(next, control) { display.configure(next); saveDisplay(display.settings); showDisplay(); control?.blur(); } // a focused control would take the race's keys
$('dsp-scaling').addEventListener('change', e => setDisplay(changeDisplay(display.settings, 'scaling', e.target.value), e.target));
$('dsp-aspect').addEventListener('change', e => setDisplay(changeDisplay(display.settings, 'aspect', e.target.value), e.target));
$('dsp-crt').addEventListener('change', e => setDisplay(changeDisplay(display.settings, 'crt', e.target.checked), e.target));
for (const k of CRT_LEVELS) { $(`dsp-${k}`).addEventListener('input', e => setDisplay(changeDisplay(display.settings, k, Number(e.target.value)))); $(`dsp-${k}`).addEventListener('change', e => e.target.blur()); }
$('dsp-fullscreen').addEventListener('click', e => { display.toggleFullscreen(); e.target.blur(); });
$('dsp-reset').addEventListener('click', e => setDisplay(resetDisplay(), e.target));
display.configure(loadDisplay()); showDisplay();

// ---- the vehicle screen in front of the setup menus (menu.vehicle-screen)
function enterVehicle(first) {
  const second = first === 'shoot2' || first === 'duo2' || first === 'link2', two = second || first === 'shoot1' || first === 'duo1' || first === 'link1'; // the link's two players each choose on their own machine (the host first) // the two player modes ask both players: the second one's car list has the first one's crossed out (versus.flow)
  if (!two) state.duo = null;
  state.vehicle = { v: createVehicle(two ? { player: second ? 1 : 0, taken: second ? (state.shoot ?? state.duo ?? state.linkPlay).slots[0] : null } : {}), art: state.vehicleArt ??= loadVehicleArt(state.menuArt, archiveMembers(state.dat)), wait: 0, next: first, key: null, since: performance.now() }; // @math the intro's first pass has no wait
  state.screen = 'vehicle'; state.last = performance.now(); state.keys.clear();
}

function stepVehicleClock(now) {
  const c = state.vehicle; if (c.help) return; // the game does not run its passes while the controls screen waits for a key
  c.wait -= Math.min(now - state.last, 250) * 136 / 1000; // @math at most a quarter second at a time; 136 counts a second
  while (c.wait <= 0 && state.screen === 'vehicle') {
    const out = stepVehicle(c.v, c.key); c.v = out.vehicle; c.key = null; c.wait += out.wait; // the first key since the last pass
    if (out.help) { c.help = { armed: false }; return; } // F1 (menu.controls-help): the screen waits for F1 to be released and then for a key
    if (out.leave === 'menu') { saveDuckTable(); if (state.linkPlay) abortLink(); state.screen = 'menu'; state.menuAccumulator = 0; return; }
    if (out.leave && (c.next === 'link1' || c.next === 'link2')) { linkPicked(out.leave.slot); return; }
    if (out.leave && c.next === 'shoot1') { state.shoot = { slots: [out.leave.slot], hits: 5 }; enterVehicle('shoot2'); return; } // @math the default hits are the first item's
    if (out.leave && c.next === 'shoot2') { state.shoot.slots[1] = out.leave.slot; state.menu = enterMenu('hits', [{ id: 'main', cursor: 3 }], state.menu.settings); state.screen = 'menu'; state.menuAccumulator = 0; return; } // @math the cursor of TWO PLAYER SHOOT OUT
    if (out.leave && c.next === 'duo1') { state.duo.slots = [out.leave.slot]; enterVehicle('duo2'); return; }
    if (out.leave && c.next === 'duo2') { state.duo.slots[1] = out.leave.slot; state.menu = state.duo.cars === 2 ? enterMenu('duoClass', [{ id: 'main', cursor: 2 }], state.menu.settings) : enterSetup(state.menu, 'laps'); state.screen = 'menu'; state.menuAccumulator = 0; return; } // the class menu only with all cars; the laps, engine and race type menus follow (versus.flow)
    if (out.leave && c.next === 'duck') { state.humanSlot = out.leave.slot; state.slots = null; afterDuckVehicle(); return; }
    if (out.leave) { state.humanSlot = out.leave.slot; state.slots = null; state.menu = enterSetup(state.menu, c.next); state.screen = 'menu'; state.menuAccumulator = 0; return; }
  }
}

function drawVehicle() {
  const c = state.vehicle, vga = c.help ? renderControlsHelp(index, c.art, { player: c.v.player ?? 0, versus: c.v.player !== null, controller: vehicleLayout().controller.text, names: namesOf(state.menu.settings.keys, state.linkPlay ? 0 : c.v.player ?? 0) }) : renderVehicle(index, c.art, c.v); // the second player of a two player game has the second player's keys
  blit(rgbaPalette(vga));
  $('readout').innerHTML = `<dt>Vehicle</dt><dd>${c.v.phase}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet beyond the idle screen: the vehicle screen (menu.vehicle-screen); the zoom of the texts in its intro and the pictures of the chosen animation are not ported.';
}

// ---- the screens around the race: the loading card with the track preview, the leaderboard and the menu after a lost race (race.cup-flow, race.leaderboard)
const LOADING_MS = 700; // @math how long the loading banner stays on: the game's time is its file loading, which the port has no counterpart of
const CREDITS_CATCH_UP_MS = 250; // @math the longest stretch of wall clock one frame turns into credits steps (a throttled tab does not fast-forward the pages)
const FADE_MS = 1000 / 70; // @math one step of the palette fade is one retrace of the 70 Hz VGA mode
const RETRY_ITEMS = [' TRY TO QUALIFY ', ' LEAVE RACE     ']; // obj2+0x1a3c and +0x1a14 (obj1+0x219f3 to +0x21a5b); the fifth race says TRY AGAIN, the saving item is left out here
const isTrial = () => classOf(state.menu.settings.flow.class).class === trialClass(); // the menu's class is the time trial (race.time-trial)
const WAIT_KEYS = ['Enter', 'Space', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'ArrowUp', 'KeyA']; // the keys that end the card and the leaderboard: Enter, Space and the buttons of the player

// The race's palette: the track's, with the DAC entries the palette cycler has rewritten (palette.cycle-rules).
const fadeNow = () => (state.fadeIn ? fadeLevel(Math.floor(((performance.now()) - (state.fadeIn.since ?? performance.now())) / FADE_STEP_MS)) : null);
const fadeCap = () => { const level = fadeNow(); return level === null ? 255 : Math.min((level << 2) | (level >> 4), 255); }; // @math the fade's 6-bit level widened to 8 bits: the brightest an effect's colour may be
function raceRgba() {
  const level = fadeNow();
  if (level !== null) return rgbaPalette(state.world.palette.map(v => Math.min(v, level))); // the first frame of a demo race fades in (demo.fade-in)
  const entries = shownCycle(state)?.entries;
  if (!entries?.size) return rgba;
  const out = Uint8ClampedArray.from(rgba);
  for (const [entry, c] of entries) c.forEach((v, k) => { out[entry * 4 + k] = (v << 2) | (v >> 4); }); // @math four bytes an entry; 6 bits widened to 8 by repeating the top bits
  return out;
}

function snapshotScreen() { state.snapshot = { index: index.slice(), rgba: raceRgba(), image: enh.active() ? Uint8ClampedArray.from(image.data) : null }; } // the enhanced picture as it was shown

// A cup from the menu: Bronze (the cup board is not ported), regular or bonus pack races, three tries.
function beginCup(cup = 1) { state.cup = startCup(cup, state.menu.settings.flow.races === 2); state.totals = null; state.tries = 3; state.slots = null; state.carry = { counter: 0, held: 0 }; enterCard(); } // a new cup starts with nothing held (obj1+0x83a7)

// A race of the track chosen on the page, not part of a cup.
function freeRace() { state.cup = null; state.totals = null; state.tries = 3; state.slots = null; state.carry = null; state.screen = 'race'; startTrack(); }

// The cup board (race.cup-board): the pictures and the palette of the cups, the selected cup, the fade in and the blinking bar.
const FADE_STEP_MS = 1000 / 70; // @math one step of the palette fade is one retrace of the 70 Hz VGA mode
function enterCupBoard() {
  const bonus = state.menu.settings.flow.races === 2, files = boardFiles(bonus), boards = (state.cupBoards ??= {})[bonus] ??= loadBoards(archiveMembers(state.dat), files);
  state.cup = null; state.totals = null; state.race = 1; state.tries = 3;
  state.cupboard = { boards, board: enterCupBoardState(boards.palette, state.lastCup ?? 1, isTrial() ? state.lastRace ?? null : null), since: performance.now(), accumulator: 0, keys: {} }; state.screen = 'cupboard'; state.last = performance.now(); // @math the cup word keeps the cup last played
  state.keys.clear();
}

function stepCupBoard(now) {
  const c = state.cupboard; c.accumulator += Math.min(now - state.last, 250); // @math at most a quarter second at a time
  const ms = frameMs(boardPass());
  while (c.accumulator >= ms && state.screen === 'cupboard') {
    const before = c.board.mode, { board, leave } = stepBoard(c.board, c.keys, isTrial()); c.board = board; c.keys = {}; c.accumulator -= ms;
    if (before === 'cup' && board.mode === 'track') state.audio?.play(boardSound()); // the fire key of the cup choice (obj1+0x8d9c)
    if (board.mode === 'track') state.lastRace = board.race; // the race kept for the next visit (obj1+0x8eaf)
    if (leave === 'hall') { state.audio?.play(boardSound()); state.lastCup = board.cup; enterTrialHall(board.cup, board.race, null); return; }
    if (leave === 'cup') { state.audio?.play(boardSound()); state.lastCup = board.cup; beginCup(board.cup); return; } // the accelerate key plays the sound 0x12 (obj1+0x8d9c)
    if (leave === 'menu') { state.screen = 'menu'; state.cup = null; state.menuAccumulator = 0; return; }
  }
}

function drawCupBoard(now) {
  const c = state.cupboard, step = Math.min(Math.floor((now - c.since) / FADE_STEP_MS), fadeSteps()), level = fadeLevel(step);
  renderBoardPicture(index, c.boards, c.board.cup);
  blit(rgbaPalette(c.board.palette.map(v => Math.min(v, level))));
  $('readout').innerHTML = `<dt>Cup board</dt><dd>cup ${c.board.cup}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the cup board (race.cup-board): Up and Down choose the cup, Enter or Space starts it, Esc leaves.';
}

function enterCard(demo = false, keepSnapshot = false) {
  if (!keepSnapshot) snapshotScreen();
  state.card = { stage: 'loading', since: performance.now(), key: false, picture: null, demo }; state.screen = 'card'; state.last = performance.now();
}

function startCupRace() {
  const track = trackOf(state.cup);
  $('track').value = String(track); state.race = state.cup.race; state.result = null;
  state.screen = 'race'; startTrack();
  state.saveRecord = isTrial() ? null : makeSave({ humanSlot: state.humanSlot, flow: state.menu.settings.flow, cup: state.cup, totals: state.totals, slots: state.slots, carry: state.carry, engine: state.engine }); // the record of the race's start (obj1+0x1ff77)
}

function stepCard(now) {
  const c = state.card;
  if (c.stage === 'loading' && c.demo && now - c.since >= LOADING_MS) { state.card = null; const race = state.demoNext ?? null; state.demoNext = null; startDemo('attract', race); return; } // the attract mode's card says LOADING DEMO and goes on to the race (demo.flow)
  if (c.stage === 'loading' && now - c.since >= LOADING_MS) { c.stage = 'preview'; c.since = now; c.picture = decodePcxMember(archiveMembers(state.dat).get(previewName(trackOf(state.cup)))); }
  else if (c.stage === 'preview' && c.key) { c.key = false; startCupRace(); }
}

function drawCard(now) {
  const c = state.card;
  if (c.stage === 'loading') {
    index.set(state.snapshot.index);
    const text = c.demo ? demoModel().cardText : cardText(state.cup), b = bannerOf(text);
    drawBox(index, b.x, b.y, b.width, b.height, b.border, b.fill); drawText(index, state.hudArt.ofont, text, b.x + b.margin, b.y + b.margin);
    blit(state.snapshot.rgba);
  } else {
    index.set(c.picture.indices);
    const step = Math.min(Math.floor((now - c.since) / FADE_MS), fadeSteps());
    blit(rgbaPalette(c.picture.vga.map(v => Math.min(v, fadeLevel(step)))));
  }
  $('readout').innerHTML = `<dt>Card</dt><dd>${c.stage}</dd>` + (state.cup ? `<dt>Cup</dt><dd>${state.cup.cup} race ${state.cup.race}</dd>` : `<dt>Demo</dt><dd>${c.demo ? 'next race' : 'none'}</dd>`); // the loading card of the attract mode has no cup
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the loading card and the track preview (race.cup-flow); the cup board before the first card is not ported.';
}

function enterBoard() {
  snapshotScreen();
  const rows = boardRows(state.totals, state.slots), layout = boardLayout(rows, humansOf(), state.cup ? state.cup.race : state.race, Boolean(state.cup?.bonusRace));
  state.board = { layout, since: performance.now(), key: false, art: state.boardArt ?? (state.boardArt = loadBoardArt(archiveMembers(state.dat))) }; state.screen = 'board'; state.last = performance.now();
}

function drawBoard(now) {
  const b = state.board, counts = ((now - b.since) * 136) / 1000, vga = renderBoard(index, b.art, b.layout, humanFrame(counts)); // @math 136 counts a second
  blit(rgbaPalette(vga));
  $('readout').innerHTML = `<dt>Leaderboard</dt><dd>after race ${state.cup ? state.cup.race : state.race}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the leaderboard (race.leaderboard); the music and what follows the fifth race are not ported.';
}

// ---- the time trial (race.time-trial): the tables of the engine, the hall of fame screen, the name entry and the start of a race
const TIM_KEY = engine => `wackywheels.tim.${engine}`;
function trialTable(engine) {
  try { const kept = localStorage.getItem(TIM_KEY(engine)); if (kept) return JSON.parse(kept); } catch { /* no storage: the defaults */ }
  return trialDefault(archiveMembers(state.dat), engine);
}
function saveTrialTable(engine, table) { try { localStorage.setItem(TIM_KEY(engine), JSON.stringify(table)); } catch { /* the table stays for this visit */ } }
const packOf = () => (state.menu.settings.flow.races === 2 ? 3 : 0); // @math the bonus pack adds 3 to the cup (obj2+0x1ecb4)

// A race of the time trial from the board: the card, then the race on its own.
function beginTrial(cup, race) { state.cup = { ...startCup(cup, packOf() !== 0), race }; state.totals = null; state.tries = 3; state.slots = null; state.lastCup = cup; enterCard(); }

// The race has ended: the check against the records, the name entry when a record was made, then the hall of fame.
function trialResult() {
  const engine = state.engine ?? 1, cup = state.cup.cup, race = state.cup.race, cb = cup + packOf(), table = trialTable(engine), laps = state.lapTimes, total = totalOf(laps), index = trialIndex(cb, race);
  const ev = trialEvaluate(table, index, laps, total), fresh = { laps, total, lapMark: ev.rank, lapRank: -1, overallMark: false };
  if (!ev.needsName) { showHall(cup, race, table, fresh, 'new'); return; }
  const info = trialEntryInfo();
  state.trialArt ??= loadTrialArt(archiveMembers(state.dat)); state.famousArt ??= loadFamousArt(archiveMembers(state.dat));
  state.trialEntry = { e: startEntry(info.chars), info, ev, table, index, cup, race, fresh, total };
  state.screen = 'trialEntry'; state.last = performance.now(); state.keys.clear();
}

function finishTrialEntry() {
  const t = state.trialEntry, engine = state.engine ?? 1, out = insertTimes(t.table, t.index, t.ev, t.e.name, t.total);
  saveTrialTable(engine, out.table); state.trialEntry = null;
  showHall(t.cup, t.race, out.table, { ...t.fresh, lapRank: out.lapRank, overallMark: out.overallMark }, 'new');
}

// The hall of fame screen: `fresh` is the result of a race (mode 'new') or null (mode 'view' from the board).
function showHall(cup, race, table, fresh, mode, back = 'cupboard', engine = state.engine ?? 1) {
  const cb = cup + packOf();
  state.trialArt ??= loadTrialArt(archiveMembers(state.dat));
  state.hall = { layout: trialLayout(table, cb, race, engine, fresh), art: state.trialArt, mode, cup, race, stage: 'fade', since: performance.now(), message: 0, messages: fresh ? messagesOf(fresh.lapRank, fresh.overallMark) : [], wiggle: 0, passAt: 0, key: false, esc: false, back, title: trialTitle(cb, race, engine) };
  state.screen = 'hall'; state.last = performance.now(); state.keys.clear();
}
const enterTrialHall = (cup, race, fresh) => showHall(cup, race, trialTable(state.engine ?? 1), fresh, 'view');

function stepHall(now) {
  const h = state.hall, counts = 1000 / 136; // @math a count of the 136 Hz counter lasts 1000/136 ms
  if (h.stage === 'fade' && now - h.since >= fadeSteps() * FADE_STEP_MS) { h.stage = h.messages.length ? 'message' : 'show'; h.since = now; h.passAt = now; }
  else if (h.stage === 'message' && now - h.since >= trialMessageCounts() * counts) { h.message += 1; h.since = now; if (h.message >= h.messages.length) { h.stage = 'show'; h.passAt = now; } }
  else if (h.stage === 'show') {
    if (now - h.passAt >= trialMarker().counts * counts) { h.wiggle ^= 1; h.passAt = now; }
    if (h.key || h.esc) leaveHall(h.esc);
  }
}

// A key leaves the hall; from the board an Esc stays on the board, any other key starts the race (obj1+0x9124 to +0x9399); after a race the board follows.
function leaveHall(esc) {
  const h = state.hall; state.hall = null; state.keys.clear();
  if (h.back === 'menu') returnToMenu(); // from the Info menu a key goes back to the menu (obj1+0xd6d6)
  else if (h.mode === 'view' && !esc) beginTrial(h.cup, h.race); else enterCupBoard();
}

function drawHall(now) {
  const h = state.hall, vga = renderTrial(index, h.art, h.layout, h.wiggle);
  if (h.stage === 'message') drawTrialMessage(index, h.art, h.messages[h.message]);
  const step = h.stage === 'fade' ? Math.min(Math.floor((now - h.since) / FADE_STEP_MS), fadeSteps()) : fadeSteps(), level = fadeLevel(step);
  blit(rgbaPalette(vga.map(v => Math.min(v, level))));
  $('readout').innerHTML = `<dt>Hall of fame</dt><dd>${h.title}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the time trial hall of fame and the records (race.time-trial); the tables are kept in this browser\'s storage.';
}

function drawTrialEntry() {
  const t = state.trialEntry;
  blit(rgbaPalette(renderEntry(index, state.famousArt, t.e, state.trialArt.background, { text: t.info.title, y: t.info.titleY })));
  $('readout').innerHTML = `<dt>Name entry</dt><dd>${t.e.name.trim() || '(empty)'}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the time trial name entry (race.time-trial). Type up to 16 letters, digits or spaces; Enter ends.';
}

// The human drivers of the race: one slot, or the two players' slots in the two player race.
const humansOf = () => (state.duo ? state.duo.slots : [state.humanSlot]);

function leaveBoard() {
  if (state.cup && state.cup.race < racesInCup()) { state.cup = { ...state.cup, race: state.cup.race + 1 }; enterCard(); return; }
  if (state.cup) { // the final: the bonus notice when the champion class Bronze cup was won on the podium, else the rostrum (race.bonus-notice, race.rostrum)
    const { playerGroup } = podiumGroups(boardRows(state.totals, state.slots), humansOf());
    if (!state.duo && bonusOffered(state.cup, state.class, playerGroup)) enterNotice(); else enterRostrum(); // the two player race shows no bonus notice (obj1+0x1c85a)
    return;
  }
  state.screen = 'menu'; state.keys.clear(); state.menuAccumulator = 0;
}

// ---- the keyboard layout (keys.js): the page's own menus under GAME OPTIONS, not the game's
const KEY_CONFLICTS = { you: 'KEY CONFLICT - YOU ARE DUPLICATING KEYS', other: 'KEY CONFLICT - BETWEEN OTHER PLAYER' }; // SETUP.EXE's two messages, as the box routine's capitals
function setKeys(keys) { state.menu = { ...state.menu, settings: { ...state.menu.settings, keys } }; saveKeys(keys); }
// The prompt for one key, as SETUP.EXE asks it ("Press a key..."): the box routine's message over the menu as it stood.
function enterKeySet(player, slot) {
  state.keyset = { player, slot, base: index.slice(), conflict: null, until: 0 };
  state.screen = 'keyset'; state.last = performance.now(); state.keys.clear();
}
function drawKeySet() {
  const k = state.keyset; if (k.conflict && performance.now() >= k.until) k.conflict = null;
  index.set(k.base);
  const items = menuDef(state.menu.id, state.menu.settings).items, row = menuBottom('sub', items) + 12; // @math a bar's height below the last bar, so the box does not cover the line asked about
  drawMessage(index, state.hudArt.ofont, messageAt(k.conflict ? KEY_CONFLICTS[k.conflict] : 'PRESS A KEY...', row));
  blit(state.menuArt.rgba);
  $('readout').innerHTML = `<dt>Keys</dt><dd>player ${k.player + 1}, ${SLOTS[k.slot]}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not in the original game: the keyboard layout is set in SETUP.EXE there; this page asks for the keys under GAME OPTIONS (the list of keys is SETUP.EXE\'s, setup.key-table) and keeps them in this browser.';
}
function keySetKey(e) {
  const k = state.keyset; e.preventDefault();
  if (e.code === 'Escape') { state.keyset = null; state.screen = 'menu'; state.menuAccumulator = 0; state.keys.clear(); return; }
  if (k.conflict || e.repeat) return; // the message stays up for its count
  const scancode = scancodeOf(e.code); if (scancode === null) return; // only the keys SETUP.EXE offers
  const out = rebind(state.menu.settings.keys, k.player, k.slot, scancode);
  if (out.conflict) { k.conflict = out.conflict; k.until = performance.now() + 300 * 1000 / 136; return; } // @math the message lasts 300 counts of the 136 Hz clock, as the game's messages do
  if (out.keys !== state.menu.settings.keys) setKeys(out.keys);
  state.keyset = null; state.screen = 'menu'; state.menuAccumulator = 0; state.keys.clear();
}

// ---- COMM-BAT PLAY over WebRTC (play-link.js, net/, docs/comm-bat.md): a deviation from the DOS game, which links two machines by modem or serial cable. The host (player one) and the guest (player two)
// are linked by the menus' WEBRTC PEERJS (a code) or WEBRTC LOCAL (no code, the pages of one address), each picks a car on their own machine, the host chooses the race, and both machines then run
// the same two player race (split-screen rules, full-screen view of the own car) with the players' input swapped every frame.
const linkCtl = () => (state.linkCtl ??= createLink({ archive: state.dat, on: { linked: onLinked, closed: onLinkClosed } }));
const LINK_BADGE = 'Not in the original game: COMM-BAT PLAY links two browsers by WebRTC instead of a modem or a serial cable (docs/comm-bat.md). Both machines run the two player race with the input of both players swapped every frame; the link and the race rules around it are the page\'s own, not read from the game.';
function startLink(kind) {
  state.linkBase = Uint8Array.from(state.menuArt.title.indices); state.linkPlay = null; // the messages are boxes over the plain menu picture
  linkCtl().start(kind); state.screen = 'link'; state.last = performance.now(); state.keys.clear();
}
function drawLink() {
  const lines = linkCtl().lines, top = 92 - (lines.length - 1) * 10; // @math a box is 16 rows and the first stands on row 92: stack the lines 20 rows apart around it
  index.set(state.linkBase);
  lines.forEach((text, k) => drawMessage(index, state.hudArt.ofont, messageAt(text, top + k * 20)));
  blit(state.menuArt.rgba);
  $('readout').innerHTML = `<dt>Link</dt><dd>${linkCtl().kind ?? ''} ${linkCtl().stage}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = LINK_BADGE;
}
// The link is up (both sides said hello): the host picks a car first, the guest waits for that pick (the guest's list has the host's car crossed out).
function onLinked(c) {
  const host = c.role === ROLE.HOST, s = c.session;
  state.linkPlay = { role: c.role, seat: host ? 0 : 1, session: s, slots: [null, null], cars: 1 };
  s.on('pick', (role, slot) => {
    const L = state.linkPlay; if (!L) return;
    L.slots[role] = slot;
    if (host && L.slots[0] !== null) hostMenus(); else if (!host) enterVehicle('link2');
  });
  s.on('setup', setup => {
    let p = null; try { p = decodeParams(setup.params); } catch { /* not a race of this page */ }
    const members = archiveMembers(state.dat), tracks = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => Number(n.replace('.GAM', '')));
    const bad = setup.size !== INPUT_SIZE ? 'THE OTHER PLAYER SENT INPUT THIS GAME CANNOT READ' : p === null ? 'THE OTHER PLAYER CHOSE A RACE THIS GAME CANNOT RUN' : checkParams(p, { tracks, drivers: driverCount() });
    if (bad) { abortLink(bad); return; }
    beginLinkRace(p, setup.seed);
  });
  s.on('desync', frame => { setMessage(`The two games have drifted apart at frame ${frame}.`, true); abortLink('THE TWO GAMES DO NOT AGREE'); });
  if (host) enterVehicle('link1'); else c.say('LINK ESTABLISHED', 'WAITING FOR PLAYER');
}
function onLinkClosed(reason) { abortLink(reason, true); }
// A car is chosen on this machine: it goes to the other side, and the host goes on once both have chosen.
function linkPicked(slot) {
  const L = state.linkPlay; L.slots[L.seat] = slot; L.session.pick(slot);
  state.linkBase = Uint8Array.from(state.menuArt.title.indices); state.screen = 'link'; state.last = performance.now(); state.keys.clear();
  linkCtl().say('WAITING FOR PLAYER');
  if (L.seat === 0 && L.slots[1] !== null) hostMenus();
}
const linkSettings = on => { state.menu = { ...state.menu, settings: { ...state.menu.settings, link: on } }; };
// The host chooses the race with the menus of the two player race: head to head or with all cars, the class of that one, the laps and the engine (the race type menu is left out).
function hostMenus() {
  linkSettings(true); state.menu = enterMenu('duoMode', [{ id: 'main', cursor: 5 }], state.menu.settings); state.screen = 'menu'; state.menuAccumulator = 0; state.keys.clear(); // @math the cursor of COMM-BAT PLAY in the main menu
}
function linkMode(cars) {
  state.linkPlay.cars = cars;
  state.menu = cars === 2 ? enterMenu('duoClass', [{ id: 'main', cursor: 5 }], state.menu.settings) : enterSetup(state.menu, 'laps'); // @math the cursor of COMM-BAT PLAY in the main menu
}
function hostStart(flow) {
  const L = state.linkPlay, s = L.session, seed = Math.floor(Math.random() * 0x7fffffff);
  const params = { cars: L.cars, cls: L.cars === 2 ? flow.duoClass : 1, laps: lapsTotal(flow.laps), engine: flow.engine, track: Number($('track').value), slotOne: L.slots[0], slotTwo: L.slots[1], detail: state.menu.settings.detail.single }; // @math head to head forces the class 1
  linkSettings(false);
  s.start({ delay: delayFor(s.rtt, frameMs()), seed, params: encodeParams(params), size: INPUT_SIZE });
  beginLinkRace(params, seed);
}
// Both sides begin the same race: the two players' drivers and the seed the computer racers' drivers are drawn from; the view is of the own car, full screen, with the page's usual panel.
function beginLinkRace(p, seed) {
  const L = state.linkPlay; if (!L) return;
  const slots = [p.slotOne, p.slotTwo];
  state.duo = { cars: p.cars, slots }; state.shoot = null; state.demo = null; state.cup = null; state.carry = null; state.result = null; state.screen = 'race'; state.keys.clear();
  state.versusMode = { kind: 'race', cars: p.cars, laps: p.laps, class: p.cls, engine: p.engine, slots, scores: [0, 0] };
  state.humanSlot = slots[0]; state.slots = null; state.seed = seed; state.detail = p.detail; $('track').value = String(p.track); $('engine').value = String(p.engine);
  startTrackWith({ name: String(p.track), engine: p.engine, cls: classOf(p.cls), laps: p.laps, split: false }); state.versusMode = null;
  state.fadeIn = null; L.taunt = 0; state.tauntQueue = []; L.params = p;
}
// One frame of the link race: the other player's input for it has to be here, else the race waits (as the game's serial link did) and the frame is not stepped.
function tickLink() {
  const L = state.linkPlay, s = L.session;
  if (!s.ready()) { s.waiting(); return false; }
  const [one, two] = s.take(), has = k => state.keys.has(k);
  stepRace(state, { p1: decodeInput(one), p2: decodeInput(two) }); playSounds();
  const ms = frameMs(); state.hud = advanceTimer(state.hud, ms); state.seat2.hud = advanceTimer(state.seat2.hud, ms); // the clock follows the frames, not the wall clock: both machines must agree
  s.report(raceHash(state, carsOf(state)));
  const input = inputOf(has, state.menu.settings.keys, 0); if (L.taunt) { input.taunt = L.taunt; L.taunt = 0; }
  s.submit(encodeInput(input));
  return true;
}
// The own car's view full screen: the other seat is swapped in for its draw.
function drawLinkRace() {
  const L = state.linkPlay, cars = carsOf(state);
  state.minimapOthers = [{ x: cars[1 - L.seat].px, y: cars[1 - L.seat].py }, ...(state.ai ? state.ai.racers.slice(VERSUS_RACE().firstComputer) : [])]; // the overhead map's dots: the other human, then the computer racers
  if (L.seat === 1) swapSeat(state);
  drawRaceFrame(state, index);
  if (L.seat === 1) swapSeat(state);
  blit(raceRgba());
  const [a, b] = carsOf(state);
  $('readout').innerHTML = `<dt>Link</dt><dd>${L.session.phase}, round trip ${Math.round(L.session.rtt ?? 0)} ms</dd><dt>Frame</dt><dd>${L.session.simFrame}</dd><dt>One</dt><dd>${a.cx}, ${a.cy} ${a.heading}</dd><dt>Two</dt><dd>${b.cx}, ${b.cy} ${b.heading}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = LINK_BADGE;
}
function endLinkRace() {
  const L = state.linkPlay, places = finalPlaces(state), mine = places[L.seat];
  closeLink(mine === 1 ? 'YOU WON THE RACE' : `YOU CAME IN PLACE ${mine}`, 'race');
}
// The player gave the game up (Esc), or the line failed: back to the menu with the reason in a box.
function abortLink(reason = null, fromLine = false) {
  if (!state.linkPlay && !reason) return;
  closeLink(reason, fromLine ? 'line' : 'leave');
}
// How the link ends: 'leave' (the player left: the other side is told), 'line' (the line failed or the other side left: nothing to tell) or 'race' (the race is over: the line stays up for a moment so
// that the other player's last frames get through, link.finish). What the race left in the page is cleared, so that a later single player race starts as if there had been none.
function closeLink(reason, how = 'leave') {
  state.linkPlay = null; state.minimapOthers = null; state.versus = null; state.duo = null; state.versusMode = null; state.result = null; state.audio?.stopAll(); linkSettings(false);
  state.seed = undefined; state.slots = null; state.humanSlot = null; state.fadeIn = null; // the link race's seed, drivers and opponents are not the next race's
  state.menu = enterMenu('main', [], state.menu.settings); // the setup menus are done with
  if (how === 'leave') linkCtl().close();
  if (reason) { state.linkBase = Uint8Array.from(state.menuArt.title.indices); if (how === 'race') linkCtl().finish(reason); else linkCtl().notice(reason); state.screen = 'link'; state.last = performance.now(); } else returnToMenu();
  state.keys.clear();
}

// The link screen ended (Esc, or its message's count): back to the menu the player came from.
function leaveLinkScreen() { if (state.linkPlay) { state.linkPlay = null; linkSettings(false); } returnToMenu(); }

// The bonus notice (race.bonus-notice): a box over the plain background for 544 counts, then the bonus race.
function enterNotice(kind = 'bonus') {
  const art = state.rostrumArt ??= loadRostrumArt(archiveMembers(state.dat), state.humanSlot), kid = kind === 'kid'; // the kid mode's box stands over the menu screen, the bonus notice over the plain background
  state.notice = { kind, art, since: performance.now(), lines: kid ? kidNoticeLines() : undefined, base: kid ? index.slice() : art.background.indices, palette: kid ? state.menuArt.rgba : rgbaPalette(art.background.vga), key: false };
  state.screen = 'notice'; state.last = performance.now(); state.keys.clear();
}

function stepNotice(now) {
  const n = state.notice;
  if (n.kind === 'kid') { if (n.key) { state.notice = null; state.screen = 'menu'; state.menuAccumulator = 0; state.keys.clear(); } return; } // until a key (obj1+0x1a392)
  if (now - n.since < noticeTicks() * (1000 / 136)) return; // @math a count of the 136 Hz counter lasts 1000/136 ms
  index.set(n.art.background.indices); rgba = n.palette; // the screen returns to the plain background before the card (obj1+0x1a3c5)
  state.notice = null; state.cup = startBonusRace(state.cup); enterCard();
}

function drawNotice() {
  const n = state.notice;
  renderNotice(index, n.art, n.base, n.lines); blit(n.palette);
  $('readout').innerHTML = `<dt>Notice</dt><dd>${n.kind}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the bonus notice (race.bonus-notice) and the kid mode\'s explanation (menu.kid-notice).';
}

// THE ROSTRUM after the final leaderboard (race.rostrum): the title for 400 counts, then a pass of the animation every 6 counts until a key.
function enterRostrum() {
  const rows = boardRows(state.totals, state.slots);
  state.rostrum = { stage: 'text', since: performance.now(), art: loadRostrumArt(archiveMembers(state.dat), state.humanSlot), acc: 0, s: startRostrum(rows, humansOf(), state.cup.cup), out: null, key: false };
  state.screen = 'rostrum'; state.last = performance.now(); state.keys.clear();
}

function stepRostrumClock(now) {
  const r = state.rostrum, counts = 1000 / 136; // @math a count of the 136 Hz counter lasts 1000/136 ms
  if (r.stage === 'text') {
    if (now - r.since >= rostrumTicks() * counts) { r.stage = 'show'; r.acc = 0; state.audio?.play(rostrumStartSound()); r.out = rostrumPass(r.s); r.s = r.out.next; }
    return;
  }
  r.acc += Math.min(now - state.last, 250); // @math at most a quarter second at a time
  const ms = rostrumPassTicks() * counts;
  while (r.acc >= ms) { r.acc -= ms; r.out = rostrumPass(r.s); r.s = r.out.next; for (const id of r.out.sounds) state.audio?.play(id); }
  if (r.key) leaveRostrum();
}

function leaveRostrum() {
  const group = state.rostrum.s.playerGroup;
  state.rostrum = null; state.keys.clear();
  if (group === 1 && !state.duo) enterNameEntry(); else enterCupBoard(); // the winner of the final standings types his name (obj1+0x1d227), not in the two player race (obj1+0x1d20e)
}

// The hall of fame tables of an engine: the archive's defaults, or what this browser kept of the file the game would have written (race.hall-of-fame).
const HALL_KEY = engine => `wackywheels.hall.${engine}`;
function hallTable(engine) {
  try { const kept = localStorage.getItem(HALL_KEY(engine)); if (kept) return JSON.parse(kept); } catch { /* no storage: the defaults */ }
  return hallDefault(archiveMembers(state.dat), engine);
}
function saveHall(engine, table) { try { localStorage.setItem(HALL_KEY(engine), JSON.stringify(table)); } catch { /* the table stays for this visit */ } }

function enterNameEntry() {
  state.entry = { e: startEntry(), art: state.famousArt ??= loadFamousArt(archiveMembers(state.dat)) };
  state.screen = 'entry'; state.last = performance.now(); state.keys.clear();
}

function finishNameEntry() {
  const cb = state.cup.cup + state.cup.bonus, engine = state.engine ?? 1, cls = state.class ?? 1; // @math the engine and the class count from 1
  const out = insertScore(hallTable(engine), { cb, cls, points: state.totals[0], slot: state.humanSlot, date: dateText(), name: state.entry.e.name });
  saveHall(engine, out.table); state.entry = null;
  enterFamous(cb, cls);
}

// The FAMOUS DRIVERS board of a class and cup (race.hall-of-fame); a key leaves it for the cup board.
function enterFamous(cb, cls, back = 'cupboard', engine = state.engine ?? 1) {
  const pack = back === 'menu' ? packOf() : state.cup ? state.cup.bonus : 0; // @math the pack of the settings from the menu, the cup's in a cup
  state.famous = { layout: famousLayout(hallTable(engine), cb, cls, engine, pack), art: state.famousArt ??= loadFamousArt(archiveMembers(state.dat)), key: false, back };
  state.screen = 'famous'; state.last = performance.now(); state.keys.clear();
}

function drawEntry() {
  blit(rgbaPalette(renderEntry(index, state.entry.art, state.entry.e)));
  $('readout').innerHTML = `<dt>Name entry</dt><dd>${state.entry.e.name.trim() || '(empty)'}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the name entry (race.hall-of-fame). Type up to 12 letters, digits or spaces; Enter ends.';
}

function drawFamous() {
  blit(rgbaPalette(renderFamous(index, state.famous.art, state.famous.layout)));
  $('readout').innerHTML = `<dt>Famous drivers</dt><dd>${state.famous.layout.title}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: the FAMOUS DRIVERS board (race.hall-of-fame); the table is kept in this browser\'s storage.';
}

function drawRostrum() {
  const r = state.rostrum, vga = r.stage === 'text' ? renderRostrumText(index, r.art) : renderRostrum(index, r.art, r.out.draws);
  blit(rgbaPalette(vga));
  $('readout').innerHTML = `<dt>Rostrum</dt><dd>${r.stage}${r.stage === 'show' ? `, state ${r.s.state}` : ''}</dd>`;
  $('badge').className = 'badge bad'; $('badge').textContent = 'Not compared with frames of the running game yet: THE ROSTRUM (race.rostrum); the name entry and the famous drivers board that follow a win are not ported.';
}

// The race ended (race.finish-flow): the leaderboard, the menu of a lost race or the game over.
function raceOver() {
  if (state.linkPlay) { endLinkRace(); return; }
  if (state.result === 'duck') { endDuck(); return; } // the time is up (duck.race-rules)
  if (state.result === 'versus') { endVersus(); return; } // a player reached the hits (versus.shootout-rules)
  if (state.result === 'versusRace') { endVersusRace(); return; } // a human finished: the points of the places, then the leaderboard (versus.race-rules)
  state.carry = { counter: state.car.counter, held: state.car.held }; // what the car holds at the end goes into the next race
  if (state.result === 'leaderboard') { enterBoard(); return; }
  if (state.result === 'trial') { state.result = null; trialResult(); return; } // the time trial: the hall of fame follows the race (race.time-trial)
  if (state.result === 'restart') { state.result = null; startTrack(); return; } // a crash that cost a try: the same race starts again (obj1+0x2006a)
  snapshotScreen();
  if (state.result === 'gameover') { if (state.cup) enterCupBoard(); else state.screen = 'menu'; setMessage('GAME OVER'); state.keys.clear(); return; }
  state.retry = createChoice(state.cup && state.cup.race === racesInCup() ? [' TRY AGAIN      ', RETRY_ITEMS[1]] : RETRY_ITEMS, 108); // @math the menu's centre row as the in-race menu has it
  state.retryKey = null; state.retryAccumulator = 0; state.screen = 'retry'; state.last = performance.now();
}

function stepRetryClock(now) {
  state.retryAccumulator += Math.min(now - state.last, 250); // @math at most a quarter second at a time
  const ms = frameMs(menuPeriod());
  while (state.retryAccumulator >= ms && state.screen === 'retry') {
    const { choice, chosen } = stepChoice(state.retry, state.retryKey); state.retry = choice; state.retryKey = null; state.retryAccumulator -= ms;
    if (chosen === 1) { state.result = null; state.screen = 'race'; startTrack(); } // the same race again, the lost try is spent
    else if (chosen === 2 || chosen === 'escape') { if (state.cup) enterCupBoard(); else { state.screen = 'menu'; state.keys.clear(); } } // LEAVE RACE goes back to the cup board (obj1+0x10063)
  }
}

function drawRetry() {
  index.set(state.snapshot.index);
  renderMenuOverlay(index, state.menuArt, choiceView(state.retry));
  if (state.snapshot.image) { enh.drawOver({ out: image.data, base: state.snapshot.image, index, palette: state.snapshot.rgba, overlay: fb => renderMenuOverlay(fb, state.menuArt, choiceView(state.retry)) }); show(); }
  else blit(state.snapshot.rgba);
  $('badge').className = 'badge bad'; $('badge').textContent = 'The menu of a race that was not won in the first three places (obj1+0x219cd): not compared with a frame of the running game; SAVE AND QUIT is left out.';
}

function frame(now) {
  if (!state.dat) return;
  followMusic();
  if (state.screen === 'vehicle') { stepVehicleClock(now); state.last = now; if (state.screen === 'vehicle') drawVehicle(); requestAnimationFrame(frame); return; }
  if (state.screen === 'duckChooser') { stepDuckChooser(now); state.last = now; if (state.screen === 'duckChooser') drawDuckChooser(); requestAnimationFrame(frame); return; }
  if (state.screen === 'duckIntro') { state.last = now; drawDuckIntro(); requestAnimationFrame(frame); return; }
  if (state.screen === 'duckEnd') { state.last = now; drawDuckEnd(); requestAnimationFrame(frame); return; }
  if (state.screen === 'shootCard') { state.last = now; drawShootCard(now); requestAnimationFrame(frame); return; }
  if (state.screen === 'versusEnd') { state.last = now; drawVersusEnd(); requestAnimationFrame(frame); return; }
  if (state.screen === 'duckEntry') { state.last = now; drawDuckEntry(); requestAnimationFrame(frame); return; }
  if (state.screen === 'cupboard') { stepCupBoard(now); state.last = now; if (state.screen === 'cupboard') drawCupBoard(now); requestAnimationFrame(frame); return; }
  if (state.screen === 'card') { stepCard(now); state.last = now; if (state.screen === 'card') drawCard(now); requestAnimationFrame(frame); return; }
  if (state.screen === 'hall') { stepHall(now); state.last = now; if (state.screen === 'hall') drawHall(now); requestAnimationFrame(frame); return; }
  if (state.screen === 'trialEntry') { state.last = now; drawTrialEntry(); requestAnimationFrame(frame); return; }
  if (state.screen === 'keyset') { state.last = now; drawKeySet(); requestAnimationFrame(frame); return; }
  if (state.screen === 'link') { state.last = now; if (linkCtl().step(now) === 'leave') leaveLinkScreen(); else drawLink(); requestAnimationFrame(frame); return; }
  if (state.screen === 'notice') { stepNotice(now); state.last = now; if (state.screen === 'notice') drawNotice(); requestAnimationFrame(frame); return; }
  if (state.screen === 'volume') { runVolume(now); state.last = now; if (state.screen === 'volume') drawVolume(); requestAnimationFrame(frame); return; }
  if (state.screen === 'credits') { runCredits(now); state.last = now; if (state.screen === 'credits') drawCredits(); requestAnimationFrame(frame); return; }
  if (state.screen === 'exit') { state.last = now; requestAnimationFrame(frame); return; } // the text screen is an element, not the canvas
  if (state.screen === 'entry') { state.last = now; drawEntry(); requestAnimationFrame(frame); return; }
  if (state.screen === 'famous') { if (state.famous.key) { const back = state.famous.back; state.famous = null; if (back === 'menu') returnToMenu(); else enterCupBoard(); requestAnimationFrame(frame); return; } state.last = now; drawFamous(); requestAnimationFrame(frame); return; }
  if (state.screen === 'rostrum') { stepRostrumClock(now); state.last = now; if (state.screen === 'rostrum') drawRostrum(); requestAnimationFrame(frame); return; }
  if (state.screen === 'board') { if (state.board.key) { state.board.key = false; leaveBoard(); } state.last = now; if (state.screen === 'board') drawBoard(now); requestAnimationFrame(frame); return; }
  if (state.screen === 'retry') { stepRetryClock(now); state.last = now; if (state.screen === 'retry') drawRetry(); requestAnimationFrame(frame); return; }
  if (state.screen === 'menu') { stepMenuClock(now); state.last = now; if (state.screen === 'menu') drawMenu(); requestAnimationFrame(frame); return; }
  if (state.fadeIn) { // the game does not run while the first frame fades in (demo.fade-in)
    state.fadeIn.since ??= now; state.last = now; state.accumulator = 0;
    if (Math.floor((now - state.fadeIn.since) / FADE_STEP_MS) >= fadeSteps()) state.fadeIn = null;
    draw(); requestAnimationFrame(frame); return;
  }
  if (state.pause) { stepPauseClock(now); state.last = now; if (state.screen === 'race') draw(); requestAnimationFrame(frame); return; } // the race does not run while its menu is open
  const elapsed = Math.min(now - state.last, 250); // @math at most a quarter second at a time after a pause
  state.accumulator += elapsed; state.last = now; if (!state.linkPlay) state.hud = advanceTimer(state.hud, elapsed);
  if (state.duck && !state.result && state.hud.ticks >= duckRules().timer) state.result = 'duck'; // the clock reaches 0 (duck.race-rules)
  const frame_ms = frameMs();
  while (state.accumulator >= frame_ms && !state.result) {
    if (tickOnce() === false) { state.accumulator = Math.min(state.accumulator, 2 * frame_ms); break; } // a link race waiting for the other player does not run ahead when the input comes
    enh.afterTick(state, { sounds: tickSounds }); // the enhanced presentation's snapshot of the completed tick
    state.accumulator -= frame_ms;
  }
  draw();
  if (state.result) raceOver();
  requestAnimationFrame(frame);
}

async function load(vfs) {
  try {
    const path = vfs.list().find(p => /(^|\/)wacky\.dat$/i.test(p));
    if (!path) throw new Error('WACKY.DAT was not found in the selected files.');
    state.dat = await vfs.openPath(path);
    const names = [...archiveMembers(state.dat).keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => n.replace('.GAM', '')).sort((a, b) => a - b);
    $('track').innerHTML = names.map(n => `<option>${n}</option>`).join('');
    state.audio = createAudio(archiveMembers(state.dat)); state.volumes = storedVolumes(); applyVolumes(); state.musicName = null; state.musicScreen = null;
    state.menuArt = loadMenuArt(archiveMembers(state.dat)); state.menuArt.rgba = rgbaPalette(state.menuArt.title.vga); state.hudArt = loadHudArt(archiveMembers(state.dat)); state.mov = parseMov(archiveMembers(state.dat).get('GIG.MOV'));
    state.screen = 'menu'; state.menu = createMenu({ ...defaultSettings(Number($('detail').value), true), keys: loadKeys(), sound: loadDevices(), graphics: menuView(enh.settings), display: displayView(display.settings, { fullscreen: display.fullscreen(), crtReady: display.crtReady() }) }); // the keyboard layout, the sound devices, the graphics and the display settings of this browser (keys.js, sound-devices.js, enhance/settings.js, enhance/display-settings.js)
    state.audio?.setDevices(state.menu.settings.sound);
    startTrack(); $('stage').hidden = false; display.layout(); setMessage(''); // the display measures its space once the stage is shown
    state.last = performance.now(); if (!state.running) { state.running = true; requestAnimationFrame(frame); }
  } catch (e) { state.dat = null; setMessage(`${e.message}`, true); }
}

$('open').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', e => { if (e.target.files.length) load(openPicked(e.target.files)); });
$('local').addEventListener('click', async () => { try { await load(await openDevGame({ base: import.meta.env.BASE_URL })); } catch (e) { setMessage(e.message, true); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) load(openPicked(e.dataTransfer.files)); });
for (const id of ['track', 'engine']) $(id).addEventListener('change', () => state.dat && !state.linkPlay && freeRace()); // a link race is not restarted by one machine
$('reset').addEventListener('click', () => state.dat && !state.linkPlay && freeRace());
// The browser keys the race reads: the first player's six keys, in a split screen game both players' (the layout of keys.js).
const gameCodes = () => new Set((state.versus && !state.linkPlay ? [0, 1] : [0]).flatMap(p => SLOTS.flatMap((_, slot) => codesOf(state.menu.settings.keys, p, slot)))); // @math the players 0 and 1
const vehicleKeys = next => { // the keys of the vehicle screen's passes: the player's steering keys, a button of the player (the first two buttons of the table, in the second player's pass the third as well), Enter and Space are a fire (obj1+0xb2d2, +0xb3a0, +0xb3b3); the second player's pass also takes the first player's fire key (versus.flow)
  const keys = state.menu.settings.keys, p = next === 'shoot2' || next === 'duo2' ? 1 : 0, map = { Escape: 'escape', Enter: 'fire', Space: 'fire' }; // @math the second player's pass is the player 1
  const add = (codes, what) => codes.forEach(c => { map[c] ??= what; });
  add(codesOf(keys, p, 0), 'left'); add(codesOf(keys, p, 1), 'right'); // @math the first two keys of the table steer
  [2, 3, ...(p === 1 ? [4] : [])].forEach(slot => add(codesOf(keys, p, slot), 'fire')); // @math the buttons 1 and 2, the button 3 for the second player
  if (p === 1) add(codesOf(keys, 0, 3), 'fire'); // @math the first player's fire key
  return map;
};
const MENU_KEYS = { ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', Space: 'enter', Escape: 'escape' };
addEventListener('keydown', e => {
  state.audio?.unlock(); // browsers start the audio context with the first key
  if (e.target.tagName === 'SELECT' || !state.dat) return;
  if (e.code === 'Escape' && display.fullscreen()) return; // the browser's key for leaving full screen: should a browser also pass it on, it neither pauses the race nor gives up a link race
  if (state.screen === 'race' && state.pause) { if (MENU_KEYS[e.code]) { e.preventDefault(); if (!state.pauseKey) state.pauseKey = MENU_KEYS[e.code]; } return; }
  if (state.screen === 'race' && state.demo) { if (e.code === 'Escape') state.demo.escape = true; else if (/^(Arrow|Enter|Space|Alt)/.test(e.code)) { state.keys.add(e.code); e.preventDefault(); } return; } // a demo race: Esc leaves, the arrows, Enter, Space and Alt turn the slides' pages
  if (state.screen === 'link') { e.preventDefault(); if (linkCtl().key(e) === 'leave') leaveLinkScreen(); return; }
  if (state.screen === 'race' && state.linkPlay && e.code === 'Escape') { e.preventDefault(); abortLink('YOU LEFT THE GAME'); return; } // a link race cannot be paused: Esc gives it up for both players
  if (state.screen === 'race' && e.code === 'Escape') { // Esc opens the in-race menu unless the race is finished or the car wrecked, where the game ignores it (race.pause-menu)
    if (canPause(state.finished, state.car.crashed || state.car.wrecked)) { state.pause = createPause(Boolean(state.duck || state.versus?.kind === 'shootout')); state.pauseKey = null; state.pauseAccumulator = 0; state.keys.clear(); state.last = performance.now(); }
    return;
  }
  if (state.screen === 'duckChooser') { const m = { ArrowUp: 'up', ArrowLeft: 'up', ArrowDown: 'down', ArrowRight: 'down', Enter: 'fire', Space: 'fire', ControlLeft: 'fire', ControlRight: 'fire', Escape: 'escape' }[e.code]; if (m) { e.preventDefault(); if (!state.duckFlow.key) state.duckFlow.key = m; } return; }
  if (state.screen === 'duckIntro') { if (e.code === 'Escape') { e.preventDefault(); enterChooser(state.duckFlow.bonus); } else if (WAIT_KEYS.includes(e.code)) { e.preventDefault(); startDuck(state.duckFlow.zone, state.duckFlow.bonus); } return; }
  if (state.screen === 'duckEnd') { if (WAIT_KEYS.includes(e.code)) { e.preventDefault(); enterChooser(state.duckFlow.bonus); } return; }
  if (state.screen === 'shootCard') { if (e.code === 'Escape') { e.preventDefault(); enterChooser(state.duckFlow.bonus); } else if (WAIT_KEYS.includes(e.code)) { e.preventDefault(); startVersus(state.duckFlow.zone, state.duckFlow.bonus, state.shoot.hits, state.shoot.slots); } return; }
  if (state.screen === 'versusEnd') { if (WAIT_KEYS.includes(e.code)) { e.preventDefault(); state.versusEnd = null; enterChooser(state.duckFlow.bonus); } return; }
  if (state.screen === 'duckEntry') { e.preventDefault(); const out = typeKey(state.duckFlow.entry, e.key); state.duckFlow.entry = out.entry; if (out.done) finishDuckEntry(); return; }
  if (state.screen === 'vehicle' && state.vehicle.help) { e.preventDefault(); if (state.vehicle.help.armed && !e.repeat && buttonCodes(state.vehicle.v.player ?? 0, state.menu.settings.keys).includes(e.code)) { state.vehicle.help = null; state.last = performance.now(); state.vehicle.key = vehicleKeys(state.vehicle.next)[e.code] === 'fire' ? 'fire' : null; } return; } // Enter, Space and the player's buttons end the controls screen once F1 is up; a leaving key that still is down is a fire in the next pass (menu.controls-help)
  if (state.screen === 'vehicle' && e.code === HELP_KEY) { e.preventDefault(); if (!state.vehicle.key && !e.repeat) state.vehicle.key = 'help'; return; }
  if (state.screen === 'vehicle') { const m = vehicleKeys(state.vehicle.next)[e.code]; if (m) { e.preventDefault(); if (!state.vehicle.key) state.vehicle.key = m; } return; } // the second player's pass takes the second player's steering and fire keys, the first player's fire, Enter and Space (versus.flow)
  if (state.screen === 'cupboard') { const k = state.cupboard.keys; if (e.code === 'ArrowUp') k.up = true; else if (e.code === 'ArrowDown') k.down = true; else if (e.code === 'ArrowLeft') k.left = true; else if (e.code === 'ArrowRight') k.right = true; else if (e.code === 'Escape') k.escape = true; else if (['Enter', 'Space', 'AltLeft', 'AltRight', 'KeyA'].includes(e.code)) k.fire = true; else return; e.preventDefault(); return; }
  if (state.screen === 'card') { if (e.code === 'Escape') { state.screen = 'menu'; state.cup = null; return; } if (WAIT_KEYS.includes(e.code)) { e.preventDefault(); state.card.key = true; } return; }
  if (state.screen === 'keyset') { keySetKey(e); return; }
  if (state.screen === 'notice') { if (state.notice.kind === 'kid' && (WAIT_KEYS.includes(e.code) || e.code === 'Escape')) { e.preventDefault(); state.notice.key = true; } return; }
  if (state.screen === 'trialEntry') { e.preventDefault(); const out = typeKey(state.trialEntry.e, e.key); state.trialEntry.e = out.entry; if (out.done) finishTrialEntry(); return; }
  if (state.screen === 'volume') { if (e.code === 'Escape') state.volume.escape = true; else if (e.code.startsWith('Arrow')) state.keys.add(e.code); e.preventDefault(); return; }
  if (state.screen === 'credits') { const s = state.credits; if (e.code === 'Escape') s.escape = true; else if (['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight'].includes(e.code)) s.advance = true; e.preventDefault(); return; } // the first player's keys turn a page (approximated)
  if (state.screen === 'exit') { e.preventDefault(); leaveExit(); return; }
  if (state.screen === 'hall') { if (e.code === 'Escape') { e.preventDefault(); state.hall.esc = true; } else if (WAIT_KEYS.includes(e.code)) { e.preventDefault(); state.hall.key = true; } return; }
  if (state.screen === 'entry') { e.preventDefault(); const out = typeKey(state.entry.e, e.key); state.entry.e = out.entry; if (out.done) finishNameEntry(); return; }
  if (state.screen === 'famous') { if (WAIT_KEYS.includes(e.code) || e.code === 'Escape') { e.preventDefault(); state.famous.key = true; } return; }
  if (state.screen === 'rostrum') { if (WAIT_KEYS.includes(e.code) && state.rostrum.stage === 'show') { e.preventDefault(); state.rostrum.key = true; } return; }
  if (state.screen === 'board') { if (WAIT_KEYS.includes(e.code)) { e.preventDefault(); state.board.key = true; } return; }
  if (state.screen === 'retry') { if (MENU_KEYS[e.code]) { e.preventDefault(); if (!state.retryKey) state.retryKey = MENU_KEYS[e.code]; } return; }
  if (state.screen === 'menu' && MENU_KEYS[e.code]) {
    e.preventDefault(); if (e.repeat) return; // the game samples the keys, the browser's repeats add nothing (menu.input-sampling)
    const key = MENU_KEYS[e.code];
    if (key === 'enter' && !state.menuKey && isSettled(state.menu) && actionAt(state.menu)?.display?.fullscreen) display.toggleFullscreen(); // FULL SCREEN: browsers enter it only inside a key's handler, so here rather than when the menu's pass reads the key
    if (!state.menuKey) state.menuKey = key;
    if (key === 'up' || key === 'down' || key === 'escape') { state.menuHeld = key; state.menuHeldCode = e.code; } // read again while it is down and the icons settle
    return;
  }
  if (state.screen !== 'race') return;
  if (state.linkPlay) { // the own player's keys, the first player's layout; F1 to F6 and 1 to 6 taunt the other player
    const taunt = /^F([1-6])$|^Digit([1-6])$/.exec(e.code);
    if (taunt) { e.preventDefault(); state.linkPlay.taunt = Number(taunt[1] ?? taunt[2]); return; }
    if (gameCodes().has(e.code)) { state.keys.add(e.code); e.preventDefault(); }
    return;
  }
  if (state.versus) { // the two players' keys and the taunt keys: F1 to F6 for the first player, 1 to 6 for the second (versus.taunts)
    const taunt = /^F([1-6])$/.exec(e.code) ?? null, second = /^Digit([1-6])$/.exec(e.code) ?? null;
    if (taunt || second) { e.preventDefault(); (state.tauntQueue ??= []).push({ player: taunt ? 0 : 1, id: Number((taunt ?? second)[1]) }); return; } // @math the players count from 0
    if (gameCodes().has(e.code)) { state.keys.add(e.code); e.preventDefault(); }
    return;
  }
  const mine = gameCodes();
  if (e.code === 'KeyR' && !state.duck && !mine.has(e.code)) { startTrack(); return; } if (mine.has(e.code)) { state.keys.add(e.code); e.preventDefault(); }
});
addEventListener('keyup', e => { state.keys.delete(e.code); if (e.code === state.menuHeldCode) { state.menuHeld = null; state.menuHeldCode = null; } if (e.code === HELP_KEY && state.vehicle?.help) state.vehicle.help.armed = true; });
addEventListener('blur', () => { state.keys.clear(); state.menuHeld = null; state.menuHeldCode = null; }); // a key released while the page is not focused would stay down

// `play.html?debug` exposes the race state and the frame functions, so that a test (or a browser tab the browser throttles) can step the race by hand.
if (new URLSearchParams(location.search).has('debug')) window.wackyDebug = { index, enh, display, drawEnhanced, startVersus, startDuck, state, tickOnce, draw, startTrack, beginCup, enterBoard, enterCupBoard, enterVehicle, enterRostrum, stepRostrumClock, drawRostrum, enterNameEntry, enterFamous, finishNameEntry, enterNotice, leaveBoard, startCupRace, enterTrialHall, trialResult, showExit, startDemo, enterCard, chooseItem, persistSave, savedGame, raceOver, freeRace, frame };
