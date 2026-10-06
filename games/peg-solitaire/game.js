'use strict';

const SIZE = 7;
const CELLS = SIZE * SIZE;
const BEST_KEY = 'best-peg-solitaire';
const UNDO_LIMIT = { easy: Infinity, medium: 10, hard: 3 };

let difficulty = 'easy';
let board = new Array(CELLS).fill(null);
let selected = -1;
let moves = 0;
let undosLeft = 0;
let history = [];
let best = readBest();
let locked = false;

// Classic English cross: rows 0,1,5,6 have holes in columns 2-4; rows 2-4 are full.
function inCross(r, c) {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
  if (r === 0 || r === 1 || r === 5 || r === 6) return c >= 2 && c <= 4;
  return true;
}

const CROSS = Array.from({ length: CELLS }, (_, i) => inCross(Math.floor(i / SIZE), i % SIZE));

function readBest() {
  const n = parseInt(localStorage.getItem(BEST_KEY), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildBoard() {
  const wrap = $('#board');
  wrap.innerHTML = '';
  for (let i = 0; i < CELLS; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    if (!CROSS[i]) {
      cell.className = 'cell off-board';
      cell.disabled = true;
    } else {
      cell.className = 'cell hole';
      cell.setAttribute('aria-label', 'Hole ' + (i + 1));
      cell.addEventListener('click', () => clickCell(i));
    }
    wrap.appendChild(cell);
  }
}

function pegCount() {
  return CROSS.reduce((n, ok, i) => n + (ok && board[i] ? 1 : 0), 0);
}

// Empty holes two squares away with a peg in between.
function jumpsFrom(index) {
  const r = Math.floor(index / SIZE);
  const c = index % SIZE;
  const targets = [];
  [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (!inCross(nr, nc)) return;
    const mid = (r + dr / 2) * SIZE + (c + dc / 2);
    const to = nr * SIZE + nc;
    if (board[mid] && !board[to]) targets.push(to);
  });
  return targets;
}

function anyMove() {
  return CROSS.some((ok, i) => ok && board[i] && jumpsFrom(i).length > 0);
}

function paint() {
  $$('#board .cell').forEach((el, i) => {
    if (!CROSS[i]) return;
    el.classList.toggle('has-peg', !!board[i]);
    el.classList.toggle('selected', i === selected);
    el.classList.toggle('target', selected >= 0 && jumpsFrom(selected).includes(i));
  });
}

function updateStats() {
  $('#pegs-left').textContent = pegCount();
  $('#best').textContent = best === null ? '—' : best;
  const undoBtn = $('#undo-btn');
  if (undoBtn) undoBtn.disabled = locked || history.length === 0 || undosLeft <= 0;
}

function newGame(diff) {
  difficulty = diff;
  board = CROSS.map((ok) => (ok ? true : null));
  board[24] = false; // classic start: the middle hole is empty
  selected = -1;
  moves = 0;
  history = [];
  undosLeft = UNDO_LIMIT[difficulty];
  locked = false;
  hideModal();
  $('#board').classList.remove('won');
  paint();
  updateStats();
}

function clickCell(index) {
  if (locked || !CROSS[index]) return;
  if (board[index]) {
    selected = index;
    paint();
    return;
  }
  if (selected >= 0 && jumpsFrom(selected).includes(index)) {
    doJump(selected, index);
    return;
  }
  selected = -1;
  paint();
}

function doJump(from, to) {
  const r1 = Math.floor(from / SIZE), c1 = from % SIZE;
  const r2 = Math.floor(to / SIZE), c2 = to % SIZE;
  const mid = ((r1 + r2) / 2) * SIZE + ((c1 + c2) / 2);

  board[from] = false;
  board[mid] = false;
  board[to] = true;
  history.push({ from, mid, to });
  moves++;
  selected = to;

  const el = $$('#board .cell')[to];
  el.classList.add('landed');
  setTimeout(() => el.classList.remove('landed'), 350);

  paint();
  updateStats();

  const left = pegCount();
  if (left === 1) {
    win();
  } else if (!anyMove()) {
    stuck();
  }
}

function undo() {
  if (locked || history.length === 0 || undosLeft <= 0) return;
  const mv = history.pop();
  undosLeft--;
  board[mv.to] = false;
  board[mv.mid] = true;
  board[mv.from] = true;
  moves--;
  selected = -1;
  paint();
  updateStats();
}

function win() {
  locked = true;
  const isRecord = best === null || moves < best;
  if (isRecord) {
    best = moves;
    localStorage.setItem(BEST_KEY, String(best));
  }

  $('#board').classList.add('won');
  burstConfetti();
  updateStats();

  const text = isRecord
    ? `Only one peg left in ${moves} jumps — a new record!`
    : `Only one peg left in ${moves} jumps. Your best is still ${best} jumps.`;

  showModal('🎉 You Win!', text, 'Play Again', () => newGame(difficulty));
}

function stuck() {
  const left = pegCount();
  showModal(
    '😅 No more jumps!',
    `No peg can jump anymore — ${left} pegs are left. Undo your last jump or start a new board.`,
    'Play Again',
    () => newGame(difficulty)
  );
}

initGameFrame({
  title: 'Peg Solitaire',
  emoji: '📕',
  difficulties: [
    { value: 'easy', label: 'Easy · unlimited undo' },
    { value: 'medium', label: 'Medium · 10 undos' },
    { value: 'hard', label: 'Hard · 3 undos' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => newGame(d),
  onRestart: () => newGame(difficulty)
});

const undoBtn = $('#undo-btn');
if (undoBtn) undoBtn.addEventListener('click', undo);

buildBoard();
newGame('easy');
