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
// The lobby lists every game; retro-games.html is an additional curated view, so
// a slug may legitimately appear in both. Compare the union against games/.
const allListed = new Set([...slugsInIndex, ...slugsInRetro]);
if (allListed.size !== gameDirs.length) {
  issues.push(`Count mismatch: the menus list ${allListed.size} distinct games but games/ has ${gameDirs.length} folders`);
}
for (const slug of allListed) {
  if (!gameDirs.includes(slug)) issues.push(`A menu links to '${slug}' but no folder exists`);
}
for (const dir of gameDirs) {
  if (!allListed.has(dir)) {
    issues.push(`Folder '${dir}' exists but is not in the lobby or retro menu`);
  }
}

if (issues.length) {
  console.error('\n❌ Index validation failed:\n');
  for (const i of issues) console.error(`  - ${i}`);
  console.error('');
  process.exit(1);
} else {
  const overlap = slugsInRetro.filter((slug) => slugsInIndex.includes(slug)).length;
  console.log(`\n✅ Lobby and games/ are in sync — ${gameDirs.length} games (${slugsInIndex.length} in the lobby, ${slugsInRetro.length} in the retro menu, ${overlap} in both).\n`);
}
