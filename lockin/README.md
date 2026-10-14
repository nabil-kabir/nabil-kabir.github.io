# Lock-In Training Ledger

A home-screen web app (PWA) for tracking monthly workouts and habits.
Live at https://nabil-kabir.github.io/lockin/

## Files

- `index.html` – the whole app: layout, styles and logic
- `sw.js` – service worker: offline support and update checks
- `manifest.webmanifest` – app name, colours and icons for installing
- `icons/` – app icons

## Shipping an update

1. Edit `index.html` (and any other files).
2. Bump the version in **both** places, using the same number:
   - `const VERSION = '…'` in `sw.js`
   - `const APP_VERSION = '…'` in `index.html`
3. Commit and push. GitHub Pages goes live in about a minute.
4. When people next open the app, a "New version available" bar appears. Tapping Update loads the new version.

If you skip the version bump, installed apps keep showing the old version.

## Data

Ticks are saved on each phone in `localStorage` under the key `lockin-data`.
The data carries a `schema` number. When a change alters the shape of the data, raise `SCHEMA`
and add a step to `migrate()` in `index.html`, so existing history is upgraded instead of lost.
"Back up data" exports a JSON file and "Restore" imports one.
