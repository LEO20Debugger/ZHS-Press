#!/usr/bin/env node
/**
 * Fails the build on raw white/black in application styles.
 *
 * The warmth of this palette comes from never using #ffffff or #000000 — the
 * ground is oat (--paper) and the ink is a slightly green near-black (--ink).
 * A single stray #fff in a component is invisible in review and quietly
 * un-warms whatever it touches, so it is a build error rather than a
 * convention people are asked to remember.
 *
 * Tokens are declared once in packages/ui/src/tokens.css; everything else
 * references them through var(). Colours in test files are exempt, since
 * contrast tests legitimately assert against pure black and white.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const SEARCH_ROOTS = ['apps', 'packages'];
const EXTENSIONS = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  'storybook-static',
]);

/** Contrast tests must be able to assert against pure black and white. */
const EXEMPT_FILE = /\.(test|spec|stories)\.[tj]sx?$/;

const RAW_WHITE = /#fff(?:fff)?\b/gi;
const RAW_BLACK = /#000(?:000)?\b/gi;
const RAW_FUNCTIONAL = /\b(?:rgb|rgba)\(\s*(?:255\s*,\s*255\s*,\s*255|0\s*,\s*0\s*,\s*0)\b/gi;

function* walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = join(directory, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      yield* walk(full);
    } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      yield full;
    }
  }
}

/** Strips block and line comments so prose explaining the rule doesn't trip it. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const violations = [];

for (const searchRoot of SEARCH_ROOTS) {
  for (const file of walk(join(root, searchRoot))) {
    const relativePath = relative(root, file).split(sep).join('/');
    if (EXEMPT_FILE.test(relativePath)) continue;

    const source = stripComments(readFileSync(file, 'utf8'));
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const pattern of [RAW_WHITE, RAW_BLACK, RAW_FUNCTIONAL]) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match) {
          violations.push({
            file: relativePath,
            line: index + 1,
            match: match[0],
            source: line.trim(),
          });
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(`\nFound ${violations.length} raw white/black colour(s).\n`);
  for (const { file, line, match, source } of violations) {
    console.error(`  ${file}:${line}  ${match}`);
    console.error(`    ${source}`);
  }
  console.error(
    '\nUse the design tokens instead: var(--paper) / var(--paper-raised) for light\n' +
      'grounds, var(--ink) for text. See packages/ui/src/tokens.css.\n',
  );
  process.exit(1);
}

console.log('No raw white or black found. Tokens only.');
