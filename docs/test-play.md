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
