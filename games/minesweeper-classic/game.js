/* 扫雷经典版 Minesweeper Classic */
'use strict';

initGameFrame({
  title: '扫雷经典版',
  emoji: '💣',
  difficulties: [
    { value: 'easy', label: '简单 9×9 (10雷)' },
    { value: 'medium', label: '中等 16×16 (40雷)' },
    { value: 'hard', label: '困难 16×30 (99雷)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (v) => newGame(v),
  onRestart: () => newGame(currentDiff)
});

let currentDiff = 'easy';
let ROWS, COLS, MINES;
let grid = []; // {mine, revealed, flagged, count}
let firstClick = true;
let timer = 0, timerInterval = null;
let gameOver = false;
let revealedCount = 0;

const DIFFS = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 }
};

function newGame(diff) {
  currentDiff = diff || currentDiff;
  const d = DIFFS[currentDiff];
  ROWS = d.rows; COLS = d.cols; MINES = d.mines;
  firstClick = true;
  timer = 0;
  gameOver = false;
  revealedCount = 0;
  clearInterval(timerInterval);
  timerInterval = null;
  $('#mines').textContent = MINES;
  $('#timer').textContent = '0';
  $('#status').textContent = '🤖';
  hideModal();

  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = { mine: false, revealed: false, flagged: false, count: 0 };
    }
  }

  renderBoard();
}

function placeMines(safeR, safeC) {
  let placed = 0;
  while (placed < MINES) {
    const r = randInt(0, ROWS - 1);
    const c = randInt(0, COLS - 1);
    if (grid[r][c].mine) continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    grid[r][c].mine = true;
    placed++;
  }
  // Calculate counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].mine) continue;
      let count = 0;
      forNeighbors(r, c, (nr, nc) => { if (grid[nr][nc].mine) count++; });
      grid[r][c].count = count;
    }
  }
}

function forNeighbors(r, c, fn) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) fn(nr, nc);
    }
  }
}

function renderBoard() {
  const board = $('#board');
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${COLS}, 32px)`;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell hidden';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('click', () => reveal(r, c));
      cell.addEventListener('contextmenu', (e) => { e.preventDefault(); flag(r, c); });
      board.appendChild(cell);
    }
  }
}

function getCell(r, c) {
  return $('#board').children[r * COLS + c];
}

function reveal(r, c) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged) return;

  if (firstClick) {
    firstClick = false;
    placeMines(r, c);
    if (!timerInterval) {
      timerInterval = setInterval(() => {
        timer++;
        $('#timer').textContent = timer;
      }, 1000);
    }
  }

  if (cell.mine) {
    // Game over
    gameOver = true;
    clearInterval(timerInterval);
    $('#status').textContent = '💀';
    cell.revealed = true;
    cell.exploded = true;
    // Show all mines
    for (let rr = 0; rr < ROWS; rr++)
      for (let cc = 0; cc < COLS; cc++)
        if (grid[rr][cc].mine) {
          grid[rr][cc].revealed = true;
          const el = getCell(rr, cc);
          el.className = 'cell revealed mine';
          el.textContent = '💣';
        }
    const el = getCell(r, c);
    el.className = 'cell revealed mine exploded';
    el.textContent = '💥';
    showModal('💀 踩到地雷了！', '坚持了 ' + timer + ' 秒', '再来一局', () => newGame(currentDiff));
    return;
  }

  floodReveal(r, c);
  checkWin();
}

function floodReveal(r, c) {
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged || cell.mine) return;
  cell.revealed = true;
  revealedCount++;
  const el = getCell(r, c);
  el.className = 'cell revealed';
  if (cell.count > 0) {
    el.textContent = cell.count;
    el.classList.add('n' + cell.count);
  }
  if (cell.count === 0) {
    forNeighbors(r, c, (nr, nc) => floodReveal(nr, nc));
  }
}

function flag(r, c) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  const el = getCell(r, c);
  if (cell.flagged) {
    el.classList.add('flagged');
    el.textContent = '🚩';
    $('#mines').textContent = MINES - countFlags();
  } else {
    el.classList.remove('flagged');
    el.textContent = '';
    $('#mines').textContent = MINES - countFlags();
  }
}

function countFlags() {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c].flagged) n++;
  return n;
}

function checkWin() {
  if (revealedCount === ROWS * COLS - MINES) {
    gameOver = true;
    clearInterval(timerInterval);
    $('#status').textContent = '😎';
    // Auto-flag remaining mines
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c].mine && !grid[r][c].flagged) {
          grid[r][c].flagged = true;
          getCell(r, c).textContent = '🚩';
        }
    $('#mines').textContent = '0';
    burstConfetti();
    showModal('🎉 恭喜通关！', '用时 ' + timer + ' 秒', '再来一局', () => newGame(currentDiff));
  }
}

newGame('easy');
