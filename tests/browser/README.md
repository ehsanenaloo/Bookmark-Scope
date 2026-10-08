# Browser checks

These checks drive a real Chromium with the extension loaded, so they cover things the unit tests cannot: real bookmark mutations, Undo, the virtual list, Web Locks across pages, import and export, and a worker restart. They are optional for most pull requests and run in CI on pushes to `main`.

They only use a disposable browser profile in your temp folder and synthetic bookmarks. Your own browser and bookmarks are never touched, and nothing is written into the repository.

## Run them in 6 steps

1. Install Node.js 24 or newer.
2. From the repository root, install Playwright without changing `package.json`: `npm i --no-save playwright`.
3. Download a Chromium build for it: `npx playwright install chromium`.
4. Run `npm run test:browser` (or `node tests/browser/run.mjs`).
5. Pass a word to run one suite only, for example `node tests/browser/run.mjs gaps`.
6. Read the result: each check prints `PASS: ...` as it goes, then a short JSON summary. The exit code is 0 when everything passed.

## Good to know

- Without Playwright the runner prints "skipped" and exits 0. Add `--require` to make that a failure.
- Already have Playwright somewhere else? Set `BOOKMARK_SCOPE_PLAYWRIGHT_MODULE` to the path of its `index.mjs`.
- Want to use your own Chromium? Set `BOOKMARK_SCOPE_CHROMIUM_EXECUTABLE` to its path.
- The extension is loaded straight from the `extension/` folder of the repository, so there is no build step.
- On Linux without a display, the checks still work because Chromium runs headless.
