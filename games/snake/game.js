'use strict';

const COLS = 20;
const ROWS = 20;
const CELL = 22;
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const DIFFS = {
  easy: { speed: 170 },
  medium: { speed: 130 },
  hard: { speed: 95 }
};

let state = null;
let timer = null;
let sessionBest = 0;

function init(diff) {
  clearTimeout(timer);
  state = {
    diff,
    snake: [{ x: 10, y: 10 }],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: null,
    score: 0,
    paused: false,
    over: false,
    speed: DIFFS[diff].speed
  };
  spawnFood();
  $('#score').textContent = '0';
  $('#best').textContent = sessionBest;
  draw();
  schedule();
}

function schedule() {
  clearTimeout(timer);
  if (state.over || state.paused) return;
  timer = setTimeout(tick, state.speed);
}

function tick() {
  if (state.paused || state.over) return;
  state.dir = state.nextDir;
  const head = {
    x: state.snake[0].x + state.dir.x,
    y: state.snake[0].y + state.dir.y
  };

  // wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
  // self collision (ignore tail if not growing)
  const eating = head.x === state.food.x && head.y === state.food.y;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((s) => s.x === head.x && s.y === head.y)) return gameOver();

  state.snake.unshift(head);
  if (eating) {
    state.score++;
    $('#score').textContent = state.score;
    if (state.score > sessionBest) {
      sessionBest = state.score;
      $('#best').textContent = sessionBest;
    }
    // speed up a little
    state.speed = Math.max(60, state.speed - 4);
    spawnFood();
  } else {
    state.snake.pop();
  }
  draw();
  schedule();
}

function spawnFood() {
  const free = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!state.snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  if (free.length === 0) return gameOver(); // board full = win
  state.food = pick(free);
}

function gameOver() {
  state.over = true;
  clearTimeout(timer);
  const isWin = state.score >= COLS * ROWS - 1;
  if (isWin) {
    burstConfetti();
    showModal('🏆 Incredible!', 'You filled the whole board!', 'Play Again', () => init(state.diff));
  } else {
    showModal('😅 Game Over', `You scored ${state.score} point${state.score === 1 ? '' : 's'}!`, 'Play Again', () => init(state.diff));
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // subtle grid
  ctx.strokeStyle = 'rgba(76,175,155,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
  }
  for (let i = 0; i <= ROWS; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
  }

  // food
  if (state.food) {
    ctx.fillStyle = '#ff7e67';
    ctx.beginPath();
    ctx.arc(state.food.x * CELL + CELL / 2, state.food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(state.food.x * CELL + CELL / 2, state.food.y * CELL + CELL / 2 - CELL / 2 + 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // snake
  state.snake.forEach((seg, i) => {
    const pad = i === 0 ? 1 : 2;
    ctx.fillStyle = i === 0 ? '#2e8b7a' : '#4caf9b';
    ctx.beginPath();
    ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 6);
    ctx.fill();
  });

  // paused overlay
  if (state.paused) {
    ctx.fillStyle = 'rgba(51,80,94,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '800 28px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
  }
}

function setDirection(dx, dy) {
  if (!state || state.over) return;
  // prevent reversing
  if (state.dir.x === -dx && state.dir.y === -dy) return;
  state.nextDir = { x: dx, y: dy };
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') { e.preventDefault(); setDirection(0, -1); }
  else if (key === 'arrowdown' || key === 's') { e.preventDefault(); setDirection(0, 1); }
  else if (key === 'arrowleft' || key === 'a') { e.preventDefault(); setDirection(-1, 0); }
  else if (key === 'arrowright' || key === 'd') { e.preventDefault(); setDirection(1, 0); }
  else if (key === ' ' || key === 'p') {
    e.preventDefault();
    if (state && !state.over) {
      state.paused = !state.paused;
      if (!state.paused) schedule();
      draw();
    }
  }
});

initGameFrame({
  title: 'Snake',
  emoji: '🐍',
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
