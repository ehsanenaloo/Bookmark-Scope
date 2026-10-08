# Screenshots

These images are used by the guide pages. They were captured from the extension with synthetic bookmarks in a disposable browser profile; none show real bookmarks. Replace a file by overwriting it with the **same name**.

| File | Size (px) | What it shows | Used on |
| --- | --- | --- | --- |
| `dashboard-desktop-light.png` | 1440 x 900 | Dashboard in the light theme: search, filter chips, tag strip, list with health badges, side rail and the detail panel | quick-start, dashboard-tour, appearance-and-languages |
| `dashboard-desktop-dark.png` | 1440 x 900 | The same view in the dark theme | same pages (shown when the dark theme is active) |
| `dashboard-narrow-light.png` | 375 x 812 | Dashboard at phone width, light theme | dashboard-tour |
| `dashboard-rtl-dark.png` | 375 x 812 | Dashboard in Persian (right-to-left) at phone width, dark theme | appearance-and-languages |
| `dashboard-selected.png` | 1440 x 900 | Two rows selected, with the selection bar and Library tools button above the list | dashboard-tour |
| `dashboard-detail.png` | 1440 x 900 | Dashboard with the detail panel for an active bookmark that has a redirect result | dashboard-tour |
| `library-tools.png` | 1440 x 900 | The Library tools dialog with its four groups: Organize, Check links, Backup and import, Troubleshoot | dashboard-tour, backup-and-restore |
| `popup-light.png` | 420 x 580 | The popup on a page with several bookmarks, light theme | quick-start, popup |
| `popup-dark.png` | 420 x 580 | The same popup in the dark theme | quick-start, popup |
| `options-light.png` | 900 x 1500 | The settings page, light theme, with all five sections including Review reminders | settings-reference |
| `options-dark.png` | 900 x 1500 | The settings page, dark theme | settings-reference |
| `command-palette.png` | 1440 x 900 | The command palette open over the dashboard, listing the thirteen commands | command-palette |
| `dashboard-about.png` | 1440 x 900 | The About dialog open over the dashboard | dashboard-tour |
| `popup-about.png` | 420 x 580 | The popup with the About footer tab selected | popup |
| `duplicate-preview.png` | 1440 x 900 | The Duplicate preview dialog with a survivor selected | README |
| `bulk-tags.png` | 1440 x 900 | The Bulk tags dialog after Preview, with Before and After lines | organizing |

Notes:

- Each page declares the image's real pixel size in its `width` and `height` attributes. If you replace an image with a different size, update those attributes in the HTML so the page does not shift while loading.
- `*-light` and `*-dark` pairs are swapped automatically to match the reader's theme. `dashboard-narrow-light.png` and `dashboard-rtl-dark.png` have no twin and appear in both themes.
- Alt text lives in the HTML, not in the image, and describes controls by their labels.
- If a file is ever missing, the page hides the broken image and shows a dashed placeholder carrying the file name.
- Compress PNGs (for example with oxipng) before committing.
