#!/usr/bin/env node
// Prints the runtime file list (one repository-relative path per line, sorted).
// Used by the release workflow to build the extension zip: only these files ship.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'runtime-files.json'), 'utf8'));

export function listRuntimeFiles() {
  const out = [...spec.files];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link not allowed in runtime directory: ${rel}`);
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  for (const dir of spec.directories) walk(dir);
  return out.sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(listRuntimeFiles().join('\n') + '\n');
}
