#!/usr/bin/env node
/**
 * verify-index.mjs
 * -----------------
 * Cross-checks the lobby (index.html) GAMES array against the game folders
 * to make sure there are no orphan folders or dead links.
 *
 * Usage: node scripts/verify-index.mjs
 * Exits 0 on success, 1 on failure.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const gamesDir = join(root, 'games');

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const slugsInIndex = [...indexHtml.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);

const gameDirs = readdirSync(gamesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const issues = [];
if (slugsInIndex.length !== gameDirs.length) {
  issues.push(`Count mismatch: lobby lists ${slugsInIndex.length} games but games/ has ${gameDirs.length} folders`);
}
for (const slug of slugsInIndex) {
  if (!gameDirs.includes(slug)) issues.push(`Lobby links to '${slug}' but no folder exists`);
}
for (const dir of gameDirs) {
  if (!slugsInIndex.includes(dir)) issues.push(`Folder '${dir}' exists but is not in the lobby`);
}

if (issues.length) {
  console.error('\n❌ Index validation failed:\n');
  for (const i of issues) console.error(`  - ${i}`);
  console.error('');
  process.exit(1);
} else {
  console.log(`\n✅ Lobby and games/ are in sync — ${slugsInIndex.length} games.\n`);
}
