# Contributing to Bookmark Scope

Thank you for wanting to help. Bookmark Scope is a small, local Chrome extension, and it gets better when people who use it report problems, fix text, and send patches. You do not need to be an expert. A clear bug report or a corrected translation is a real contribution.

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Picking something to work on](#picking-something-to-work-on)
- [Project principles](#project-principles)
- [Workflow](#workflow)
- [Project map](#project-map)
- [Run it locally](#run-it-locally)
- [Checks](#checks)
- [Writing tests](#writing-tests)
- [Code style](#code-style)
- [Adding or changing UI text](#adding-or-changing-ui-text)
- [Translations](#translations)
- [Privacy and permission changes](#privacy-and-permission-changes)
- [Commit and pull request checklist](#commit-and-pull-request-checklist)
- [Reporting bugs well](#reporting-bugs-well)
- [Security](#security)
- [Recognition](#recognition)
- [Maintainers and decisions](#maintainers-and-decisions)
- [Releases](#releases)
- [License and sign-off](#license-and-sign-off)

## Ways to contribute

- **Report a bug.** Use the [bug report form](https://github.com/ehsanenaloo/Bookmark-Scope/issues/new?template=bug_report.yml). Search [existing issues](https://github.com/ehsanenaloo/Bookmark-Scope/issues) first.
- **Suggest a feature.** Use the [feature request form](https://github.com/ehsanenaloo/Bookmark-Scope/issues/new?template=feature_request.yml). Describe the problem you have before the solution you want.
- **Improve a translation.** Fix a wrong or awkward string, or add a language. See [Translations](#translations). If you do not want to edit files, use the [translation fix form](https://github.com/ehsanenaloo/Bookmark-Scope/issues/new?template=translation_fix.yml).
- **Improve the docs or screenshots.** The user guide is in [docs/](../docs/README.md) and is published at <https://ehsanenaloo.github.io/Bookmark-Scope/>. Fix errors, unclear steps, or outdated screenshots. Screenshots must use synthetic bookmarks.
- **Review pull requests.** Try a change in your own test profile and say what you saw. This helps a lot, and anyone can do it.
- **Fix an issue.** Pick one from the list below, say that you are on it, and open a pull request.

Not sure where to start? Open an issue and ask. It is fine to start small.

## Picking something to work on

These labels help you find work. The full list is in [labels.yml](labels.yml).

| Label | What it means |
| --- | --- |
| `good first issue` | Small, well described, and a good first change. The issue says where to look. |
| `help wanted` | The maintainer would like help and has agreed the change fits the project. |
| `translation` | A translation fix or a new language. No coding is needed for most of these. |
| `needs triage` | Not looked at yet. Please wait for a label before you start a large change. |

Before you start on an issue, leave a short comment such as "I would like to work on this." This avoids two people doing the same work. If you do not send a pull request within a few weeks, the maintainer may offer the issue to someone else. That is not a problem. You can come back later.

If you want to change something that has no issue, open one first. For a typo or a small fix, you can send a pull request directly.

## Project principles

These guide every review. They keep the extension small, safe and trusted.

1. **Local only.** No analytics, no remote code, no servers. A new network request needs a strong reason and an update to [docs/PRIVACY.md](../docs/PRIVACY.md).
2. **Least privilege.** Do not add permissions. Access to websites stays optional and is requested only when you start a scan.
3. **Protect user data.** Destructive actions need a confirmation, a preview, or Undo. They must report what worked and what failed, separately. Browser bookmarks are the source of truth.
4. **Render text as text.** Never build HTML from bookmark titles, URLs, imported files or translated strings. Use text nodes.
5. **No build step.** The `extension/` folder is the extension, exactly as it ships. Use plain ES modules, HTML and CSS. Do not add a framework, a bundler or a runtime dependency.

A change that breaks one of these needs a discussion in an issue before any code.

## Workflow

1. **Fork** the repository on GitHub and clone your fork.

   ```bash
   git clone https://github.com/<your-username>/Bookmark-Scope.git
   cd Bookmark-Scope
   git remote add upstream https://github.com/ehsanenaloo/Bookmark-Scope.git
   ```

2. **Create a branch** from the latest `main`. Use a short name with a prefix:

   - `fix/popup-badge-count`
   - `feat/dashboard-export-selected`
   - `docs/troubleshooting-steps`
   - `i18n/fix-german-tags`
   - `chore/update-editorconfig`

3. **Make small commits.** One idea per commit. Each commit should leave the project in a working state.

4. **Write the commit message in Conventional Commits style:** `type(scope): short summary`. Use the imperative mood ("fix", not "fixed"). Keep the first line under about 72 characters. Examples:

   ```text
   fix(popup): keep the badge count in sync after a bookmark is deleted
   feat(dashboard): add a filter for bookmarks older than one year
   docs(guide): explain why a redirected link is not always better
   i18n(de): correct the word for "tags" in the bulk tag dialog
   refactor(services): move tag name cleanup into tag-service
   ci(validate): fail when a locale file has invalid JSON
   ```

   Common types are `feat`, `fix`, `docs`, `i18n`, `refactor`, `perf`, `test`, `chore` and `ci`. Common scopes are `popup`, `dashboard`, `options`, `background`, `services`, `i18n`, `guide` and `validate`.

5. **Keep your branch up to date by rebasing**, not by merging `main` into it.

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

   If you have already pushed the branch, update it with `git push --force-with-lease`. The maintainer may squash your commits when merging, so a clean history on your side is helpful but not required.

6. **Open a pull request** against `main`. Fill in the template: what changed, why, the related issue, and how you tested it. Mark it as a draft if it is not ready. Keep one topic per pull request. A small pull request is reviewed faster.

7. **Respond to review.** Push follow-up commits to the same branch. When a comment is fixed, say so in a short reply.

### What review looks like

The maintainer checks that the change fits the [principles](#project-principles), passes CI, works in the browser, and is easy to read. You may get questions, requests for changes, or a suggestion to split the pull request. This is normal and is about the code, not about you.

Bookmark Scope has one maintainer, who works on it in spare time. Replies are best effort. A first response often comes within a week or two, and sometimes it takes longer. There is no promise of a date. If you have heard nothing after two weeks, a polite comment on the pull request is welcome.

## Project map

The repository root is kept small on purpose. The extension itself lives in `extension/`, and everything else (guide, tests, scripts, community files) sits beside it. The main places are:

| Path | What it holds |
| --- | --- |
| `extension/manifest.json` | Extension manifest (Manifest V3): permissions, entry points, icons. |
| `extension/background.js` | The service worker. It handles the badge, alarms, context menus, link checks and runtime messages. It has no access to the DOM. |
| `extension/pages/popup/` | The toolbar popup: `popup.html`, `popup.js`, `popup.css`, and the footer link settings. |
| `extension/pages/dashboard/` | The full-page library dashboard: `dashboard.html`, `dashboard.js`, `dashboard.css`. |
| `extension/pages/options/` | The settings page: `options.html`, `options.js`, `options.css`. |
| `extension/icons/` | The toolbar and store icons (`icon-16.png` to `icon-128.png`, and `icon.svg`). |
| `extension/src/services/` | Reusable logic for storage, preferences, tags, snapshots, imports, link-health data, reminders and diagnostics. |
| `extension/src/dashboard/` | Dashboard modules: selection, rendering, groups, review, import and export tools, the command palette. |
| `extension/src/popup/` | Popup modules: state, actions, footer, overlays. |
| `extension/src/platform/` | The browser API wrapper (`browser-api.js`) and time helpers. |
| `extension/src/runtime/messages.js` | Message types and request builders between pages and the worker. |
| `extension/src/core/` | Shared logic with no browser UI: `constants.js` (storage keys, limits, enums), URL and bookmark helpers, fuzzy matching and the Public Suffix rules. |
| `extension/src/ui/` | Helpers for the pages: icons, theme and DOM utilities. |
| `extension/src/locales/` | The translation loader (`i18n.js`) and interface translations (see [Adding or changing UI text](#adding-or-changing-ui-text)). |
| `extension/_locales/` | Browser-level strings for the manifest, one folder per language. |
| `extension/styles/` | Shared CSS (`base.css`, `colors.css`) and styles for the dashboard and popup. |
| `extension/vendor/`, `extension/THIRD_PARTY_NOTICES.md` | The bundled Public Suffix List and the third-party license notices. |
| `docs/` | The user guide (a static HTML site), `PRIVACY.md`, and the translated READMEs in `docs/translations/`. |
| `tests/` | Unit tests in `tests/unit/` (`*.test.mjs`), the fake browser and DOM helpers in `tests/helpers/`, and the optional browser checks in `tests/browser/` (Chromium) and `tests/firefox/` (Firefox). |
| `scripts/` | `validate.mjs`, `test.mjs` and the helper files they use. `build-firefox.mjs` turns the files in `extension/` into the experimental Firefox build in `dist-firefox/`; it never changes `extension/manifest.json`. |
| `.github/` | Issue forms, the pull request template, labels, workflows, and the community files (this guide, Code of Conduct, Security, Support). |

## Run it locally

You need Chrome or another Chromium browser. Node.js 24 or newer is needed to run the checks and tests. There is no `npm install` step for the extension or the unit tests.

1. Create a **separate Chrome profile** for development. Add a few **synthetic bookmarks** to it: some duplicates, some folders, one dead link. Do not test destructive features on your real library.
2. In that profile, open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the **`extension/`** folder inside your clone (the folder that contains `manifest.json`), not the repository root. See also [Install](../README.md#install).
4. After you edit a file, click the reload button on the extension card on `chrome://extensions`. Then reopen the popup or refresh the dashboard tab.
   - Changes to `extension/background.js` or `extension/manifest.json` need the extension reload.
   - Changes to popup, dashboard or settings files usually need only a reopened popup or a refreshed tab.

### Where to find console logs

- **Popup:** right-click inside the popup and choose **Inspect**.
- **Dashboard and settings:** open the page in a tab and press F12.
- **Service worker:** on `chrome://extensions`, find Bookmark Scope and click the **service worker** link next to **Inspect views**. The worker sleeps when idle. If the link says "inactive", open the popup to wake it.

If a page shows a blank screen, the console usually names the file and line.

### Try the Firefox build

The Firefox build is experimental. It is made from the same files in `extension/`.

1. Run `npm run build:firefox` (or `node scripts/build-firefox.mjs`). It writes the package to `dist-firefox/<fingerprint>/` and prints the folder name. The `dist-firefox/` folder is not committed.
2. In Firefox 140 or newer, open `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on**. Choose the `manifest.json` inside that folder.
3. Use a separate Firefox profile with synthetic bookmarks, as for Chrome. A temporary add-on is removed when Firefox closes.

## Checks

Run both of these before you push:

```bash
node scripts/validate.mjs
node scripts/test.mjs
```

`npm run check` runs the two in a row, and `npm test` is a shortcut for the second one. Neither needs `npm install`.

- **`node scripts/validate.mjs`** checks the manifest, the files it references (they must all exist inside `extension/`), that only shipping files sit in `extension/`, that the repository root stays small, JavaScript syntax, JSON and locale files, imports between modules, and that no keys or forbidden files are present.
- **`node scripts/test.mjs`** runs every `tests/unit/*.test.mjs` file with the built-in Node test runner and prints a short summary. Pass a word to run only the files whose name contains it, for example `node scripts/test.mjs popup`. It needs Node.js 24 or newer, because the tests use `navigator.locks`, and it tells you if your version is too old.
- **Firefox checks (optional).** `npm run test:firefox` starts a headless desktop Firefox with a throwaway profile, loads the Firefox build as a temporary add-on and runs about 30 checks on synthetic bookmarks. It needs Firefox 140 or newer and nothing else. Without Firefox the runner prints "skipped". The steps are in [tests/firefox/README.md](../tests/firefox/README.md).
- **Browser checks (optional).** `npm run test:browser` loads the extension into a real Chromium with a throwaway profile and synthetic bookmarks. You install Playwright yourself, and the runner prints "skipped" if it is missing. The steps are in [tests/browser/README.md](../tests/browser/README.md).

CI runs `validate` and the unit tests on every pull request. It also runs the browser checks on pushes to `main`, and the Firefox checks too (the Firefox job is informative for now and does not block a merge). The maintainer looks for a green CI run before merging a pull request.

Tests do not replace trying the change by hand. In the pull request, describe your manual steps: the browser and version, what you clicked, and what you saw. Include a failure case, such as a cancelled dialog or a bookmark that no longer exists.

## Writing tests

A fix or a feature should come with a test when the behavior can be tested without a browser.

- **Where tests live.** Unit tests are in `tests/unit/`. Name a file after the area it covers and end it with `.test.mjs`, for example `tests/unit/tag-service.test.mjs`. The runner picks up every file with that ending. Use `node:test` and `node:assert/strict`, with no other test library.
- **Name tests by behavior.** A good name reads like a sentence: "partial page removal exposes Undo only for the deletion that was applied". Put the failure cases next to the happy path.
- **Fake browser.** `fakeBrowser(tree, storage)` in `tests/helpers/browser.mjs` installs an in-memory bookmarks tree, storage, alarms, notifications and tabs through `setChromeApiForTesting`. Build trees with `folder(id, children)` and `leaf(id)`. It records calls (`calls.creates`, `calls.moves`, `calls.removes`) so you can assert what happened.
- **DOM helper.** `domFixture()` in `tests/helpers/dom.mjs` gives a small fake document and elements, so UI modules can run without a browser. It is good for keyboard, focus and rendering logic. It is not a layout engine, so leave pixel and scroll behavior to the browser checks.
- **Injecting failures.** Add an id or URL to `failures.create`, `failures.remove` or `failures.move`, or set `failures.set` to a function, and that browser call throws. Use `deferred()` to hold a call open and release it when the test is ready. Then assert the applied and the failed operations separately, because that is how the extension reports them.
- **Keep tests deterministic.** No real network, no real timers that depend on the clock, no reliance on test order, and no data shared between tests. Use the time helpers in `extension/src/platform/time.js` and the `.test` or `example.test` host names for URLs. Create the data a test needs inside the test.
- **Browser checks.** Add to `tests/browser/` only when the behavior needs a real browser, such as a layout, the real bookmarks API or a worker restart. Keep them on synthetic bookmarks, and wait for a condition, never for a fixed delay.

## Code style

- Follow [.editorconfig](../.editorconfig): UTF-8, LF line endings, two spaces for indentation.
- Use modern JavaScript as ES modules. Do not add a framework, a bundler or a dependency.
- Keep the service worker free of DOM APIs.
- Show user content with text nodes (`textContent`, `createTextNode`). Do not use `innerHTML` with bookmark titles, URLs, imported data or translated strings.
- Reuse names from `extension/src/core/constants.js` and message builders from `extension/src/runtime/messages.js`. Do not add a second set of keys or message types.
- Use `extension/src/platform/browser-api.js` for browser API calls that are shared.
- Keep names meaningful and consistent with nearby code. Keep functions short. Prefer a clear small change over a large rewrite.
- Comments should explain why, not what.

### Accessibility

Every interface change should work for people who use a keyboard, a screen reader, a high zoom level, or a right-to-left language.

- All actions work with the keyboard. Tab order follows the visual order.
- Focus is visible. When a dialog opens, focus moves into it. When it closes, focus returns to where it was.
- Buttons and fields have a text label or an `aria-label`. Icons that carry meaning have a text alternative.
- Text and controls have enough contrast in both the light and the dark theme.
- Layouts work in right-to-left languages (for example Arabic, Persian, Hebrew and Urdu). Prefer logical CSS properties such as `margin-inline-start` over `margin-left`.

## Adding or changing UI text

Bookmark Scope has four places where text lives. Which one you change depends on the string. All of this was checked against the files in this repository.

1. **English source: `extension/src/locales/en.js`.** A list of `[key, value]` pairs. The key is the English text itself. This is the base for every language.
2. **One file per language: `extension/src/locales/<code>.json`.** A flat JSON object. Each key is the same English text as in `en.js`, and the value is the translation. Files are loaded when the language is selected. If a key is missing, the interface shows the English text, so a partial translation still works.
3. **Feature copy: `extension/src/locales/feature-messages.js`.** Strings for the newer library tools. This file holds the Persian text, and the helper `featureText()` uses it only when the language is Persian. For every other language it falls back to the normal lookup, which means the language file if the key is there, and English if not. Strings in this file can be missing from `en.js`. In that case the English text in the code is the fallback.
4. **Browser-level strings: `extension/_locales/<code>/messages.json`.** The Chrome format with `message` fields. It holds the strings that the browser reads directly: the extension name, its description, the toolbar tooltip, and a few labels. There are only a handful of keys.

How to add a string in code:

- Wrap the English text with `t('Your English text')` from `extension/src/locales/i18n.js`. The English text is the key.
- Add the pair to `extension/src/locales/en.js` when the string belongs to the main interface.
- Do not build sentences by joining pieces. Translators need whole sentences.

### Placeholders

Variables are written as `{{name}}`, with double braces, for example `Showing {{count}} bookmarks`. In every translation:

- Keep each placeholder exactly as written. Do not translate the name, and do not change the braces.
- Include every placeholder that the English text has. You may move them to fit the grammar of your language.
- Do not add placeholders that the English text does not have.

## Translations

Bookmark Scope ships in 52 languages. Most translations have not been reviewed by native speakers, so careful human fixes are very valuable.

### Fix a wrong string

1. Find the string in `extension/src/locales/<code>.json`. Search for the English text. Note that the key is English and the value is the translation.
2. Change only the value. Keep the key and any `{{placeholders}}` unchanged.
3. Run `node scripts/validate.mjs` to make sure the JSON is still valid.
4. Open a pull request. In the description, name the screen where you saw the string and say whether you are a native speaker.

If you would rather not edit files, open a [translation fix issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues/new?template=translation_fix.yml) with the current text and your suggestion.

### Add a language

Please open an issue first so we can agree on the language code and avoid duplicate work. Then:

1. Create `extension/src/locales/<code>.json`. The easiest way is to copy an existing language file, such as `extension/src/locales/fr.json`, and replace every value with your translation. Keep the keys (the English text) unchanged. Translate what you can. Missing keys fall back to English.
2. Create `extension/_locales/<code>/messages.json` by copying `extension/_locales/en/messages.json` and translating the `message` values.
3. Register the language in the `LOCALE_META` list in `extension/src/locales/index.js`. Each entry has `code`, `intl` (a BCP 47 tag such as `pt-BR`), `nativeName`, `englishName`, `rtl` and `aliases`. Set `rtl` to `true` for right-to-left languages.
4. Run `node scripts/validate.mjs`.
5. Load the extension, choose your language in Settings, and look at the popup, the dashboard and the settings page. Check for text that is cut off, overlaps, or points the wrong way.
6. Open a pull request. The maintainer will update language counts in the docs.

Use the folder names Chrome expects for `_locales`, such as `pt_BR` and `zh_CN`.

### Quality bar

- Use the natural words that people use for bookmarks, tags, folders and browsers in your language.
- Keep the tone short and friendly, like the English text.
- Keep the same meaning. Do not add or drop warnings, especially for delete, restore and import messages.
- Be consistent. Use one word for one idea across the whole interface.
- Keep product names, file names and keyboard keys unchanged (for example Bookmark Scope, JSON, CSV, Ctrl).
- Check long words in the narrow popup.

### Native-speaker review

Say in the pull request which of these applies:

- "I am a native speaker of this language."
- "I am fluent but not a native speaker."
- "I used a translation tool and checked the result myself."

All three are welcome. If a second person who speaks the language can read the change, ask for their review in the pull request. The maintainer cannot judge every language, so a review by another speaker is the strongest signal.

### Thanks

Translators are credited in the release notes by name or username, unless you prefer not to be named. Tell us in the pull request if you want to stay anonymous. See [Recognition](#recognition).

## Privacy and permission changes

Discuss these in an issue **before** you write code:

- A new permission, or any change to the optional website access.
- A new network request, or any change to who the extension talks to.
- A new storage key, or a change to what is stored.
- Anything that reads, copies or exports more bookmark data than today.
- Anything that adds analytics, remote code or a third-party service.

Each of these affects user trust and Chrome Web Store review. If the change is accepted, the same pull request must update [docs/PRIVACY.md](../docs/PRIVACY.md) and the docs.

## Commit and pull request checklist

The pull request template has the same list.

- [ ] The change is focused, and the description says why it is needed.
- [ ] The pull request links the related issue, for example "Fixes #123".
- [ ] `node scripts/validate.mjs` and `node scripts/test.mjs` pass.
- [ ] I added or updated a test for the change, or I explained why it cannot be tested.
- [ ] I tested the change in Chrome with synthetic bookmarks, and I described the steps I took.
- [ ] I tested a failure case, not only the happy path.
- [ ] Commit messages follow the Conventional Commits style.
- [ ] No new permissions, network requests or storage keys, or they were agreed in an issue first.
- [ ] Interface text is wrapped in `t()`, and user content is shown as text, not HTML.
- [ ] The change works with the keyboard and in a right-to-left language.
- [ ] User-visible changes are noted in [CHANGELOG.md](../CHANGELOG.md) under the upcoming version.
- [ ] The docs and [docs/PRIVACY.md](../docs/PRIVACY.md) are updated if behavior or data handling changed.
- [ ] Screenshots, logs and test files contain no personal bookmark data.
- [ ] I wrote this change or I have the right to submit it (see [License and sign-off](#license-and-sign-off)).

## Reporting bugs well

A good report lets someone else see the problem in a few minutes. Include:

- the extension version (shown on `chrome://extensions`), your browser version, and your operating system,
- what you expected and what happened,
- the smallest set of steps that shows the problem, ideally with a few made-up bookmarks,
- console errors, if any (see [Where to find console logs](#where-to-find-console-logs)),
- the interface language, if the problem looks language-specific.

The dashboard has a diagnostic export that shows exactly what it will include before you save it. It contains no URLs or titles, so it is safe to attach. Never attach your real bookmark export, a snapshot, or a recovery journal to a public issue. Those files contain your bookmark data.

## Security

Do not open a public issue for a security problem. Follow [SECURITY.md](SECURITY.md) and use GitHub's private vulnerability report. For general help, see [SUPPORT.md](SUPPORT.md).

## Recognition

Every person whose commits are merged into `main` is listed automatically in the Contributors section of the [README](../README.md). That list comes from GitHub, so it needs your commits to be linked to your GitHub account. Check that your Git email address is added to your GitHub profile.

Work that does not always show up as commits is credited in the release notes. This includes translations, documentation, bug reports with good reproduction steps, and reviews. You are named by your name or GitHub username, unless you prefer not to be. Tell the maintainer in the issue or pull request.

## Maintainers and decisions

Bookmark Scope is maintained by [Ehsan Enaloo](https://github.com/ehsanenaloo). The maintainer makes the final decision on what is merged and what is not, using the [project principles](#project-principles) and the results of CI.

If you disagree with a decision, say so in the issue. Give your reasons and your use case, and listen to the reply. Please keep the discussion respectful and about the work, as the [Code of Conduct](CODE_OF_CONDUCT.md) asks. A "no" to a feature is not a judgment about you. Often it means the idea needs a permission or a service that this project does not want. You are always free to fork the project under the MIT License.

## Releases

Releases are made by the maintainer. The maintainer updates the version in `extension/manifest.json` and `CHANGELOG.md`, then pushes a tag named `vX.Y.Z`. The [release workflow](workflows/release.yml) then:

1. runs `node scripts/validate.mjs`,
2. checks that the tag matches the version in `extension/manifest.json`,
3. builds the extension zip from the runtime file list (the contents of `extension/`, with `manifest.json` at the zip root, plus the `LICENSE`) and a SHA-256 checksum,
4. builds the experimental Firefox zip the same way with `scripts/build-firefox.mjs` (`bookmark-scope-X.Y.Z-firefox.zip`) and its checksum,
5. creates a GitHub Release with both zips and both checksums attached, and uses the matching section of `CHANGELOG.md` as the notes.

Publishing to the Chrome Web Store is a separate manual step. The Firefox build is not on Firefox Add-ons yet.

## License and sign-off

Bookmark Scope is released under the [MIT License](../LICENSE). When you contribute, your contribution is licensed under the same terms.

By opening a pull request, you confirm that you wrote the change yourself, or that you have the right to submit it under the MIT License. Do not copy code, text or images from sources that do not allow this. There is no sign-off tool and no `Signed-off-by` line is required.
