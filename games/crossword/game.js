'use strict';

/* Kid crossword — 10 easy words on a compact grid.
   Layout is fixed; clue numbers are computed from word-start cells. */
const LAYOUT = [
  { word: 'BIRD', clue: 'An animal with wings that can fly', r: 0, c: 0, dir: 'D' },
  { word: 'FISH', clue: 'A slippery animal that swims in water', r: 0, c: 2, dir: 'A' },
  { word: 'FROG', clue: 'A green hopping animal that says ribbit', r: 0, c: 2, dir: 'D' },
  { word: 'STAR', clue: 'A twinkling light in the night sky', r: 0, c: 4, dir: 'D' },
  { word: 'BOOK', clue: 'Stacked pages you read for a story', r: 1, c: 1, dir: 'D' },
  { word: 'SUN', clue: 'The bright light that warms the daytime', r: 1, c: 7, dir: 'D' },
  { word: 'CAT', clue: 'A furry pet that says meow', r: 2, c: 5, dir: 'D' },
  { word: 'DOG', clue: 'A loyal pet that barks and fetches', r: 3, c: 0, dir: 'A' },
  { word: 'RAIN', clue: 'Water that falls down from the clouds', r: 3, c: 4, dir: 'A' },
  { word: 'TREE', clue: 'A tall plant with a trunk and leafy branches', r: 4, c: 5, dir: 'A' }
];

const ROWS = 5, COLS = 9;
const STORAGE_KEY = 'best-crossword';

const boardEl = $('#board');
const acrossList = $('#across-list');
const downList = $('#down-list');
const padEl = $('#letter-pad');
const checkBtn = $('#check-btn');
const correctEl = $('#correct-count');
const totalEl = $('#total-count');
const bestEl = $('#best-count');

let cells = new Map();
let words = [];
let selected = null;
let activeWord = -1;
let checks = 0;
let correctCount = 0;

const keyOf = (r, c) => r + ',' + c;

/* ---------- Puzzle building ---------- */
function buildPuzzle() {
  cells = new Map();
  words = LAYOUT.map((w) => ({ word: w.word, clue: w.clue, r: w.r, c: w.c, dir: w.dir, cells: [], number: 0 }));

  words.forEach((w) => {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.r + (w.dir === 'D' ? i : 0);
      const c = w.c + (w.dir === 'A' ? i : 0);
      const k = keyOf(r, c);
      const cell = cells.get(k) || { r, c, answer: w.word[i], words: [], number: 0, value: '', el: null };
      cell.words.push(words.indexOf(w));
      cells.set(k, cell);
      w.cells.push(k);
    }
  });

  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = cells.get(keyOf(r, c));
      if (!cell) continue;
      const isStart = cell.words.some((wi) => words[wi].r === r && words[wi].c === c);
      if (isStart) cell.number = ++n;
    }
  }
  words.forEach((w) => { w.number = cells.get(keyOf(w.r, w.c)).number; });
}

/* ---------- Rendering ---------- */
function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = cells.get(keyOf(r, c));
      const el = document.createElement('div');
      if (!cell) {
        el.className = 'cell black';
        el.setAttribute('aria-hidden', 'true');
        boardEl.appendChild(el);
        continue;
      }
      el.className = 'cell';
      el.dataset.key = keyOf(r, c);
      el.setAttribute('role', 'gridcell');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', 'Square ' + cell.number);
      el.innerHTML = '<span class="num">' + cell.number + '</span><span class="letter"></span>';
      el.addEventListener('click', () => selectCell(keyOf(r, c)));
      cell.el = el;
      boardEl.appendChild(el);
    }
  }
}

function renderClues() {
  acrossList.innerHTML = '';
  downList.innerHTML = '';
  const sorted = words.slice().sort((a, b) => a.number - b.number);
  sorted.forEach((w) => {
    const li = document.createElement('li');
    li.className = 'clue';
    li.innerHTML = '<span class="n">' + w.number + '.</span>' + w.clue;
    li.addEventListener('click', () => selectCell(w.cells[0], words.indexOf(w)));
    w.clueEl = li;
    (w.dir === 'A' ? acrossList : downList).appendChild(li);
  });
}

function renderLetterPad() {
  padEl.innerHTML = '';
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.type = 'button';
    btn.textContent = letter;
    btn.addEventListener('click', () => putLetter(letter));
    padEl.appendChild(btn);
  }
  const del = document.createElement('button');
  del.className = 'letter-btn del';
  del.type = 'button';
  del.textContent = '⌫';
  del.addEventListener('click', () => removeLetter());
  padEl.appendChild(del);
}

/* ---------- Selection & highlighting ---------- */
function selectCell(k, forceWord) {
  const cell = cells.get(k);
  if (!cell) return;
  selected = k;

  if (forceWord !== undefined) {
    activeWord = forceWord;
  } else {
    const across = cell.words.find((wi) => words[wi].dir === 'A');
    activeWord = across !== undefined ? across : cell.words[0];
  }

  cells.forEach((c) => {
    if (!c.el) return;
    c.el.classList.remove('active', 'in-word');
  });
  const word = words[activeWord];
  word.cells.forEach((wk) => cells.get(wk).el.classList.add('in-word'));
  cell.el.classList.add('active');

  words.forEach((w) => { if (w.clueEl) w.clueEl.classList.remove('active'); });
  if (word.clueEl) word.clueEl.classList.add('active');
}

function putLetter(letter) {
  if (!selected) return;
  const cell = cells.get(selected);
  if (!cell) return;
  cell.value = letter;
  cell.el.querySelector('.letter').textContent = letter;
  cell.el.classList.remove('correct', 'wrong');

  const word = words[activeWord];
  const pos = word.cells.indexOf(selected);
  if (pos >= 0 && pos + 1 < word.cells.length) selectCell(word.cells[pos + 1], activeWord);
}

function removeLetter() {
  if (!selected) return;
  const cell = cells.get(selected);
  if (!cell) return;
  cell.value = '';
  cell.el.querySelector('.letter').textContent = '';
  cell.el.classList.remove('correct', 'wrong');

  const word = words[activeWord];
  const pos = word.cells.indexOf(selected);
  if (pos > 0) selectCell(word.cells[pos - 1], activeWord);
}

/* ---------- Checking ---------- */
function checkAnswers() {
  checks++;
  correctCount = 0;
  cells.forEach((cell) => {
    if (!cell.el) return;
    cell.el.classList.remove('correct', 'wrong');
    if (!cell.value) return;
    if (cell.value === cell.answer) {
      cell.el.classList.add('correct');
      correctCount++;
    } else {
      cell.el.classList.add('wrong');
    }
  });
  updateStats();

  if (correctCount === cells.size) {
    const best = getBest();
    if (best === null || checks < best) setBest(checks);
    updateStats();
    burstConfetti();
    showModal('🎉 You Win!', 'Every letter is correct — you filled the whole crossword in ' + checks + ' checks!', 'Play Again', newGame);
  }
}

/* ---------- Stats & best score ---------- */
function getBest() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : Number(raw);
}

function setBest(value) {
  localStorage.setItem(STORAGE_KEY, String(value));
}

function updateStats() {
  correctEl.textContent = correctCount;
  totalEl.textContent = cells.size;
  const best = getBest();
  bestEl.textContent = best === null ? '–' : best;
}

/* ---------- New game ---------- */
function newGame() {
  selected = null;
  activeWord = -1;
  checks = 0;
  correctCount = 0;
  buildPuzzle();
  renderBoard();
  renderClues();
  updateStats();
}

document.addEventListener('keydown', (e) => {
  if (!$('#modal').classList.contains('hidden')) return;
  if (e.key === 'Backspace') {
    e.preventDefault();
    removeLetter();
    return;
  }
  if (/^[a-zA-Z]$/.test(e.key)) putLetter(e.key.toUpperCase());
});

checkBtn.addEventListener('click', checkAnswers);

renderLetterPad();
newGame();

initGameFrame({
  title: 'Crossword',
  emoji: '📝',
  onRestart: newGame
});
