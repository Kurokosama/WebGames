'use strict';

const W = 400;
const H = 540;
const BIRD_X = 90;
const BIRD_R = 14;
const GROUND_H = 60;

const DIFFS = {
  easy: { gap: 160, speed: 2.2, gravity: 0.35, flap: -6.5 },
  medium: { gap: 130, speed: 2.8, gravity: 0.42, flap: -6.8 },
  hard: { gap: 100, speed: 3.4, gravity: 0.5, flap: -7.0 }
};

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let raf = null;
let sessionBest = 0;

function init(diff) {
  cancelAnimationFrame(raf);
  const cfg = DIFFS[diff];
  state = {
    diff, cfg,
    bird: { y: H / 2, vy: 0 },
    pipes: [],
    score: 0,
    over: false,
    started: false,
    last: performance.now(),
    pipeTimer: 0
  };
  $('#score').textContent = '0';
  $('#best').textContent = sessionBest;
  draw();
  raf = requestAnimationFrame(loop);
}

function flap() {
  if (!state || state.over) return;
  state.started = true;
  state.bird.vy = state.cfg.flap;
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (!state.over) {
    const b = state.bird;
    if (state.started) {
      b.vy += state.cfg.gravity * (dt / 16.6);
      b.y += b.vy * (dt / 16.6);

      // spawn pipes
      state.pipeTimer += dt;
      if (state.pipeTimer > 1650) {
        state.pipeTimer = 0;
        const gapY = randInt(90, H - GROUND_H - state.cfg.gap - 90);
        state.pipes.push({ x: W + 20, gapY, gap: state.cfg.gap, passed: false });
      }
      // move pipes
      state.pipes.forEach((p) => { p.x -= state.cfg.speed * (dt / 16.6); });
      state.pipes = state.pipes.filter((p) => p.x > -70);

      // score + collision
      for (const p of state.pipes) {
        if (!p.passed && p.x + 26 < BIRD_X) {
          p.passed = true;
          state.score++;
          $('#score').textContent = state.score;
          if (state.score > sessionBest) {
            sessionBest = state.score;
            $('#best').textContent = sessionBest;
          }
        }
        // pipe collision
        const pipeW = 26;
        if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + pipeW) {
          const birdTop = b.y - BIRD_R;
          const birdBottom = b.y + BIRD_R;
          if (birdTop < p.gapY || birdBottom > p.gapY + p.gap) {
            gameOver();
          }
        }
      }
      // ground / ceiling
      if (b.y + BIRD_R > H - GROUND_H) gameOver();
      if (b.y - BIRD_R < 0) { b.y = BIRD_R; b.vy = 0; }
    }
  }
  draw();
  if (!state.over) raf = requestAnimationFrame(loop);
}

function gameOver() {
  state.over = true;
  cancelAnimationFrame(raf);
  showModal('😅 Game Over', `You scored ${state.score} point${state.score === 1 ? '' : 's'}!`, 'Play Again', () => init(state.diff));
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // pipes
  state.pipes.forEach((p) => {
    ctx.fillStyle = '#43a047';
    ctx.fillRect(p.x, 0, 26, p.gapY - 40);
    ctx.fillRect(p.x, p.gapY + p.gap + 40, 26, H - GROUND_H - (p.gapY + p.gap + 40));
    ctx.fillStyle = '#66bb6a';
    ctx.fillRect(p.x - 3, p.gapY - 52, 32, 14);
    ctx.fillRect(p.x - 3, p.gapY + p.gap + 38, 32, 14);
  });

  // bird
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(BIRD_X, state.bird.y, BIRD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f47ba1';
  ctx.beginPath();
  ctx.moveTo(BIRD_X + BIRD_R, state.bird.y);
  ctx.lineTo(BIRD_X + BIRD_R + 12, state.bird.y - 3);
  ctx.lineTo(BIRD_X + BIRD_R + 12, state.bird.y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(BIRD_X + 5, state.bird.y - 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(BIRD_X + 7, state.bird.y - 5, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // ground
  ctx.fillStyle = '#d8b36a';
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
  ctx.fillStyle = '#c39a4e';
  ctx.fillRect(0, H - GROUND_H, W, 8);
}

canvas.addEventListener('click', flap);
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); }
});

initGameFrame({
  title: 'Flappy Bird',
  emoji: '🐦',
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
