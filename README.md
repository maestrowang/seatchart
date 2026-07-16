# Adding Templates via GitHub Repo Files

The app can show templates that live as plain files in this repo, alongside
`index.html` (the app itself) -- no admin login, no in-app publishing needed.
Anyone who can push to the repo can add, edit, or remove templates just by
editing files.

## How it works

The app looks for a `templates/` folder next to itself, containing:

1. **`templates/manifest.json`** -- a list of which template files exist.
2. **One `.seatchart.json` file per template** -- the actual chart data,
   normally created via the app's own "Download Chart File" button.

When the app loads (or when you click "Refresh List" under Templates), it
fetches the manifest, then fetches each file listed in it, and adds them to
the Templates list. These behave exactly like any other template: loading one
only affects your own local chart -- nothing about the repo file changes when
you or anyone else edits and re-saves after loading one.

## Setting it up

1. In this repo, create a folder called `templates/` next to `index.html`.
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

## Adding more templates

Just repeat: drop another `.seatchart.json` file into `templates/`, and add
it to the manifest array:

```json
[
  "orchestra-standard.seatchart.json",
  "band-basic.seatchart.json",
  "jazz-combo.seatchart.json"
]
```

## Custom display names

By default, the name shown in the app is the filename with `.seatchart.json`
stripped off (so `orchestra-standard.seatchart.json` shows as
"orchestra-standard"). To show something nicer, use an object instead of a
plain string for that entry:

```json
[
  { "file": "orchestra-standard.seatchart.json", "name": "Standard Orchestra Setup" },
  "band-basic.seatchart.json"
]
```

You can mix plain strings and `{file, name}` objects freely in the same list.

## Included example

This repo ships with one example already set up:
`templates/standard-small-ensemble.seatchart.json`, listed in
`templates/manifest.json` as "Standard Small Ensemble" -- a small string
section with a few instruments assigned, mainly so you can see the expected
file layout. Feel free to remove it and replace it with your own.

## Notes

- This only works when the app is actually served over HTTP/HTTPS (GitHub
  Pages, any web server, `python -m http.server`, etc.) -- browsers generally
  block `fetch()` from reading local files when you just double-click
  `index.html` and open it as a `file://` URL. In that case, file-based
  templates simply won't appear (fails silently), but everything else in the
  app still works normally.
- If `templates/manifest.json` doesn't exist at all, that's fine too -- the
  app just won't show any file-based templates, same as above.
- These file-based templates are read-only from the app's side -- there's no
  delete button for them in the UI, since they're managed by editing the repo
  directly, not through the app.
