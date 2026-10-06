# Evidence discipline

The project ports *Wacky Wheels* to HTML and vanilla JavaScript, built with npm and Vite. `game/` is a reverse-engineering target, not a source repo. Every asset is read from the user's own copy (the `game/` folder in development, or a file pick on the hosted site) and decoded in-process at run time. Nothing is pre-extracted to data files: decoding the shipped bytes in-process is what keeps every format claim checkable.

## Tags

Every claim carries exactly one tag.

| Tag | Meaning |
| --- | --- |
| `PROVEN` | Verified by executing something: a check in `src/verify/checks/` re-executes it against the user's bytes and passes in `npm run verify`, and that check has been reviewed by the maintainer. |
| `STATIC` | Read out of the binary (disassembly or strings) with a verifiable citation, but not confirmed at run time. |
| `WF` | Produced by a subagent workflow and not yet re-read by the maintainer. It is plausible and adversarially reviewed, but nobody in this project has executed a check on it. The workflow's error rate is demonstrably nonzero: fifteen of its findings were refuted on bytes by its own verifiers, and a histogram it reported was wrong. Treat `WF` as a lead, not a fact. |
| `UNKNOWN` | Not established. The claim id is `UNKNOWN_<IDENTIFIER>`, and the claim has no value. |

External references (ModdingWiki, file-format specifications) are **leads** attached to a claim (`leads: [...]`). They are never a tag.

The **maintainer** is the user and the main Claude session, never a subagent. Anything a subagent reports about a binary is `WF`, including findings from Explore and Plan agents.

## THE RULE

Every constant must trace to a specific offset in the disassembly or to a validated observation of the real game. A constant that cannot be cited is omitted or rendered as a visible placeholder. It is never invented-but-plausible.

## Claim registry

The registry is `src/evidence/claims/*.js`, and every module is listed in `claims/index.js`. Each record has this shape:

```js
{ id, tag, statement, value?, evidence: { checks, at, obs, wf }, leads?, todo? }
```

- `src/evidence/registry.js` validates every record at load time:
  - the tag is known;
  - `UNKNOWN_` ids carry the `UNKNOWN` tag, and have no value;
  - `PROVEN` claims name a check;
  - `STATIC` claims have a citation or an observation;
  - `WF` claims name their run;
  - citations are well-formed;
  - ids are not duplicated.
- `K(value, claimId)` in `src/evidence/k.js` is the only way a constant enters `src/{formats,render,audio,game,verify/checks}`. It throws if the claim is missing, records no value, or records a different value.
- `UNKNOWN('UNKNOWN_X')` in `src/evidence/unknown.js` returns a sentinel. It renders as its label, and any numeric use throws. Render code draws a hatched, labelled tile for it, and audio plays silence. There are no silent fallbacks.
- `withSteps(fn)` records every claim a decode touches. A viewer badges the decode with the **weakest** tag, in the order `UNKNOWN < WF < STATIC < PROVEN`. Steps that come from `src/formats/hypotheses/` count as at most `WF`: lint requires every hypotheses module to call `noteStep('<WF or UNKNOWN claim>')` inside its parser (a module-level call would never reach a decode's collector), so any decode that runs it badges no stronger than that claim. A decode that touches no claim badges as `UNKNOWN`.

## Promotion procedure

1. A claim becomes `PROVEN` when a check that lists it passes in `npm run verify` **and** that check has `reviewed: { by, date }`.
2. A check body written by a subagent starts with `reviewed: null` and cannot back `PROVEN` until the maintainer has read it.
3. Where a pass could be coincidence, the check's `discriminate(ctx)` returns wrong variants, and every one of them must fail. For example, the other MZ signatures in WW.EXE must fail as the LE base.
4. A tag change, such as `WF` to `PROVEN`/`STATIC`, flips the registry tag, the docs line and the `docs/TODO.md` checkbox (ticked and moved to *Done*) in one commit.
5. Refuted leads stay in the docs together with the refuting evidence. Nothing is deleted.
6. Regression and identity checks are never evidence. That covers `npm test`, `check:assets`, `check:tracks` and roundtrip tests.
7. `npm run mutate` perturbs every leaf of every `PROVEN` value through K()'s `__DR_MUTATE__` hook: ±1 for numbers, one flipped bit for strings. For each perturbation it re-runs that claim's checks in a fresh process. A surviving mutation means the claim is not actually asserted, and the run fails. The fix is to narrow the claim or strengthen the check, never to delete the mutation.
8. Claims and checks must name each other. `verify` reports a one-sided link as an error.

## Reading rules

- Read Ghidra **disassembly**. Decompiler output may be wrong or misleading, and it is never cited.
- Load the `ghidra-evidence` skill before drawing conclusions from xrefs, decompiler output or a negative finding.
- A negative finding states the tool, address, technique and date ("not found by X"). It never says "does not exist".

## Citations

```
WW.EXE:obj<N>+0x<off> fp=<crc32>
```

- `off` is object-relative in the **pre-fixup** object, as assembled from the LE pages by `src/formats/le.js`.
- `fp` is the lowercase 8-hex CRC-32 (IEEE) of the 16 pre-fixup bytes that start at `off`.
- `npm run verify` re-hashes every citation in-process, so a wrong offset or a different build fails.
- Generate citations with `npm run cite -- 0x411a8` (from a Ghidra address) or `npm run cite -- obj1+0x311a8`.
- Ghidra addresses (at the LE-declared object bases) and live DOSBox addresses are derived. They are never cited alone. See [binaries.md](binaries.md).

## Observations

DOSBox observations are committed as numeric-only JSON records in `src/evidence/obs/`, written by `npm run observe` (see [binaries.md](binaries.md#observing-the-running-game)). A record contains:

- the tool and DOSBox build, the date, the executable's size and SHA-1, and what the game was doing (`moment`);
- the live object bases, and readings: addresses, counts, values, CRC-32s of memory regions, and short name labels.

Records contain no asset bytes (`validateObs` rejects long strings and byte-like arrays). A record is evidence only through a check in `src/verify/checks/` that lists it under `obs` and re-derives every reading from the in-process decode of the user's own files; `verify` fails on a record no claim cites, a claim citing a missing record, or a claim whose checks do not declare it. Without such a check, an observation-backed claim caps at `STATIC`. When an observation confirms only part of a claim, narrow the claim to the part seen and keep the rest as its own `STATIC` claim.

## Enforcement

`npm run lint` (`tools/lint/constants.mjs`, built on acorn) enforces the rule mechanically:

- **Numeric literals.** In `src/{formats,render,audio,game,verify/checks}`, a numeric literal other than 0 or 1 is rejected unless it is:
  - inside `K(...)`;
  - on a line tagged `// @math <reason>` (bit mechanics only);
  - on a line tagged `// @spec <claimId>`, where the claim has leads and a validating check.
- **Claim ids.** `K`/`UNKNOWN` must take a string-literal id that exists in the registry.
- **Game code.** `src/game/**` may use only `PROVEN`/`STATIC` claims, and may not import `src/formats/hypotheses/`.
- **Derived artefacts.** Nothing under `src/` may refer to `analysis/`.

Parsers whose correctness rests only on `WF` claims or leads live in `src/formats/hypotheses/`.

### Enhancement constants

The Enhanced presentation ([enhancements.md](enhancements.md)) is the page's own addition, not a reconstruction, so its numbers are not evidence and get no claims. Lint keeps them apart:

- **Design values live in one file.** Shadow opacity, fog strength, particle sizes and lifetimes, the presets and the discontinuity limits of smooth motion are all in `src/enhance/config.js`. Each is commented as a design choice. Any other module in `src/enhance/` may use only 0, 1 and literals on lines tagged `// @math <reason>`.
- **No claims.** `src/enhance/` never calls `K()` or `UNKNOWN()`. It reads the reconstructed values it shares with the game, such as the screen size, the view model, the turn, the horizon bounds, the tick period, the effect pictures, the spark sides, the special surface values and the SKID sound, through accessors exported by the modules that own them (`viewModel`, `skyModel`, `floorModel`, `horizonBounds`, `frameMs`, `surfacePicture`, `sparkShift`, `starterPoint`, `specialSurfaces`, `soundNumber`). `src/enhance/models.js` reads them once, because each accessor validates its claim on every call. A game number is therefore never restated as a design value.
- **No writes to the race.** `src/enhance/` may not assign to `state` (lint). It draws from shallow copies of the state. `npm run check:enhance` hashes the simulation after every tick under three conditions: no draw, the reference draw, and the enhanced draw. All three must match.
- **One-way dependency.** Only the pages import `src/enhance/`: the playtest page (`src/play.js`) and the asset garage's previews (`src/viewer.js`, `src/viewer-preview.js`). The reconstructed renderer, the game and the checks never depend on it, and the Original preset draws through the reference renderer unchanged.
- **No hypotheses.** `src/enhance/` may not import `src/formats/hypotheses/`. Its particles and skid marks use only classifications the game itself makes (an effect picture a surface has, the pit state, the spark word, the skid states and the SKID sound, the special surface values); it never gives a surface a meaning the disassembly has not shown.

## Layout

| Path | Content |
| --- | --- |
| `game/` | the user's copy of the game (git-ignored, never bundled) |
| `ghidra/` | Ghidra project (git-ignored, machine-local) |
| `analysis/` | derived listings, dumped objects, verify reports and raw WF outputs (git-ignored). `src/` never reads it |
| `docs/` | findings by subsystem, with evidence tags; this file; [binaries.md](binaries.md); [TODO.md](TODO.md) |
| `src/` | the web port: `formats/` (plus `hypotheses/`), `vfs/`, `evidence/`, `verify/`, `viewer/`, `render/`, `audio/`, `game/`, `editor/` |
| `tools/` | every tool developed for the project (`lint/`, `ghidra/`, `dump-le.mjs`, `cite.mjs`) |

## Roadmap

0. **Evidence infrastructure.** Done: registry, `K`, `UNKNOWN`, lint, verify, mutate, citations.
1. **WW.EXE loader.** Done: LE locate, pages, entry and fixups are PROVEN. Next, run the Ghidra import ([binaries.md](binaries.md)).
2. **Migrate the legacy decoders.** Move `src/*.js` into `src/formats/`. Every constant becomes a claim, with the wiki as a lead. Lead-only parsers go to `hypotheses/`. Status:
   - done: DAT directory, PCX (game-style) with the tile-sheet split, `.M`, `.POS`, `.SIN`, `.RD`, `.GAM` (STATIC from the loader, PROVEN layout from the archive);
   - next: `.SPW` and `.PAR` (their game readers are unread), then the sprite catalogue (`.ATR`, `.SP`), audio (`.VOC`, `.KLM`, `.MID`, AudioT), and the small record formats in `src/data-formats.js`;
   - after that, repoint the viewer and editor at the new parsers and delete the legacy ones.

   Each promotion cites the WW.EXE reader and adds a byte check with discriminators.
3. **Viewer and editor on the evidence layer.** Weakest-tag badges per decode, hatched `UNKNOWN` tiles, silence for unknown audio. Writers use the same claims as readers.
4. **Game (`src/game/`, PROVEN/STATIC only).** Fixed-step loop, input, physics, floor renderer, laps/progress, AI. Each constant is cited in WW.EXE, confirmed by a DOSBox observation record, and cross-validated by a check.
