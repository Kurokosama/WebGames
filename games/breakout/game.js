'use strict';

const W = 560;
const H = 400;
const PADDLE_W = 90;
const PADDLE_H = 14;
const BALL_R = 8;
const BRICK_COLS = 8;
const BRICK_H = 22;

const DIFFS = {
  easy: { rows: 3, speed: 3.6 },
  medium: { rows: 4, speed: 4.4 },
  hard: { rows: 5, speed: 5.4 }
};

const BRICK_COLORS = ['#ff7e67', '#f6c453', '#4cc9f0', '#9b7edb', '#06d6a0', '#f47ba1', '#4a90c4', '#ffd166'];

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let raf = null;
let mouseX = W / 2;

function init(diff) {
  cancelAnimationFrame(raf);
  const cfg = DIFFS[diff];
  const brickW = (W - 20) / BRICK_COLS;
  const bricks = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: 10 + c * brickW,
        y: 50 + r * (BRICK_H + 8),
        w: brickW - 4,
        h: BRICK_H,
        color: BRICK_COLORS[(r * BRICK_COLS + c) % BRICK_COLORS.length],
        alive: true
      });
    }
  }
  state = {
    diff,
    cfg,
    bricks,
    paddle: { x: W / 2 - PADDLE_W / 2, w: PADDLE_W },
    ball: null,
    lives: 3,
    score: 0,
    over: false,
    last: performance.now()
  };
  resetBall();
  $('#score').textContent = '0';
  $('#lives').textContent = '❤️❤️❤️';
  draw();
  raf = requestAnimationFrame(loop);
}

function resetBall() {
  state.ball = {
    x: W / 2,
    y: H - 70,
    r: BALL_R,
    vx: state.cfg.speed * (Math.random() < 0.5 ? -1 : 1) * 0.8,
    vy: -state.cfg.speed
  };
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (!state.over) {
    // paddle follows mouse
    state.paddle.x = mouseX - state.paddle.w / 2;
    state.paddle.x = Math.max(5, Math.min(W - state.paddle.w - 5, state.paddle.x));

    const b = state.ball;
    b.x += (b.vx * dt) / 16.6;
    b.y += (b.vy * dt) / 16.6;

    // walls
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }

    // paddle bounce
    const p = state.paddle;
    if (b.vy > 0 && b.y + b.r >= H - PADDLE_H - 6 && b.y + b.r <= H - 2 &&
        b.x >= p.x - b.r && b.x <= p.x + p.w + b.r) {
      const hit = (b.x - (p.x + p.w / 2)) / (p.w / 2); // -1..1
      b.vx = hit * state.cfg.speed * 1.2;
      b.vy = -Math.abs(b.vy);
      b.y = H - PADDLE_H - 6 - b.r;
    }

    // brick collision
    for (const br of state.bricks) {
      if (!br.alive) continue;
      if (b.x + b.r > br.x && b.x - b.r < br.x + br.w &&
          b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
        br.alive = false;
        state.score += 10;
        $('#score').textContent = state.score;
        // simple bounce: reverse vy (or vx if hit from side)
        if (b.x < br.x || b.x > br.x + br.w) b.vx = -b.vx;
        else b.vy = -b.vy;
        break;
      }
    }

    // ball out bottom
    if (b.y - b.r > H) {
      state.lives--;
      $('#lives').textContent = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, 3 - state.lives));
      if (state.lives <= 0) {
        state.over = true;
        showModal('😅 Game Over', `You scored ${state.score} points!`, 'Play Again', () => init(state.diff));
      } else {
        resetBall();
      }
    }

    // all bricks cleared
    if (state.bricks.every((br) => !br.alive)) {
      state.over = true;
      burstConfetti();
      showModal('🎉 You Cleared It!', `You smashed every brick with ${state.score} points!`, 'Play Again', () => init(state.diff));
    }
  }
  draw();
  if (!state.over) raf = requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // bricks
  for (const br of state.bricks) {
    if (!br.alive) continue;
    ctx.fillStyle = br.color;
    ctx.beginPath();
    ctx.roundRect(br.x, br.y, br.w, br.h, 5);
    ctx.fill();
  }

  // paddle
  ctx.fillStyle = '#4a90c4';
  ctx.beginPath();
  ctx.roundRect(state.paddle.x, H - PADDLE_H - 6, state.paddle.w, PADDLE_H, 7);
  ctx.fill();

  // ball
  ctx.fillStyle = '#ff7e67';
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
  ctx.fill();
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
});

initGameFrame({
  title: 'Breakout',
  emoji: '🧱',
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
