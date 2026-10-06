'use strict';

const SIZE = 10;
const WORDS = ['CAT', 'DOG', 'SUN', 'FISH', 'TREE', 'BOOK', 'STAR', 'RAIN'];
const BEST_KEY = 'best-word-search';

const boardEl = $('#board');
const listEl = $('#word-list');
const foundEl = $('#found-count');
const bestEl = $('#best-count');

let grid, placements, foundWords, firstPick, attempts;

const idx = (r, c) => r * SIZE + c;
const cellAt = (i) => boardEl.children[i];

// ---------- Board generation ----------
function placeWord(word) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const [dr, dc] = pick([[1, 0], [0, 1], [1, 1]]);
    const r0 = randInt(0, SIZE - 1);
    const c0 = randInt(0, SIZE - 1);
    const cells = [];
    let ok = true;
    for (let k = 0; k < word.length; k++) {
      const r = r0 + dr * k, c = c0 + dc * k;
      if (r >= SIZE || c >= SIZE) { ok = false; break; }
      const i = idx(r, c);
      if (grid[i] && grid[i] !== word[k]) { ok = false; break; }
      cells.push(i);
    }
    if (ok) {
      cells.forEach((i, k) => { grid[i] = word[k]; });
      placements.push({ word, cells });
      return true;
    }
  }
  return false;
}

function buildGrid() {
  for (let guard = 0; guard < 100; guard++) {
    grid = Array(SIZE * SIZE).fill('');
    placements = [];
    let ok = true;
    for (const w of shuffle(WORDS)) {
      if (!placeWord(w)) { ok = false; break; }
    }
    if (ok) break;
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  grid = grid.map((ch) => ch || letters[randInt(0, 25)]);
}

// ---------- Rendering ----------
function renderBoard() {
  boardEl.innerHTML = '';
  grid.forEach((ch) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = ch;
    boardEl.appendChild(cell);
  });
}

function renderList() {
  listEl.innerHTML = '';
  WORDS.forEach((w) => {
    const li = document.createElement('li');
    li.textContent = w;
    li.dataset.word = w;
    listEl.appendChild(li);
  });
}

function updateStats() {
  foundEl.textContent = foundWords.size;
  const best = localStorage.getItem(BEST_KEY);
  bestEl.textContent = best ? best : '—';
}

// ---------- Gameplay ----------
function checkLine(a, b) {
  const ra = Math.floor(a / SIZE), ca = a % SIZE;
  const rb = Math.floor(b / SIZE), cb = b % SIZE;
  const straight = (ra === rb) || (ca === cb) || (Math.abs(rb - ra) === Math.abs(cb - ca));
  if (!straight) return null;
  const dr = Math.sign(rb - ra), dc = Math.sign(cb - ca);
  const len = Math.max(Math.abs(rb - ra), Math.abs(cb - ca)) + 1;
  const cells = [];
  for (let k = 0; k < len; k++) cells.push(idx(ra + dr * k, ca + dc * k));
  const letters = cells.map((i) => grid[i]).join('');
  const rev = letters.split('').reverse().join('');
  for (const p of placements) {
    if (foundWords.has(p.word)) continue;
    if (p.word === letters || p.word === rev) return { word: p.word, cells };
  }
  return null;
}

function clearSelection() {
  if (firstPick !== null) cellAt(firstPick).classList.remove('selected');
  firstPick = null;
}

function flashWrong(i) {
  const el = cellAt(i);
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 350);
}

function onCellClick(i) {
  if (foundWords.size >= WORDS.length) return;

  if (firstPick === null) {
    firstPick = i;
    cellAt(i).classList.add('selected');
    return;
  }
  if (firstPick === i) { clearSelection(); return; }

  attempts++;
  const match = checkLine(firstPick, i);
  const a = firstPick;
  clearSelection();

  if (match) {
    match.cells.forEach((c) => cellAt(c).classList.add('found'));
    foundWords.add(match.word);
    const li = listEl.querySelector(`[data-word="${match.word}"]`);
    if (li) li.classList.add('done');
    updateStats();
    if (foundWords.size >= WORDS.length) win();
  } else {
    flashWrong(a);
    flashWrong(i);
  }
}

function win() {
  const best = parseInt(localStorage.getItem(BEST_KEY), 10);
  if (!best || attempts < best) localStorage.setItem(BEST_KEY, String(attempts));
  updateStats();
  burstConfetti();
  showModal('🎉 You Win!', `You found all 8 words in ${attempts} tries! Fewest tries wins the Best score.`, 'Play Again', startGame);
}

function startGame() {
  foundWords = new Set();
  attempts = 0;
  firstPick = null;
  buildGrid();
  renderBoard();
  renderList();
  updateStats();
}

boardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  onCellClick(Array.from(boardEl.children).indexOf(cell));
});

initGameFrame({
  title: 'Word Search',
  emoji: '🔍',
  onRestart: startGame
});

startGame();
