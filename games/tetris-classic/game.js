/* 俄罗斯方块经典版 Tetris Classic */
'use strict';

initGameFrame({
  title: '俄罗斯方块经典版',
  emoji: '🧱',
  onRestart: () => resetGame()
});

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const COLS = 10, ROWS = 20;
const CELL = 28;
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

// Tetromino shapes
const SHAPES = [
  { shape: [[1,1,1,1]], color: '#00bcd4' },          // I
  { shape: [[1,1],[1,1]], color: '#ffd600' },        // O
  { shape: [[0,1,0],[1,1,1]], color: '#9c27b0' },    // T
  { shape: [[1,0,0],[1,1,1]], color: '#ff5722' },    // L
  { shape: [[0,0,1],[1,1,1]], color: '#2196f3' },    // J
  { shape: [[0,1,1],[1,1,0]], color: '#4caf50' },    // S
  { shape: [[1,1,0],[0,1,1]], color: '#f44336' }     // Z
];

let board = [];
let current = null;
let score = 0;
let best = parseInt(localStorage.getItem('tetris_classic_best') || '0');
let lines = 0;
let gameOver = false;
let dropInterval = 500;
let lastDrop = 0;
let animId = null;

$('#best').textContent = best;

function resetGame() {
  hideModal();
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  score = 0;
  lines = 0;
  dropInterval = 500;
  gameOver = false;
  spawnPiece();
  updateStatus();
  if (animId) cancelAnimationFrame(animId);
  lastDrop = performance.now();
  loop();
}

function spawnPiece() {
  const idx = randInt(0, SHAPES.length - 1);
  const piece = SHAPES[idx];
  current = {
    shape: piece.shape.map(row => row.slice()),
    color: piece.color,
    x: Math.floor((COLS - piece.shape[0].length) / 2),
    y: 0
  };
  if (collides(current.shape, current.x, current.y)) {
    gameOver = true;
    updateStatus();
    showModal('🎮 游戏结束', '得分: ' + score + ' · 消除 ' + lines + ' 行', '再来一局', resetGame);
  }
}

function collides(shape, x, y) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const bx = x + c, by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

function rotate(shape) {
  const rows = shape.length, cols = shape[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

function lockPiece() {
  current.shape.forEach((row, r) => {
    row.forEach((val, c) => {
      if (val) {
        const by = current.y + r;
        const bx = current.x + c;
        if (by >= 0) board[by][bx] = current.color;
      }
    });
  });
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared];
    lines += cleared;
    dropInterval = Math.max(100, 500 - lines * 10);
    updateStatus();
  }
}

function updateStatus() {
  $('#score').textContent = score;
  $('#lines').textContent = lines;
  if (score > best) {
    best = score;
    localStorage.setItem('tetris_classic_best', best);
  }
  $('#best').textContent = best;
}

function move(dx, dy) {
  if (gameOver) return;
  if (!collides(current.shape, current.x + dx, current.y + dy)) {
    current.x += dx;
    current.y += dy;
    return true;
  }
  if (dy > 0) {
    lockPiece();
  }
  return false;
}

function hardDrop() {
  if (gameOver) return;
  while (!collides(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 2;
  }
  lockPiece();
  updateStatus();
}

function rotatePiece() {
  if (gameOver) return;
  const rotated = rotate(current.shape);
  if (!collides(rotated, current.x, current.y)) {
    current.shape = rotated;
  } else {
    // Wall kick
    for (const kick of [-1, 1, -2, 2]) {
      if (!collides(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        break;
      }
    }
  }
}

function loop() {
  if (gameOver) return;
  const now = performance.now();
  if (now - lastDrop > dropInterval) {
    lastDrop = now;
    if (!move(0, 1)) return;
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Board background
  ctx.fillStyle = '#0f0f23';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(canvas.width, r * CELL);
    ctx.stroke();
  }

  // Placed blocks
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        drawBlock(c, r, board[r][c]);
      }
    }
  }

  // Current piece
  if (current) {
    current.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          drawBlock(current.x + c, current.y + r, current.color);
        }
      });
    });
  }
}

function drawBlock(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4);
  ctx.fillRect(x * CELL + 1, y * CELL + 1, 4, CELL - 2);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x * CELL + 1, y * CELL + CELL - 5, CELL - 2, 4);
  ctx.fillRect(x * CELL + CELL - 5, y * CELL + 1, 4, CELL - 2);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { move(-1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { move(1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowDown') { move(0, 1); score += 1; updateStatus(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { rotatePiece(); e.preventDefault(); }
  else if (e.key === ' ') { hardDrop(); e.preventDefault(); }
});

resetGame();