# Firefox checks

These checks start a real desktop Firefox with the extension loaded as a temporary add-on. They cover things the unit tests cannot: the event page, permission requests from clicks, real bookmark changes, import and export, and the page layout. About 30 checks run in a few minutes.

They only use a disposable Firefox profile in your temp folder and synthetic bookmarks. Your own Firefox and bookmarks are never touched, and nothing is written into the repository.

## Run them in 6 steps

1. Install Node.js 24 or newer.
2. Install desktop Firefox 140 or newer. The checks were recorded on Firefox 157 on Windows.
3. If Firefox is not in the usual place, set `FIREFOX_BIN` to its full path.
4. From the repository root, run `npm run test:firefox` (or `node tests/firefox/run.mjs`).
5. Pass `--only=<text>` to run some checks only, for example `--only=dashboard`.
6. Read the result: each check prints `PASS` or `FAIL` as it goes, then a JSON summary. The exit code is 0 when everything passed.

## Good to know

- Without Firefox the runner prints "skipped" and exits 0. Add `--require` to make that a failure.
- The Firefox package is built into a temp folder from `extension/` (see `scripts/build-firefox.mjs`). Set `EXTENSION_DIR` to test another extension folder.
- Set `FIREFOX_SHOTS_DIR` to keep the screenshots. Otherwise they are deleted when the run ends.
- Firefox runs without a window, so no display is needed on Linux.
- Node 24 is needed because the runner uses the built-in WebSocket client. There is nothing to download or install besides Firefox.
