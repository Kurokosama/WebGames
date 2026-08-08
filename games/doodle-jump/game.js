'use strict';

const W = 360;
const H = 520;
const PLAYER_W = 30;
const PLAYER_H = 34;
const GRAVITY = 0.32;
const JUMP_VY = -9.5;
const MOVE_SPEED = 5.2;
const CAMERA_LINE = H * 0.45;

const DIFFS = {
  easy: { gap: [48, 78], moveChance: 0 },
  medium: { gap: [52, 90], moveChance: 0.22 },
  hard: { gap: [58, 105], moveChance: 0.42 }
};

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let raf = null;
let keys = {};
let sessionBest = 0;

function init(diff) {
  cancelAnimationFrame(raf);
  const cfg = DIFFS[diff];
  state = {
    diff, cfg,
    player: { x: W / 2 - PLAYER_W / 2, y: H - 80, vy: 0 },
    platforms: [],
    score: 0,
    over: false,
    last: performance.now()
  };
  // Guarantee a platform right under the player so the game always starts well.
  state.platforms.push({ x: W / 2 - 32, w: 64, y: state.player.y + PLAYER_H, moving: false, dir: 1 });
  let y = state.platforms[0].y;
  while (y > 0) {
    y -= randInt(cfg.gap[0], cfg.gap[1]);
    state.platforms.push(makePlatform(y));
  }
  $('#score').textContent = '0';
  $('#best').textContent = sessionBest;
  draw();
  raf = requestAnimationFrame(loop);
}

function makePlatform(y) {
  const moving = state.cfg.moveChance > 0 && Math.random() < state.cfg.moveChance;
  return { x: randInt(6, W - 70), w: 64, y, moving, dir: Math.random() < 0.5 ? 1 : -1 };
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (!state.over) {
    const p = state.player;

    // horizontal movement
    if (keys.left) p.x -= MOVE_SPEED * (dt / 16.6);
    if (keys.right) p.x += MOVE_SPEED * (dt / 16.6);
    // wrap around
    if (p.x < -PLAYER_W) p.x = W;
    if (p.x > W) p.x = -PLAYER_W;

    // vertical physics
    p.vy += GRAVITY * (dt / 16.6);
    const prevFeet = p.y + PLAYER_H;
    p.y += p.vy * (dt / 16.6);

    // landing (crossing detection: works even on slow/frame-skipping displays)
    if (p.vy > 0) {
      const feet = p.y + PLAYER_H;
      for (const plat of state.platforms) {
        if (prevFeet <= plat.y + 4 && feet >= plat.y - 4 &&
            p.x + PLAYER_W > plat.x && p.x < plat.x + plat.w) {
          p.vy = JUMP_VY;
          p.y = plat.y - PLAYER_H;
          break;
        }
      }
    }

    // move platforms
    for (const plat of state.platforms) {
      if (plat.moving) {
        plat.x += plat.dir * 1.5 * (dt / 16.6);
        if (plat.x < 0) { plat.x = 0; plat.dir = 1; }
        if (plat.x > W - plat.w) { plat.x = W - plat.w; plat.dir = -1; }
      }
    }

    // camera scroll
    if (p.y < CAMERA_LINE) {
      const dy = CAMERA_LINE - p.y;
      p.y += dy;
      state.score += Math.round(dy);
      $('#score').textContent = state.score;
      if (state.score > sessionBest) {
        sessionBest = state.score;
        $('#best').textContent = sessionBest;
      }
      for (const plat of state.platforms) plat.y += dy;
      // spawn platforms above
      let top = 0;
      for (const plat of state.platforms) top = Math.min(top, plat.y);
      while (top > -40) {
        top -= randInt(state.cfg.gap[0], state.cfg.gap[1]);
        state.platforms.push(makePlatform(top));
      }
      state.platforms = state.platforms.filter((plat) => plat.y < H + 40);
    }

    // fall off
    if (p.y > H + 40) gameOver();
  }
  draw();
  if (!state.over) raf = requestAnimationFrame(loop);
}

function gameOver() {
  state.over = true;
  cancelAnimationFrame(raf);
  showModal('😅 Oops!', `You climbed ${state.score} points!`, 'Play Again', () => init(state.diff));
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // platforms
  for (const plat of state.platforms) {
    ctx.fillStyle = plat.moving ? '#ff7e67' : '#4caf9b';
    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y, plat.w, 12, 6);
    ctx.fill();
  }

  // doodle
  const p = state.player;
  // body
  ctx.fillStyle = '#4cc9f0';
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, PLAYER_W, PLAYER_H, 12);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(p.x + 9, p.y + 12, 5, 0, Math.PI * 2);
  ctx.arc(p.x + 21, p.y + 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(p.x + 10, p.y + 13, 2.4, 0, Math.PI * 2);
  ctx.arc(p.x + 22, p.y + 13, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // smile
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x + 15, p.y + 16, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') { keys.left = true; e.preventDefault(); }
  if (k === 'arrowright' || k === 'd') { keys.right = true; e.preventDefault(); }
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') keys.left = false;
  if (k === 'arrowright' || k === 'd') keys.right = false;
});

initGameFrame({
  title: 'Doodle Jump',
  emoji: '🐸',
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
