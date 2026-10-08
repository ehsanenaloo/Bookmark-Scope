export function buildLocaleMap(entries, label = 'locale') {
  const map = {};
  const seen = new Set();
  for (const entry of entries || []) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error(`Invalid translation entry in ${label}. Expected [key, value].`);
    }
    const [key, value] = entry;
    if (seen.has(key)) {
      throw new Error(`Duplicate translation key in ${label}: ${key}`);
    }
    seen.add(key);
    map[key] = value;
  }
  return Object.freeze(map);
}
