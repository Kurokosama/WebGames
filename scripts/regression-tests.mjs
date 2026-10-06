#!/usr/bin/env node
/**
 * Targeted regression tests for gameplay bugs that are easy to miss in a
 * load-only smoke test. The harness executes the real browser scripts with a
 * tiny DOM facade, then calls their actual game functions and inspects state.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  setFromName(name) { this.values = new Set(String(name).split(/\s+/).filter(Boolean)); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.contains(name) : force;
    if (enabled) this.add(name); else this.remove(name);
    return enabled;
  }
}

class FakeElement {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = { setProperty() {} };
    this.classList = new FakeClassList(this);
    this._className = '';
    this._innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.clientWidth = 600;
    this.clientHeight = 500;
  }
  set className(value) { this._className = value; this.classList.setFromName(value); }
  get className() { return this._className; }
  set innerHTML(value) { this._innerHTML = value; if (value === '') this.children = []; }
  get innerHTML() { return this._innerHTML; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener() {}
  focus() {}
  remove() {}
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    // data-* attributes are reflected on dataset in the real DOM
    const m = /^data-(.+)$/.exec(name);
    if (m) this.dataset[m[1]] = String(value);
  }
  getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return name in this.attributes; }
  insertBefore(child) { this.children.unshift(child); return child; }
  replaceChildren(...nodes) { this.children = nodes; }
  querySelector() { return new FakeElement(); }
  querySelectorAll() { return []; }
  closest() { return null; }
  click() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight };
  }
  getContext() {
    const gradient = { addColorStop() {} };
    const target = {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      createPattern: () => ({ setTransform() {} }),
      measureText: () => ({ width: 10 })
    };
    return new Proxy(target, {
      get(t, property) {
        if (!(property in t)) t[property] = () => {};
        return t[property];
      },
      set(t, property, value) { t[property] = value; return true; }
    });
  }
}

function makeHarness(slug) {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, new FakeElement());
    return elements.get(id);
  };
  let seed = 0x12345678;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  let timerId = 0;
  const activeTimers = new Set();
  const storage = new Map();
  const localStorageMock = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };
  const context = {
    console,
    Math: Object.create(Math),
    performance: { now: () => 1000 },
    localStorage: localStorageMock,
    addEventListener() {},
    removeEventListener() {},
    document: {
      createElement: () => new FakeElement(),
      createElementNS: (_ns, tag) => { const el = new FakeElement(); el.tagName = tag; return el; },
      addEventListener() {},
      body: new FakeElement()
    },
    window: {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    createElementNS: (_ns, tag) => { const el = new FakeElement(); el.tagName = tag; return el; },
    setTimeout: () => { const id = ++timerId; activeTimers.add(id); return id; },
    clearTimeout: (id) => activeTimers.delete(id),
    setInterval: () => { const id = ++timerId; activeTimers.add(id); return id; },
    clearInterval: (id) => activeTimers.delete(id),
    requestAnimationFrame: () => ++timerId,
    cancelAnimationFrame() {},
    $: (selector) => getElement(selector.replace(/^#/, '')),
    $$: (selector, parent) => {
      if (parent) return parent.children;
      const match = selector.match(/^#([^ ]+) /);
      return match ? getElement(match[1]).children : [];
    },
    randInt: (min, max) => Math.floor(random() * (max - min + 1)) + min,
    pick: (items) => items[Math.floor(random() * items.length)],
    shuffle: (items) => {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    initGameFrame() {},
    burstConfetti() {},
    showModal() {},
    hideModal() {}
  };
  context.Math.random = random;
  context.window = context;
  context.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  vm.createContext(context);
  const source = readFileSync(join(root, 'games', slug, 'game.js'), 'utf8');
  vm.runInContext(source, context, { filename: `games/${slug}/game.js` });
  return { context, elements, activeTimers };
}

function run(context, source) {
  return vm.runInContext(source, context);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('all game scripts initialize without runtime errors', () => {
  const readSlugs = (file) => {
    const html = readFileSync(join(root, file), 'utf8');
    return Array.from(html.matchAll(/slug:\s*'([^']+)'/g), (match) => match[1]);
  };
  const games = [
    ...readSlugs('index.html'),
    ...readSlugs('retro-games.html')
  ];
  // Standalone third-party games have their own
  // structure and no game.js — they are smoke-tested in the browser instead.
  const standalone = ['adarkroom', 'tower-defense', 'battle-city', 'xiangqi', 'doudizhu', 'klotski', 'nes-emulator', 'monopoly', 'mahjong', 'ludo', 'cluedo', 'spider-solitaire', 'checkers', 'sudoku', 'retro-racers', 'dungeon-crawl', 'blackjack', 'backgammon', '8-ball-pool', 'gin-rummy', 'darts', 'bowling', 'crimson-tide', 'plants-vs-zombies', 'minecraft', 'genesis-emulator'];
  const toTest = games.filter((slug) => !standalone.includes(slug));
  // Every non-standalone game must ship a game.js that the harness can execute.
  const withoutScript = toTest.filter((slug) => !existsSync(join(root, 'games', slug, 'game.js')));
  assert.deepEqual(withoutScript, [], `games missing game.js: ${withoutScript.join(', ')}`);
  assert.ok(toTest.length > 0, 'no games to smoke-test');
  for (const slug of toTest) makeHarness(slug);
});

test('sliding puzzle tracks the visible empty tile and solves in standard order', () => {
  const { context } = makeHarness('sliding-puzzle');
  for (const diff of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 30; i++) {
      run(context, `init('${diff}')`);
      assert.equal(run(context, 'state.board.indexOf(0)'), run(context, 'state.empty'));
      assert.equal(run(context, 'new Set(state.board).size'), run(context, 'state.board.length'));
    }
  }
  run(context, "init('easy'); state.board = [1,2,3,4,5,6,7,0,8]; state.empty = 7; clickTile(8)");
  assert.equal(run(context, 'state.done'), true);
});

for (const [slug, first, second, assertion] of [
  ['tic-tac-toe', 'humanMove(0)', 'humanMove(1)', 'board[1] === null && aiThinking'],
  ['gomoku', 'playerMove(7, 7)', 'playerMove(7, 8)', 'state.board[7][8] === EMPTY && state.thinking'],
  ['connect-four', 'playerDrop(3)', 'playerDrop(4)', 'colHeight(4) === 0 && state.thinking']
]) {
  test(`${slug} locks player input during the computer turn`, () => {
    const { context } = makeHarness(slug);
    run(context, first);
    run(context, second);
    assert.equal(run(context, assertion), true);
  });
}

test('chess recognizes pawn attacks and preserves exact castling rights', () => {
  const { context } = makeHarness('chess');
  assert.equal(run(context, "legalMoves(state.board, 'w', state.castling, state.enPassant).length"), 20);
  assert.equal(run(context, "(() => { const b = Array.from({length:8}, () => Array(8).fill(null)); b[6][3] = 'P'; return isAttacked(b, 5, 2, 'w'); })()"), true);
  assert.equal(run(context, "(() => { const b = Array.from({length:8}, () => Array(8).fill(null)); b[1][3] = 'p'; return isAttacked(b, 2, 2, 'b'); })()"), true);
  assert.equal(run(context, "(() => { const b = Array.from({length:8}, () => Array(8).fill(null)); b[6][6] = 'b'; b[7][7] = 'R'; return applyMove(b, {r:6,c:6}, {r:7,c:7}, {K:true,Q:true,k:true,q:true}, null).castling.K; })()"), false);
  assert.equal(run(context, "(() => { const b = Array.from({length:8}, () => Array(8).fill(null)); b[4][6] = 'N'; return applyMove(b, {r:4,c:6}, {r:4,c:7}, {K:true,Q:true,k:true,q:true}, null).castling.K; })()"), true);
});

test('match-three always starts without matches and with a legal move', () => {
  const { context } = makeHarness('match-three');
  for (const diff of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 30; i++) {
      run(context, `init('${diff}')`);
      assert.equal(run(context, 'findMatches().size'), 0);
      assert.equal(run(context, 'hasMove()'), true);
    }
  }
});

test('pair-link always starts with at least one connectable pair', () => {
  const { context } = makeHarness('pair-link');
  for (const diff of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 20; i++) {
      run(context, `init('${diff}')`);
      assert.equal(run(context, 'hasMove()'), true);
    }
  }
});

test('color-match highlights the right answer after a wrong click', () => {
  const { context } = makeHarness('color-match');
  const wrongIndex = run(context, 'state.options.findIndex((hex) => hex !== state.target.hex)');
  run(context, `choose(state.options[${wrongIndex}], $('#options').children[${wrongIndex}])`);
  assert.equal(run(context, "$('#options').children.find((button) => button.dataset.hex === state.target.hex).classList.contains('correct')"), true);
});

test('wordle locks input while evaluating a submitted row', () => {
  const { context } = makeHarness('wordle');
  run(context, "state.current = 'APPLE'; submit(); typeLetter('Z')");
  assert.equal(run(context, 'state.locked'), true);
  assert.equal(run(context, 'state.current'), '');
});

test('every Sokoban level has a reachable solution', () => {
  const { context } = makeHarness('sokoban');
  const levelCount = run(context, 'LEVELS.length');
  for (let level = 0; level < levelCount; level++) {
    const parsed = JSON.parse(run(context, `JSON.stringify(parseLevel(${level}))`));
    const startBoxes = parsed.boxes.map(({ r, c }) => `${r},${c}`).sort();
    const encode = (player, boxes) => `${player.r},${player.c}|${boxes.join(';')}`;
    const queue = [{ player: parsed.player, boxes: startBoxes }];
    const seen = new Set([encode(parsed.player, startBoxes)]);
    let solved = false;
    for (let head = 0; head < queue.length && head < 100000; head++) {
      const current = queue[head];
      if (current.boxes.every((key) => {
        const [r, c] = key.split(',').map(Number);
        return parsed.terrain[r][c] === '.';
      })) { solved = true; break; }
      const occupied = new Set(current.boxes);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = current.player.r + dr;
        const nc = current.player.c + dc;
        if (!parsed.terrain[nr] || parsed.terrain[nr][nc] === '#') continue;
        const nextBoxes = current.boxes.slice();
        const boxKey = `${nr},${nc}`;
        if (occupied.has(boxKey)) {
          const br = nr + dr;
          const bc = nc + dc;
          const pushedKey = `${br},${bc}`;
          if (!parsed.terrain[br] || parsed.terrain[br][bc] === '#' || occupied.has(pushedKey)) continue;
          nextBoxes[nextBoxes.indexOf(boxKey)] = pushedKey;
          nextBoxes.sort();
        }
        const nextPlayer = { r: nr, c: nc };
        const key = encode(nextPlayer, nextBoxes);
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ player: nextPlayer, boxes: nextBoxes });
        }
      }
    }
    assert.equal(solved, true, `Sokoban level ${level + 1} should be solvable`);
  }
});

/* ---------------------------------------------------------------------------
 * Regressions for bugs found during the full-catalog QA pass.
 * Each one locks in a fix that was previously broken on disk.
 * ------------------------------------------------------------------------- */

test('nonogram mounts its grid cells into the board', () => {
  const { context, elements } = makeHarness('nonogram');
  const board = elements.get('nonogram');
  assert.ok(board, 'nonogram board element should exist');
  // The cells used to be created and pushed into an array but never appended,
  // which left the puzzle with no clickable squares at all.
  const cells = board.children.filter((el) => el.classList.contains('cell'));
  assert.ok(cells.length > 0, 'nonogram must render clickable cells');
  const clues = board.children.filter((el) => el.classList.contains('clue'));
  assert.ok(clues.length > 0, 'nonogram must render clue boxes');
});

test('slitherlink starts from an empty grid, not a solved puzzle', () => {
  const { context, elements } = makeHarness('slitherlink');
  // The generated loop was being assigned straight to the player's H/V arrays,
  // so every puzzle opened already complete.
  const on = run(context, `(() => {
    let n = 0;
    for (let r = 0; r <= ${5}; r++) for (let c = 0; c < ${5}; c++) if (H[r][c]) n++;
    for (let r = 0; r < ${5}; r++) for (let c = 0; c <= ${5}; c++) if (V[r][c]) n++;
    return n;
  })()`);
  assert.equal(on, 0, 'slitherlink should start with no lines drawn');
  const clues = run(context, 'clues.flat().filter((n) => n > 0).length');
  assert.ok(clues > 0, 'slitherlink should still generate clues');
});

test('bomberman starts with a full set of lives', () => {
  const { context } = makeHarness('bomberman');
  // Enemies used to be able to spawn on the player's tile, so the game hit
  // game-over on the first frame with zero lives.
  assert.equal(run(context, 'lives'), 3, 'bomberman should start with 3 lives');
  const overlaps = run(context, `enemies.filter((e) => e.c === player.c && e.r === player.r).length`);
  assert.equal(overlaps, 0, 'no enemy may spawn on the player tile');
});

test('zuma never grows its chain when a shot misses a match', () => {
  const { context } = makeHarness('zuma');
  const start = run(context, 'chain.length');
  assert.ok(start > 0, 'zuma should start with marbles');
  // Fire a marble that cannot match (colour forced to differ from both neighbours).
  const after = run(context, `(() => {
    const before = chain.length;
    chain[0].c = '#ff6b6b'; chain[1].c = '#4dabf7'; chain[2].c = '#ffd43b';
    insertBall(1);
    return { before, after: chain.length };
  })()`);
  assert.ok(after.after <= after.before,
    `chain must not grow on a non-matching insert (was ${after.before}, now ${after.after})`);
});

test('farkle scores the standard combinations', () => {
  const { context } = makeHarness('farkle');
  const cases = [
    [[1], 100], [[5], 50], [[1, 5], 150], [[2], 0],
    [[1, 1, 1], 1000], [[2, 2, 2], 200], [[3, 3, 3, 3], 1000],
    [[5, 5, 5, 5, 5], 2000], [[1, 1, 1, 1, 1, 1], 3000],
    [[1, 2, 3, 4, 5, 6], 1500], [[1, 1, 2, 2, 3, 3], 1500],
    [[1, 1, 1, 2, 2, 2], 2500], [[2, 3, 4, 6], 0]
  ];
  for (const [dice, expected] of cases) {
    const got = run(context, `scoreHand(${JSON.stringify(dice)})`);
    assert.equal(got, expected, `scoreHand(${dice.join('')}) should be ${expected}, got ${got}`);
  }
});

test('every page ships exactly one title, description and canonical', () => {
  const pages = ['index.html', 'retro-games.html'];
  for (const dir of readdirSync(join(root, 'games'), { withFileTypes: true })) {
    if (dir.isDirectory()) pages.push(join('games', dir.name, 'index.html'));
  }
  for (const rel of pages) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    const html = readFileSync(p, 'utf8');
    const count = (re) => (html.match(re) || []).length;
    assert.equal(count(/<title>/g), 1, `${rel} should have exactly one <title>`);
    assert.equal(count(/<meta\s+name="description"/g), 1, `${rel} should have exactly one description`);
    assert.equal(count(/rel="canonical"/g), 1, `${rel} should have exactly one canonical link`);
  }
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures++;
    console.error(`✗ ${name}`);
    console.error(error.stack || error);
  }
}

if (failures) {
  console.error(`\n${failures} regression test${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log(`\n${tests.length} targeted gameplay regressions passed.`);
