# Changelog

All notable changes to Bookmark Scope are listed here.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.2.1] - 2026-10-08

This release makes the package acceptable to the Microsoft Edge Add-ons store. The extension behaves the same as 5.2.0.

### Fixed

- The short description was too long in Tamil, Malayalam, Kannada and Finnish. Microsoft Edge Add-ons allows at most 190 characters, so the extra sentence about the dashboard was removed from those four translations. A new test keeps every language within that limit.

## [5.2.0] - 2026-10-08

This release only reorganizes the project folders to make them easier to navigate. The extension behaves the same as 5.1.0.

### Changed

- The project folders are easier to navigate. The extension root now holds only `manifest.json`, `background.js` and a few folders. Pages live in `pages/`, icons in `icons/`, shared code in `src/core/` and `src/ui/`, and unit tests in `tests/unit/`. Behavior does not change.

## [5.1.0] - 2026-10-08

This release adds an experimental Firefox build, links to the online user guide from inside the extension, and fixes a bug where bookmarks could land one place off when moved down in the same folder in Chrome.

### Added

- Experimental Firefox build (Firefox 140 or newer, desktop), published as a separate zip on each release.
- A "User guide" button in the About dialog of the popup and the dashboard. It opens the online guide in a new tab.

### Fixed

- In Chrome, moving a bookmark down inside the same folder (and undoing that move) could place it one position too early. Chrome and Firefox count the target position differently, and the extension now handles both.
- Firefox: the permission prompt for link scans now appears reliably when you click "Start new scan".
- Dashboard: the Undo button on the "Deleted" and "Restored" messages could miss a click if you pressed it within a fraction of a second after the message appeared, because the list was redrawn under the pointer. The list now refreshes before the message is shown.

### Changed

- The privacy policy lists the user guide among the links you can choose to open.

## [5.0.0] - 2026-10-07

Bookmark Scope 5.0.0 has a new look in the popup, dashboard and settings. It adds eight library tools for backing up, cleaning and organizing your bookmarks, and it fixes several bugs, including a Stop button that did not stop link scans. The Chrome Web Store listing was at 4.44.0 before this release.

Known limitations:

- Imports are flat. Folders are shown as a path, but bookmarks are created in the folder you choose, and original dates are not applied.
- "Repair redirected" has no Undo.
- CSV export has not been tested in spreadsheet programs.
- Translation fixes are waiting for review by native speakers.

### Added

- Snapshots let you save your bookmark library and restore it later. A restore shows a preview first and only adds what is missing.
- Merge duplicates shows a preview and lets you pick which bookmark to keep. Tags from the merged bookmarks are combined.
- Link scans can be paused, resumed and cancelled. Scan progress is saved, so you can continue later.
- Saved views store a search, filter and sort so you can open them again in one click.
- Bulk tag tools add, remove, rename and merge tags on many bookmarks after a preview. Undo is available.
- Import shows a preview with the destination folder and any warnings. For duplicates you can keep, skip or merge.
- Diagnostic export shows what it will include before you download it.
- A command palette lists all actions and opens with Ctrl+Shift+P (Cmd+Shift+P on Mac).
- You can import `bookmarks.html` files exported by Chrome, Edge, Firefox, Safari, Brave and most bookmark managers. Firefox tags are kept. Bookmarklets and non-web links are skipped.
- Export visible bookmarks as CSV from the list menu, Library tools or the command palette. The file opens again in the importer.
- A sort control in the dashboard orders by title, address, newest, oldest or folder path. Your choice is remembered and saved with views.
- Review reminders can be turned on in Settings, with an interval of 1 to 365 days.
- The dashboard has a new About dialog. The popup About tab now shows the author.

### Changed

- The popup, dashboard and settings have a new design with clearer text, rows, dialogs and light and dark themes.
- Icons were replaced with the Lucide set.
- The popup now lists up to 20 matching bookmarks instead of 8.
- Settings use section cards with switches and a save bar that stays in view.
- Settings stay selected after you save them.
- Menus, dialogs and controls work better with the keyboard.
- Library tools stay available while you select bookmarks.
- Previews for snapshots, imports and tag changes show readable bookmark names and results, not raw data.
- About 24 settings and About texts that were still in English are now translated in 46 languages.
- Translations that were in the wrong language or script were corrected for Bulgarian, Ukrainian, Romanian, Traditional Chinese, Slovak, Slovenian, Serbian, Malay, Czech, Catalan, Thai and Malayalam.
- Stored data moved to a newer format. Your bookmarks, tags and settings are kept, and old link-check results are cleared.

### Fixed

- The Stop button now stops a running link scan.
- Adding or removing a tag on a dashboard row no longer fails.
- Links from the right-click menu and the 1, 2 and 3 scope shortcuts now open the right view.
- The popup width setting now works. Compact is 380 px and Comfortable is 420 px.
- A bookmark is no longer marked as redirected when only the #fragment or the letter case of the host differs.
- The scheduled scan section in Settings has its text back.
- The merge confirmation now shows "newest" and "oldest" in your language.
- Pages with a non-default port are no longer treated as the same page as the default port.
- The toolbar badge follows your matching preferences.
- Deleting or moving many bookmarks keeps tags and order if some of the changes fail. Undo can retry what is left.
- Link scans stop on cancel or timeout, including during the GET retry. Old results from before a reset are ignored.
- Scheduled scans and reminders stay scheduled after an early exit.
- Long lists keep their scroll position when storage refreshes.
- Imports that stop partway are recorded, and the result shows what was done. A new bookmark is rolled back if saving its tags fails.
- Pocket titles with HTML entities now import correctly.
- Some translation entries and placeholders were missing and have been added.

### Security

- CSV cells that look like spreadsheet formulas are made safe on export.

### Removed

- The fixed extension key and update address were removed from the manifest. The Chrome Web Store manages both. An unpacked build now gets its own extension ID and does not share data with the Store version.

## [4.44.0] - 2026-05-27

### Fixed

- Dragging several selected bookmarks within one folder now puts them in the right order and place. Before, they could land in the wrong slots or in reverse order.

## [4.43.0] - 2026-05-27

### Added

- New text from versions 4.38 to 4.42 is translated into Persian, Russian, Japanese, Spanish, French, German and Simplified Chinese.
- Other languages show these new texts in English.

## [4.42.0] - 2026-05-27

### Changed

- The code was prepared for a Firefox build. Firefox is not supported or tested as of 5.0.0.
- Favicons are skipped in browsers that do not provide them, so rows show a letter instead of errors.

## [4.41.0] - 2026-05-27

### Added

- Import from Pocket, Pinboard and Raindrop.io exports. Tags are kept.
- An "Import bookmarks" item in the dashboard list menu. It accepts HTML, JSON, CSV and text files and detects the format from the file.

### Security

- Imports skip links that are not http or https.

## [4.40.0] - 2026-05-27

### Added

- Tags: add your own labels to any bookmark, without changing the bookmark in Chrome.
- A tag strip above the list filters by your most used tags. Choosing several tags shows bookmarks that have all of them.
- Tags are lowercase and limited to 32 characters, 20 per bookmark and 500 in total.
- Tags are removed when their bookmark is deleted.

## [4.39.0] - 2026-05-27

### Added

- Drag and drop in the dashboard moves one or several bookmarks within a folder or into another folder.
- A line shows where the bookmark will land.
- An Undo button appears for 5 seconds after each move.

## [4.38.0] - 2026-05-27

### Added

- Fuzzy search in the popup finds bookmarks from partial or out-of-order text when normal search finds nothing.
- The right-click menu can show all bookmarks of a domain and find duplicates of a page or link.
- An optional scheduled link scan checks a small batch of bookmarks every few days and sends one notification when new broken links appear.

## [4.37.0] - 2026-05-27

### Added

- "Clear cached health data" in the list menu removes saved link-check results and leaves your bookmarks alone.

### Fixed

- CSV import and export now handle commas, line breaks and quotes inside cells, so an exported file imports back without loss.
- The list no longer goes blank when you scroll slowly.
- The settings page saves reliably when you close it.

## [4.36.0] - 2026-05-27

### Added

- Link-check results are now saved between dashboard visits for 7 days.
- Clicking the filled star in the popup removes the bookmark, with Undo.
- The popup and dashboard update when bookmarks change elsewhere.

### Fixed

- The oldest link-check results are cleared first when the saved list is full.
- The popup star button is faster with large libraries.
- "Repair redirected" now clears only the results it changed.

## [4.35.0] - 2026-05-27

### Fixed

- The toolbar badge now follows the popup mode you chose: Page, Host or Domain.
- Stopping a link scan now works after the scan retries with GET.
- The Duplicate, Untitled and Title collision labels in the popup are translated.

### Security

- Imports now reject links that are not http or https, such as `javascript:` and `data:`.

## [4.34.0] - 2026-04-14

### Fixed

- The dashboard list now updates right after you delete one or more bookmarks.
- The review reminder now repeats after its set interval, not after one day.
- Link checks skip file, browser and other non-web addresses.

## [4.33.0] - 2026-04-08

### Fixed

- Servers that answer a HEAD request with "405 Method Not Allowed" are no longer marked as broken.
- Menus close with one click instead of being handled twice.
- Two link scans can no longer start at once while a permission prompt is open.

### Changed

- The popup and dashboard redraw less, and number and date formatting is faster.

## [4.32.0] - 2026-04-08

### Fixed

- Startup no longer rewrites stored settings when nothing changed.
- A broken JSON import file now gives an error and does not crash the import.
- "Repair redirected" now finds the redirected bookmarks.
- Turning reminders off stays off when you mark bookmarks as reviewed, and deferring a reminder uses your chosen interval.
- The bulk bar shows the correct total, and scan progress is reset after a scan finishes.
- Filter labels are translated, and log writes no longer overwrite each other.

## [4.31.0] - 2026-04-08

### Fixed

- Several smaller bug fixes.
