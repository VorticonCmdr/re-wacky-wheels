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
    id: 'UNKNOWN_START_HEADING', tag: 'UNKNOWN',
    statement: 'Where the player\'s start heading comes from. It was 480 (the TRIG index of the +y direction, down the map) at the start of every observed race (tracks 1 and 7 and the demo on track 2), which is also the angle word of the first .RD record of 38 of the 42 tracks, but the tracks 16, 18, 19, 20, 21, 37, 39, 40, 41 and 42 have another first angle and no start frame of them with the player\'s heading was taken; the game restores the heading from the dword obj2+0xab48 (obj1+0x26c8) and the routine that sets that is not read.',
    evidence: {},
    leads: ['docs/rd.md'],
    todo: 'Take start frames on a track whose first route angle is not 480 (track 18 or 19: cup screens) and read the writers of obj2+0xab48.',
  },
  {
    id: 'UNKNOWN_TICK_RATE', tag: 'UNKNOWN',
    statement: 'The real-time rate of the game\'s logic tick. The race timer is shown as MM:SS:T from a tick word (hud.timer-observed: tenths is the reading of the format) and the car moves one step per tick (car.step-observed), but the counter\'s rate was not read: a measurement of the dword obj2+0x1ec64 in DOSBox gave 113 ticks in 10.0 s (88.5 ms a tick, about 11.3 a second) in the attract demo, not 100 ms.',
    evidence: {},
    leads: ['docs/driving-model.md'],
    todo: 'Read the timer interrupt (the programmed PIT divisor and the routine that adds to the counters obj2+0x1e71c and +0x1ec64) and measure both counters in a played race.',
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
];
