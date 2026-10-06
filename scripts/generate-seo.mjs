#!/usr/bin/env node
/**
 * generate-seo.mjs
 * ----------------
 * SEO pass for Kids Game Land. Idempotent: every injected block is wrapped in
 * HTML comment markers and stripped before it is re-added, so repeated runs
 * never stack duplicates.
 *
 *   1. index.html         -> canonical, Open Graph, Twitter card, JSON-LD
 *                            (WebSite + ItemList of all games), sr-only <h1>,
 *                            and a subtitle that tracks the catalog size
 *   2. retro-games.html   -> the same treatment for the retro menu
 *   3. each games/<slug>/index.html -> canonical + description + OG tags
 *   4. robots.txt, sitemap.xml, css/common.css (.sr-only utility)
 *
 * Usage: node scripts/generate-seo.mjs [--base https://example.com/repo]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const baseArg = process.argv.indexOf('--base');
const BASE = (baseArg !== -1 ? process.argv[baseArg + 1] : 'https://kurokosama.github.io/WebGames').replace(/\/+$/, '');

const MARK = (name) => ({ open: `<!--seo:${name}-->`, close: `<!--/seo:${name}-->` });

// Remove every SEO artefact this script (or an older run) may have left.
function stripAll(html) {
  return html
    .replace(/<!--\/?seo:[a-z]+-->\s*/g, '')
    .replace(/<link rel="canonical" href="[^"]*">\s*/g, '')
    .replace(/<meta property="og:[^"]*" content="[^"]*">\s*/g, '')
    .replace(/<meta name="twitter:[^"]*" content="[^"]*">\s*/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')
    .replace(/^[ \t]*<meta name="description" content="[^"]*">[ \t]*\r?\n/gm, '');
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const plain = (s) => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"');

function parseGames(html, varName) {
  const m = html.match(new RegExp(`var ${varName} = \\[([\\s\\S]*?)\\n  \\];`));
  if (!m) return [];
  const out = [];
  for (const line of m[1].split('\n')) {
    if (!line.includes('slug:')) continue;
    const g = line.match(/slug:\s*'([^']+)'[\s\S]*?emoji:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?desc:\s*'([^']+)'/);
    if (g) out.push({ slug: g[1], emoji: g[2], name: g[3], desc: g[4] });
  }
  return out;
}

function headBlock({ title, desc, url, jsonLd }) {
  const { open, close } = MARK('head');
  return [
    open,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Kids Game Land">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${BASE}/assets/og-image.svg">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    close
  ].join('\n');
}

// ---------------------------------------------------------------- lobby
const lobbyPath = join(root, 'index.html');
let lobby = stripAll(readFileSync(lobbyPath, 'utf8'));
// headBlock supplies the title, so drop any earlier ones (old runs stacked them).
lobby = lobby.replace(/[ \t]*<title>[\s\S]*?<\/title>[ \t]*\r?\n?/g, '');
const games = parseGames(lobby, 'GAMES');
if (!games.length) {
  console.error('Could not parse the GAMES array from index.html');
  process.exit(1);
}

const n = games.length;
const lobbyTitle = `Kids Game Land · ${n} Fun Games for Kids — Free Classic Browser Games`;
const lobbyDesc = `${n} simple and fun classic games for kids and grown-ups, playable right in your browser — Snake, Tetris, 2048, Minesweeper, Chess, Sudoku, card games, puzzles and arcade classics. No ads, no sign-ups, nothing to install.`;

const lobbyJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Kids Game Land',
    url: `${BASE}/`,
    description: 'Free classic browser games for kids and families.',
    inLanguage: 'en'
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'All games on Kids Game Land',
    numberOfItems: n,
    itemListElement: games.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: plain(g.name),
      url: `${BASE}/games/${g.slug}/`
    }))
  }
];

lobby = lobby.replace('</head>', `${headBlock({ title: lobbyTitle, desc: lobbyDesc, url: `${BASE}/`, jsonLd: lobbyJsonLd })}\n</head>`);

lobby = lobby.replace(
  /(<p class="lobby-subtitle">)[^<]*(<\/p>)/,
  `$1${n} classic games for kids &amp; grown-ups — pick one and play!$2`
);
if (!lobby.includes('sr-only')) {
  lobby = lobby.replace(
    '<body class="lobby-page">',
    '<body class="lobby-page">\n\n<h1 class="sr-only">Kids Game Land — free classic games for kids</h1>'
  );
}
writeFileSync(lobbyPath, lobby);

// ----------------------------------------------------------- retro menu
const retroPath = join(root, 'retro-games.html');
if (existsSync(retroPath)) {
  let retro = stripAll(readFileSync(retroPath, 'utf8'));
  retro = retro.replace(/[ \t]*<title>[\s\S]*?<\/title>[ \t]*\r?\n?/g, '');
  const retroGames = parseGames(retro, 'RETRO_GAMES').concat(parseGames(retro, 'BIG_GAMES'));
  const rTitle = `Retro Games — ${retroGames.length} Classic 90s Games for Older Kids & Adults | Kids Game Land`;
  const rDesc = `A curated menu of ${retroGames.length} classic games for older kids and adults: retro arcade, board games, card games, solitaire, emulators and deeper strategy games — all free in the browser.`;
  const rJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Retro games on Kids Game Land',
    numberOfItems: retroGames.length,
    itemListElement: retroGames.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: plain(g.name),
      url: `${BASE}/games/${g.slug}/`
    }))
  };
  retro = retro.replace('</head>', `${headBlock({ title: rTitle, desc: rDesc, url: `${BASE}/retro-games.html`, jsonLd: rJsonLd })}\n</head>`);
  if (!retro.includes('sr-only')) {
    retro = retro.replace(
      '<body class="lobby-page">',
      '<body class="lobby-page">\n\n<h1 class="sr-only">怀旧游戏 · Retro games for older kids and adults</h1>'
    );
  }
  writeFileSync(retroPath, retro);
}

// ----------------------------------------------------------- game pages
const descBySlug = new Map(games.map((g) => [g.slug, g.desc]));
let patched = 0;
for (const slug of readdirSync(join(root, 'games'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name)) {
  const p = join(root, 'games', slug, 'index.html');
  if (!existsSync(p)) continue;
  let html = stripAll(readFileSync(p, 'utf8'));
  // Exactly one description per page: drop whatever is there (a leftover from an
  // earlier run, or the vendored game's own) and use the catalog copy instead.
  html = html.replace(/[ \t]*<meta\s+name="description"[^>]*>[ \t]*\r?\n?/g, '');
  const desc = plain(descBySlug.get(slug)
    || 'Play this classic game for free in your browser on Kids Game Land — no ads, no sign-ups.');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, slug])[1];
  const { open, close } = MARK('games');
  const block = [
    open,
    `<link rel="canonical" href="${BASE}/games/${slug}/">`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${BASE}/games/${slug}/">`,
    close
  ].join('\n');
  writeFileSync(p, html.replace('</head>', `${block}\n</head>`));
  patched++;
}

// ------------------------------------------------------- robots + sitemap
writeFileSync(join(root, 'robots.txt'),
  `# Kids Game Land — free browser games\nUser-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

const urls = [`${BASE}/`, `${BASE}/retro-games.html`, ...games.map((g) => `${BASE}/games/${g.slug}/`)];
writeFileSync(join(root, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')
  + '\n</urlset>\n');

// ------------------------------------------------------------ sr-only CSS
const cssPath = join(root, 'css', 'common.css');
const css = readFileSync(cssPath, 'utf8');
if (!css.includes('.sr-only')) {
  writeFileSync(cssPath, css + '\n/* Visually hidden, still read by screen readers and crawlers */\n'
    + '.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }\n');
}

console.log(`SEO pass: ${n} games, ${urls.length} sitemap URLs, ${patched} game pages, base ${BASE}`);
