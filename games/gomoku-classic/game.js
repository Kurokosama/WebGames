/* 五子棋经典版 Gomoku Classic */
'use strict';

initGameFrame({
  title: '五子棋经典版',
  emoji: '⚫',
  onRestart: () => resetGame()
});

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const SIZE = 560;
const GRID = 15;
const CELL = SIZE / (GRID + 1);
const MARGIN = CELL;

canvas.width = SIZE;
canvas.height = SIZE;

let board = []; // 0 empty, 1 black, 2 white
let currentPlayer = 1; // 1 = player (black), 2 = AI (white)
let moves = 0;
let gameOver = false;
let lastMove = null;

function resetGame() {
  hideModal();
  board = Array.from({ length: GRID }, () => Array(GRID).fill(0));
  currentPlayer = 1;
  moves = 0;
  gameOver = false;
  lastMove = null;
  updateStatus();
  draw();
}

function updateStatus() {
  $('#turn').textContent = currentPlayer === 1 ? '⚫ 黑棋 (你)' : '⚪ 白棋 (电脑)';
  $('#moves').textContent = moves;
}

function draw() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Board background
  ctx.fillStyle = '#e8b96a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Grid lines
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 1;
  for (let i = 0; i < GRID; i++) {
    const pos = MARGIN + i * CELL;
    ctx.beginPath();
    ctx.moveTo(MARGIN, pos);
    ctx.lineTo(SIZE - MARGIN, pos);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos, MARGIN);
    ctx.lineTo(pos, SIZE - MARGIN);
    ctx.stroke();
  }

  // Star points
  const stars = [[3,3],[3,11],[11,3],[11,11],[7,7]];
  stars.forEach(([r,c]) => {
    ctx.beginPath();
    ctx.arc(MARGIN + c * CELL, MARGIN + r * CELL, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#8b5a2b';
    ctx.fill();
  });

  // Stones
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] === 0) continue;
      const x = MARGIN + c * CELL;
      const y = MARGIN + r * CELL;
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = board[r][c] === 1 ? '#111' : '#fff';
      ctx.fill();
      ctx.strokeStyle = board[r][c] === 1 ? '#000' : '#ccc';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Highlight
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, CELL * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
  }

  // Last move marker
  if (lastMove) {
    const x = MARGIN + lastMove.c * CELL;
    const y = MARGIN + lastMove.r * CELL;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = board[lastMove.r][lastMove.c] === 1 ? '#fff' : '#111';
    ctx.fill();
  }
}

function canvasToGrid(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (SIZE / rect.width);
  const y = (e.clientY - rect.top) * (SIZE / rect.height);
  const c = Math.round((x - MARGIN) / CELL);
  const r = Math.round((y - MARGIN) / CELL);
  if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
  return { r, c };
}

function checkWin(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID || board[nr][nc] !== player) break;
      count++;
    }
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID || board[nr][nc] !== player) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}

function isDraw() {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (board[r][c] === 0) return false;
  return true;
}

// Simple AI: score-based
function aiMove() {
  let best = null, bestScore = -Infinity;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] !== 0) continue;
      // Only consider near existing stones
      if (!hasNeighbor(r, c)) continue;
      const score = evaluatePoint(r, c, 2) * 1.1 + evaluatePoint(r, c, 1);
      if (score > bestScore) {
        bestScore = score;
        best = { r, c };
      }
    }
  }
  if (!best) {
    // Center
    best = { r: 7, c: 7 };
  }
  return best;
}

function hasNeighbor(r, c) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && board[nr][nc] !== 0) return true;
    }
  }
  return false;
}

function evaluatePoint(r, c, player) {
  let score = 0;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    let openEnds = 0;
    // Forward
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) break;
      if (board[nr][nc] === player) count++;
      else if (board[nr][nc] === 0) { openEnds++; break; }
      else break;
    }
    // Backward
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) break;
      if (board[nr][nc] === player) count++;
      else if (board[nr][nc] === 0) { openEnds++; break; }
      else break;
    }
    if (count >= 5) score += 100000;
    else if (count === 4 && openEnds >= 1) score += 10000;
    else if (count === 3 && openEnds === 2) score += 3000;
    else if (count === 3 && openEnds === 1) score += 500;
    else if (count === 2 && openEnds === 2) score += 200;
    else if (count === 2 && openEnds === 1) score += 50;
    else if (count === 1 && openEnds === 2) score += 10;
  }
  return score;
}

function placeStone(r, c, player) {
  board[r][c] = player;
  lastMove = { r, c };
  moves++;
  if (checkWin(r, c, player)) {
    gameOver = true;
    const winner = player === 1 ? '⚫ 黑棋 (你)' : '⚪ 白棋 (电脑)';
    if (player === 1) {
      burstConfetti();
      showModal('🎉 你赢了！', '共 ' + moves + ' 步', '再来一局', resetGame);
    } else {
      showModal('🤖 电脑赢了', '共 ' + moves + ' 步', '再来一局', resetGame);
    }
    updateStatus();
    draw();
    return true;
  }
  if (isDraw()) {
    gameOver = true;
    showModal('🤝 平局！', '棋盘已满', '再来一局', resetGame);
    updateStatus();
    draw();
    return true;
  }
  return false;
}

canvas.addEventListener('click', (e) => {
  if (gameOver || currentPlayer !== 1) return;
  const pos = canvasToGrid(e);
  if (!pos) return;
  if (board[pos.r][pos.c] !== 0) return;
  if (placeStone(pos.r, pos.c, 1)) return;
  currentPlayer = 2;
  updateStatus();
  draw();

  // AI move after short delay
  setTimeout(() => {
    if (gameOver) return;
    const ai = aiMove();
    if (placeStone(ai.r, ai.c, 2)) return;
    currentPlayer = 1;
    updateStatus();
    draw();
  }, 300);
});

resetGame();