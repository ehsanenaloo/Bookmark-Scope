let nowProvider = () => Date.now();
let randomProvider = () => Math.random();

export function now() {
  return Number(nowProvider());
}

export function isoNow() {
  return new Date(now()).toISOString();
}

export function makeStableId(prefix = 'id') {
  return `${prefix}:${now()}:${randomProvider().toString(36).slice(2, 10)}`;
}

export function setNowProviderForTesting(provider) {
  nowProvider = typeof provider === 'function' ? provider : () => Date.now();
}

export function setRandomProviderForTesting(provider) {
  randomProvider = typeof provider === 'function' ? provider : () => Math.random();
}
