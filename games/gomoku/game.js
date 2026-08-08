'use strict';

const N = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

let state = null;
let score = { you: 0, computer: 0 };

function init(diff) {
  clearTimeout(state ? state.aiTimer : null);
  state = {
    diff,
    board: Array.from({ length: N }, () => Array(N).fill(EMPTY)),
    gameOver: false,
    thinking: false,
    aiTimer: null
  };
  $('#you').textContent = score.you;
  $('#computer').textContent = score.computer;
  $('#turn').textContent = 'Your turn! (⚫)';
  render();
}

function render() {
  const board = $('#board');
  board.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  board.innerHTML = '';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = document.createElement('button');
      const v = state.board[r][c];
      cell.className = 'cell' + (v === BLACK ? ' black taken' : v === WHITE ? ' white taken' : '');
      if (v === EMPTY && !state.gameOver && !state.thinking) cell.addEventListener('click', () => playerMove(r, c));
      board.appendChild(cell);
    }
  }
}

function playerMove(r, c) {
  if (state.gameOver || state.thinking || state.board[r][c] !== EMPTY) return;
  state.board[r][c] = BLACK;
  render();
  if (checkWin(BLACK)) return win();
  if (isFull()) return draw();
  state.thinking = true;
  render();
  $('#turn').textContent = 'Computer is thinking… 🤔';
  state.aiTimer = setTimeout(aiMove, 350);
}

function aiMove() {
  state.thinking = false;
  const move = findAIMove();
  if (move === null) return draw();
  state.board[move.r][move.c] = WHITE;
  render();
  if (checkWin(WHITE)) return lose();
  if (isFull()) return draw();
  $('#turn').textContent = 'Your turn! (⚫)';
}

function isFull() {
  return state.board.every((row) => row.every((v) => v !== EMPTY));
}

function checkWin(player) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (state.board[r][c] !== player) continue;
      for (const [dr, dc] of DIRS) {
        let cnt = 1;
        for (let k = 1; k < 5; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= N || cc < 0 || cc >= N || state.board[rr][cc] !== player) { cnt = 0; break; }
          cnt++;
        }
        if (cnt >= 5) return true;
      }
    }
  }
  return false;
}

function makesFive(r, c, player) {
  for (const [dr, dc] of DIRS) {
    let cnt = 1;
    for (const s of [1, -1]) {
      let rr = r + dr * s;
      let cc = c + dc * s;
      while (rr >= 0 && rr < N && cc >= 0 && cc < N && state.board[rr][cc] === player) {
        cnt++;
        rr += dr * s;
        cc += dc * s;
      }
    }
    if (cnt >= 5) return true;
  }
  return false;
}

function findFive(player) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (state.board[r][c] !== EMPTY) continue;
      if (makesFive(r, c, player)) return { r, c };
    }
  }
  return null;
}

function hasNeighbor(r, c) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N && state.board[rr][cc] !== EMPTY) return true;
    }
  }
  return false;
}

function lineScore(r, c, dr, dc, player) {
  let count = 1;
  let open = 0;
  let rr = r + dr;
  let cc = c + dc;
  while (rr >= 0 && rr < N && cc >= 0 && cc < N && state.board[rr][cc] === player) { count++; rr += dr; cc += dc; }
  if (rr >= 0 && rr < N && cc >= 0 && cc < N && state.board[rr][cc] === EMPTY) open++;
  rr = r - dr; cc = c - dc;
  while (rr >= 0 && rr < N && cc >= 0 && cc < N && state.board[rr][cc] === player) { count++; rr -= dr; cc -= dc; }
  if (rr >= 0 && rr < N && cc >= 0 && cc < N && state.board[rr][cc] === EMPTY) open++;
  if (count >= 5) return 100000;
  if (open === 2 && count >= 3) return count * 100;
  if (open === 1 && count >= 3) return count * 50;
  return count * 10;
}

function evaluate(r, c) {
  let s = 0;
  for (const [dr, dc] of DIRS) {
    s += lineScore(r, c, dr, dc, WHITE) - lineScore(r, c, dr, dc, BLACK) * 0.9;
  }
  return s;
}

function findAIMove() {
  const empty = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (state.board[r][c] === EMPTY) empty.push({ r, c });
    }
  }
  if (empty.length === 0) return null;
  const candidates = empty.filter(({ r, c }) => hasNeighbor(r, c));
  const pool = candidates.length ? candidates : empty;

  if (state.diff === 'hard' || state.diff === 'medium') {
    const winMove = findFive(WHITE);
    if (winMove) return winMove;
    const blockMove = findFive(BLACK);
    if (blockMove) return blockMove;
  }
  if (state.diff === 'hard') {
    let best = null;
    let bestScore = -Infinity;
    for (const { r, c } of pool) {
      const s = evaluate(r, c);
      if (s > bestScore) { bestScore = s; best = { r, c }; }
    }
    if (best) return best;
  }
  // prefer near center
  pool.sort((a, b) => {
    const da = Math.abs(a.r - 7) + Math.abs(a.c - 7);
    const db = Math.abs(b.r - 7) + Math.abs(b.c - 7);
    return da - db;
  });
  return pool[0];
}

function win() {
  state.gameOver = true;
  score.you++;
  $('#you').textContent = score.you;
  $('#turn').textContent = '';
  burstConfetti();
  showModal('🎉 You Win!', 'Five in a row — excellent strategy!', 'Play Again', () => init(state.diff));
}

function lose() {
  state.gameOver = true;
  score.computer++;
  $('#computer').textContent = score.computer;
  $('#turn').textContent = '';
  showModal('😅 Computer Wins!', 'The computer got five in a row. Try again!', 'Play Again', () => init(state.diff));
}

function draw() {
  state.gameOver = true;
  $('#turn').textContent = '';
  showModal('🤝 It’s a Draw!', 'The board is full — nobody wins.', 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Gomoku',
  emoji: '🎱',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'medium',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('medium');
