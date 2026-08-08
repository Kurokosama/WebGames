'use strict';

const COLS = 7;
const ROWS = 6;
const P1 = 1;
const P2 = 2;

let state = null;
let score = { you: 0, computer: 0 };

function init(diff) {
  clearTimeout(state ? state.aiTimer : null);
  state = {
    diff,
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    over: false,
    thinking: false,
    aiTimer: null
  };
  $('#you').textContent = score.you;
  $('#computer').textContent = score.computer;
  $('#turn').textContent = 'Your turn! (🔴)';
  render();
}

function dropDisc(col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.grid[r][col] === 0) {
      state.grid[r][col] = player;
      return r;
    }
  }
  return -1;
}

function playerDrop(col) {
  if (state.over || state.thinking) return;
  const row = dropDisc(col, P1);
  if (row === -1) return;
  render();
  if (checkWin(P1)) return win();
  if (isFull()) return draw();
  state.thinking = true;
  render();
  $('#turn').textContent = 'Computer is thinking… 🤔';
  state.aiTimer = setTimeout(aiTurn, 400);
}

function aiTurn() {
  state.thinking = false;
  const col = aiMove();
  if (col === -1) return draw();
  dropDisc(col, P2);
  render();
  if (checkWin(P2)) return lose();
  if (isFull()) return draw();
  $('#turn').textContent = 'Your turn! (🔴)';
}

function colHeight(col) {
  let h = 0;
  for (let r = 0; r < ROWS; r++) if (state.grid[r][col] !== 0) h++;
  return h;
}

function aiMove() {
  const playable = [];
  for (let c = 0; c < COLS; c++) if (colHeight(c) < ROWS) playable.push(c);
  if (playable.length === 0) return -1;

  // winning move
  for (const c of playable) {
    const row = ROWS - 1 - colHeight(c);
    state.grid[row][c] = P2;
    const w = checkWin(P2);
    state.grid[row][c] = 0;
    if (w) return c;
  }
  if (state.diff === 'medium' || state.diff === 'hard') {
    // block player win
    for (const c of playable) {
      const row = ROWS - 1 - colHeight(c);
      state.grid[row][c] = P1;
      const w = checkWin(P1);
      state.grid[row][c] = 0;
      if (w) return c;
    }
  }
  if (state.diff === 'hard' || state.diff === 'medium') {
    if (playable.includes(3)) return 3; // center
  }
  if (state.diff === 'hard') {
    // prefer columns near center
    const sorted = playable.slice().sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
    return sorted[0];
  }
  return pick(playable);
}

function checkWin(player) {
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (state.grid[r][c] === player && state.grid[r][c + 1] === player && state.grid[r][c + 2] === player && state.grid[r][c + 3] === player) return true;
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      if (state.grid[r][c] === player && state.grid[r + 1][c] === player && state.grid[r + 2][c] === player && state.grid[r + 3][c] === player) return true;
    }
  }
  // diagonal down-right
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (state.grid[r][c] === player && state.grid[r + 1][c + 1] === player && state.grid[r + 2][c + 2] === player && state.grid[r + 3][c + 3] === player) return true;
    }
  }
  // diagonal up-right
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (state.grid[r][c] === player && state.grid[r - 1][c + 1] === player && state.grid[r - 2][c + 2] === player && state.grid[r - 3][c + 3] === player) return true;
    }
  }
  return false;
}

function isFull() {
  return state.grid.every((row) => row.every((v) => v !== 0));
}

function render() {
  const gridEl = $('#grid');
  gridEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      const v = state.grid[r][c];
      cell.className = 'cell' + (v === P1 ? ' p1' : v === P2 ? ' p2' : '');
      gridEl.appendChild(cell);
    }
  }
  const drops = $('#drops');
  drops.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const btn = document.createElement('button');
    btn.className = 'drop-btn';
    btn.textContent = '⬇';
    btn.disabled = state.over || state.thinking || colHeight(c) >= ROWS;
    btn.addEventListener('click', () => playerDrop(c));
    drops.appendChild(btn);
  }
}

function win() {
  state.over = true;
  score.you++;
  $('#you').textContent = score.you;
  $('#turn').textContent = '';
  burstConfetti();
  showModal('🎉 You Win!', 'Four in a row — amazing!', 'Play Again', () => init(state.diff));
}

function lose() {
  state.over = true;
  score.computer++;
  $('#computer').textContent = score.computer;
  $('#turn').textContent = '';
  showModal('😅 Computer Wins!', 'The computer got four in a row. Try again!', 'Play Again', () => init(state.diff));
}

function draw() {
  state.over = true;
  $('#turn').textContent = '';
  showModal('🤝 It’s a Draw!', 'The board is full — nobody wins.', 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Connect Four',
  emoji: '🔴',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
