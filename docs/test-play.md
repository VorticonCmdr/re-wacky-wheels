# Test-playing the original with DOSBox (and the jev oracle)

The DOSBox bridge (`mcp__dosbox__*`, REST at 127.0.0.1:8386) drives the original game for observation: `Enter` taps navigate the menus to a played race, the input sequence API holds keys, `debug/pause` stops the game and the memory API reads the numeric state. `tools/dosbox/observe.mjs` turns such runs into records (`src/evidence/obs/`) that checks validate; `tools/dosbox/boost-run.mjs` and `keys-run.mjs` are examples of a scripted run. A run copy of the archive can be edited (`make-test-archive.mjs`, `make-test-sin.mjs`) to make a situation the real tracks do not have; the check rebuilds the edit from the user's own archive and compares hashes.

## jev as a judge

`jev/` (gitignored, the user's copy of the TypeSafe docs) describes `jev-latest`, a model behind `POST https://api.typesafe.ai/v1/systemone` that answers typed questions (`noul` yes/no, `choice`, `score`) about a `state` (a string or JSON). It is useful as an oracle for test-play where the right answer is a judgment about the state rather than a number the disassembly gives: is the car stuck, is a boost running, is the race over. `tools/dosbox/jev-judge.mjs` reads the paused player's numeric state through the bridge and asks such questions. `--dry-run` prints the request and sends nothing.

Limits: it needs `TYPESAFE_API_KEY` and sends the state to an outside service, so it is only run when the user has supplied a key and agreed; the state is numbers only, never archive bytes or pictures (the API takes text or JSON, not images); and an answer is a probability from a model, so it is a lead (WF), never evidence for a claim - claims still need a check that re-executes.
