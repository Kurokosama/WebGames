'use strict';

const W = 560;
const H = 350;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 8;
const WIN_SCORE = 5;

const DIFFS = {
  easy: { aiSpeed: 2.4, ballSpeed: 3.4, react: 0.7 },
  medium: { aiSpeed: 3.2, ballSpeed: 4.0, react: 0.85 },
  hard: { aiSpeed: 4.2, ballSpeed: 4.8, react: 1.0 }
};

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let raf = null;
let mouseY = H / 2;

function init(diff) {
  cancelAnimationFrame(raf);
  state = {
    diff,
    cfg: DIFFS[diff],
    playerY: H / 2 - PADDLE_H / 2,
    aiY: H / 2 - PADDLE_H / 2,
    you: 0,
    computer: 0,
    ball: null,
    over: false,
    last: performance.now()
  };
  serve();
  $('#you').textContent = '0';
  $('#computer').textContent = '0';
  draw();
  raf = requestAnimationFrame(loop);
}

function serve() {
  state.ball = {
    x: W / 2,
    y: H / 2,
    vx: state.cfg.ballSpeed * (Math.random() < 0.5 ? -1 : 1),
    vy: (Math.random() - 0.5) * state.cfg.ballSpeed
  };
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (state.over) { draw(); return; }

  // player paddle follows mouse
  state.playerY = mouseY - PADDLE_H / 2;
  state.playerY = Math.max(5, Math.min(H - PADDLE_H - 5, state.playerY));

  // AI paddle
  const b = state.ball;
  const ballTowardsAI = b.vx > 0;
  const target = b.y - PADDLE_H / 2;
  if (ballTowardsAI || Math.random() < 0.15) {
    const diffAI = target - state.aiY;
    const step = state.cfg.aiSpeed * (dt / 16.6) * state.cfg.react;
    state.aiY += Math.max(-step, Math.min(step, diffAI));
    state.aiY = Math.max(5, Math.min(H - PADDLE_H - 5, state.aiY));
  }

  // ball movement
  b.x += (b.vx * dt) / 16.6;
  b.y += (b.vy * dt) / 16.6;

  // top/bottom walls
  if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y + BALL_R > H) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy); }

  // player paddle
  if (b.vx < 0 && b.x - BALL_R <= PADDLE_W + 2 && b.x - BALL_R >= PADDLE_W - 14 &&
      b.y >= state.playerY && b.y <= state.playerY + PADDLE_H) {
    const hit = (b.y - (state.playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
    b.vx = Math.abs(b.vx);
    b.vy = hit * state.cfg.ballSpeed * 1.2;
  }

  // AI paddle
  if (b.vx > 0 && b.x + BALL_R >= W - PADDLE_W - 2 && b.x + BALL_R <= W - PADDLE_W + 14 &&
      b.y >= state.aiY && b.y <= state.aiY + PADDLE_H) {
    const hit = (b.y - (state.aiY + PADDLE_H / 2)) / (PADDLE_H / 2);
    b.vx = -Math.abs(b.vx);
    b.vy = hit * state.cfg.ballSpeed * 1.2;
  }

  // score
  if (b.x - BALL_R < 0) {
    state.computer++;
    $('#computer').textContent = state.computer;
    checkScore();
    if (!state.over) serve();
  }
  if (b.x + BALL_R > W) {
    state.you++;
    $('#you').textContent = state.you;
    checkScore();
    if (!state.over) serve();
  }

  draw();
  raf = requestAnimationFrame(loop);
}

function checkScore() {
  if (state.you >= WIN_SCORE) {
    state.over = true;
    burstConfetti();
    showModal('🎉 You Win!', 'First to 5 — great reflexes!', 'Play Again', () => init(state.diff));
  } else if (state.computer >= WIN_SCORE) {
    state.over = true;
    showModal('😅 Computer Wins!', 'The computer reached 5 first. Try again!', 'Play Again', () => init(state.diff));
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // center line
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(74,144,196,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#4a90c4';
  ctx.beginPath();
  ctx.roundRect(4, state.playerY, PADDLE_W, PADDLE_H, 6);
  ctx.fill();

  ctx.fillStyle = '#ff7e67';
  ctx.beginPath();
  ctx.roundRect(W - PADDLE_W - 4, state.aiY, PADDLE_W, PADDLE_H, 6);
  ctx.fill();

  ctx.fillStyle = '#33505e';
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseY = (e.clientY - rect.top) * (H / rect.height);
});

initGameFrame({
  title: 'Pong',
  emoji: '🏓',
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
