# Test-playing the original with DOSBox (and the jev oracle)

The DOSBox bridge (`mcp__dosbox__*`, REST at 127.0.0.1:8386) drives the original game for observation: `Enter` taps navigate the menus to a played race, the input sequence API holds keys, `debug/pause` stops the game and the memory API reads the numeric state. `tools/dosbox/observe.mjs` turns such runs into records (`src/evidence/obs/`) that checks validate; `tools/dosbox/boost-run.mjs` and `keys-run.mjs` are examples of a scripted run. A run copy of the archive can be edited (`make-test-archive.mjs`, `make-test-sin.mjs`) to make a situation the real tracks do not have; the check rebuilds the edit from the user's own archive and compares hashes.

## jev as a judge

`jev/` (gitignored, the user's copy of the TypeSafe docs) describes `jev-latest`, a model behind `POST https://api.typesafe.ai/v1/systemone` that answers typed questions (`noul` yes/no, `choice`, `score`) about a `state` (a string or JSON). It is useful as an oracle for test-play where the right answer is a judgment about the state rather than a number the disassembly gives: is the car stuck, is a boost running, is the race over. `tools/dosbox/jev-judge.mjs` reads the paused player's numeric state through the bridge and asks such questions. `--dry-run` prints the request and sends nothing.

Limits: it needs `TYPESAFE_API_KEY` and sends the state to an outside service, so it is only run when the user has supplied a key and agreed; the state is numbers only, never archive bytes or pictures (the API takes text or JSON, not images); and an answer is a probability from a model, so it is a lead (WF), never evidence for a claim - claims still need a check that re-executes.

## Driving the original with jev (measured 2026-10-03)

`tools/dosbox/jev-drive.mjs` steers the player's car along track 1's `.RD` route (42 segments, the lap) from a fresh race start, one policy per run, holding the accelerate key and choosing left, straight or right from the angle error to a waypoint 140 units ahead. `jev` receives only that error, the distance, the speed and whether the car is on road. A call of the jev API takes about 250 ms (230 to 420 ms in 7 calls), a few calls of the game.

| policy | run | decisions | segments reached | samples off road |
| --- | --- | --- | --- | --- |
| `local` (proportional controller in the script, no API) | 25 s real time | 919 | 42 (a lap) | 176 of 919 |
| `jev`, game running | 25 s real time | 93 | 6 | 750 of 1014 |
| `stepped` (game paused during each jev call, 120 ms of game time between calls) | 40 s real time | 100 | 27 | 34 of 100 |

So jev picks the right steering when it is given the time, but as a real-time driver it is too slow for this game: at about 3.7 decisions a second the car runs off the road in the first corners. It is not a replacement for a human's reflexes. Two uses remain: the stepped mode as a test player (the game waits, so latency costs only wall time, 265 ms per 120 ms of play), and a split in which a local reflex loop steers every frame while jev answers the slower questions (a racing line, whether to use an item, whether the race is won). One run of each policy, the car not reset between the first two (the runs above were repeated from fresh starts); this is a tool measurement, not evidence for any claim.

## Controlled experiments in the countdown (2026-10-04)

The race's countdown (the first ~34 ticks, timer mode word `obj2+0x28c44` = 1) holds every car still and ignores fire, which makes it the place for set-ups: the 8 cars stand at the grid positions of `racer.start-grid`, nothing moves, the position words can be written and the game then runs the experiment from the green light. `tools/dosbox/countdown-run.mjs` leaves the current race (Esc, Down, Enter), takes the two Enter presses of the main menu to a new race, pauses it in the countdown and records the `steps` scenario of `observe.mjs`:

```sh
node tools/dosbox/countdown-run.mjs --id shot-1 --extra --extra2 --ms 15,40 \
  --poke '[[166666,1300],[166670,1376],[33830,3],[43774,30000],[43780,0]]' \
  --moment "..." --phases '[[["KBD_leftctrl"],80]]'
```

- `--poke` writes 16-bit words to obj2 offsets (decimal): `obj2+0x28b0a` (166666) and `+0x28b0e` (166670) are the position words (the camera; the player's car stands 124 units ahead along the heading), `obj2+0x8426` (33830) the held item, `obj2+0x847a` (33914) the pickup counter, racer n's record is at `obj2+0xaa90 + 0x68 n` (racer 1: counter word `+6` = 43774, advance word `+0xc` = 43780: writing 30000 and 0 keeps racer 1 in state 0 without moving). Pokes are experiments on the run copy, never claims; claims are about what the game then does.
- `steps` columns (`observe.mjs`): phase, tick, throttle, speed, x, y (the player's car words), angle, accelerate, brake, right and left steering amounts, the car words `+0x7c` and `+0x7e`, terrain; `--extra` adds the global collision word, the position words and racers 1 and 7 (x, y, words `+2` and `+4`, contact flag); `--extra2` adds the held item, the shot list summary (count and x, y, travel of the first three) and the hit words `+0x58` of racers 1 to 7.
- Sampling: each sample resumes for 15 to 120 ms and pauses; the tick counter `obj2+0x1ec64` says how many ticks passed, and only pairs one tick apart are exact steps (two samples can also share a tick: the pause fell inside the call).
- The input API's `/input/sequence` **replaces** the pending sequence and DOSBox keeps keys down across experiments: the tool releases every key with each call, otherwise Esc is ignored while Ctrl or Alt is still down.
- Other `observe.mjs` additions of the same day: `screen --args` takes `tiles` (a tile font: for every position and tile the pixel count and CRC-32 of the screen under the tile's pixels; used for the menus with `WFONT1.SP`), `words` (extra obj2 words) and the `horizon` spec (camera words, heading vector, box words, racer positions and the draw list); the `font` scenario reads the text routine's glyph table.

What the experiments established is in `docs/driving-model.md` (`car.step-observed`, `car.steer-step-observed`, `car.racer-hit-observed`, `item.racer-hit-observed`, `item.mine-types-observed`) and `docs/view.md`.
