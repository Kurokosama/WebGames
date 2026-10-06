'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const GROUND = H - 70;
const BASE = { x: W / 2, y: GROUND + 14 };
const BLAST_R = 46;
const MAX_WAVES = 5;
const KEY = 'best-missile-command';

const CITY_SPOTS = [70, 165, 260, W - 260, W - 165, W - 70];

let cities, enemies, friends, blasts, score, best, wave, running, spawnTimer, waveQueue;

function bestKey() { return KEY; }

function reset() {
  cities = CITY_SPOTS.map((x) => ({ x, alive: true }));
  enemies = [];
  friends = [];
  blasts = [];
  score = 0;
  wave = 1;
  best = Number(localStorage.getItem(bestKey()) || 0);
  waveQueue = [];
  spawnTimer = 0;
  running = true;
  queueWave();
  updateHud();
}

function queueWave() {
  const n = 5 + wave * 3;
  waveQueue = [];
  for (let i = 0; i < n; i++) waveQueue.push(0);
}

function updateHud() {
  $('#score').textContent = score;
  $('#cities').textContent = cities.filter((c) => c.alive).length;
  $('#wave').textContent = Math.min(wave, MAX_WAVES);
  $('#best').textContent = best;
}

const liveEnemies = () => enemies.filter((e) => !e.dead);

function fire(tx, ty) {
  if (!running) return;
  friends.push({
    x: BASE.x, y: BASE.y - 10,
    tx, ty, t: 0,
    trail: []
  });
}

function explode(x, y) {
  blasts.push({ x, y, r: 0, life: 26 });
  liveEnemies().forEach((e) => {
    if (Math.hypot(e.x - x, e.y - y) < BLAST_R + 10) {
      e.dead = true;
      score += 25;
    }
  });
  if (score > best) { best = score; localStorage.setItem(bestKey(), String(best)); }
  updateHud();
}

function update() {
  if (!running) return;

  // spawn queue
  spawnTimer++;
  if (waveQueue.length && spawnTimer > 34) {
    spawnTimer = 0;
    waveQueue.pop();
    const sx = Math.random() * (W - 60) + 30;
    const target = pick(cities.filter((c) => c.alive));
    enemies.push({
      x: sx, y: -10,
      tx: target ? target.x : W / 2,
      ty: GROUND + 6,
      dead: false
    });
  }

  // enemy movement
  enemies.forEach((e) => {
    if (e.dead) return;
    const dx = e.tx - e.x, dy = e.ty - e.y;
    const d = Math.hypot(dx, dy);
    const sp = 1.15 + wave * 0.28;
    if (d < sp) {
      // impact
      e.dead = true;
      explode(e.x, GROUND + 6);
      const city = cities.find((c) => c.alive && Math.abs(c.x - e.x) < 26);
      if (city) { city.alive = false; updateHud(); }
    } else {
      e.x += dx / d * sp;
      e.y += dy / d * sp;
    }
  });
  enemies = enemies.filter((e) => !e.dead || e.y < -50);

  // friendly missiles
  friends.forEach((f) => {
    f.trail.push({ x: f.x, y: f.y });
    if (f.trail.length > 6) f.trail.shift();
    const dx = f.tx - f.x, dy = f.ty - f.y;
    const d = Math.hypot(dx, dy);
    const sp = 11;
    if (d < sp) { f.done = true; explode(f.tx, f.ty); }
    else { f.x += dx / d * sp; f.y += dy / d * sp; }
  });
  friends = friends.filter((f) => !f.done);

  blasts.forEach((b) => { b.r += 2.4; b.life--; });
  blasts = blasts.filter((b) => b.life > 0);

  // wave / game over
  if (!waveQueue.length && !liveEnemies().length && !blasts.length) {
    if (wave >= MAX_WAVES) {
      running = false;
      burstConfetti();
      showModal('🛡️ You Win!', `You protected every city through all ${MAX_WAVES} waves! Score ${score}.`, 'Play Again', reset);
      return;
    }
    wave++;
    queueWave();
    updateHud();
  }
  if (cities.every((c) => !c.alive)) {
    running = false;
    showModal('💥 Game Over', `All cities are gone. Score ${score}, wave ${wave}.`, 'Play Again', reset);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // ground
  ctx.fillStyle = '#3b2f2f';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = '#5c4a4a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 50; i++) {
    ctx.fillRect((i * 89) % W, (i * 41) % (GROUND - 40), 2, 2);
  }

  // cities
  cities.forEach((c) => {
    if (!c.alive) {
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(c.x - 16, GROUND - 12, 32, 12);
      return;
    }
    ctx.fillStyle = '#63e6be';
    ctx.fillRect(c.x - 14, GROUND - 24, 28, 24);
    ctx.fillRect(c.x - 20, GROUND - 14, 6, 14);
    ctx.fillRect(c.x + 14, GROUND - 14, 6, 14);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(c.x - 3, GROUND - 32, 6, 8);
  });

  // base
  ctx.fillStyle = '#74c0fc';
  ctx.beginPath();
  ctx.moveTo(BASE.x - 26, GROUND + 14);
  ctx.lineTo(BASE.x, GROUND - 22);
  ctx.lineTo(BASE.x + 26, GROUND + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(BASE.x - 5, GROUND - 30, 10, 8);

  // enemies
  enemies.forEach((e) => {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y - 8);
    ctx.lineTo(e.x, e.y + 8);
    ctx.stroke();
    ctx.fillStyle = '#ffa8a8';
    ctx.fillRect(e.x - 2, e.y + 8, 4, 4);
  });

  // friendlies
  friends.forEach((f) => {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    ctx.beginPath();
    f.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.fillStyle = '#fff9db';
    ctx.fillRect(f.x - 2, f.y - 6, 4, 12);
  });

  // blasts
  blasts.forEach((b) => {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,196,83,0.7)');
    g.addColorStop(1, 'rgba(255,107,107,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  });
}

function loop() {
  if (!$('#modal').classList.contains('hidden')) { draw(); requestAnimationFrame(loop); return; }
  update();
  draw();
  requestAnimationFrame(loop);
}

function point(e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * (W / rect.width),
    y: (src.clientY - rect.top) * (H / rect.height)
  };
}
canvas.addEventListener('mousedown', (e) => { const p = point(e); fire(p.x, p.y); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const p = point(e); fire(p.x, p.y); }, { passive: false });

reset();
loop();

initGameFrame({
  title: 'Missile Command',
  emoji: '🚀',
  onRestart: reset
});