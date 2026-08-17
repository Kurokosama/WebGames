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
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const gamesDir = join(root, 'games');

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const slugsInIndex = [...indexHtml.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);

// Retro games menu (retro-games.html)
let slugsInRetro = [];
const retroHtmlPath = join(root, 'retro-games.html');
if (existsSync(retroHtmlPath)) {
  const retroHtml = readFileSync(retroHtmlPath, 'utf8');
  slugsInRetro = [...retroHtml.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
}

const gameDirs = readdirSync(gamesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const issues = [];
if (slugsInIndex.length + slugsInRetro.length !== gameDirs.length) {
  issues.push(`Count mismatch: lobby lists ${slugsInIndex.length} + retro menu ${slugsInRetro.length} games but games/ has ${gameDirs.length} folders`);
}
for (const slug of slugsInIndex) {
  if (!gameDirs.includes(slug)) issues.push(`Lobby links to '${slug}' but no folder exists`);
}
for (const slug of slugsInRetro) {
  if (!gameDirs.includes(slug)) issues.push(`Retro menu links to '${slug}' but no folder exists`);
}
for (const dir of gameDirs) {
  if (!slugsInIndex.includes(dir) && !slugsInRetro.includes(dir)) {
    issues.push(`Folder '${dir}' exists but is not in the lobby or retro menu`);
  }
}

if (issues.length) {
  console.error('\n❌ Index validation failed:\n');
  for (const i of issues) console.error(`  - ${i}`);
  console.error('');
  process.exit(1);
} else {
  console.log(`\n✅ Lobby and games/ are in sync — ${slugsInIndex.length} games.\n`);
}
