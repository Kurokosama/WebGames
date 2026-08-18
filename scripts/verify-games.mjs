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

// Third-party games integrated as-is (own structure, own assets). They are
// exempt from the standard frame checks but must still have an index.html.
const STANDALONE_GAMES = ['adarkroom', 'tower-defense', 'battle-city', 'xiangqi', 'doudizhu', 'klotski', 'nes-emulator', 'monopoly', 'mahjong', 'ludo', 'cluedo', 'spider-solitaire', 'checkers', 'sudoku', 'retro-racers', 'dungeon-crawl', 'blackjack', 'backgammon', '8-ball-pool', 'gin-rummy', 'darts', 'bowling', 'crimson-tide', 'plants-vs-zombies', 'minecraft', 'genesis-emulator'];

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
if (!indexHtml.includes(`${slugsInIndex.length} Fun Games for Kids`)) {
  errors.push(`Lobby <title> does not reflect the ${slugsInIndex.length}-game catalog`);
}
if (!indexHtml.includes(`${slugsInIndex.length} simple and fun classic games`)) {
  errors.push(`Lobby description does not reflect the ${slugsInIndex.length}-game catalog`);
}
for (const slug of slugsInIndex) {
  if (!gameDirs.includes(slug)) errors.push(`Lobby lists '${slug}' but no folder exists in games/`);
}

// 4b. Retro games menu (retro-games.html) slugs match folders
const retroHtmlPath = join(root, 'retro-games.html');
let slugsInRetro = [];
if (existsSync(retroHtmlPath)) {
  const retroHtml = readFileSync(retroHtmlPath, 'utf8');
  slugsInRetro = [...retroHtml.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
  for (const slug of slugsInRetro) {
    if (!gameDirs.includes(slug)) errors.push(`Retro menu lists '${slug}' but no folder exists in games/`);
  }
}

// Every game folder must be listed in the lobby or the retro menu
for (const dir of gameDirs) {
  if (!slugsInIndex.includes(dir) && !slugsInRetro.includes(dir)) {
    errors.push(`Folder games/${dir} is not listed in the lobby index.html or retro-games.html`);
  }
}

// 3. Per-game checks
for (const dir of gameDirs) {
  const gameRoot = join(gamesDir, dir);
  const isStandalone = STANDALONE_GAMES.includes(dir);

  // Standalone third-party games keep their own structure — only require
  // that index.html exists and doesn't reference external tracking scripts.
  if (isStandalone) {
    const htmlPath = join(gameRoot, 'index.html');
    if (!existsSync(htmlPath)) {
      errors.push(`${dir}: missing required file index.html`);
      continue;
    }
    const html = readFileSync(htmlPath, 'utf8');
    if (/googletagmanager|google-analytics|adsbygoogle|pagead2/.test(html)) {
      errors.push(`${dir}: still references external tracking/ads scripts`);
    }
    continue;
  }

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

    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const id of new Set(duplicateIds)) errors.push(`${dir}: duplicate id="${id}"`);

    const jsPath = join(gameRoot, 'game.js');
    if (existsSync(jsPath)) {
      const js = readFileSync(jsPath, 'utf8');
      // Check the root ID of literal selectors such as $('#board .cell').
      // Skip dynamic ID prefixes (e.g. $('#found-' + i) → 'found-') which are
      // constructed at runtime and can't be validated statically.
      const selectedIds = [...js.matchAll(/\$\('#([^' ]+)/g)].map((m) => m[1]);
      for (const id of new Set(selectedIds)) {
        if (id.endsWith('-')) continue; // dynamic ID prefix
        if (!ids.includes(id)) errors.push(`${dir}: game.js selects missing #${id}`);
      }
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
  console.log(`   Slugs in lobby: ${slugsInIndex.length} · Retro: ${slugsInRetro.length} · Folders: ${gameDirs.length}\n`);
}
