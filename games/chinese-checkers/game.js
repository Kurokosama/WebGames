/* 中国跳棋 Chinese Checkers */
'use strict';

initGameFrame({
  title: '中国跳棋',
  emoji: '⭐',
  onRestart: () => resetGame()
});

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const SIZE = 560;
canvas.width = SIZE; canvas.height = SIZE;

const CX = SIZE / 2, CY = SIZE / 2;
const HEX_R = 22;
const SQRT3 = Math.sqrt(3);

// Hex grid: axial coordinates (q, r)
// 15x15 star board
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
const COLOR_NAMES = ['红方', '蓝方', '绿方', '黄方', '紫方', '青方'];

let board = {}; // key: "q,r" -> player index or null
let players = []; // array of {color, pieces: [{q,r}], home: [{q,r}], target: [{q,r}]}
let currentPlayer = 0;
let selected = null; // {q, r}
let validMoves = [];
let moves = 0;
let gameOver = false;

// Generate star board positions
function genStarPositions() {
  const positions = new Set();
  // 6 triangles of 10 cells each + center hex
  // Using axial coords, center at (0,0)
  // Triangle directions (6 directions)
  const dirs = [
    [0, -1], [1, -1], [1, 0],
    [0, 1], [-1, 1], [-1, 0]
  ];
  // For each of 6 directions, generate 10 cells in a triangle
  for (let d = 0; d < 6; d++) {
    const [dq, dr] = dirs[d];
    // Triangle: 1+2+3+4 cells
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col <= row; col++) {
        // Offset from center
        const q = dq * (row + 1) + (d % 2 === 0 ? col : 0);
        const r = dr * (row + 1) + (d % 2 === 1 ? col : 0);
        // This is approximate - let's use a simpler approach
      }
    }
  }

  // Simpler: define the 6 home triangles explicitly
  // Each triangle has 10 cells arranged in rows of 1,2,3,4
  const homes = [];
  const targetDirs = [
    // direction vectors for each of 6 triangles
    { dq: 0, dr: -1, name: 'top' },
    { dq: 1, dr: -1, name: 'top-right' },
    { dq: 1, dr: 0, name: 'bottom-right' },
    { dq: 0, dr: 1, name: 'bottom' },
    { dq: -1, dr: 1, name: 'bottom-left' },
    { dq: -1, dr: 0, name: 'top-left' }
  ];

  for (let t = 0; t < 6; t++) {
    const cells = [];
    const dir = targetDirs[t];
    // Generate triangle cells
    for (let row = 1; row <= 4; row++) {
      for (let col = 0; col < row; col++) {
        let q, r;
        if (t === 0) { q = col - Math.floor(row/2); r = -row; }
        else if (t === 1) { q = row; r = col - Math.floor(row/2) - 1; }
        else if (t === 2) { q = row; r = row - col - 1; }
        else if (t === 3) { q = col - Math.floor(row/2); r = row; }
        else if (t === 4) { q = -row; r = Math.floor(row/2) - col + 1; }
        else { q = -row; r = -(row - col - 1); }
        cells.push({ q, r });
      }
    }
    homes.push(cells);
  }
  return homes;
}

// Use a well-known star board layout
function initBoard() {
  board = {};
  const homes = genStarPositions();

  players = [];
  for (let p = 0; p < 6; p++) {
    const home = homes[p];
    const target = homes[(p + 3) % 6]; // opposite
    const pieces = home.map(c => ({ q: c.q, r: c.r }));
    players.push({ color: COLORS[p], pieces, home, target });
    pieces.forEach(pc => {
      board[pc.q + ',' + pc.r] = p;
    });
  }
  currentPlayer = 0;
  selected = null;
  validMoves = [];
  moves = 0;
  gameOver = false;
  updateStatus();
}

function updateStatus() {
  $('#current-player').textContent = COLOR_NAMES[currentPlayer];
  $('#current-player').style.color = COLORS[currentPlayer];
  $('#moves').textContent = moves;
}

function hexToPixel(q, r) {
  const x = CX + HEX_R * SQRT3 * (q + r / 2);
  const y = CY + HEX_R * 1.5 * r;
  return { x, y };
}

function pixelToHex(px, py) {
  const x = px - CX, y = py - CY;
  const q = (SQRT3 / 3 * x - y / 3) / HEX_R;
  const r = (2 / 3 * y) / HEX_R;
  // Round to nearest hex
  const rq = Math.round(q), rr = Math.round(r);
  // Check neighbors for closest
  let best = { q: rq, r: rr }, bestDist = Infinity;
  for (let dq = -1; dq <= 1; dq++) {
    for (let dr = -1; dr <= 1; dr++) {
      const cq = rq + dq, cr = rr + dr;
      const p = hexToPixel(cq, cr);
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bestDist) { bestDist = d; best = { q: cq, r: cr }; }
    }
  }
  return best;
}

function getNeighbors(q, r) {
  return [
    { q: q+1, r: r }, { q: q-1, r: r },
    { q: q, r: r+1 }, { q: q, r: r-1 },
    { q: q+1, r: r-1 }, { q: q-1, r: r+1 }
  ];
}

function getValidMoves(q, r) {
  const moves = [];
  const neighbors = getNeighbors(q, r);
  neighbors.forEach(n => {
    const key = n.q + ',' + n.r;
    if (board[key] === undefined || board[key] === null) {
      // Empty - can move
      moves.push({ q: n.q, r: n.r, jump: false });
      // Check for jump
      const jumpTo = { q: q + (n.q - q) * 2, r: r + (n.r - r) * 2 };
      const jKey = jumpTo.q + ',' + jumpTo.r;
      if (board[jKey] !== undefined && board[jKey] !== null) {
        // Can jump over
        const jumpDest = { q: jumpTo.q + (n.q - q), r: jumpTo.r + (n.r - r) };
        const jdKey = jumpDest.q + ',' + jumpDest.r;
        if (board[jdKey] === undefined || board[jdKey] === null) {
          moves.push({ q: jumpDest.q, r: jumpDest.r, jump: true });
        }
      }
    }
  });
  return moves;
}

function isOnTarget(q, r, playerIdx) {
  return players[playerIdx].target.some(c => c.q === q && c.r === r);
}

function checkWin(playerIdx) {
  return players[playerIdx].pieces.every(p => isOnTarget(p.q, p.r, playerIdx));
}

function handleClick(e) {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (SIZE / rect.width);
  const py = (e.clientY - rect.top) * (SIZE / rect.height);
  const hex = pixelToHex(px, py);
  const key = hex.q + ',' + hex.r;

  if (selected) {
    // Try to move
    const move = validMoves.find(m => m.q === hex.q && m.r === hex.r);
    if (move) {
      // Execute move
      const fromKey = selected.q + ',' + selected.r;
      board[fromKey] = null;
      board[key] = currentPlayer;
      const player = players[currentPlayer];
      const piece = player.pieces.find(p => p.q === selected.q && p.r === selected.r);
      piece.q = hex.q; piece.r = hex.r;

      // Check if can continue jumping
      if (move.jump) {
        const newMoves = getValidMoves(hex.q, hex.r);
        const jumpMoves = newMoves.filter(m => m.jump);
        if (jumpMoves.length > 0) {
          selected = { q: hex.q, r: hex.r };
          validMoves = jumpMoves;
          draw();
          return;
        }
      }

      selected = null;
      validMoves = [];
      moves++;

      // Check win
      if (checkWin(currentPlayer)) {
        gameOver = true;
        showModal('🎉 ' + COLOR_NAMES[currentPlayer] + ' 获胜！', '共 ' + moves + ' 步', '再来一局', resetGame);
        draw();
        return;
      }

      // Next player
      currentPlayer = (currentPlayer + 1) % 6;
      updateStatus();
      draw();
      return;
    }
    // Deselect
    selected = null;
    validMoves = [];
  }

  // Select piece
  if (board[key] === currentPlayer) {
    selected = { q: hex.q, r: hex.r };
    validMoves = getValidMoves(hex.q, hex.r);
  }

  draw();
}

function draw() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Background
  ctx.fillStyle = '#f5f0e8';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Draw hex grid
  const allCells = new Set();
  players.forEach(p => {
    p.home.forEach(c => allCells.add(c.q + ',' + c.r));
    p.target.forEach(c => allCells.add(c.q + ',' + c.r));
  });
  // Add center and connecting cells
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      if (Math.abs(q + r) <= 5 && Math.abs(q) <= 5 && Math.abs(r) <= 5) {
        allCells.add(q + ',' + r);
      }
    }
  }

  allCells.forEach(key => {
    const [q, r] = key.split(',').map(Number);
    const { x, y } = hexToPixel(q, r);
    drawHex(x, y, HEX_R - 1, '#e8e0d0', '#c8b898');
  });

  // Draw target zones
  players.forEach((p, i) => {
    p.target.forEach(c => {
      const { x, y } = hexToPixel(c.q, c.r);
      drawHex(x, y, HEX_R - 2, p.color + '33', p.color + '88');
    });
  });

  // Draw valid moves
  validMoves.forEach(m => {
    const { x, y } = hexToPixel(m.q, m.r);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = m.jump ? '#e74c3c' : '#2ecc71';
    ctx.fill();
  });

  // Draw pieces
  players.forEach((p, i) => {
    p.pieces.forEach(pc => {
      const { x, y } = hexToPixel(pc.q, pc.r);
      const isSelected = selected && selected.q === pc.q && selected.r === pc.r;
      ctx.beginPath();
      ctx.arc(x, y, HEX_R * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      // 3D effect
      ctx.beginPath();
      ctx.arc(x - 3, y - 3, HEX_R * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    });
  });
}

function drawHex(x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i - Math.PI / 6;
    const hx = x + r * Math.cos(angle);
    const hy = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

canvas.addEventListener('click', handleClick);

function resetGame() {
  hideModal();
  initBoard();
  draw();
}

resetGame();
