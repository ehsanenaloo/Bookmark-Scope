export function createCommandRegistry(definitions = {}) {
  const commands = new Map(Object.entries(definitions));

  return Object.freeze({
    has(name) {
      return commands.has(name);
    },
    list() {
      return [...commands].filter(([,definition])=>definition && typeof definition.run==='function' && typeof definition.label==='string').map(([name,definition])=>({name,label:definition.label}));
    },
    async run(name, ...args) {
      const definition = commands.get(name);
      const handler = typeof definition==='function' ? definition : definition?.run;
      if (typeof handler !== 'function') {
        throw new Error(`Unknown dashboard command: ${name}`);
      }
      return handler(...args);
    }
  });
}
