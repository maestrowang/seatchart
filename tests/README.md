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
cd design && node properties.test.js && node fuzz.test.js
```

## What's here

| Count | Kind |
|---|---|
| 58 | asserting tests (`RESULT: PASS`/`FAIL`) |
| 29 | investigation scripts — print measurements, no verdict |
| 7 | JSON chart fixtures |

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

## The absolute-path quirk

The tests read `/home/claude/test.html` and `/home/claude/<fixture>.json` by
absolute path — that literal appears in 86 files. `setup.sh` stages the files
there rather than rewriting all of them. If `/home/claude` isn't writable on
your machine, either run setup with `sudo`, or create the directory once and
chown it to yourself.

`test.html` is a copy of `index.html`; it's gitignored so a stale copy can't be
committed. Re-run `setup.sh` after editing `index.html` or you'll be testing
the previous build — the most common way to get a confusing result here.

## The harness

Every test builds a JSDOM instance with a fake 2D canvas context: a Proxy
returning no-ops for drawing calls and plausible values for `measureText`. To
assert on *what was drawn*, override the specific method to push into a log —
see `test_disabled_podium_export.js`.

Simulate a real drag as `mousedown → input × N → change`. Keyboard stepping is
`input × N → change` with no mousedown; that distinction has exposed real bugs.

## Conventions

- Tests assert invariants, not snapshots.
- When behavior changes deliberately, fix the assertion and say why in a
  comment. Several tests carry notes explaining that they were updated because
  the old assertion encoded a bug.
- `test_exploratory_*.js` cover cross-feature interaction (undo, save/load,
  hidden seats, text boxes, rosters, degenerate charts).

See `../HANDOFF.md` for the architecture behind what these tests protect,
especially the spacing subsystem.
