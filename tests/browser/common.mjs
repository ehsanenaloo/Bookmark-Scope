// Shared helpers for the browser checks. Dependency-free apart from Playwright,
// which you install yourself (see README.md in this folder).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The extension/ folder of the repository IS the unpacked extension, so there is no build step.
export const extensionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'extension');

// Returns Playwright's chromium launcher, or null when Playwright is not available.
export async function loadChromium() {
  const modulePath = process.env.BOOKMARK_SCOPE_PLAYWRIGHT_MODULE;
  try {
    const mod = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
    return mod.chromium || mod.default?.chromium || null;
  } catch (error) {
    if (modulePath || !/Cannot find (?:package|module)|ERR_MODULE_NOT_FOUND/.test(String(error?.code || '') + String(error?.message || ''))) {
      console.error(`Could not load Playwright: ${error.message}`);
    }
    return null;
  }
}

// Launch options for a persistent context that loads the extension from the repository's extension/ folder.
export function launchOptions(extra = {}) {
  return {
    channel: 'chromium',
    executablePath: process.env.BOOKMARK_SCOPE_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    ...extra
  };
}
