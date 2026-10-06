'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const WAVES = 5, DUCKS_PER_WAVE = 3, MISS_LIMIT = 5;
const KEY = 'best-duck-hunt';

let score, best, lives, wave, ducks, shots, dog, flashes, started;

function reset() {
  score = 0; best = Number(localStorage.getItem(KEY) || 0);
  lives = 3; wave = 1; shots = 0; started = false;
  ducks = []; flashes = [];
  dog = { state: 'idle', t: 0 };
  spawnWave();
  updateHud();
}

function updateHud() {
  $('#score').textContent = score;
  $('#wave').textContent = wave;
  $('#left').textContent = Math.max(0, DUCKS_PER_WAVE - ducks.filter((d) => !d.hit).length);
  $('#lives').textContent = lives;
  $('#best').textContent = best;
}

function spawnWave() {
  ducks = [];
  for (let i = 0; i < DUCKS_PER_WAVE; i++) {
    ducks.push({
      x: 60 + i * 200, y: 120 + (i % 2) * 60,
      vx: (i % 2 === 0 ? 1 : -1) * (1.4 + wave * 0.35),
      vy: (i === 1 ? -0.7 : 0.4),
      r: 30, alive: true, hit: false, bob: Math.random() * 6
    });
  }
}

function shoot(x, y) {
  flashes.push({ x, y, t: 10 });
  const target = ducks.find((d) => d.alive && !d.hit &&
    Math.hypot(d.x - x, d.y - y) < d.r);
  shots++;
  if (target) {
    target.hit = true;
    target.alive = false;
    score += 10 * wave;
    if (score > best) { best = score; localStorage.setItem(KEY, String(best)); }
    updateHud();
    if (ducks.every((d) => d.hit)) {
      setTimeout(nextWave, 700);
    }
  } else {
    dog.state = 'laugh'; dog.t = 90;
    if (shots % MISS_LIMIT === 0) {
      lives--;
      updateHud();
      if (lives <= 0) { showModal('\uD83D\uDE22 Game Over', 'Score ' + score, 'Play Again', reset); return; }
    }
  }
}

function nextWave() {
  if (wave >= WAVES) {
    burstConfetti();
    showModal('\uD83C\uDF89 You Win!', 'You cleared all 5 waves! Score ' + score, 'Play Again', reset);
    return;
  }
  wave++;
  shots = 0;
  spawnWave();
  updateHud();
}

function update() {
  ducks.forEach((d) => {
    if (!d.alive) return;
    d.x += d.vx; d.y += d.vy;
    d.bob += 0.08;
    if (d.x < 40) { d.x = 40; d.vx *= -1; }
    if (d.x > W - 40) { d.x = W - 40; d.vx *= -1; }
    if (d.y < 70) { d.y = 70; d.vy *= -1; }
    if (d.y > H - 120) { d.y = H - 120; d.vy *= -1; }
  });
  flashes.forEach((f) => f.t--);
  flashes = flashes.filter((f) => f.t > 0);
  if (dog.t > 0) dog.t--;
  else dog.state = 'idle';
}

function drawDuck(d) {
  ctx.save();
  ctx.translate(d.x, d.y + Math.sin(d.bob) * 3);
  if (d.hit) {
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f08c00'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('\uD83E\uDDBA', 0, 2);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#495057'; ctx.lineWidth = 2; ctx.stroke();
  // head
  ctx.beginPath(); ctx.arc(16, -14, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // beak
  ctx.fillStyle = '#fd7e14';
  ctx.beginPath(); ctx.moveTo(26, -14); ctx.lineTo(40, -11); ctx.lineTo(26, -8); ctx.fill();
  // eye
  ctx.fillStyle = '#212529';
  ctx.beginPath(); ctx.arc(18, -17, 2.5, 0, Math.PI * 2); ctx.fill();
  // wing
  ctx.fillStyle = '#dee2e6';
  ctx.beginPath(); ctx.ellipse(-2, 2, 13, 8, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // feet
  ctx.strokeStyle = '#fd7e14'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-6, 20); ctx.lineTo(-6, 26); ctx.moveTo(6, 20); ctx.lineTo(6, 26); ctx.stroke();
  ctx.restore();
}

function draw() {
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4dabf7'); g.addColorStop(1, '#a5d8ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 4; i++) {
    const x = (i * 160 + 40) % W, y = 40 + (i % 2) * 30;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.arc(x + 22, y - 6, 18, 0, Math.PI * 2); ctx.arc(x - 22, y - 4, 16, 0, Math.PI * 2); ctx.fill();
  }
  // grass
  ctx.fillStyle = '#69db7c';
  ctx.fillRect(0, H - 90, W, 90);

  ducks.forEach(drawDuck);

  // dog
  const dx = W / 2, dy = H - 60;
  ctx.fillStyle = '#e03131';
  ctx.beginPath(); ctx.ellipse(dx, dy + 10, 34, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(dx + 26, dy - 10, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c92a2a';
  ctx.beginPath(); ctx.ellipse(dx - 20, dy - 12, 8, 16, 0.4, 0, Math.PI * 2); ctx.fill();
  if (dog.state === 'laugh') {
    ctx.fillStyle = '#212529';
    ctx.beginPath(); ctx.arc(dx + 20, dy - 14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx + 32, dy - 14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(dx + 18, dy - 4, 18, 8);
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HA HA HA!', dx, dy + 46);
  }

  // flashes
  flashes.forEach((f) => {
    ctx.strokeStyle = 'rgba(255,255,255,' + (f.t / 10) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(f.x, f.y, 22 - (10 - f.t), 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f.x - 12, f.y - 12); ctx.lineTo(f.x + 12, f.y + 12);
    ctx.moveTo(f.x + 12, f.y - 12); ctx.lineTo(f.x - 12, f.y + 12); ctx.stroke();
  });
}

function loop() {
  if (!$('#modal').classList.contains('hidden')) { draw(); requestAnimationFrame(loop); return; }
  update(); draw();
  requestAnimationFrame(loop);
}

function pos(e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - rect.left) * (W / rect.width), y: (src.clientY - rect.top) * (H / rect.height) };
}
canvas.addEventListener('mousedown', (e) => { const p = pos(e); shoot(p.x, p.y); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const p = pos(e); shoot(p.x, p.y); }, { passive: false });

initGameFrame({ title: 'Duck Hunt', emoji: '\uD83E\uDD86', onRestart: reset });

reset(); loop();
