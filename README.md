**English** · [فارسی](docs/translations/README.fa.md) · [Español](docs/translations/README.es.md) · [Français](docs/translations/README.fr.md) · [Deutsch](docs/translations/README.de.md) · [Português (Brasil)](docs/translations/README.pt-BR.md) · [Русский](docs/translations/README.ru.md) · [简体中文](docs/translations/README.zh-CN.md) · [日本語](docs/translations/README.ja.md) · [العربية](docs/translations/README.ar.md) · [हिन्दी](docs/translations/README.hi.md)

<div align="center">

<img src="extension/icon-128.png" alt="Bookmark Scope logo" width="88" height="88">

# Bookmark Scope

**Find the bookmarks for the site you are on. Clean up the rest of your library.**

A free Chrome extension for people who have saved too many links.<br>
It runs on your computer only. No account, no tracking.

[![Add to Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 languages](https://img.shields.io/badge/languages-52-orange)
![No analytics](https://img.shields.io/badge/analytics-none-lightgrey)

[![GitHub stars](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/screenshots/dashboard-desktop-dark.png">
  <img src="docs/assets/screenshots/dashboard-desktop-light.png" alt="The Bookmark Scope dashboard with a list of bookmarks, filters, tags and a detail panel">
</picture>

## Why this exists

Chrome shows your bookmarks as a folder tree. That is fine for twenty links. It is not fine for two thousand.

You save the same article three times. A folder from 2019 is half dead links. You have eleven bookmarks about a site and cannot find the one you want. Bookmark Scope helps with these problems.

- Open the popup on any page. See the bookmarks you already have for that page, that site, or that domain.
- Open the dashboard. See your whole library, find duplicates and dead links, and fix them in a few clicks.

## What you can do

### See what you already saved for this site

Click the icon in the toolbar. The popup lists your bookmarks for the page you are on. Switch between this exact page, this host, or the whole domain. The badge on the icon shows how many bookmarks match.

<p align="center">
  <img src="docs/assets/screenshots/popup-light.png" alt="The popup showing bookmarks for the current site" width="300">
  &nbsp;&nbsp;
  <img src="docs/assets/screenshots/popup-dark.png" alt="The popup in the dark theme" width="300">
</p>

### See your whole library

The dashboard is a full page for your bookmarks. Search by title, address or folder. Group by domain or folder. Sort by title, address, or date. Filter for duplicates, untitled bookmarks, old bookmarks and title collisions. It stays fast with thousands of bookmarks.

Click a bookmark to see its details. Tick several to work on them together. Drag bookmarks to change their order.

### Clean up without fear

Nothing big happens without a preview.

<p align="center">
  <img src="docs/assets/screenshots/duplicate-preview.png" alt="The duplicate preview dialog where you choose which bookmark to keep" width="780">
</p>

- **Duplicates.** Choose which copy to keep. The tags from the other copies are added to it. You see the result before anything is deleted.
- **Tags.** Add, remove, rename or merge tags for many bookmarks at once. Check the before and after, then apply. You can undo it.
- **Delete and undo.** Deleted bookmarks can be restored with their tags. Chrome does not let any extension bring back the original ID or the date added, so the restored bookmark is new. The extension tells you this.

<p align="center">
  <img src="docs/assets/screenshots/bulk-tags.png" alt="The bulk tags dialog showing tags before and after the change" width="780">
</p>

### Find dead links

Check a group of bookmarks to see which links work, which redirect, and which are broken. The check runs in your browser and talks only to the sites you bookmarked.

- It asks for permission first. If you say no, everything else still works.
- You can pause a long scan and continue later.
- You can turn on a scheduled scan. It is off by default.
- "Repair redirected" updates bookmarks that moved to a new address. It has no undo, so look at the new address first.

### Back up and move

- **Snapshot.** Save your whole library, with folders and tags, to one file. Restore it later into a new folder.
- **Import.** Bring in bookmarks from Chrome, Edge, Firefox, Safari or Brave (the `bookmarks.html` file), Pocket, Pinboard, Raindrop.io, or a CSV, JSON or plain list of links. You see a preview and choose what to do with duplicates: keep, skip or merge.
- **Export.** Save the bookmarks you are looking at as JSON or CSV.

<p align="center">
  <img src="docs/assets/screenshots/library-tools.png" alt="Library tools: saved views, bulk tags, duplicates, scans, backup and import" width="780">
</p>

### Work faster

- **Command palette.** Press `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac) and type what you want to do.
- **Saved views.** Save a search with its filters, tags, sorting and grouping. Open it again with one click.
- **Right-click menu.** On any page or link, show your bookmarks for that domain, or find duplicates of that link.
- **Review reminders.** Turn them on in Settings if you want a nudge every few weeks to tidy up.

<p align="center">
  <img src="docs/assets/screenshots/command-palette.png" alt="The command palette with a list of actions" width="780">
</p>

### Make it yours

Light, dark or system theme. Four color palettes. Right-to-left layouts. The extension includes 52 languages (see [Good to know](#good-to-know)).

<p align="center">
  <img src="docs/assets/screenshots/options-light.png" alt="The settings page" width="300">
  &nbsp;&nbsp;
  <img src="docs/assets/screenshots/dashboard-rtl-dark.png" alt="The dashboard in Persian with a right-to-left layout in the dark theme" width="300">
</p>

## Install

**From the Chrome Web Store (easiest)**

1. Open the [Bookmark Scope page](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo).
2. Click **Add to Chrome**.
3. Click the puzzle icon in the toolbar and pin Bookmark Scope.

Edge and Brave are Chromium browsers, so they can install it from the same page. It is not listed on Edge Add-ons yet. I only test with Chrome. Firefox and Safari are not supported.

**From this repository**

There is no build step. The `extension/` folder is the extension.

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the **`extension`** folder inside the repository (the one that contains `manifest.json`), not the top folder.

An unpacked copy has its own extension ID. You can keep it next to the Store version, but they do not share data, and the unpacked copy does not update by itself.

## Your data stays with you

There is no server. There is no account, no analytics and no ads. Your bookmarks, tags and settings stay in your browser. The [privacy policy](docs/PRIVACY.md) has the details.

The extension does not read the pages you visit. It only reads the address of the active tab, so it can show matching bookmarks.

| Permission | What it is for |
| --- | --- |
| `bookmarks` | Read your bookmarks, and change them when you ask |
| `tabs` | Read the address of the active tab for the popup and the badge |
| `storage` | Keep your settings, tags and scan results in the browser |
| `alarms` | Run optional reminders and optional scheduled scans |
| `notifications` | Show reminders and scan results |
| `contextMenus` | Add the right-click menu items |
| `clipboardWrite` | Copy addresses when you click a copy button |
| `favicon` | Show site icons from the browser's own cache |
| Websites (optional) | Asked only when you start a link check, so the extension can contact the sites you bookmarked |

## Good to know

- **Translations.** The translations are machine-made, so they can have mistakes or leave some English words. If you speak one of these languages natively and can write a correct, natural translation, please help us: [open an issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) or send a pull request. See [CONTRIBUTING.md](.github/CONTRIBUTING.md#translations).
- **Import is flat.** When you import a `bookmarks.html` file, the folder name is shown as a path, but folders are not created and the original dates are not kept. Use a snapshot if you need to rebuild a folder tree.
- **Link checks are hints.** Any 4xx answer counts as broken. A page that loads but shows an error or a login screen counts as healthy.
- **CSV.** I tested the CSV export with the importer and with a real Chrome download. I have not opened it in Excel, Numbers or Google Sheets yet.
- **Testing.** The extension is tested in Chromium. See the [full list of limits](docs/guides/limits.html).

## Keyboard shortcuts

| Keys | What it does |
| --- | --- |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Open the command palette |
| `/` | Go to the search box |
| `Ctrl+A` / `Cmd+A` | Select all bookmarks in the current list |
| `Esc` | Go back one step: cancel an edit, clear the search, clear the selection, close a dialog |

## User guide

The guide explains every part of the extension, with screenshots. Start with [docs/README.md](docs/README.md) or open the [guides folder](docs/guides/). To read it as a web page, open `docs/index.html` in your browser.

## Help the project

Bug reports, translation fixes and small pull requests are welcome. Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) first. Before you send a pull request, run this check. It needs Node.js 24 or newer and no install step.

```bash
node scripts/validate.mjs
node scripts/test.mjs
```

Please report security problems in private. See [SECURITY.md](.github/SECURITY.md).

If Bookmark Scope saves you time, you can [buy me a coffee](https://buymeacoffee.com/enaloo). A rating on the [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) also helps other people find it.

## Contributors

Thanks to everyone who has helped. Your name appears here after your first merged contribution. See [CONTRIBUTING.md](.github/CONTRIBUTING.md#recognition).

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributors"></a>


## License

[MIT](LICENSE). Copyright 2026 Ehsan Enaloo.

The Bookmark Scope code is MIT. Two pieces come from other projects and keep their own licenses: the Public Suffix List (a list of domain endings such as `.co.uk`, MPL-2.0) and the [Lucide](https://lucide.dev) icons (ISC). The full texts are in [extension/THIRD_PARTY_NOTICES.md](extension/THIRD_PARTY_NOTICES.md).
