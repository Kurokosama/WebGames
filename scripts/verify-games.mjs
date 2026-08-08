#!/usr/bin/env node
/**
 * verify-games.mjs
 * -----------------
 * Validates the structure and consistency of every game page in the repo.
 * Used by the CI workflow (see .github/workflows/ci.yml).
 *
 * Checks:
 *   1. Shared assets exist (index.html, css/common.css, css/games.css, js/common.js)
 *   2. Every folder in games/ has the required files (index.html, style.css, game.js)
 *   3. Every game page references the shared assets and includes the required
 *      frame elements (game-title, modal, restart button, back button, etc.)
 *   4. Every slug listed in the lobby (index.html GAMES array) has a matching folder
 *
 * Usage: node scripts/verify-games.mjs
 * Exits 0 on success, 1 on failure.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const gamesDir = join(root, 'games');

const SHARED_FILES = ['index.html', 'css/common.css', 'css/games.css', 'js/common.js'];
const REQUIRED_GAME_FILES = ['index.html', 'style.css', 'game.js'];
const REQUIRED_ASSETS = ['/css/common.css', '/css/games.css', '/js/common.js'];
const REQUIRED_ELEMENTS = [
  'id="game-title"',
  'id="modal"',
  'id="restart-btn"',
  'id="modal-btn"',
  'class="btn back-btn"'
];

const errors = [];

// 1. Shared assets
for (const file of SHARED_FILES) {
  if (!existsSync(join(root, file))) {
    errors.push(`Missing shared file: ${file}`);
  }
}

// 2. Game folders
const gameDirs = readdirSync(gamesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (gameDirs.length === 0) {
  errors.push('No game folders found in games/');
}

// 4. Slugs in the lobby match folders
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const slugsInIndex = [...indexHtml.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
for (const slug of slugsInIndex) {
  if (!gameDirs.includes(slug)) errors.push(`Lobby lists '${slug}' but no folder exists in games/`);
}
for (const dir of gameDirs) {
  if (!slugsInIndex.includes(dir)) {
    errors.push(`Folder games/${dir} is not listed in the lobby index.html`);
  }
}

// 3. Per-game checks
for (const dir of gameDirs) {
  const gameRoot = join(gamesDir, dir);
  for (const file of REQUIRED_GAME_FILES) {
    if (!existsSync(join(gameRoot, file))) {
      errors.push(`${dir}: missing required file ${file}`);
    }
  }

  const htmlPath = join(gameRoot, 'index.html');
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf8');
    for (const asset of REQUIRED_ASSETS) {
      if (!html.includes(asset)) errors.push(`${dir}: missing reference to ${asset}`);
    }
    if (!html.includes('src="game.js"')) errors.push(`${dir}: missing <script src="game.js">`);
    if (!html.includes('src="/js/common.js"')) errors.push(`${dir}: missing <script src="/js/common.js">`);
    for (const el of REQUIRED_ELEMENTS) {
      if (!html.includes(el)) errors.push(`${dir}: missing required element ${el}`);
    }
  }
}

// Report
if (errors.length) {
  console.error(`\n❌ Validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
} else {
  console.log(`\n✅ All checks passed — ${gameDirs.length} game folders verified.`);
  console.log(`   Slugs in lobby: ${slugsInIndex.length} · Folders: ${gameDirs.length}\n`);
}
