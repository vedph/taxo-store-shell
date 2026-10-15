#!/usr/bin/env node
/**
 * Builds the libraries under projects/myrmidon into dist/myrmidon, in
 * dependency order.
 *
 * Why this exists: the libraries resolve through tsconfig.json's
 * compilerOptions.paths -> ./dist/myrmidon/<name>, so a source change only
 * reaches the app (and other libraries) once that library AND everything
 * downstream of it has been rebuilt.
 *
 * The dependency graph is the union of each library's package.json
 * (peer)dependencies and the @myrmidon/* imports actually found in
 * its non-spec sources: several manifests do not declare every local library
 * they import, so the manifests alone would yield a wrong build order.
 *
 * Usage:
 *   node scripts/build-libs.mjs              build all, in order
 *   node scripts/build-libs.mjs <name>...    build these and everything
 *                                            downstream of them
 *   node scripts/build-libs.mjs --dry <...>  only print the order
 *   node scripts/build-libs.mjs --clean-cache <...>
 *                                            also delete .angular/cache, whose
 *                                            Vite pre-bundle is NOT invalidated
 *                                            by rebuilding a library into dist/
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIBS_DIR = join(ROOT, 'projects', 'myrmidon');
const NG = join(ROOT, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

// --- guard: no local library may be shadowed by a node_modules copy ------
execFileSync(process.execPath, [join(ROOT, 'scripts', 'check-local-libs.mjs')], {
  stdio: 'inherit',
});

// --- read the libraries and their local dependencies ---------------------
function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* sourceFiles(path);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      yield path;
    }
  }
}

const libs = readdirSync(LIBS_DIR)
  .map((dir) => join(LIBS_DIR, dir))
  .filter((dir) => existsSync(join(dir, 'package.json')))
  .map((dir) => ({
    dir,
    manifest: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')),
  }));

const local = new Set(libs.map((l) => l.manifest.name));
const deps = new Map();
for (const { dir, manifest } of libs) {
  const found = new Set([
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.dependencies ?? {}),
  ]);
  for (const file of sourceFiles(join(dir, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/from\s+['"](@myrmidon\/[\w-]+)['"]/g)) {
      found.add(m[1]);
    }
  }
  found.delete(manifest.name);
  deps.set(
    manifest.name,
    [...found].filter((d) => local.has(d)),
  );
}

// --- topological order ---------------------------------------------------
const order = [];
const state = new Map();
function visit(name, stack = []) {
  if (state.get(name) === 'done') return;
  if (state.get(name) === 'visiting') {
    throw new Error(`dependency cycle: ${[...stack, name].join(' -> ')}`);
  }
  state.set(name, 'visiting');
  for (const dep of deps.get(name).sort()) visit(dep, [...stack, name]);
  state.set(name, 'done');
  order.push(name);
}
[...local].sort().forEach((n) => visit(n));

// --- optional filter: the named libraries plus everything downstream -----
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const cleanCache = args.includes('--clean-cache');
const requested = args.filter((a) => !a.startsWith('--'));

let targets = order;
if (requested.length) {
  const wanted = new Set(
    requested.map((r) => (r.startsWith('@myrmidon/') ? r : `@myrmidon/${r}`)),
  );
  for (const name of wanted) {
    if (!local.has(name)) {
      console.error(`ERROR: unknown library "${name}"`);
      process.exit(1);
    }
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, d] of deps) {
      if (!wanted.has(name) && d.some((x) => wanted.has(x))) {
        wanted.add(name);
        grew = true;
      }
    }
  }
  targets = order.filter((n) => wanted.has(n));
}

// --- build ---------------------------------------------------------------
console.log(
  `${dry ? 'Would build' : 'Building'} ${targets.length} ` +
    `librar${targets.length === 1 ? 'y' : 'ies'}:\n`,
);
for (const [i, name] of targets.entries()) {
  process.stdout.write(`[${i + 1}/${targets.length}] ${name}`);
  if (dry) {
    console.log();
    continue;
  }
  process.stdout.write(' ... ');
  try {
    execFileSync(process.execPath, [NG, 'build', name], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log('ok');
  } catch (err) {
    console.log('FAILED\n');
    process.stderr.write(String(err.stdout ?? '') + String(err.stderr ?? ''));
    process.exit(1);
  }
}
if (!dry && cleanCache) {
  rmSync(join(ROOT, '.angular', 'cache'), { recursive: true, force: true });
  console.log('\nDeleted .angular/cache: restart ng serve to pick up the new builds.');
} else if (!dry) {
  console.log('\nDone. If the served app still shows old code, rerun with ' +
    '--clean-cache (or delete .angular/cache) and restart ng serve.');
}
