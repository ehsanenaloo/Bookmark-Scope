# Security Policy

## Supported versions

Security fixes are made to the latest release published on the [Chrome Web Store](https://chromewebstore.google.com/detail/cdonpinfefphkfdcffnangpmjjkoklfo) and tagged in this repository. Older versions are not patched; please update.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately with GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the problem and how to reproduce it.

Direct link: <https://github.com/ehsanenaloo/Bookmark-Scope/security/advisories/new>

Helpful details:

- the extension version (shown on `chrome://extensions`) and browser version,
- the affected component (popup, dashboard, settings, background worker, import or export),
- clear reproduction steps, ideally with synthetic bookmarks rather than your real library,
- the impact you believe it has.

Please do not include real bookmark data, personal URLs or credentials in a report.

## What to expect

This is a volunteer-maintained project, so response times are best effort. The maintainer will acknowledge a report, assess it, work on a fix for confirmed issues and credit you in the release notes if you wish. Please allow a reasonable time to ship a fix before disclosing the issue publicly.

## Scope

In scope:

- code in this repository that ships in the extension,
- ways to make the extension read, change or leak data beyond what its documented permissions allow,
- cross-site scripting or injection through bookmark titles, URLs, imported files or localized strings,
- unsafe handling of imported or restored files.

Out of scope:

- issues that require an already compromised browser, operating system or Chrome profile,
- vulnerabilities in Chrome or in other extensions,
- findings that depend on a modified copy of the extension,
- social engineering, and denial of service from deliberately enormous local files beyond the documented 10 MiB import limit.

## Design notes relevant to security researchers

- The extension declares no content scripts, no externally connectable origins and no web-accessible resources.
- HTTP and HTTPS host access is an **optional** permission requested only when a link-health scan starts.
- Bookmark titles, URLs and imported content are rendered as text nodes, not HTML.
- Imports reject URLs with non-HTTP(S) schemes.
