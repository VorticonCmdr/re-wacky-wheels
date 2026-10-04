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

## Clock, start and turning (proven, 2026-10-04)

- The horizon strip scrolls with the steering ramps (`horizon.scroll`, `src/game/horizon.js`, replayed on 410 recorded pairs by `port-horizon`). A steering tick turns the camera about the point NDIST[0] units ahead of it and the move uses the old heading (`car.turn-move`, replayed by `port-carmodel`).

- The logic runs one frame per 12 counts of a 136 Hz counter, 88.2 ms (`tick.rate`, `src/game/clock.js`); the HUD race timer is a separate 10 Hz counter. The start heading is 480 and the start camera is the player's position less 0x7c in y (`race.start-heading`).

## What is not ported or not known (shown on the page)

- Sprites (cars, objects), the HUD, sound, laps, the AI, items and menus: not ported yet (see `docs/next-steps.md`).
- Accelerate and brake together, and the slowdown off the road (observed in `car.speed-observed`, not ported yet).
