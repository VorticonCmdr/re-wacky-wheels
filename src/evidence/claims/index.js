// Every claim module, listed explicitly so the registry loads identically in node and the browser.
// test/evidence.test.js fails if a file in this directory is missing here.
import audio from './audio.js';
import boot from './boot.js';
import cfg from './cfg.js';
import dat from './dat.js';
import drive from './drive.js';
import duck from './duck.js';
import effects from './effects.js';
import exes from './exes.js';
import gam from './gam.js';
import items from './items.js';
import le from './le.js';
import pcx from './pcx.js';
import port from './port.js';
import race from './race.js';
import sprites from './sprites.js';
import statics from './static.js';
import terrain from './terrain.js';
import track from './track.js';
import versus from './versus.js';
import voc from './voc.js';
import wf from './wf.js';
import wwExe from './ww-exe.js';

export default [...le, ...wwExe, ...dat, ...pcx, ...track, ...gam, ...terrain, ...statics, ...sprites, ...exes, ...audio, ...cfg, ...voc, ...wf, ...port, ...race, ...drive, ...items, ...effects, ...versus, ...duck, ...boot];
