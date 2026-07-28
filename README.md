# Seating Chart Studio

> **Copyright (c) 2026 maestrowang. All rights reserved.**
>
> This code is for review and educational purposes only. No part of this
> repository may be copied, distributed, or modified without explicit written
> permission from the author.

A single-file web app for building orchestra, band, and ensemble seating
charts. Everything runs in the browser -- there is no server, no account, and
no data leaves your machine.

---

## Contents

- [Getting started](#getting-started)
- [Building the formation](#building-the-formation)
- [Selecting and editing seats](#selecting-and-editing-seats)
- [Spacing and size](#spacing-and-size)
- [Tools](#tools)
- [Rosters -- putting names on seats](#rosters----putting-names-on-seats)
- [Groups](#groups)
- [View options](#view-options)
- [Saving, loading, and sharing](#saving-loading-and-sharing)
- [Exporting and printing](#exporting-and-printing)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Templates](#templates)
- [Adding templates via repo files](#adding-templates-via-repo-files)

---

## Getting started

Open the app and you get an empty stage with a conductor's podium at the front.
The panel on the left holds every control, organised into sections you can
collapse by clicking their titles. **Collapse All** and **Expand All** sit at
the bottom of the panel.

Work generally flows top-down: build rows, assign instruments, add names,
adjust spacing, then export.

---

## Building the formation

**Build Rows** is where a chart starts.

1. Set **Chairs in row** (how many seats).
2. Choose a **Shape** -- *Curved* (an arc around the podium) or *Straight*.
3. Click **+ Add Row**.

Each new row is placed behind the previous one. Curved rows are laid out so
their end seats line up with the rows in front, which is the conventional look
for orchestral seating.

- **Undo Row** removes the most recently added row.
- **Reset Seating Chart** clears everything and starts over.

### When a row won't fit

The stage is a fixed size, so there is a real limit to how many rows fit. If a
new row cannot be placed without overlapping the existing formation or running
off the visible area, the app declines to add it and says why, rather than
placing a squashed or invisible row.

If that happens and you still want another row, make room first:

- Reduce **Seat spacing** to narrow the rows.
- Reduce **Row spacing** to pull the rows closer together.
- Adjust **Stage spacing** to move the whole formation forward.

Then try adding the row again. Past a certain point the stage really is full,
and that is expected.

---

## Selecting and editing seats

- **Click** a chair to select it.
- **Drag** a chair to move it anywhere you like.
- **Drag on empty stage** to box-select several chairs at once.
- **Shift-click** to add to or remove from the current selection.
- **Double-click** a chair to edit its text directly on the chart.
- **Arrow keys** nudge the selection a pixel at a time.

The **Selection** section changes to match what you have selected, and expands
on its own when you select something.

### One seat selected

Set its **instrument/section** (which also colours it), its **label**, and its
colour. You can toggle a **music stand**, **hide** it (useful for a partial
row), or **Delete Seat**. **Reset** returns it to a plain unassigned chair.

### Several seats selected

The panel switches to batch controls: assign an instrument to all of them, give
them all a stand, **Hide all** / **Show all**, **Delete Selected**, or **Reset
Seats**. You can also convert a run of seats inside a curved row to sit in a
straight line -- handy for a piano, percussion, or a front-and-centre soloist.

### The podium

Click the podium to rename it, recolour it, or give it a music stand or a
conductor's stand. **Disable Podium** hides it entirely.

---

## Spacing and size

Four sliders live in **Tools**. They behave differently depending on what is
selected:

| Nothing selected | Seats selected |
|---|---|
| Applies to the whole chart | Applies only to the selection |

- **Seat size** -- how large the chairs are drawn.
- **Seat spacing** -- how far apart seats sit *within* a row. On a curved row
  the seats spread along the arc, so the ends open up just as much as the
  middle. Straight rows stay straight.
- **Row spacing** -- how far apart the rows sit from one another, measured out
  from the podium so the gap opens evenly along a curve.
- **Stage spacing** -- slides the entire formation toward or away from the
  audience.

Everything moves from where it currently sits, including chairs you have
dragged by hand and freeform chairs that belong to no row -- they travel with
the rows around them rather than being left behind.

The sliders stop when the formation reaches the edge of the visible area, or
when seats would begin to overlap. If you drag further than the stage allows,
the slider springs back to the furthest setting that actually worked. That is
the app telling you it has run out of room, not a glitch.

---

## Tools

- **+ Freeform Chair** -- click anywhere on the stage to drop a chair that
  belongs to no row. Useful for soloists, a piano bench, or anything off to one
  side.
- **Link Stand Partners** -- click two seats to have them share a music stand.
  Clicking the same pair again unlinks them. If you later delete one of a linked
  pair, the survivor keeps a stand of its own.
- **Text Box** -- click anywhere to place free text. Double-click it to edit on
  the chart; press Enter for a new line. While selected you get font size,
  **bold**, *italic*, underline, and left / centre / right alignment. Drag to
  move it, or use **Delete Text Box**.

Press **Escape** to leave any tool.

---

## Rosters -- putting names on seats

The **Roster** button sits at the top right of the screen.

Rosters attach player names to seats by *rank* -- the first name goes to the
first chair, and so on. Ranking follows normal seating convention: curved rows
rank from the outside in, straight rows from the centre out.

1. Open the Roster panel and pick a section from the dropdown.
2. Click **Paste / Edit Names** and paste a list, one name per line. Pasting
   straight from a spreadsheet column works.
3. Names appear on the chart immediately.

Other things you can do:

- **Drag** names in the list to reorder them.
- **Double-click a name on the chart** to edit it in place.
- **Shuffle** randomly reassigns the section. **Preserve stand partners** keeps
  stand-sharing pairs together as a unit. Shuffling never alters your real
  roster order -- **Revert to Original** always brings it back, and you can
  shuffle repeatedly without reverting first.
- Names beyond the number of available chairs are highlighted as unassigned.
- **Roster text size** scales the names, globally or just for a selection.

### Charts with no instruments

You do not need to assign instruments to use rosters. If seats have no
instrument, the roster panel groups them **by row** instead -- "Row 1", "Row 2"
and so on -- ranked naturally left to right. This makes a plain seating chart
work exactly like a sectioned one.

---

## Groups

**Groups** lists every instrument section currently on the chart, with a seat
count, and lets you select a whole section in one click.

You can also select any set of seats and use **Save Selection as Group...** to
name it and keep it for later. Groups expand into view automatically once you
have any.

---

## View options

- **Show seat rank numbers** -- small numbered badges, with per-section controls
  for ranking style, inverting the order, or hiding numbers for one section.
- **Show seat labels** -- instrument abbreviations on each chair.
- **Show roster names** -- player names on each chair.
- **Show music stand** -- draw stands (purely visual; links are preserved either
  way).
- **Show section legend** -- the colour key.
- **Flip (performer's view)** -- turn the chart around to see it as the players
  do.
- **Notes** -- free text printed underneath the chart, e.g. "Concert attire:
  black & white".

The chart title is editable directly at the top of the page.

---

## Saving, loading, and sharing

**Save & Load** offers two different things.

**Saved charts** live in your browser's local storage. Quick, but tied to this
browser on this machine. Deleting one asks for confirmation first.

**Chart files** are portable `.seatchart.json` files:

- **Download Chart File** saves the current chart to disk.
- **Upload Chart File...** loads one back in.

Use chart files to move work between machines, send a chart to a colleague, or
keep versions in a repo.

---

## Exporting and printing

- **Download PNG** -- an image, with a quality picker (Standard / High / Very
  High) that shows the estimated file size.
- **Download PDF** -- a real PDF, same quality options.
- **Print Chart** -- prints at the highest quality, no options needed.

PNG and PDF each offer three colour modes:

- **Digital -- Full Color** -- exactly as shown on screen.
- **Print -- Color** -- white background, no stage texture.
- **Print -- Black & White** -- greyscale, tuned so labels and names stay
  legible without their colour backgrounds.

**Ctrl+P** (or **Cmd+P**) opens this print dialog rather than the browser's, so
you get the chart on its own instead of the whole page with the sidebar.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + A` | Select all seats |
| `Ctrl/Cmd + P` | Open the app's print dialog |
| `Arrow keys` | Nudge the selected seats |
| `Delete` / `Backspace` | Delete the selection |
| `Escape` | Exit a tool, close a dialog, or clear the selection |
| `Double-click` | Edit a seat's name or label, or a text box, on the chart |

`Escape` also releases a slider, so arrow keys go back to nudging seats instead
of moving the slider.

---

## Templates

**Templates** loads a pre-built chart as a starting point. Loading one only
affects your own copy -- the original is untouched, so you can freely modify
whatever you load.

Templates come from two places: charts saved locally in your browser, and files
published alongside the app in its repo. Both appear in the same list. Click
**Refresh List** to re-check for new ones.

---

## Adding templates via repo files

The app can show templates that live as plain files in the repo, alongside
`index.html` (the app itself) -- no admin login, no in-app publishing needed.
Anyone who can push to the repo can add, edit, or remove templates just by
editing files.

### How it works

The app looks for a `templates/` folder next to itself, containing:

1. **`templates/manifest.json`** -- a list of which template files exist.
2. **One `.seatchart.json` file per template** -- the actual chart data,
   normally created via the app's own **Download Chart File** button.

When the app loads (or when you click **Refresh List** under Templates), it
fetches the manifest, then fetches each file listed in it, and adds them to the
Templates list. These behave exactly like any other template: loading one only
affects your own local chart -- nothing about the repo file changes when you or
anyone else edits and re-saves after loading one.

### Setting it up

1. In the repo, create a folder called `templates/` next to `index.html`.
2. Build a chart in the app the way you want it, then use **Save & Load ->
   Chart File Management -> Download Chart File** to get a `.seatchart.json`
   file.
3. Put that file in the `templates/` folder.
4. Create or edit `templates/manifest.json` to list it:

```json
[
  "orchestra-standard.seatchart.json"
]
```

5. Commit and push. Once GitHub Pages redeploys, the template shows up in the
   app's Templates list automatically.

### Adding more templates

Just repeat: drop another `.seatchart.json` file into `templates/`, and add it
to the manifest array:

```json
[
  "orchestra-standard.seatchart.json",
  "band-basic.seatchart.json",
  "jazz-combo.seatchart.json"
]
```

### Custom display names

By default, the name shown in the app is the filename with `.seatchart.json`
stripped off (so `orchestra-standard.seatchart.json` shows as
"orchestra-standard"). To show something nicer, use an object instead of a plain
string for that entry:

```json
[
  { "file": "orchestra-standard.seatchart.json", "name": "Standard Orchestra Setup" },
  "band-basic.seatchart.json"
]
```

You can mix plain strings and `{file, name}` objects freely in the same list.

### Included examples

This repo ships with seven ensemble templates already set up in
`templates/manifest.json`, so you can see the expected file layout:

| File | Shows in app as |
| --- | --- |
| `String_Orchestra.seatchart.json` | String Orchestra |
| `String_Orchestra_LG.seatchart.json` | String Orchestra LG |
| `Chamber_Orchestra.seatchart.json` | Chamber Orchestra |
| `Symphony_Orchestra.seatchart.json` | Symphony Orchestra |
| `German_Symphony.seatchart.json` | German Symphony |
| `Antiphonal_Full_Orchestra.seatchart.json` | Antiphonal Full Orchestra |
| `Wind_Ensemble.seatchart.json` | Wind Ensemble |

Feel free to remove any of them and replace them with your own.

### Notes

- This only works when the app is actually served over HTTP/HTTPS (GitHub
  Pages, any web server, `python -m http.server`, etc.) -- browsers generally
  block `fetch()` from reading local files when you just double-click
  `index.html` and open it as a `file://` URL. In that case, file-based
  templates simply won't appear (fails silently), but everything else in the app
  still works normally.
- If `templates/manifest.json` doesn't exist at all, that's fine too -- the app
  just won't show any file-based templates, same as above.
- These file-based templates are read-only from the app's side -- there's no
  delete button for them in the UI, since they're managed by editing the repo
  directly, not through the app.
