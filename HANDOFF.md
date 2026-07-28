# Seating Chart Studio — Engineering Handoff

Written for a fresh agent or developer picking this up cold.
Current app version: **5.4.2**. Test suite: **89 files, all passing** — 60 of
them assert a `RESULT:` verdict, the other 29 are investigation scripts that
print measurements only.

---

## 1. What this is

A single-file browser app for building orchestra/band seating charts.
`index.html` is ~6,500 lines of vanilla JS + Canvas with no
build step, no framework, and no backend. It is deployed as a static file
(GitHub Pages). Charts save to `localStorage` or download as
`.seatchart.json`.

Shipped alongside it:

| File | Purpose |
|---|---|
| `index.html` | the entire app (was `seating-chart-studio.html` pre-merge) |
| `guide.html` | end-user guide, linked from the app footer |
| `README.md` | repo-owner docs, incl. publishing templates |
| `favicon.png` | referenced by both HTML files |
| `templates/` | optional `manifest.json` + `.seatchart.json` files |
| `tests/`, `design/` | test suite and DOM-free design suites |

**Licence:** all rights reserved, notice in both HTML headers and `README.md`.
The app bundles jsPDF (MIT) — its `@license` block must stay, and the
reservation explicitly does not extend to it.

---

## 2. Start here: the spacing subsystem

This is the heart of the app and where nearly all the hard bugs lived. If you
change one thing, understand this first.

### 2.1 Why it was rebuilt

The original code branched on what *kind* of seat it was moving — formula-laid,
hand-dragged, custom-shaped, or freeform — times three sliders. Twelve code
paths, each with its own snapshot and clamps. Fixing one routinely broke
another. It was rebuilt around a single model in v5.0.0.

### 2.2 The model

Seat categories were deleted. A seat is a point relative to the podium:

- **depth** — how far back it sits
- **lateral** — how far sideways from center

Seats at a similar distance read as *a row* whether or not the data says so.
That is what makes an all-freeform chart behave like a neatly rowed one, with
no code that knows the difference.

Each slider is one visual intent:

| Slider | Intent |
|---|---|
| stage spacing | translate the whole formation toward/away from the audience |
| row spacing | scale the gaps **between** depth-bands |
| seat spacing | spread seats **within** their own band |

Every transform is **monotonic** in the coordinate it changes, so seats cannot
swap or overtake. That is a property of the transform's shape — not something
patched afterward by clamping individual seats, which is what made seats jump
in the old code.

### 2.3 Arcs use polar coordinates — this matters

Measured on a real chart: an arc row's seats vary by up to **293px in depth**
but only **2–28px in radius** from the podium. Depth is the wrong frame for a
curve.

So banding groups by **radius**, and per-band the code records whether it reads
as an arc or a line. Seat spacing on a curved band widens the **angle** seats
occupy while holding radius, so they slide along the arc — the ends spread as
much as the middle. Row spacing scales **radius** gaps, so the gap opens evenly
along the whole curve rather than only at the center.

Straightness is decided **per seat** via `rowShapeOf()`, not per band, so seats
deliberately straightened inside a curved row stay straight.

### 2.4 The gesture lifecycle

```
mousedown / first input   →  beginSpacingGesture()    freeze a snapshot
each input                →  gesture{Stage,RowSpacing,SeatSpacing}(g, ratio)
                          →  gestureApplyFitted(...)  back off if it won't fit
                          →  commitSpacingGesture(g, points)
change (release)          →  endSliderDrag()          clear + reset thumbs
```

Key functions (`index.html`):

| Line | Function |
|---|---|
| ~1578 | `bandTolerance` — derived from the chart's own scale, not fixed px |
| ~1601 | `groupIntoBands` — radius banding + straight-row repair |
| ~1652 | `beginSpacingGesture` — freezes everything a gesture needs |
| ~1733 | `gestureStage` / `gestureRowSpacing` / `gestureSeatSpacing` |
| ~1851 | `gestureApplyFitted` — binary-searches the largest ratio that fits |
| ~1886 | `commitSpacingGesture` — writes back + resyncs row geometry |
| ~2248 | `effectiveSpacingSelection` — implicit "everyone" when nothing selected |

**Non-negotiable invariants** (all covered by tests):

1. Transforms read the **frozen snapshot**, never live seat positions — so
   repeated slider movement never compounds.
2. Banding is computed **once** at gesture start. Recomputing mid-drag makes
   seats regroup and drift under the cursor.
3. When a fit fails, ease the **ratio** back and re-apply the same transform.
   Never clamp individual seats — that makes them pile against an edge and jump.
4. The fit checks **both** canvas bounds and seat-to-seat crowding, per seat,
   with a "never worse than it started" rule.
5. Record the ratio **achieved**, not requested. Storing the request made later
   gestures measure from a position the chart never reached (was 64px of drift).

---

## 3. Gotchas that cost real time

**`chart.rowRadii` means two different things.** For an **arc** row it is the
radius from the podium. For a **straight** row it is plain depth. Writing depth
for both silently corrupts every arc. Anything reading or writing it must branch
on `chart.rowShapes[i]`.

**`exportRenderOptions` is null during "screen" export.** That mode deliberately
means "render exactly as displayed", so it cannot be used to detect exporting.
Use the separate **`isExporting`** flag, which covers all three export modes and
Print. This is how the disabled-podium placeholder is kept out of exports.

**Scoped vs global sliders.** With a selection, sliders are scoped and neutral is
always **100**. Baselining a scoped gesture against a global value (`chart.rowSpacing`
etc.) re-applies changes and compounds across releases. `beginSpacingGesture`
handles this — see the `scoped` flag.

**Concentric arcs nest.** An outer row's end seats sit *beside* the row in front,
not behind. Any check based on vertical extent or bounding boxes will misread a
correct layout as overlapping. Use seat-to-seat proximity.

**Row order is radial, not vertical.** Stage spacing preserves y-order but not
radial order; row spacing preserves radial order but lets arcs harmlessly cross
in y. Neither is a universal measure — assert on **distance between seats**.

**Never merge two bands that hold different chart rows.** `groupIntoBands` ends
with a merge pass, and it is easy to reach for depth there — but depth is the
wrong frame for a curve, which is the whole reason the banding above it is
radius-based. A short back row nests *beside* the front row: on String
Orchestra, row 3 at radius 377 shared a median depth with row 0 at 148, the two
fused into one band, and because row 0 is the anchor that never moves, the last
row froze with it. Chamber Orchestra collapsed to a single band and nothing
moved at all. Merging is only ever correct for a group with **no chart row of
its own** — a freeform chair being adopted — and proximity must be measured in
**radius**. Two merged rows also move in lockstep, so equal deltas on adjacent
rows are the tell.

**Straight-row fitting.** Never shrink a straight row's *width* to answer a
*vertical* overflow. Narrowing cannot fix it, and the loop will collapse the row
into overlapping chairs.

---

## 4. Testing

### 4.1 Running

```bash
bash tests/setup.sh          # installs jsdom, the only dependency
bash tests/run-all.sh        # runs everything, prints a summary
bash tests/run-all.sh roster # or filter by substring
node tests/test_<name>.js    # each prints "RESULT: PASS|FAIL"
```

The full run takes a few minutes. `run-all.sh` exits non-zero if any asserting
test fails. `.github/workflows/tests.yml` runs it, plus `design/run-all.sh`, on
every push to `main` and `claude/**` and on PRs into `main`.

> **Don't run the design suites directly from CI.** `properties.test.js` and
> `fuzz.test.js` print `RESULT: PASS`/`FAIL` but never call `process.exit`, so
> they exit 0 even when failing — `node properties.test.js` as a CI step is a
> gate that cannot go red. `design/run-all.sh` reads the verdict and sets the
> exit code; use it.

> **Paths:** tests resolve everything from `__dirname` — the app as
> `../index.html`, fixtures as siblings in `tests/`. There is no copy step and
> no `test.html`; the suite reads the real `index.html`, so it cannot silently
> test a stale build. This replaced hardcoded `/home/claude/...` literals that
> had to be recreated by hand on every checkout.

### 4.2 The harness

Every test builds a JSDOM instance with a **fake 2D context** — a Proxy
returning no-ops for drawing calls and plausible values for `measureText`
etc. To assert on *what was drawn*, override the specific method to push into a
log (see `test_disabled_podium_export.js`).

Simulate a real drag as `mousedown → input × N → change`. Keyboard stepping is
`input × N → change` with no mousedown — that distinction has exposed real bugs.

### 4.3 The design suites

`design/` holds the spacing model as **pure functions with no DOM**, plus:

- `properties.test.js` — 558 properties across 9 hand-built scenarios
- `fuzz.test.js` — 600 generated charts across 5 structural styles

```bash
cd design && node properties.test.js && node fuzz.test.js
```

**Use these first when changing the spacing model.** They caught three design
flaws before any code touched the app. `design/shape.js` is a prototype of the
shape-aware banding; the shipped version lives in the app.

### 4.4 Conventions

- Tests are behavioral, not snapshots — they assert invariants.
- When behavior changes deliberately, **fix the assertion and say why in a
  comment.** Several tests carry notes explaining that they were updated
  because the old assertion encoded a bug.
- `test_exploratory_*.js` cover cross-feature interaction (undo, save/load,
  hidden seats, text boxes, rosters, degenerate charts).
- `test_slider_performance.js` guards the O(n²) crowding check — 6.8ms at 368
  seats, well inside a 60fps budget.

---

## 5. Open work

### 5.1 Row spacing doesn't fully honor edge alignment — *known, diagnosed*

Every row's end seats align at a common height (the `edgeK` rule). That makes
each successive row fan wider, so corresponding edge seats sit at **different
angles**. Their separation is largely tangential, which a radial scale barely
touches.

Measured, row spacing 100% → 140%:

| | middle-to-middle | edge-to-edge |
|---|---|---|
| row1→row2 | +3.9% | +3.7% |
| row2→row3 | **+8.2%** | **+3.9%** |

**Fix:** row spacing should scale radii *and* recompute each row's span so edge
seats stay aligned — the same `edgeK` relationship `addRow` already uses.
Contained, but real work; needs the design suite to verify.

### 5.2 Row-add gate is stricter than necessary

Compressing spacing frees genuine room (backmost seat moves y=37 → y=113) but
the gate can still decline. A new arc's ends swing forward of its center, so it
needs more clearance than the depth freed. Declining is the *safe* direction —
it never leaves overlapping or invisible chairs — but it is conservative. Same
root cause as 5.1. Recorded as a known limitation in
`test_exploratory_workflows.js` with the measurement attached.

### 5.3 Analytics — discussion only, nothing built

User wants per-feature usage data to decide what to streamline. Open questions
raised but not resolved:

- The app currently promises *"nothing leaves your computer"* in the footer,
  guide, and README. Analytics contradicts that.
- **Rosters contain student names.** Hard rule: chart content must never leave
  the browser — anonymous event names only. District (SMMUSD) policy on
  third-party tracking should be confirmed first.
- GitHub Pages is static, so options are: third-party script, own endpoint
  (Cloudflare Worker), or local-only counters the user voluntarily exports.
  Any key/endpoint is visible in page source.
- Suggested direction: opt-in toggle, default off, privacy-first tool
  (GoatCounter/Umami/Plausible rather than GA).
- **Open question to the user:** current user count. Below a few hundred users,
  analytics will be noise and direct observation is more informative.

---

## 6. Recent history

| Version | Change |
|---|---|
| 5.0.0 | Unified spacing model; 12 code paths → 1; ~250 lines of special-casing removed |
| 5.1.0 | Arc coordinate rework (radius banding, spread along the curve); row-add gating |
| 5.2.0 | Seat-crowding guard in the fit; per-seat straightness; radial row separation |
| 5.2.1 | Fixed 64px cumulative drift (record achieved ratio, not requested) |
| 5.3.0 | Four row-adding bugs: crushed rows, unclamped arc span, judged-too-early placement |
| 5.3.1 | Scoped-slider compounding; row spacing no longer stretches within a row |
| 5.4.0 | Disabled podium excluded from all exports; user guide + footer link |
| 5.4.1 | Roster paste now clears that section's shuffle (stale permutation blanked/scrambled pasted names); test suite + design suites merged into the repo |
| 5.4.2 | Band merging no longer fuses distinct rows: row spacing reaches the last row on String Orchestra and Chamber Orchestra, and adjacent rows fan progressively instead of moving in lockstep; a roster shuffle that no longer matches its roster is dropped at load |

---

## 7. Working notes

- **Reproduce before fixing.** Every real bug in this project was found by
  measuring, not by reading code. Several plausible-looking fixes made things
  worse; the measurements caught it.
- **Distrust your own test when app behavior looks impossible.** Stage spacing
  is a pure translation and *cannot* invert ordering — when a test said it did,
  the test was wrong, and fixing the measure exposed a genuine crowding bug.
- **Prefer structural guarantees over guards.** "Seats can't overtake" should
  fall out of a monotonic transform, not a post-hoc clamp.
- The user tests thoroughly against real charts and reports precisely. When
  they say something regressed, it did.
