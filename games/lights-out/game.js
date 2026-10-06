'use strict';

const SIZE = 5;
const CELLS = SIZE * SIZE;
const SCRAMBLE = { easy: 5, medium: 8, hard: 12 };
const BEST_KEY = 'best-lights-out';

let difficulty = 'easy';
let board = new Array(CELLS).fill(false);
let moves = 0;
let best = readBest();
let locked = false;

function readBest() {
  const n = parseInt(localStorage.getItem(BEST_KEY), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// A bulb plus its four orthogonal neighbours.
function affectedCells(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const cells = [index];
  if (row > 0) cells.push(index - SIZE);
  if (row < SIZE - 1) cells.push(index + SIZE);
  if (col > 0) cells.push(index - 1);
  if (col < SIZE - 1) cells.push(index + 1);
  return cells;
}

function buildBoard() {
  const wrap = $('#board');
  wrap.innerHTML = '';
  for (let i = 0; i < CELLS; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bulb';
    btn.setAttribute('aria-label', 'Bulb ' + (i + 1));
    btn.addEventListener('click', () => pressBulb(i));
    wrap.appendChild(btn);
  }
}

function paint() {
  $$('#board .bulb').forEach((btn, i) => {
    btn.classList.toggle('on', board[i]);
    btn.setAttribute('aria-pressed', String(board[i]));
  });
}

function updateStats() {
  $('#moves').textContent = moves;
  $('#best').textContent = best === null ? '—' : best;
}

// Scramble by applying N distinct clicks to the solved (all-off) board,
// which guarantees the puzzle is solvable in at most N moves.
function scramble() {
  const count = SCRAMBLE[difficulty];
  for (let attempt = 0; attempt < 40; attempt++) {
    board = new Array(CELLS).fill(false);
    const clicks = shuffle(Array.from({ length: CELLS }, (_, i) => i)).slice(0, count);
    clicks.forEach((i) => affectedCells(i).forEach((c) => { board[c] = !board[c]; }));
    if (board.some(Boolean)) return;
  }
}

function newGame(diff) {
  difficulty = diff;
  moves = 0;
  locked = false;
  hideModal();
  $('#board').classList.remove('won');
  scramble();
  paint();
  updateStats();
}

function pressBulb(index) {
  if (locked) return;

  const lit = $$('#board .bulb');
  const touched = affectedCells(index);
  touched.forEach((c) => {
    board[c] = !board[c];
    const btn = lit[c];
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 320);
  });

  moves++;
  paint();
  updateStats();

  if (!board.some(Boolean)) win();
}

function win() {
  locked = true;
  const previousBest = best;
  const isRecord = best === null || moves < best;
  if (isRecord) {
    best = moves;
    localStorage.setItem(BEST_KEY, String(best));
  }

  $('#board').classList.add('won');
  burstConfetti();

  const text = isRecord
    ? `Every bulb is off in ${moves} moves — a new record!`
    : `Every bulb is off in ${moves} moves. Your best is still ${best} moves.`;

  showModal('🎉 You Win!', text, 'Play Again', () => newGame(difficulty));
}

initGameFrame({
  title: 'Lights Out',
  emoji: '💡',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => newGame(d),
  onRestart: () => newGame(difficulty)
});

buildBoard();
newGame('easy');
