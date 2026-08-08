#!/usr/bin/env node
/**
 * Targeted regression tests for gameplay bugs that are easy to miss in a
 * load-only smoke test. The harness executes the real browser scripts with a
 * tiny DOM facade, then calls their actual game functions and inspects state.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight };
  }
  getContext() {
    return new Proxy({}, {
      get(target, property) {
        if (!(property in target)) target[property] = () => {};
        return target[property];
      },
      set(target, property, value) { target[property] = value; return true; }
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
  const context = {
    console,
    Math: Object.create(Math),
    performance: { now: () => 1000 },
    document: {
      createElement: () => new FakeElement(),
      addEventListener() {},
      body: new FakeElement()
    },
    window: {},
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

test('all 36 game scripts initialize without runtime errors', () => {
  const slugs = readFileSync(join(root, 'index.html'), 'utf8')
    .matchAll(/slug:\s*'([^']+)'/g);
  const games = Array.from(slugs, (match) => match[1]);
  assert.equal(games.length, 36);
  for (const slug of games) makeHarness(slug);
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
