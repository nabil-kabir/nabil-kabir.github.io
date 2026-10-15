# Lock-In sync source

Source for `lockin/cloud.js`, the optional sign-in and sync module (Firebase Auth + Firestore).

- `src/core.js` – converts the app's data to the cloud shape, diffs and merges. No Firebase code.
- `src/cloud.js` – Firebase sign-in, Firestore reads, writes and live updates, first-login merge.
- `build.mjs` – bundles `src/cloud.js` with the Firebase SDK into `../lockin/cloud.js`.
- `test-core.mjs` – unit tests for `core.js` (`node test-core.mjs`).
- `test/` – local test rig: `fake-store.mjs` stands in for Firestore, `init.js` points the page at it
  and at the Firebase Auth emulator (`npx firebase emulators:start --only auth --project demo-lockin`).

Rebuild after changing `src/`: `npm ci && node build.mjs`, then bump the app version as usual.

## Cloud data

Each user's data lives under `users/{uid}/` in Firestore:

- `lockin/meta` – habits (`h`), their sub-items (`s`) and the Removed bin (`t`)
- `months/{YYYY-MM}` – ticks as `d.{rowId}.{day} = true`

Every tick and name is its own field, so changes made on two devices merge instead of overwriting each other.
Security rules allow each signed-in user to read and write only `users/{their uid}/**`.
