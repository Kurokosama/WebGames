'use strict';

const W = 480;
const H = 520;
const INV_W = 36;
const INV_H = 26;

const DIFFS = {
  easy: { rows: 3, moveEvery: 850, shootEvery: [2200, 4200] },
  medium: { rows: 4, moveEvery: 600, shootEvery: [1500, 3200] },
  hard: { rows: 5, moveEvery: 420, shootEvery: [900, 2100] }
};

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let raf = null;
let keys = {};

function init(diff) {
  cancelAnimationFrame(raf);
  const cfg = DIFFS[diff];
  state = {
    diff, cfg,
    player: { x: W / 2 - 22, w: 44, lives: 3, hitCooldown: 0 },
    invaders: [],
    bullets: [],
    invBullets: [],
    shields: [],
    dir: 1,
    moveTimer: 0,
    shootTimer: 0,
    score: 0,
    over: false,
    last: performance.now()
  };
  // build invaders
  const cols = 8;
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cols; c++) {
      state.invaders.push({ x: 50 + c * 50, y: 50 + r * 38, alive: true, tier: cfg.rows - r });
    }
  }
  // shields
  for (let i = 0; i < 3; i++) {
    state.shields.push({ x: 110 + i * 130, y: H - 100, w: 56, h: 20, hp: 4 });
  }
  $('#score').textContent = '0';
  $('#lives').textContent = '❤️❤️❤️';
  draw();
  raf = requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (!state.over) {
    // player movement
    const p = state.player;
    p.hitCooldown = Math.max(0, p.hitCooldown - dt / 1000);
    if (keys.left) p.x -= 4.4 * (dt / 16.6);
    if (keys.right) p.x += 4.4 * (dt / 16.6);
    p.x = Math.max(8, Math.min(W - p.w - 8, p.x));

    // shooting
    if (keys.shoot && state.bullets.length === 0) {
      state.bullets.push({ x: p.x + p.w / 2 - 2, y: H - 40, w: 4, h: 14 });
    }

    // move invaders
    state.moveTimer += dt;
    const alive = state.invaders.filter((i) => i.alive);
    if (alive.length) {
      const speedMul = Math.max(0.4, 1 - (colsCount() - alive.length) / (colsCount() * 1.5));
      if (state.moveTimer > state.cfg.moveEvery * speedMul) {
        state.moveTimer = 0;
        let edge = false;
        for (const inv of alive) {
          inv.x += 14 * state.dir;
          if (inv.x < 8 || inv.x + INV_W > W - 8) edge = true;
        }
        if (edge) {
          state.dir *= -1;
          for (const inv of alive) {
            inv.x += 14 * state.dir;
            inv.y += 18;
            if (inv.y + INV_H > H - 70) { gameOver(); return; }
          }
        }
      }
    }

    // invaders shoot back
    state.shootTimer += dt;
    if (alive.length && state.shootTimer > randInt(state.cfg.shootEvery[0], state.cfg.shootEvery[1])) {
      state.shootTimer = 0;
      const shooter = pick(alive);
      state.invBullets.push({ x: shooter.x + INV_W / 2 - 2, y: shooter.y + INV_H, w: 4, h: 12 });
    }

    // move bullets
    for (const b of state.bullets) b.y -= 6 * (dt / 16.6);
    for (const b of state.invBullets) b.y += 4 * (dt / 16.6);
    state.bullets = state.bullets.filter((b) => b.y > -20);
    state.invBullets = state.invBullets.filter((b) => b.y < H + 20);

    // collisions: player bullets vs invaders
    for (const b of state.bullets) {
      for (const inv of state.invaders) {
        if (inv.alive && rectHit(b, inv, INV_W, INV_H)) {
          inv.alive = false;
          b.dead = true;
          state.score += 10 * inv.tier;
          $('#score').textContent = state.score;
          break;
        }
      }
      // shields
      for (const s of state.shields) {
        if (s.hp > 0 && rectHit(b, s, s.w, s.h)) { b.dead = true; s.hp--; }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);

    // invader bullets vs player & shields
    for (const b of state.invBullets) {
      let hit = false;
      if (p.hitCooldown === 0 && rectHit(b, { x: p.x, y: H - 36, w: p.w, h: 18 }, p.w, 18)) {
        hit = true;
        loseLife();
      } else {
        for (const s of state.shields) {
          if (s.hp > 0 && rectHit(b, s, s.w, s.h)) { hit = true; s.hp--; }
        }
      }
      if (hit) b.dead = true;
    }
    state.invBullets = state.invBullets.filter((b) => !b.dead);

    // win check
    if (state.invaders.every((i) => !i.alive)) {
      state.over = true;
      cancelAnimationFrame(raf);
      burstConfetti();
      showModal('🎉 You Win!', `You destroyed all invaders with ${state.score} points!`, 'Play Again', () => init(state.diff));
    }
  }
  draw();
  if (!state.over) raf = requestAnimationFrame(loop);
}

function colsCount() {
  return 8;
}

function rectHit(a, b, bw, bh) {
  return a.x < b.x + bw && a.x + a.w > b.x && a.y < b.y + bh && a.y + a.h > b.y;
}

function loseLife() {
  if (state.player.hitCooldown > 0 || state.over) return;
  state.player.lives--;
  state.player.hitCooldown = 1.2;
  $('#lives').textContent = '❤️'.repeat(Math.max(0, state.player.lives)) + '🖤'.repeat(Math.max(0, 3 - state.player.lives));
  if (state.player.lives <= 0) gameOver();
}

function gameOver() {
  state.over = true;
  cancelAnimationFrame(raf);
  showModal('😅 Game Over', `You scored ${state.score} points!`, 'Play Again', () => init(state.diff));
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // invaders
  for (const inv of state.invaders) {
    if (!inv.alive) continue;
    ctx.fillStyle = inv.tier >= 3 ? '#ff7e67' : inv.tier === 2 ? '#4cc9f0' : '#06d6a0';
    ctx.beginPath();
    ctx.roundRect(inv.x, inv.y, INV_W, INV_H, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(inv.x + 6, inv.y + 5, 5, 5);
    ctx.fillRect(inv.x + INV_W - 11, inv.y + 5, 5, 5);
  }

  // player
  ctx.globalAlpha = state.player.hitCooldown > 0 && Math.floor(state.player.hitCooldown * 10) % 2 === 0 ? 0.35 : 1;
  ctx.fillStyle = '#4a90c4';
  ctx.beginPath();
  ctx.moveTo(state.player.x, H - 18);
  ctx.lineTo(state.player.x + state.player.w / 2, H - 40);
  ctx.lineTo(state.player.x + state.player.w, H - 18);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // shields
  for (const s of state.shields) {
    if (s.hp <= 0) continue;
    ctx.fillStyle = s.hp >= 3 ? '#06d6a0' : s.hp === 2 ? '#ffd166' : '#ff7e67';
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 4);
    ctx.fill();
  }

  // bullets
  ctx.fillStyle = '#fff';
  for (const b of state.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#ff7e67';
  for (const b of state.invBullets) ctx.fillRect(b.x, b.y, b.w, b.h);
}

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') { keys.left = true; e.preventDefault(); }
  if (k === 'arrowright' || k === 'd') { keys.right = true; e.preventDefault(); }
  if (e.key === ' ') { keys.shoot = true; e.preventDefault(); }
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') keys.left = false;
  if (k === 'arrowright' || k === 'd') keys.right = false;
  if (e.key === ' ') keys.shoot = false;
});

initGameFrame({
  title: 'Space Invaders',
  emoji: '👾',
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
