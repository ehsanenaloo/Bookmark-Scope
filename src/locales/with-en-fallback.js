import EN_MESSAGES from './en.js';

export default function withEnglishFallback(overrides = {}) {
  return {
    ...EN_MESSAGES,
    ...overrides
  };
}
