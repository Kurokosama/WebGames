/* 贪吃蛇经典版 Snake Classic */
'use strict';

initGameFrame({
  title: '贪吃蛇经典版',
  emoji: '🐍',
  onRestart: () => resetGame()
});

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const COLS = 20, ROWS = 20;
const CELL = 24;
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

let snake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = null;
let score = 0;
let best = parseInt(localStorage.getItem('snake_classic_best') || '0');
let speed = 150;
let gameOver = false;
let paused = false;
let loopId = null;

$('#best').textContent = best;

function resetGame() {
  hideModal();
  snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  speed = 150;
  gameOver = false;
  paused = false;
  spawnFood();
  updateStatus();
  if (loopId) clearTimeout(loopId);
  loop();
}

function spawnFood() {
  do {
    food = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
  } while (snake.some(s => s.x === food.x && s.y === food.y));
}

function updateStatus() {
  $('#score').textContent = score;
  $('#length').textContent = snake.length;
  if (score > best) {
    best = score;
    localStorage.setItem('snake_classic_best', best);
  }
  $('#best').textContent = best;
}

function loop() {
  if (gameOver || paused) return;
  update();
  draw();
  loopId = setTimeout(loop, speed);
}

function update() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    endGame();
    return;
  }

  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);

  // Eat food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    speed = Math.max(60, speed - 2);
    spawnFood();
    updateStatus();
  } else {
    snake.pop();
  }
}

function endGame() {
  gameOver = true;
  updateStatus();
  showModal('🐍 游戏结束', '得分: ' + score + ' · 长度: ' + snake.length, '再来一局', resetGame);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i <= ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(canvas.width, i * CELL);
    ctx.stroke();
  }

  // Food
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ff4757';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2 - 2, food.y * CELL + CELL / 2 - 2, CELL * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();

  // Snake
  snake.forEach((seg, i) => {
    const x = seg.x * CELL, y = seg.y * CELL;
    const isHead = i === 0;
    ctx.fillStyle = isHead ? '#2ecc71' : '#27ae60';
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    if (isHead) {
      ctx.fillStyle = '#fff';
      const eyeX = dir.x === 1 ? x + CELL - 8 : dir.x === -1 ? x + 4 : x + CELL / 2 - 3;
      const eyeY = dir.y === 1 ? y + CELL - 8 : dir.y === -1 ? y + 4 : y + CELL / 2 - 3;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') { if (dir.y !== 1) nextDir = { x: 0, y: -1 }; e.preventDefault(); }
  else if (e.key === 'ArrowDown' || e.key === 's') { if (dir.y !== -1) nextDir = { x: 0, y: 1 }; e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'a') { if (dir.x !== 1) nextDir = { x: -1, y: 0 }; e.preventDefault(); }
  else if (e.key === 'ArrowRight' || e.key === 'd') { if (dir.x !== -1) nextDir = { x: 1, y: 0 }; e.preventDefault(); }
  else if (e.key === ' ') {
    paused = !paused;
    if (!paused && !gameOver) loop();
    e.preventDefault();
  }
});

resetGame();