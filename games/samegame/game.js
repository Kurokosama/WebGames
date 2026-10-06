'use strict';

/* SameGame (Star Pop) — pop groups of matching stars. */

const SIZE = 8;
const COLORS = 6;
const BEST_KEY = 'best-samegame';
const POP_MS = 260;

const boardEl = $('#board');
const scoreEl = $('#score');
const bestEl = $('#best');
const hintEl = $('#hint');

let grid = [];
let score = 0;
let best = 0;
let armed = [];
let busy = false;
let over = false;
const touchPrimary = window.matchMedia('(hover: none)').matches;

/* ---------- state ---------- */

function newBoard() {
  grid = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) row.push(randInt(0, COLORS - 1));
    grid.push(row);
  }
}

function groupAt(r, c) {
  const color = grid[r][c];
  if (color === null) return [];
  const seen = new Set([r + ':' + c]);
  const stack = [[r, c]];
  const out = [];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    out.push([cr, cc]);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
      const nr = cr + dr, nc = cc + dc;
      if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE) return;
      const key = nr + ':' + nc;
      if (seen.has(key) || grid[nr][nc] !== color) return;
      seen.add(key);
      stack.push([nr, nc]);
    });
  }
  return out;
}

function gravityAndShift() {
  for (let c = 0; c < SIZE; c++) {
    for (let r = SIZE - 1; r >= 0; r--) {
      if (grid[r][c] === null) {
        for (let src = r - 1; src >= 0; src--) {
          if (grid[src][c] !== null) {
            grid[r][c] = grid[src][c];
            grid[src][c] = null;
            break;
          }
        }
      }
    }
  }
  const cols = [];
  for (let c = 0; c < SIZE; c++) {
    if (grid.some((row) => row[c] !== null)) cols.push(c);
  }
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE; r++) grid[r][c] = c < cols.length ? grid[r][cols[c]] : null;
  }
}

function boardEmpty() {
  return grid.every((row) => row.every((v) => v === null));
}

function anyMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== null && groupAt(r, c).length >= 2) return true;
    }
  }
  return false;
}

/* ---------- rendering ---------- */

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      const v = grid[r][c];
      if (v === null) {
        cell.classList.add('empty');
      } else {
        cell.classList.add('tile', 'c' + v);
        cell.textContent = '★';
      }
      boardEl.appendChild(cell);
    }
  }
}

function cellAt(r, c) {
  return boardEl.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
}

function highlight(group) {
  $$('.cell.hl', boardEl).forEach((el) => el.classList.remove('hl'));
  group.forEach(([r, c]) => {
    const el = cellAt(r, c);
    if (el) el.classList.add('hl');
  });
}

function setHint(text, scored) {
  hintEl.textContent = text;
  hintEl.classList.toggle('scored', !!scored);
}

function updateScore() {
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
  }
  bestEl.textContent = best;
}

/* ---------- gameplay ---------- */

function sameGroup(group) {
  return group.length === armed.length && group.every(([r, c]) => armed.some(([ar, ac]) => ar === r && ac === c));
}

function popGroup(group) {
  if (busy || over || group.length < 2) return;
  busy = true;
  const points = group.length * (group.length - 1);
  score += points;
  updateScore();
  setHint('Pop! +' + points + ' points ⭐', true);

  group.forEach(([r, c]) => {
    const el = cellAt(r, c);
    if (el) { el.classList.remove('hl'); el.classList.add('pop'); }
  });

  setTimeout(() => {
    group.forEach(([r, c]) => { grid[r][c] = null; });
    armed = [];
    gravityAndShift();
    render();
    busy = false;

    if (boardEmpty()) {
      over = true;
      score += 1000;
      updateScore();
      burstConfetti();
      showModal('🎉 You Win!', 'Every star popped! +1000 bonus — final score ' + score + '.', 'Play Again');
    } else if (!anyMove()) {
      over = true;
      showModal('No more stars to pop', 'Score ' + score + '. Best ' + best + '. Try bigger groups next time!', 'Play Again');
    } else {
      setHint('Pick a group of matching stars to pop them!');
    }
  }, POP_MS);
}

function handleClick(r, c) {
  if (busy || over) return;
  if (grid[r][c] === null) return;
  const group = groupAt(r, c);
  if (group.length < 2) {
    const el = cellAt(r, c);
    if (el) {
      el.classList.add('no-group');
      setTimeout(() => el.classList.remove('no-group'), 320);
    }
    setHint('That star is alone — find 2 or more that touch!');
    return;
  }
  if (touchPrimary) {
    if (sameGroup(group)) { popGroup(group); return; }
    armed = group;
    highlight(group);
    setHint('Group of ' + group.length + ' → +' + (group.length * (group.length - 1)) + ' points. Tap again to pop!');
    return;
  }
  popGroup(group);
}

boardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  handleClick(Number(cell.dataset.r), Number(cell.dataset.c));
});

boardEl.addEventListener('pointerover', (e) => {
  if (touchPrimary || busy || over) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const group = groupAt(Number(cell.dataset.r), Number(cell.dataset.c));
  if (group.length >= 2) {
    highlight(group);
    setHint('Group of ' + group.length + ' → +' + (group.length * (group.length - 1)) + ' points');
  } else {
    highlight([]);
    setHint('Pick a group of matching stars to pop them!');
  }
});

boardEl.addEventListener('pointerleave', () => {
  if (touchPrimary || busy || over) return;
  highlight([]);
  setHint('Pick a group of matching stars to pop them!');
});

/* ---------- start ---------- */

function start() {
  busy = false;
  over = false;
  armed = [];
  score = 0;
  hideModal();
  newBoard();
  render();
  updateScore();
  setHint('Pick a group of matching stars to pop them!');
}

try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }

initGameFrame({
  title: 'SameGame (Star Pop)',
  emoji: '⭐',
  onRestart: start
});

start();
