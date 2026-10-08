# Bookmark Scope user guide

Start with [the field guide](index.html) or [the guide library](guides/index.html). This directory is a static HTML site for people who use the Bookmark Scope Chrome extension. It needs no build step and no external services. You can read it without JavaScript; with JavaScript it adds site search, a theme switch, guide filtering and copy buttons.

## Learning path

- [Quick start & first run](guides/quick-start.html)
- [Installation](guides/installation.html)
- [Popup](guides/popup.html)
- [Dashboard tour](guides/dashboard-tour.html)
- [Finding & searching](guides/finding-and-searching.html)
- [Organizing](guides/organizing.html)
- [Cleaning up](guides/cleaning-up.html)
- [Link health](guides/link-health.html)
- [Backup & restore](guides/backup-and-restore.html)

## All guides

**Get started**

- [Quick start & first run](guides/quick-start.html)
- [Installation](guides/installation.html)

**Everyday use**

- [Popup](guides/popup.html)
- [Dashboard tour](guides/dashboard-tour.html)
- [Finding & searching](guides/finding-and-searching.html)
- [Organizing](guides/organizing.html)
- [Cleaning up](guides/cleaning-up.html)

**Link health**

- [Link health](guides/link-health.html)
- [Review reminders & notifications](guides/review-reminders.html)

**Saved work**

- [Smart views](guides/smart-views.html)
- [Backup & restore](guides/backup-and-restore.html)

**Reference**

- [Command palette & shortcuts](guides/command-palette.html)
- [Settings reference](guides/settings-reference.html)
- [Appearance & languages](guides/appearance-and-languages.html)

**Trust and support**

- [Privacy, permissions & data](guides/privacy-and-data.html)
- [Diagnostics](guides/diagnostics.html)
- [Troubleshooting & FAQ](guides/troubleshooting-faq.html)
- [Limits & known limitations](guides/limits.html)
- [Privacy policy](privacy.html)

## Local preview

From the repository root:

```sh
python -m http.server 8766 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8766/ and stop the server with Ctrl+C. Opening `docs/index.html` directly from disk also works.

## Screenshots

The pages use the PNG files in `assets/screenshots/`, captured with synthetic bookmarks. If a file is ever missing, the page shows a labelled placeholder and nothing else breaks. File names, sizes and contents are listed in [assets/screenshots/README.md](assets/screenshots/README.md).

## Maintenance

- Keep the text in English and keep it aligned with the actual product. When behavior changes, update the guide that describes it and the date and version note in the footer.
- Guides describe controls by their labels and function, not by position or colour, so visual redesigns do not invalidate them.
- These guides describe the 5.1.0 release. After each release, re-check the "Limits and known limitations" page and every callout, and keep only what is still true.
- `privacy.html` is the web version of the privacy policy. The original text is `PRIVACY.md` in the public repository's `docs` folder. Update `privacy.html`, its search entry and its date whenever `PRIVACY.md` changes, so the two never disagree.
- `search-index.js` and `llms.txt` list every guide and `privacy.html`. Regenerate or edit them when a guide is added, renamed or removed.

All prose, HTML, CSS and JavaScript in this directory were authored for Bookmark Scope. The logo in `assets/logo.svg` is the extension icon.
