'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const KEY = 'best-asteroids';

let ship, bullets, rocks, score, lives, best, level, playing, fireCooldown, keys;

function bestKey() { return KEY; }

function reset() {
  ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, r: 13 };
  bullets = [];
  score = 0; lives = 3; level = 1;
  best = Number(localStorage.getItem(bestKey()) || 0);
  keys = {};
  fireCooldown = 0;
  playing = true;
  spawnRocks();
  updateHud();
}

function spawnRocks() {
  rocks = [];
  const count = 3 + level;
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do {
      x = Math.random() * W;
      y = Math.random() * H;
      tries++;
    } while (Math.hypot(x - ship.x, y - ship.y) < 130 && tries < 30);
    rocks.push(newRock(x, y, 3));
  }
}

function newRock(x, y, size) {
  const speeds = [0, 42, 68, 95];
  const ang = Math.random() * Math.PI * 2;
  const s = speeds[size] + level * 3;
  return { x, y, size, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 2.4 };
}

function updateHud() {
  $('#score').textContent = score;
  $('#lives').textContent = lives;
  $('#best').textContent = best;
  $('#level').textContent = level;
}

function wrap(o) {
  if (o.x < 0) o.x += W; if (o.x > W) o.x -= W;
  if (o.y < 0) o.y += H; if (o.y > H) o.y -= H;
}

function shoot() {
  if (!playing || fireCooldown > 0) return;
  fireCooldown = 14;
  bullets.push({
    x: ship.x + Math.cos(ship.a) * 16,
    y: ship.y + Math.sin(ship.a) * 16,
    vx: ship.vx + Math.cos(ship.a) * 8.5,
    vy: ship.vy + Math.sin(ship.a) * 8.5,
    life: 60
  });
}

function update() {
  if (!playing) return;

  if (keys.ArrowLeft || keys.a) ship.a -= 0.055;
  if (keys.ArrowRight || keys.d) ship.a += 0.055;
  if (keys.ArrowUp || keys.w) {
    ship.vx += Math.cos(ship.a) * 0.16;
    ship.vy += Math.sin(ship.a) * 0.16;
  }
  ship.vx *= 0.995; ship.vy *= 0.995;
  ship.x += ship.vx; ship.y += ship.vy;
  wrap(ship);

  if (fireCooldown > 0) fireCooldown--;
  if (keys[' ']) shoot();

  bullets.forEach((b) => { b.x += b.vx; b.y += b.vy; b.life--; wrap(b); });
  bullets = bullets.filter((b) => b.life > 0);

  rocks.forEach((r) => { r.x += r.vx; r.y += r.vy; r.rot += r.vr; wrap(r); });

  // bullet vs rock
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    for (let j = rocks.length - 1; j >= 0; j--) {
      const r = rocks[j];
      if (Math.hypot(b.x - r.x, b.y - r.y) < r.size * 14) {
        bullets.splice(i, 1);
        score += [0, 100, 50, 20][r.size] || 20;
        rocks.splice(j, 1);
        if (r.size > 1) {
          rocks.push(newRock(r.x, r.y, r.size - 1), newRock(r.x, r.y, r.size - 1));
        }
        if (score > best) { best = score; localStorage.setItem(bestKey(), String(best)); }
        if (score > 0 && score % 1000 === 0) burstConfetti();
        updateHud();
        break;
      }
    }
  }

  // ship vs rock
  for (const r of rocks) {
    if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.size * 13 + ship.r - 4) {
      hit();
      break;
    }
  }

  if (playing && rocks.length === 0) {
    level++;
    updateHud();
    spawnRocks();
  }
}

function hit() {
  lives--;
  updateHud();
  burst();
  if (lives <= 0) {
    playing = false;
    showModal('💥 Game Over', `You scored ${score} points and reached level ${level}.`, 'Play Again', reset);
    return;
  }
  ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, r: 13 };
  rocks = rocks.filter((r) => Math.hypot(r.x - ship.x, r.y - ship.y) > 150);
}

function burst() {
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 4;
    bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 26 });
  }
}

function poly(x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function draw() {
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 60; i++) {
    ctx.fillRect((i * 97) % W, (i * 53) % H, 1.5, 1.5);
  }

  ctx.strokeStyle = '#c9d6ff';
  ctx.lineWidth = 2;
  if (playing) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.a);
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-11, -10); ctx.lineTo(-6, 0); ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  rocks.forEach((r) => {
    ctx.strokeStyle = '#f1f3f5';
    ctx.lineWidth = 2;
    poly(r.x, r.y, r.size * 14, 7 + r.size, r.rot);
    ctx.stroke();
  });

  ctx.strokeStyle = '#ffd43b';
  ctx.lineWidth = 3;
  bullets.forEach((b) => {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2);
    ctx.stroke();
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

const held = {};
$$('.tc-btn').forEach((b) => {
  const act = b.dataset.act;
  b.addEventListener('touchstart', (e) => { e.preventDefault(); pressed(act); }, { passive: false });
  b.addEventListener('mousedown', (e) => { e.preventDefault(); pressed(act); });
});
function pressed(act) {
  if (!playing) return;
  if (act === 'fire') shoot();
  else if (act === 'thrust') { keys.ArrowUp = true; setTimeout(() => { keys.ArrowUp = false; }, 180); }
  else if (act === 'left') { keys.ArrowLeft = true; setTimeout(() => { keys.ArrowLeft = false; }, 180); }
  else if (act === 'right') { keys.ArrowRight = true; setTimeout(() => { keys.ArrowRight = false; }, 180); }
}

reset();
loop();

initGameFrame({
  title: 'Asteroids',
  emoji: '🚀',
  onRestart: reset
});