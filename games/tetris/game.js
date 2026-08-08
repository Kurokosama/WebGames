'use strict';

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const boardCanvas = $('#board-canvas');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = $('#next-canvas');
const nextCtx = nextCanvas.getContext('2d');
boardCanvas.width = COLS * CELL;
boardCanvas.height = ROWS * CELL;
nextCanvas.width = 4 * CELL;
nextCanvas.height = 4 * CELL;

const SHAPES = {
  I: { m: [[1, 1, 1, 1]], color: '#4cc9f0' },
  O: { m: [[1, 1], [1, 1]], color: '#ffd166' },
  T: { m: [[0, 1, 0], [1, 1, 1]], color: '#9b7edb' },
  S: { m: [[0, 1, 1], [1, 1, 0]], color: '#06d6a0' },
  Z: { m: [[1, 1, 0], [0, 1, 1]], color: '#ff7e67' },
  J: { m: [[1, 0, 0], [1, 1, 1]], color: '#4a90c4' },
  L: { m: [[0, 0, 1], [1, 1, 1]], color: '#f47ba1' }
};
const PIECE_KEYS = Object.keys(SHAPES);

let state = null;
let dropTimer = null;

function rotateMatrix(m) {
  const rows = m.length;
  const cols = m[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = m[r][c];
    }
  }
  return rotated;
}

function init() {
  clearTimeout(dropTimer);
  state = {
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    color: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    score: 0,
    lines: 0,
    level: 1,
    paused: false,
    over: false,
    current: null,
    nextKey: null
  };
  $('#score').textContent = '0';
  $('#lines').textContent = '0';
  $('#level').textContent = '1';
  spawnPiece();
  draw();
  schedule();
}

function spawnPiece() {
  if (state.nextKey === null) state.nextKey = pick(PIECE_KEYS);
  const key = state.nextKey;
  state.nextKey = pick(PIECE_KEYS);
  const shape = SHAPES[key].m;
  const piece = {
    key,
    m: shape.map((row) => row.slice()),
    color: SHAPES[key].color,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0
  };
  if (collides(piece)) {
    gameOver();
    return;
  }
  state.current = piece;
  drawNext();
}

function collides(piece) {
  for (let r = 0; r < piece.m.length; r++) {
    for (let c = 0; c < piece.m[r].length; c++) {
      if (!piece.m[r][c]) continue;
      const x = piece.x + c;
      const y = piece.y + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && state.grid[y][x]) return true;
    }
  }
  return false;
}

function lockPiece() {
  const p = state.current;
  for (let r = 0; r < p.m.length; r++) {
    for (let c = 0; c < p.m[r].length; c++) {
      if (!p.m[r][c]) continue;
      const y = p.y + r;
      if (y < 0) { gameOver(); return; }
      state.grid[y][p.x + c] = 1;
      state.color[y][p.x + c] = p.color;
    }
  }
  clearLines();
  spawnPiece();
  schedule();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (state.grid[y].every((v) => v === 1)) {
      state.grid.splice(y, 1);
      state.color.splice(y, 1);
      state.grid.unshift(Array(COLS).fill(0));
      state.color.unshift(Array(COLS).fill(null));
      cleared++;
      y++; // re-check same index
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared];
    state.score += points * state.level;
    state.lines += cleared;
    state.level = Math.floor(state.lines / 10) + 1;
    $('#score').textContent = state.score;
    $('#lines').textContent = state.lines;
    $('#level').textContent = state.level;
  }
}

function dropInterval() {
  return Math.max(90, 700 - (state.level - 1) * 60);
}

function schedule() {
  clearTimeout(dropTimer);
  if (state.over || state.paused) return;
  dropTimer = setTimeout(() => {
    if (state.over || state.paused) return;
    moveDown();
  }, dropInterval());
}

function moveDown() {
  const p = state.current;
  const test = { ...p, y: p.y + 1 };
  if (!collides(test)) {
    state.current = test;
    draw();
    schedule();
  } else {
    lockPiece();
  }
}

function softDrop() {
  const p = state.current;
  const test = { ...p, y: p.y + 1 };
  if (!collides(test)) {
    state.current = test;
    state.score += 1;
    $('#score').textContent = state.score;
    draw();
    schedule();
  } else {
    lockPiece();
  }
}

function hardDrop() {
  const p = state.current;
  while (!collides({ ...p, y: p.y + 1 })) p.y++;
  state.score += 2;
  $('#score').textContent = state.score;
  lockPiece();
}

function moveSide(dx) {
  const p = state.current;
  const test = { ...p, x: p.x + dx };
  if (!collides(test)) {
    state.current = test;
    draw();
  }
}

function rotate() {
  const p = state.current;
  const rotated = rotateMatrix(p.m);
  const kicks = [0, -1, 1, -2, 2];
  for (const kx of kicks) {
    const test = { ...p, m: rotated, x: p.x + kx };
    if (!collides(test)) {
      state.current = test;
      draw();
      return;
    }
  }
}

function gameOver() {
  state.over = true;
  clearTimeout(dropTimer);
  showModal('😅 Game Over', `You scored ${state.score} points and cleared ${state.lines} lines!`, 'Play Again', init);
}

function draw() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  // grid background
  boardCtx.strokeStyle = 'rgba(76,175,155,0.1)';
  boardCtx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    boardCtx.beginPath(); boardCtx.moveTo(c * CELL, 0); boardCtx.lineTo(c * CELL, boardCanvas.height); boardCtx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    boardCtx.beginPath(); boardCtx.moveTo(0, r * CELL); boardCtx.lineTo(boardCanvas.width, r * CELL); boardCtx.stroke();
  }

  // locked cells
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (state.grid[y][x]) {
        drawCell(boardCtx, x, y, state.color[y][x]);
      }
    }
  }

  // current piece
  if (state.current) {
    const p = state.current;
    for (let r = 0; r < p.m.length; r++) {
      for (let c = 0; c < p.m[r].length; c++) {
        if (p.m[r][c] && p.y + r >= 0) drawCell(boardCtx, p.x + c, p.y + r, p.color);
      }
    }
  }

  if (state.paused) {
    boardCtx.fillStyle = 'rgba(51,80,94,0.55)';
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardCtx.fillStyle = '#fff';
    boardCtx.font = '800 26px "Baloo 2", sans-serif';
    boardCtx.textAlign = 'center';
    boardCtx.fillText('Paused', boardCanvas.width / 2, boardCanvas.height / 2);
  }
}

function drawCell(ctx, x, y, color) {
  const pad = 1.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x * CELL + pad, y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.roundRect(x * CELL + pad + 2, y * CELL + pad + 2, CELL - pad * 2 - 4, 5, 3);
  ctx.fill();
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = SHAPES[state.nextKey];
  const m = shape.m;
  const w = m[0].length;
  const h = m.length;
  const offX = (4 - w) / 2;
  const offY = (4 - h) / 2;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (m[r][c]) drawCell(nextCtx, offX + c, offY + r, shape.color);
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (!state) return;
  const key = e.key;
  if (key === 'ArrowLeft') { e.preventDefault(); if (!state.over && !state.paused) moveSide(-1); }
  else if (key === 'ArrowRight') { e.preventDefault(); if (!state.over && !state.paused) moveSide(1); }
  else if (key === 'ArrowDown') { e.preventDefault(); if (!state.over && !state.paused) softDrop(); }
  else if (key === 'ArrowUp') { e.preventDefault(); if (!state.over && !state.paused) rotate(); }
  else if (key === ' ') { e.preventDefault(); if (!state.over && !state.paused) hardDrop(); }
  else if (key === 'p' || key === 'P') {
    e.preventDefault();
    if (state.over) return;
    state.paused = !state.paused;
    if (!state.paused) schedule();
    draw();
  }
});

initGameFrame({
  title: 'Tetris',
  emoji: '🧩',
  difficulties: [],
  onRestart: init
});

init();
