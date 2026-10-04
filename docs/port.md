# The port (`src/game`, `src/render`, `play.html`)

The first playable slice: drive one car on one track, seen from the driver's seat. Open `play.html` (dev: `npm run dev`, then *Load local game*; hosted: *Open WACKY.DAT*). Everything is decoded in the browser from the player's own archive.

## What is ported, and the evidence behind it

| Module | What it does | Evidence |
| --- | --- | --- |
| `src/render/floor.js` | the perspective floor at the three detail levels (320, 160 or 80 rays) | `floor.model` (constants, each equal to its source claim: `port-floormodel`); `port-floor` runs this renderer on the five observed frames (`floor-1` to `floor-5`) and requires every column outside the overlays to equal the game's |
| `src/render/sky.js` | the sky picture (rows 0 to 109) and the horizon strip (the 20 rows from row 110, a window of the track's .PAR file) | `sky.model`; `port-sky` replays the five sky frames and the three horizon frames; the palette is the first tileset's (`race.palette`, `dac-2`: all 256 DAC entries) |
| `src/game/track-data.js` | the tile sheets, map, palette, TRIG, NDIST, VEL.TAB and the start position of a track | the decoders of `src/formats` and `floor.model`, `car.model` |
| `src/game/car.js` | the car's throttle, speed from VEL.TAB, the straight move, the heading change, the camera 0x7c behind the car | `car.model`; `port-carmodel` replays every straight-road pair and every steering pair of `steps-1` to `steps-3` through `stepCar`, and checks the camera against the grid frames and one horizon frame |
| `src/game/view.js` | the view of a frame (fan, bounding box, SLP cone), the projection of a world point to column, distance, size class and bottom row | `view.model` (each constant equal to its source claim); `port-view` replays the horizon and grid frames' boxes and every static object record of the fit frames (`fit-2` to `fit-9`, `horizon-6` to `-14`) |
| `src/game/objects.js` | the draw records of the track's .SPW objects and their animation frame | `object.animation` (`port-animation`: 2016 recorded object samples, every frame word = (tick + 20) mod frames, 84 of them one step behind), `port-view` |
| `src/game/player-car.js`, `src/render/draw-list.js` | the player's car picture and the farthest-first draw list | `car.player-frames-observed`, `car.lean-observed` (`port-lean`: 334 pairs of pauses), `view.player-car-draw` (STATIC), `view.draw-order` |
| `src/render/menu.js`, `src/game/menu.js`, `src/game/menus.js` | the list menus (CHECK.PCX, padded items in the WFONT1.SP tile font, the selection icons, two corner cars in the main menu and four in a submenu), their cursor, animations and the way between them (main menu, Game Options, Comm-bat, Graphic Detail Levels with its two HIGH/MEDIUM/LOW lists, and the Race Screen Options switches, which the future HUD reads: `menu.tree-observed`, `obs-menutoggle`, `obs-menudetail`; the single screen level chosen there is the page's detail level) | `menu.screen-model` (`obs-menuframe` replays recorded whole-page CRCs of four running menus through the port's renderer, nearly all exact and the rest one step behind), `menu.tree-observed` (the items of the submenus; `obs-menupath` replays a recorded path of key taps through the port's menus), `menu.animation-observed` (`obs-menustate`, 299 pairs of pauses), `menu.cursor-observed` (`obs-menucursor`), `menu.keys-observed` (`obs-menukeys`: Space and Enter select, Esc puts the cursor on item 9), `menu.main-observed` (`port-menu`: 5754 tile comparisons of the recorded `menu-2` screen) |

Constants enter these modules only through `K(...)` (THE RULE); `npm run mutate` perturbs them and the replay checks must fail.

## Clock, start and turning (proven, 2026-10-04)

- The horizon strip scrolls with the steering ramps (`horizon.scroll`, `src/game/horizon.js`, replayed on 410 recorded pairs by `port-horizon`). A steering tick turns the camera about the point NDIST[0] units ahead of it and the move uses the old heading (`car.turn-move`, replayed by `port-carmodel`).

- The logic runs one frame per 12 counts of a 136 Hz counter, 88.2 ms (`tick.rate`, `src/game/clock.js`); the HUD race timer is a separate 10 Hz counter. The start heading is 480 and the start camera is the player's position less 0x7c in y (`race.start-heading`).

## What is not ported or not known (shown on the page)

- The main menu is complete as far as it was observed. Not observed: the state its animations start in when it is entered (`UNKNOWN_MENU_START_STATE`), a held key's repeat and Esc during the icons' animation (`UNKNOWN_MENU_HELD_KEYS`). SINGLE PLAYER RACING goes straight into the race (the vehicle, class, lap and track menus are not ported); GAME OPTIONS, COMM-BAT PLAY, GRAPHIC DETAIL LEVELS and RACE SCREEN OPTIONS (three ON/OFF switches) open their menus, and the detail lists set the detail level; every other item (the screens behind VOLUME LEVELS, MODEM and SERIAL CABLE, the races, WACKY WHEELS INFO, ORDERING INFO and LEAVE GAME) is recorded as pending in `src/game/menus.js` and says so on the page. The earlier belief that the menu is drawn over WINTRO.PCX (from `boot-1`'s sample at 32 s) was refuted by the live screen: it is CHECK.PCX, as the lead said.

- The AI cars (their pictures, slots and frames), pickups and consumption of objects, the HUD, sound, laps, the AI, items and menus: not ported yet (see `docs/next-steps.md`).
- Accelerate and brake together, and the slowdown off the road (observed in `car.speed-observed`, not ported yet).
