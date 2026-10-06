/* ============================================================
   Nonogram (Picross) 🎨 — game logic
   ============================================================ */
'use strict';

const BEST_KEY = 'best-nonogram';

const PUZZLES = [
  { name: 'Heart', art: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'] },
  { name: 'Star', art: ['..X..', '.XXX.', 'XXXXX', '.X.X.', 'X...X'] },
  { name: 'Cat', art: ['X....X', 'XX..XX', 'XXXXXX', 'XXXXXX', 'XXXXXX', '.X.X.X'] },
  { name: 'Fish', art: ['X.....', '.XXXXX', '..XXXX', '..XXXX', '.XXXXX', 'X.....'] },
  { name: 'Tree', art: ['..XXXX', '.XXXXX', 'XXXXXX', '.XXXXX', '..X...', '..X...'] },
  { name: 'House', art: ['..XXXX', '.XXXXX', 'XXXXXX', '.X..X.', '.X..X.', 'XXXXXX'] }
];

const boardEl = $('#nonogram');
const nameEl = $('#picture-name');
const filledEl = $('#filled-count');
const rowsEl = $('#solved-rows');
const clicksEl = $('#click-count');
const bestEl = $('#best-score');

let puzzle, size, cells, clicks, won;
let rowClues = [], colClues = [];
let rowClueEls = [], colClueEls = [], cellEls = [];
let pressTimer = null, longFired = false;

// ---------- Clues ----------
function runsOf(line) {
  const runs = [];
  let count = 0;
  for (const ch of line) {
    if (ch === 'X') count++;
    else if (count) { runs.push(count); count = 0; }
  }
  if (count) runs.push(count);
  return runs;
}

function computeClues() {
  rowClues = puzzle.art.map(runsOf);
  colClues = [];
  for (let c = 0; c < size; c++) {
    colClues.push(runsOf(puzzle.art.map((row) => row[c]).join('')));
  }
}

// ---------- Board building ----------
function clueEl(clues, isCol, idx) {
  const el = document.createElement('div');
  el.className = 'clue';
  clues.forEach((n) => {
    const span = document.createElement('span');
    span.textContent = n;
    el.appendChild(span);
  });
  if ((idx + 1) % 5 === 0) el.classList.add(isCol ? 'edge-right' : 'edge-bottom');
  return el;
}

function buildBoard() {
  boardEl.innerHTML = '';
  boardEl.classList.remove('solved');
  boardEl.style.gridTemplateColumns = `var(--clue-size) repeat(${size}, var(--cell-size))`;

  const corner = document.createElement('div');
  corner.className = 'corner';
  boardEl.appendChild(corner);

  colClueEls = [];
  for (let c = 0; c < size; c++) {
    const el = clueEl(colClues[c], true, c);
    colClueEls.push(el);
    boardEl.appendChild(el);
  }

  rowClueEls = [];
  cellEls = [];
  for (let r = 0; r < size; r++) {
    const rowClue = clueEl(rowClues[r], false, r);
    rowClueEls.push(rowClue);
    boardEl.appendChild(rowClue);
    for (let c = 0; c < size; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if ((c + 1) % 5 === 0) cell.classList.add('edge-right');
      if ((r + 1) % 5 === 0) cell.classList.add('edge-bottom');
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        markCell(r * size + c);
      });
      cell.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        longFired = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          longFired = true;
          markCell(r * size + c);
        }, 600);
      });
      cell.addEventListener('click', (e) => {
        if (e.button !== 0 || longFired) return;
        fillToggle(r * size + c);
      });
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }
}

// ---------- Cell actions ----------
function renderCell(idx) {
  const el = cellEls[idx];
  el.classList.remove('filled', 'marked');
  if (cells[idx] === 'filled') {
    el.classList.add('filled');
    el.textContent = '';
  } else if (cells[idx] === 'mark') {
    el.classList.add('marked');
    el.textContent = '❌';
  } else {
    el.textContent = '';
  }
}

function fillToggle(idx) {
  if (won) return;
  cells[idx] = cells[idx] === 'filled' ? 'empty' : 'filled';
  clicks++;
  renderCell(idx);
  refresh();
}

function markCell(idx) {
  if (won) return;
  cells[idx] = cells[idx] === 'mark' ? 'empty' : 'mark';
  clicks++;
  renderCell(idx);
  refresh();
}

// ---------- Checking ----------
function lineRuns(lineIdx, isCol) {
  let s = '';
  for (let i = 0; i < size; i++) {
    const idx = isCol ? i * size + lineIdx : lineIdx * size + i;
    s += cells[idx] === 'filled' ? 'X' : '.';
  }
  return runsOf(s);
}

function sameRuns(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function refresh() {
  let filled = 0, solvedRows = 0;
  rowClues.forEach((clues, r) => {
    const ok = sameRuns(lineRuns(r, false), clues);
    rowClueEls[r].classList.toggle('satisfied', ok);
    if (ok) solvedRows++;
  });
  colClues.forEach((clues, c) => {
    colClueEls[c].classList.toggle('satisfied', sameRuns(lineRuns(c, true), clues));
  });
  cells.forEach((state) => { if (state === 'filled') filled++; });

  filledEl.textContent = filled;
  rowsEl.textContent = solvedRows;
  clicksEl.textContent = clicks;

  if (solvedRows === size && colClues.every((clues, c) => sameRuns(lineRuns(c, true), clues))) win();
}

// ---------- Best score ----------
function loadBest() {
  const raw = localStorage.getItem(BEST_KEY);
  return raw ? parseInt(raw, 10) : null;
}

function showBest() {
  const best = loadBest();
  bestEl.textContent = best === null ? '—' : best + ' clicks';
}

// ---------- Win ----------
function win() {
  won = true;
  nameEl.textContent = '🎉 ' + puzzle.name;
  boardEl.classList.add('solved');
  const best = loadBest();
  if (best === null || clicks < best) {
    localStorage.setItem(BEST_KEY, String(clicks));
    showBest();
    showModal('🎉 You Win!', `You painted the ${puzzle.name} in ${clicks} clicks — a new best score!`, 'Play Again', startGame);
  } else {
    showModal('🎉 You Win!', `You painted the ${puzzle.name} in ${clicks} clicks. Best: ${best} clicks.`, 'Play Again', startGame);
  }
  burstConfetti();
}

// ---------- Game start ----------
function startGame() {
  puzzle = pick(PUZZLES);
  size = puzzle.art.length;
  cells = new Array(size * size).fill('empty');
  clicks = 0;
  won = false;
  nameEl.textContent = '❓ ???';
  computeClues();
  buildBoard();
  showBest();
  refresh();
}

initGameFrame({
  title: 'Nonogram (Picross)',
  emoji: '🎨',
  onRestart: startGame
});

startGame();
