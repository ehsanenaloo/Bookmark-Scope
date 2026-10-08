# Privacy Policy

**Bookmark Scope** (the "extension")
Last updated: 2026-10-07

Bookmark Scope is a Chrome extension that helps you inspect, organize and clean up your browser bookmarks. This policy explains what the extension accesses, what it stores, and what leaves your device. The short version: **the extension has no server, collects nothing about you, and sends no data to its author or to any third party.**

## Summary

- Bookmark Scope does not collect, transmit, sell or share personal data.
- There is no account, sign-in, analytics, telemetry, advertising or crash reporting.
- Your bookmarks, tags and settings stay in your browser's local extension storage.
- The only network requests the extension makes on its own are link-health checks to the websites **you** bookmarked, and only after you grant permission and start a scan (or enable scheduled scans).
- The extension does not run on, read or modify the web pages you visit. It has no content scripts.

## What the extension can access

| Data | Why | Where it goes |
| --- | --- | --- |
| Your bookmarks (titles, URLs, folders, dates) | To display, search, group, edit, move, delete, import and export them | Stays in the browser. Bookmarks remain stored by the browser itself. |
| The URL and title of your active tab | To show which bookmarks match the page you are on and to count them in the toolbar badge | Used on your device to compute matches. Not transmitted. |
| Preferences, tags, saved views, review and cleanup history, link-health results, scan progress, recovery journals | To remember your settings and let you review and undo work | Browser extension storage (`chrome.storage.local`) on your device. Not synced by the extension. |
| Clipboard (write only) | To copy URLs when you click a copy button | Written to your clipboard on your action. The extension never reads your clipboard. |

## What the extension sends over the network

1. **Link-health checks (optional).** When you start a scan, or enable scheduled background scans, your browser requests the bookmarked URLs directly (a `HEAD` request, with a `GET` request as fallback) to learn whether each page responds, redirects or fails. These requests go **only** to the sites you bookmarked and are made from your device, so those sites can see the request as they would from any visit. Results are stored locally. Nothing is sent to the extension's author. Chrome Web Store hosts and non-web URLs are skipped.
2. **Permission to contact websites is optional.** The extension requests access to `http://*/*` and `https://*/*` as an *optional* permission, only at the moment you start a scan or enable scheduled scans. If you decline, scans do not run and every other feature keeps working. You can revoke the permission at any time in Chrome's extension settings.
3. **Links you choose to open.** The footer and settings contain links to this project's GitHub page, a donation page and the Chrome Web Store review page. They open in a new tab only when you click them.
4. **Chrome's update service.** Like all Web Store extensions, Chrome itself checks for new versions. That is Chrome's feature, not the extension's.

The extension loads its translations from files packaged inside it. It does not download code, translations or configuration from the internet and does not use remote code.

## Notifications

If you allow them, the extension shows local notifications for the pin hint, review-due reminders and scan findings. These are generated on your device.

## Diagnostics

The extension keeps a small, local diagnostic log in extension storage. It is never uploaded. Some entries in that local log can include bookmark URLs, so treat it as private data on your device. You can optionally download diagnostics from the dashboard. The download is generated only when you ask for it, you are shown the exact JSON before saving it, and it is limited to up to 200 recent events with names from a fixed list and numeric or boolean counters. It does not include bookmark URLs, titles, IDs, tag names or free-form error messages. Note that the other files you can download (Export visible JSON or CSV, library snapshots and recovery journals) **do** contain your bookmark data. Review them before sharing them with anyone.

## Data sharing and Chrome Web Store Limited Use

Bookmark Scope does not transfer user data to anyone. The use of information received through browser APIs adheres to the Chrome Web Store [User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements: data is used only to provide the user-facing features described above, is not sold, is not used for advertising or creditworthiness, and is not read by humans.

## Retention and deletion

- Data lives in your browser until you remove it. History and recovery records are capped in size, and the dashboard offers a command to clear cached link-health data.
- Uninstalling the extension removes its storage from your browser.
- Your bookmarks themselves belong to your browser. Removing the extension does not delete them, and changes the extension made to bookmarks (such as deletions you confirmed) are not reverted.
- Because the author holds no copy of your data, there is nothing to request from or delete at the author's end.

## Children

The extension is not directed at children and collects no personal information from anyone.

## Open source

The full source code is public at <https://github.com/ehsanenaloo/Bookmark-Scope> so that every statement above can be verified. Third-party material is listed in [THIRD_PARTY_NOTICES.md](../extension/THIRD_PARTY_NOTICES.md).

## Changes to this policy

If the extension's data practices change, this file will be updated in the same release and the change recorded in [CHANGELOG.md](../CHANGELOG.md). The "Last updated" date above will change.

## Contact

Questions or concerns about privacy: open an issue at <https://github.com/ehsanenaloo/Bookmark-Scope/issues>. For anything sensitive, use the private reporting process in [SECURITY.md](../.github/SECURITY.md).
