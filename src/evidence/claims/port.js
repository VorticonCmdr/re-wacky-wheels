// Compact claims that carry, in one value, the constants the port's modules use, each cross-checked
// against the claims that observed or read them (the checks named here derive the value from those
// claims leaf by leaf). Product code writes the same literal inside K(...).
export default [
  {
    id: 'floor.model', tag: 'PROVEN',
    statement: 'The constants of the floor model as the port\'s renderer uses them, every one equal to its source claim (check port-floormodel derives them from floor.render-observed, floor.render-loop, floor.detail-modes-observed, trig.layout, ndist.layout, m.read, tiles.sheet-split, gam.read and pcx.layout): 320 columns of 70 steps drawn up from the screen row 199, the ray angle the heading minus 160 wrapped over the 1920 TRIG entries of 8 bytes, 70 NDIST dwords of 4 bytes a group, the map of 64 x 64 cells starting at the cell 32 of the tile table, tiles of 32 x 32 pixels (1024 bytes, shift 5, mask 0x1f) in sheets of 54 tiles with 10 to a row, the column steps 1, 2 and 4 of the three detail modes with the angle pointer reset to entry 0, the .GAM tileset prefix A_ and the 320 x 200 picture.',
    value: { columns: 320, steps: 70, angleBias: 160, wrap: 1920, bottomRow: 199, trigEntryBytes: 8, fixedBits: 16, groupDwords: 70, ndistDwordBytes: 4, mapRows: 64, mapColumns: 64, mapOrigin: 32, tileShift: 5, tileMask: 31, tileBytes: 1024, sheetCount: 54, sheetSize: 32, sheetColumns: 10, columnSteps: [1, 2, 4], resetTo: 0, gamPrefix: 'A_', width: 320, height: 200 },
    evidence: { checks: ['port-floormodel', 'port-floor'], obs: ['floor-1', 'floor-2', 'floor-3', 'floor-4', 'floor-5'] },
    leads: ['docs/view.md'],
  },
  {
    id: 'car.model', tag: 'PROVEN',
    statement: 'The constants of the player car\'s straight-road step as the port uses them, every one equal to its source claim (check port-carmodel derives them from car.step-observed, car.steer-step-observed and floor.table-use, and replays the observed records through the port\'s own code): the throttle rises by 10 to the cap 100 with the accelerate key, falls by 4 with no key and by 4 plus 8 with the brake key, the speed is the VEL.TAB entry (16-bit entries) of the new throttle, the position moves by (TRIG vector x speed + 0x8000) >> 16 per axis, the heading changes by 40 per tick with a steering key and by 120 in the hand brake turn, one turn is 1920, and the camera stands 0x7c units behind the car along the heading.',
    value: { accelStep: 10, coastStep: 4, brakeStep: 8, cap: 100, rounding: 32768, fixedBits: 16, steerStep: 40, spinStep: 120, turn: 1920, velEntryBytes: 2, trigEntryBytes: 8, cameraBehind: 124, startBias: 992 },
    evidence: { checks: ['port-carmodel'], obs: ['steps-1', 'steps-2', 'steps-3', 'grid-1', 'grid-7', 'horizon-14'] },
    leads: ['docs/driving-model.md'],
  },
  {
    id: 'UNKNOWN_CAR_TURN_MOVE', tag: 'UNKNOWN',
    statement: 'How the car moves in a tick in which a steering key is held. The straight-road step is proven (car.step-observed) and so is the heading change (car.steer-step-observed), but the observed positions while turning differ from the straight step: at a stand-still the position words drift by one or two units a tick as the heading turns (record steps-3: from (1279, 1600) at heading 440 to (1271, 1610) at heading 1880), and with the throttle on the path differs from the straight step by several units; which heading the move uses (before or after the turn) and what the drift is are not established, and the slide and hop states of car.steer-states change the path further.',
    evidence: {},
    leads: ['docs/driving-model.md'],
    todo: 'Fit the position words of steps-3 against the old and the new heading and the throttle; read the move routine obj1+0x190a0 for the order of the turn and the move and for the drift at speed 0.',
  },
  {
    id: 'sky.model', tag: 'PROVEN',
    statement: 'The constants of the sky and the horizon strip as the port draws them, every one equal to its source claim (check port-sky derives them from sky.static-observed, horizon.render-observed and par.upload and replays the observed frames through the port\'s own code): the sky is the picture named on the track\'s .GAM line, one screen row of it for every screen row from 0 to 109 (the rows 52 to 109 were observed; the rows above lie under the HUD banner), 320 wide; the 20 rows from row 110 are a window of the track\'s .PAR file read as rows of 1280 pixels, starting 4 pixels per byte offset into each row and 320 pixels wide, the offset running from 0 to 160 bytes (the bounds 0, 80, 160 and 240 of the pointer).',
    value: { width: 320, skyRows: 110, horizonRow: 110, horizonRows: 20, parRowPixels: 1280, pixelsPerByte: 4, parBytes: 25600, offsetMax: 160, observedFrom: 52 },
    evidence: { checks: ['port-sky'], obs: ['sky-1', 'sky-2', 'sky-3', 'sky-4', 'sky-5', 'horizon-1', 'horizon-2', 'horizon-14'] },
    leads: ['docs/par.md', 'docs/view.md'],
  },
  {
    id: 'UNKNOWN_HORIZON_SCROLL', tag: 'UNKNOWN',
    statement: 'How the horizon strip\'s offset (the pointer obj2+0x1d860 less 0xa7d00, 0 to 160 bytes) starts and moves. It scrolls with the car\'s steering amounts, not with the heading (horizon.render-observed), and was 66, 28 and 16 in the three observed frames, but its start value in a new race and its step while the car turns were not observed (the code at obj1+0x14832 is read, not run).',
    evidence: {},
    leads: ['docs/par.md'],
    todo: 'Pause a played race every tick while steering and read the pointer; read the routine obj1+0x14832 for the step and the wrap.',
  },
  {
    id: 'race.palette', tag: 'PROVEN',
    statement: 'Observed in the running game (record dac-2: the attract demo race on track 4 paused, the VGA DAC entries 0 to 255 read through the ports 0x3c7 and 0x3c9): all 256 DAC entries of a race equal, as 6-bit values, the palette of the first tileset picture named on the track\'s .GAM (A_F7.PCX; the second tileset, A_F8.PCX, has the same palette), and not the palette of the sky picture BACK1.PCX (138 of its 256 entries equal) or of the mask pictures (237 equal). So the race is drawn with the tileset palette, and the sky picture\'s own palette is not used. Not observed: the entries 144 to 180 of a flag-1 track while they cycle (palette.cycle-observed), and other tracks.',
    value: { track: '4', entries: 256, source: 'tileset', sameAsSecond: true },
    evidence: { checks: ['obs-racepalette'], obs: ['dac-2'] },
    leads: ['docs/pcx.md'],
  },
  {
    id: 'sprite.model', tag: 'PROVEN',
    statement: 'The constants of the scaled sprite drawing as the port uses them (check port-sprites): the .INF member of a shape holds ten pictures, each a width word, a height word and (height + 1) x width dwords (4 bytes each, a 4-byte header), the picture area is 320 x 200 with the last drawable row 199, and the sizes are the ten classes of view.model.',
    value: { pictures: 10, headerBytes: 4, deltaBytes: 4, width: 320, height: 200, maxRow: 199, headerWords: 2, wordBytes: 2 },
    evidence: { checks: ['port-sprites'], obs: ['fit-1', 'fit-2', 'fit-3', 'fit-4', 'fit-5', 'fit-6', 'fit-7', 'fit-8', 'fit-9'] },
    leads: ['docs/inf.md', 'docs/view.md'],
  },
  {
    id: 'race.start-heading', tag: 'PROVEN',
    statement: 'Read from WW.EXE and observed: the race routine (obj1+0x1fd8c) sets the heading dword obj2+0x1d5d4 to the constant 0x1e0 (480, the TRIG index of the +y direction, down the map) right after the racer reset obj1+0x6f90 (obj1+0x203a8) and again where it places the camera for the start (obj1+0x2057f), whatever the first record of the track\'s .RD says (ten tracks have another first angle): the check reads both stores, and the camera code, which sets the camera x word obj2+0x28b0a to the player\'s x (obj2+0xaaa6) and the camera y word obj2+0x28b0e to the player\'s y (obj2+0xaaa8) less 0x7c (obj1+0x20521 to +0x2058e); the second player\'s heading dword obj2+0x1d5dc becomes 0x1e0 when the word obj2+0x28bdc is set and 0x5a0 (1440) otherwise (obj1+0x20599, +0x205a5), and a later store of 0x3c0 (960) at obj1+0x20782 (when the word obj2+0x28ca8 is set: after the race) puts the heading at 960 with the camera at x 0x708. Observed: the start frames of tracks 1 and 7 (grid-1, grid-7, with the player at its start position) and of track 5 (fit-1) show the heading 480, and the camera is the player\'s position less 0x7c in y exactly (grid-1: (1280, 1476) for the car at (1280, 1600)). Not observed: the starts of the other modes (shootout, duck shoot, two player), where other stores of the same routine may apply.',
    value: { headingAt: 120276, heading: 480, startSites: [132008, 132479], finishSite: 132994, finishHeading: 960, secondAt: 120284, secondHeading: 1440, secondSite: 132517, cameraXAt: 132385, cameraYAt: 132461, cameraSubAt: 132476, cameraYStoreAt: 132489, carWords: [43686, 43688], cameraWords: [166666, 166670], cameraBehind: 124 },
    evidence: { checks: ['exe-startheading'], obs: ['grid-1', 'grid-7', 'fit-1'], at: ['WW.EXE:obj1+0x203a8 fp=2d0d5eb5', 'WW.EXE:obj1+0x2057f fp=34c2a138', 'WW.EXE:obj1+0x20782 fp=82db9d2b', 'WW.EXE:obj1+0x205a5 fp=e3cccb6f'] },
    leads: ['docs/driving-model.md'],
  },
  {
    id: 'tick.rate', tag: 'PROVEN',
    statement: 'Read from WW.EXE and measured: the game\'s clocks come from the timer library, which programs the PC timer for a base interrupt (the dword obj2+0x3fa4, 4257 in the running game, about 280 interrupts a second) and keeps counters that each advance at a rate given when it is registered by the routine obj1+0x30e38 (rate in edx, counter address in ecx; the library divides 0x12305e by the rate, obj1+0x30e80). At the start (obj1+0x264c2 to +0x26503) three counters are registered: obj2+0x1e720 at 0x88 = 136 times a second, obj2+0x1e71c at 10 a second (the race timer of hud.timer-observed, so its unit is a tenth of a second) and obj2+0x1ea74 at 1 a second. The race frame counter obj2+0x1ec64, which the car step, the countdown and the object animation count in, is not a clock: it is incremented once for every frame of the race routine (obj1+0x2114c), and the frame limiter before it (obj1+0x21108 to +0x21122) waits until the 136 Hz counter has advanced by the period word obj2+0x1ea5c since the last frame (obj2+0x1e724). The period is 12 by default (obj1+0x25cf4 stores 12 in obj2+0x1ed08 at start; obj1+0x6d5b copies it to the active word), so a frame takes 12/136 of a second, 88.2 ms (11.3 a second), when the machine keeps up; the command-line words that set it to 6 or 0 are cmdline.words. Observed in a running race (record rate-1, about 10 s of the host clock): about 112 frames and 1354 counts of the 136 Hz counter (135.2 a second), the period words both 12. Not observed: the 10 Hz counter running (it stays at its start value during the countdown), a machine too slow for the limiter, and the other values of the period.',
    value: { counters: [{ hz: 136, rateAt: 156871, address: 124704, addressAt: 156881 }, { hz: 10, rateAt: 156891, address: 124700, addressAt: 156901 }, { hz: 1, rateAt: 156921, address: 125556, addressAt: 156926 }], library: { numerator: 1192030, divideAt: 200320 }, period: 12, periodWord: 126216, activeWord: 125532, defaultAt: 154868, copyAt: 27995, limiterAt: 135432, lastWord: 124708, frameWord: 126052, incAt: 135500, tolerance: 0.02, msPerSecond: 1000, frameSlack: 2 },
    evidence: { checks: ['exe-tickrate'], obs: ['rate-1'], at: ['WW.EXE:obj1+0x264c7 fp=bf34e3ee', 'WW.EXE:obj1+0x264d1 fp=975cf997', 'WW.EXE:obj1+0x264db fp=dcea6f5b', 'WW.EXE:obj1+0x264e5 fp=eb6bbe5a', 'WW.EXE:obj1+0x264f9 fp=2c104e8b', 'WW.EXE:obj1+0x264fe fp=e278b6d1', 'WW.EXE:obj1+0x30e80 fp=821cbf42', 'WW.EXE:obj1+0x25cf4 fp=50893b25', 'WW.EXE:obj1+0x6d5b fp=f9e1161a', 'WW.EXE:obj1+0x21108 fp=36e3428f', 'WW.EXE:obj1+0x2114c fp=bb0b4e20'] },
    leads: ['docs/driving-model.md'],
  },
];
