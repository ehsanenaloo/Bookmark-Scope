**English** · [فارسی](docs/translations/README.fa.md) · [Español](docs/translations/README.es.md) · [Français](docs/translations/README.fr.md) · [Deutsch](docs/translations/README.de.md) · [Português (Brasil)](docs/translations/README.pt-BR.md) · [Русский](docs/translations/README.ru.md) · [简体中文](docs/translations/README.zh-CN.md) · [日本語](docs/translations/README.ja.md) · [العربية](docs/translations/README.ar.md) · [हिन्दी](docs/translations/README.hi.md)

<div align="center">

<img src="extension/icons/icon-128.png" alt="Bookmark Scope logo" width="88" height="88">

# Bookmark Scope

**Find the bookmarks for the site you are on. Clean up the rest of your library.**

A free, open-source browser extension for people who have saved too many links.<br>
It runs on your computer only. No account, no tracking.

[![Add to Chrome](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo)
[![User guide](https://img.shields.io/badge/User%20guide-Read%20online-0f766e?logo=readthedocs&logoColor=white&style=for-the-badge)](https://ehsanenaloo.github.io/Bookmark-Scope/)
[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/enaloo)

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![52 languages](https://img.shields.io/badge/languages-52-orange)
![No analytics](https://img.shields.io/badge/analytics-none-lightgrey)
[![GitHub stars](https://img.shields.io/github/stars/ehsanenaloo/Bookmark-Scope?style=social)](https://github.com/ehsanenaloo/Bookmark-Scope/stargazers)

[Features](#features) · [Install](#install) · [Privacy](#privacy) · [Documentation](#documentation) · [FAQ](#faq) · [Contributing](#contributing)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/screenshots/dashboard-desktop-dark.png">
  <img src="docs/assets/screenshots/dashboard-desktop-light.png" alt="The Bookmark Scope dashboard with a list of bookmarks, filters, tags and a detail panel">
</picture>

## What is Bookmark Scope?

Chrome shows your bookmarks as a folder tree. That works for twenty links, not for two thousand. You save the same article three times, half of an old folder is dead links, and you cannot tell what you already saved for the site you are reading.

Bookmark Scope fixes this with two tools. The **popup** shows the bookmarks you already have for the page, site or domain you are on. The **dashboard** shows your whole library, so you can find duplicates and dead links and clean them up in a few clicks, with a preview before anything changes.

## Features

| | |
| --- | --- |
| **Popup for the current site** <br> See saved bookmarks for this page, host or domain. The toolbar badge shows how many match. | **Dashboard for your whole library** <br> Search, filter, group, sort, tag and edit thousands of bookmarks. It stays fast. |
| **Safe cleanup** <br> Preview duplicate merges and bulk tag changes first. Undo what you delete, with its tags. | **Dead link checks** <br> Find broken and redirected links. Opt-in, and long scans can be paused and resumed. |
| **Backup and import** <br> Save snapshots of your library. Import from `bookmarks.html`, Pocket, Pinboard, Raindrop.io, CSV and JSON. Export to JSON or CSV. | **Saved views and command palette** <br> Open a saved search in one click. Press `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac) for every action. |
| **Private by design** <br> No server, no account, no analytics. Your data stays in your browser. | **Your language and look** <br> 52 languages, light and dark themes, four color palettes, right-to-left layouts. |

<p align="center">
  <img src="docs/assets/screenshots/popup-light.png" alt="The popup showing bookmarks for the current site" width="230">
  &nbsp;&nbsp;
  <img src="docs/assets/screenshots/duplicate-preview.png" alt="The duplicate preview dialog where you choose which bookmark to keep" width="520">
</p>
<p align="center">
  <img src="docs/assets/screenshots/library-tools.png" alt="Library tools: saved views, bulk tags, duplicates, scans, backup and import" width="390">
  &nbsp;&nbsp;
  <img src="docs/assets/screenshots/command-palette.png" alt="The command palette with a list of actions" width="390">
</p>

## Install

| Browser | Status | How |
| --- | --- | --- |
| **Chrome** | Tested | [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) |
| **Edge, Brave** | Works | Install from the same Chrome Web Store page. Not listed on Edge Add-ons yet. |
| **Firefox 140+** (desktop) | Experimental | [Temporary install from the Releases page](#firefox-experimental) |
| **Safari** | Not supported | |

**Chrome, Edge and Brave:** open the store page, click **Add to Chrome**, then click the puzzle icon in the toolbar and pin Bookmark Scope.

<a id="firefox-experimental"></a>

**Firefox (experimental):** it is not on Firefox Add-ons yet.

1. Download `bookmark-scope-<version>-firefox.zip` from the [Releases page](https://github.com/ehsanenaloo/Bookmark-Scope/releases).
2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and choose the zip file.

Firefox removes temporary add-ons when it closes. See the [installation guide](https://ehsanenaloo.github.io/Bookmark-Scope/guides/installation.html#firefox-experimental) for details.

**From source:** there is no build step. The `extension/` folder is the extension. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `extension` folder.

## Privacy

- There is no server, no account, no analytics and no ads.
- Your bookmarks, tags and settings stay in your browser.
- The only network requests are link checks to the sites you bookmarked, and only after you allow them. Everything else works without that permission.
- The extension does not read the pages you visit. It only reads the address of the active tab, to show matching bookmarks.

Read the [privacy policy](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) for details and the list of permissions.

## Documentation

| | |
| --- | --- |
| [User guide](https://ehsanenaloo.github.io/Bookmark-Scope/) | Every feature, with screenshots |
| [Known limits](https://ehsanenaloo.github.io/Bookmark-Scope/guides/limits.html) | What is unfinished or untested |
| [Privacy policy](https://ehsanenaloo.github.io/Bookmark-Scope/privacy.html) | What the extension stores and sends |
| [Changelog](CHANGELOG.md) | What changed in each release |
| [Contributing](.github/CONTRIBUTING.md) | How to report bugs and send changes |
| [Security](.github/SECURITY.md) | How to report a security problem in private |

## FAQ

<details>
<summary><b>Does it send my bookmarks anywhere?</b></summary>

No. There is no server. Your bookmarks stay in your browser. The extension only contacts the sites you bookmarked, when you start a link check and have allowed it.
</details>

<details>
<summary><b>Will it change or delete bookmarks by itself?</b></summary>

No. It changes bookmarks only when you ask. Merges and bulk tag changes show a preview first, and deletes ask you to confirm.
</details>

<details>
<summary><b>Can I get a deleted bookmark back?</b></summary>

Yes, use Undo. The bookmark comes back in its folder with its tags. Browsers do not let any extension restore the original ID or the date added, so the restored bookmark is new.
</details>

<details>
<summary><b>Does it work with other bookmark managers?</b></summary>

You can import from Chrome, Edge, Firefox, Safari and Brave (the `bookmarks.html` file), Pocket, Pinboard, Raindrop.io, CSV and JSON files. Imports are flat: folders are shown as a path but not created.
</details>

<details>
<summary><b>How do I report a problem or ask for a feature?</b></summary>

[Open an issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues). Please do not include your real bookmark list. For security problems, see [SECURITY.md](.github/SECURITY.md).
</details>

## Translations

The translations are machine-made, so they can have mistakes or leave some English words. If you speak one of these languages natively and can write a correct, natural translation, please help us: [open an issue](https://github.com/ehsanenaloo/Bookmark-Scope/issues) or send a pull request. See [CONTRIBUTING.md](.github/CONTRIBUTING.md#translations).

## Contributing

Bug reports, translation fixes and small pull requests are welcome. Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) first.

If Bookmark Scope saves you time, you can [buy me a coffee](https://buymeacoffee.com/enaloo). A rating on the [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) also helps other people find it.

### Contributors

Thanks to everyone who has helped. Your name appears here after your first merged contribution.

<a href="https://github.com/ehsanenaloo/Bookmark-Scope/graphs/contributors"><img src="https://contrib.rocks/image?repo=ehsanenaloo/Bookmark-Scope" alt="Contributors"></a>

## License

[MIT](LICENSE). Copyright 2026 Ehsan Enaloo.

The extension code is MIT. Two pieces come from other projects and keep their own licenses: the Public Suffix List (a list of domain endings such as `.co.uk`, MPL-2.0) and the [Lucide](https://lucide.dev) icons (ISC). The full texts are in [extension/THIRD_PARTY_NOTICES.md](extension/THIRD_PARTY_NOTICES.md).
