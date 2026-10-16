# Lock-In Training Ledger

A home-screen web app (PWA) for tracking monthly workouts and habits.
Live at https://nabil-kabir.github.io/lockin/

## Files

- `index.html` – the whole app: layout, styles and logic
- `cloud.js` – sign-in and sync (built from `../lockin-src`, see its README)
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

Ticks are saved on each device in `localStorage` under the key `lockin-data`.
People who sign in also sync to Firebase (project `lockin-app-795ad`); the config is `FIREBASE_CONFIG` in `index.html`.
Without an account the app works as before, on that device only.
The data carries a `schema` number. When a change alters the shape of the data, raise `SCHEMA`
and add a step to `migrate()` in `index.html`, so existing history is upgraded instead of lost.
"Back up data" exports a JSON file and "Restore" imports one.

## Game layer (2.1.0)

XP and ranks, badges, the streak with freezes, per-habit streaks and weekly challenges are all worked out
from the ticks in `buildGame()` in `index.html`, so they need no extra storage and sync with the ticks.
Only per-device extras live in localStorage: `lockin-seen-badges` and `lockin-seen-frozen` (what has already
been announced), `lockin-fx` (celebrations on or off) and `lockin-recap-YYYY-M` (recap banner dismissed).
Tuning lives at the top of that block: `RANKS`, `XP`, and the level curve in `buildGame()`.
The first-run tour (coach marks) is `tourSteps()` in `index.html`; it shows once per device (`lockin-tour-v1`)
and can be replayed from How it works › Replay the tour. The full guide is `openGuide()`.
