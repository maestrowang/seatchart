# Test suite

Behavioral tests for Seating Chart Studio. Each asserting test prints
`RESULT: PASS` or `RESULT: FAIL` as its last line.

## Running

```bash
bash tests/setup.sh     # installs jsdom, stages fixtures
bash tests/run-all.sh   # runs everything, prints a summary
bash tests/run-all.sh roster   # or filter by substring
```

The design suites are DOM-free and need no setup:

```bash
bash design/run-all.sh
```

Run those two scripts directly rather than invoking a suite by hand. Both
`design/properties.test.js` and `design/fuzz.test.js` print `RESULT: PASS` or
`RESULT: FAIL` but never call `process.exit`, so they exit 0 either way —
`node properties.test.js` on its own cannot tell you it failed except by what
it prints. `design/run-all.sh` reads the verdict and sets the exit code.

## CI

`.github/workflows/tests.yml` runs both scripts on every push to `main` and
`claude/**`, and on PRs into `main`. Both gates were verified to actually go
red by feeding them a deliberately failing test.

## What's here

| Count | Kind |
|---|---|
| 62 | asserting tests (`RESULT: PASS`/`FAIL`) |
| 29 | investigation scripts — print measurements, no verdict |
| 6 | JSON chart fixtures |

Of the 29 investigation scripts, 23 are named `test_debug_*`; the rest are
`test_isolate_*`, `test_textbox_part*`, and `test_slider_performance.js`.
Despite the `test_` prefix these assert nothing, so a "failure" in one is not
possible — `run-all.sh` classifies them as `diag`. They're kept because several
encode the measurements that originally found a bug, and re-running one is the
fastest way to check whether a behavior has drifted.

Worth knowing: `test_slider_performance.js` *reports* the O(n²) crowding-check
timing (~6.8ms at 368 seats, inside a 60fps budget) but does not assert a
threshold, so a performance regression there will not turn the suite red on its
own — read its output.

## Paths

Everything resolves from `__dirname`: the app as `../index.html`, fixtures as
siblings in this directory. Clone anywhere, `bash tests/setup.sh`, run.

There is no copy step and no `test.html`. The suite reads the real
`index.html`, so it is not possible to accidentally test a stale build — which
was the failure mode of the previous `cp index.html /home/claude/test.html`
arrangement.

## The harness

Every test builds a JSDOM instance with a fake 2D canvas context: a Proxy
returning no-ops for drawing calls and plausible values for `measureText`. To
assert on *what was drawn*, override the specific method to push into a log —
see `test_disabled_podium_export.js`.

Simulate a real drag as `mousedown → input × N → change`. Keyboard stepping is
`input × N → change` with no mousedown; that distinction has exposed real bugs.

**Expected noise:** every test prints a `ReferenceError: TextEncoder is not
defined` stack trace on stderr. The bundled jsPDF needs `TextEncoder` at load
and jsdom doesn't supply it; real browsers do. It only stops jsPDF from
initialising, which no test exercises, so it is harmless — `run-all.sh`
discards stderr for exactly this reason. Don't chase it.

## Conventions

- Tests assert invariants, not snapshots.
- When behavior changes deliberately, fix the assertion and say why in a
  comment. Several tests carry notes explaining that they were updated because
  the old assertion encoded a bug.
- `test_exploratory_*.js` cover cross-feature interaction (undo, save/load,
  hidden seats, text boxes, rosters, degenerate charts).

See `../HANDOFF.md` for the architecture behind what these tests protect,
especially the spacing subsystem.
