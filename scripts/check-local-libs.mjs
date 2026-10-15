#!/usr/bin/env node
/**
 * Guard: local workspace libraries must resolve in exactly one way.
 *
 * The libraries under projects/myrmidon are wired only through tsconfig.json
 * compilerOptions.paths -> ./dist/myrmidon/<name>. If a copy of any of them
 * also exists under node_modules (a published npm copy, a symlink, or an
 * entry in the pnpm store), anything resolving through Node rules (e.g. a
 * library importing another one, or Vite's dependency pre-bundling) can
 * silently pick that copy instead of the workspace build.
 *
 * Exits with code 1 when any local library is found under node_modules.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIBS_DIR = join(ROOT, 'projects', 'myrmidon');
const NM = join(ROOT, 'node_modules');

const local = readdirSync(LIBS_DIR)
  .map((dir) => join(LIBS_DIR, dir, 'package.json'))
  .filter((file) => existsSync(file))
  .map((file) => JSON.parse(readFileSync(file, 'utf8')).name);

const pnpmStore = existsSync(join(NM, '.pnpm')) ? readdirSync(join(NM, '.pnpm')) : [];

const problems = [];
for (const name of local) {
  if (existsSync(join(NM, ...name.split('/')))) {
    problems.push(`node_modules/${name} exists`);
  }
  // pnpm store entries are named like @scope+name@version...
  const storePrefix = `${name.replace('/', '+')}@`;
  for (const entry of pnpmStore.filter((e) => e.startsWith(storePrefix))) {
    problems.push(`node_modules/.pnpm/${entry} exists`);
  }
}

if (problems.length) {
  console.error(
    '[check-local-libs] Local workspace libraries must resolve only via ' +
      'tsconfig paths to dist/, but copies were found under node_modules:\n  ' +
      problems.join('\n  ') +
      '\nRemove the dependency on the published package and reinstall.',
  );
  process.exit(1);
}

console.log(
  `[check-local-libs] OK: ${local.length} local libraries, none shadowed in node_modules.`,
);
