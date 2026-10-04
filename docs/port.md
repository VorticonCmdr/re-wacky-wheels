# The port (`src/game`, `src/render`, `play.html`)

The first playable slice: drive one car on one track, seen from the driver's seat. Open `play.html` (dev: `npm run dev`, then *Load local game*; hosted: *Open WACKY.DAT*). Everything is decoded in the browser from the player's own archive.

## What is ported, and the evidence behind it

| Module | What it does | Evidence |
| --- | --- | --- |
| `src/render/floor.js` | the perspective floor at the three detail levels (320, 160 or 80 rays) | `floor.model` (constants, each equal to its source claim: `port-floormodel`); `port-floor` runs this renderer on the five observed frames (`floor-1` to `floor-5`) and requires every column outside the overlays to equal the game's |
| `src/render/sky.js` | the sky picture (rows 0 to 109) and the horizon strip (the 20 rows from row 110, a window of the track's .PAR file) | `sky.model`; `port-sky` replays the five sky frames and the three horizon frames; the palette is the first tileset's (`race.palette`, `dac-2`: all 256 DAC entries) |
| `src/game/track-data.js` | the tile sheets, map, palette, TRIG, NDIST, VEL.TAB and the start position of a track | the decoders of `src/formats` and `floor.model`, `car.model` |
| `src/game/car.js` | the car's throttle, speed from VEL.TAB, the straight move, the heading change, the camera 0x7c behind the car | `car.model`; `port-carmodel` replays every straight-road pair and every steering pair of `steps-1` to `steps-3` through `stepCar`, and checks the camera against the grid frames and one horizon frame |

Constants enter these modules only through `K(...)` (THE RULE); `npm run mutate` perturbs them and the replay checks must fail.

## What is not ported or not known (shown on the page)

- `UNKNOWN_HORIZON_SCROLL`: the horizon strip's offset (start and step); the page draws it at 0.
- Sprites (cars, objects), the HUD, sound, laps, the AI, items and menus: not ported yet (see `docs/next-steps.md`).
- `UNKNOWN_CAR_TURN_MOVE`: how the car moves in a tick with a steering key held. `src/game/car.js` makes the car stand still in such a tick unless the page passes a hypothesis; the page passes `turnMoveHypothesis` (the straight step of the old heading, `src/formats/hypotheses/turn-and-start.js`), which differs from the game by a few units a tick.
- `UNKNOWN_START_HEADING`: the page takes the first route record's angle word (480 on every observed start).
- `UNKNOWN_TICK_RATE`: the page runs 10 logic ticks a second; 88.5 ms a tick was measured in the attract demo.
- Accelerate and brake together, and the slowdown off the road (observed in `car.speed-observed`, not ported yet).
