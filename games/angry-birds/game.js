'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const GROUND = H - 70;
const KEY = 'best-angry-birds';

const LEVELS = [
  { blocks: [[420, 0], [460, 0], [440, 1]], pigs: [[440, 2]] },
  { blocks: [[400, 0], [440, 0], [480, 0], [420, 1], [460, 1]], pigs: [[440, 2], [600, 0]] },
  { blocks: [[380, 0], [420, 0], [460, 0], [500, 0], [400, 1], [440, 1], [440, 2]], pigs: [[440, 3], [600, 0], [620, 0]] }
];

let bird, blocks, pigs, dragging, trail, score, best, level, birdsLeft, particles, done;

function reset() {
  score = 0; best = Number(localStorage.getItem(KEY) || 0); level = 0;
  loadLevel();
}

function loadLevel() {
  const L = LEVELS[level];
  blocks = L.blocks.map(([x, row]) => ({ x, y: GROUND - (row + 1) * 30, w: 40, h: 30, hp: 2, angle: 0 }));
  pigs = L.pigs.map(([x, row]) => ({ x, y: GROUND - (row + 1) * 30 - 14, r: 14, hp: 2 }));
  birdsLeft = 3;
  bird = { x: 110, y: GROUND - 22, vx: 0, vy: 0, r: 16, launched: false };
  dragging = false; trail = []; particles = []; done = false;
  updateHud();
}

function updateHud() {
  $('#score').textContent = score;
  $('#birds').textContent = birdsLeft;
  $('#pigs').textContent = pigs.filter((p) => p.hp > 0).length;
  $('#level').textContent = level + 1;
  $('#best').textContent = best;
}

function burst(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 3 + 1;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 30, color });
  }
}

function overlapsCircleRect(cx, cy, cr, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return Math.hypot(cx - nx, cy - ny) < cr;
}

function launch() {
  if (!bird.launched && bird.vx !== 0) {
    bird.launched = true;
    birdsLeft--;
    updateHud();
  }
}

function update() {
  particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--; });
  particles = particles.filter((p) => p.life > 0);

  if (bird.launched) {
    bird.vy += 0.45;
    bird.x += bird.vx; bird.y += bird.vy;
    trail.push({ x: bird.x, y: bird.y });
    if (trail.length > 6) trail.shift();

    // ground
    if (bird.y + bird.r > GROUND) {
      bird.y = GROUND - bird.r; bird.vx *= 0.5; bird.vy *= -0.35;
      if (Math.abs(bird.vy) < 1.2) bird.launched = false;
    }
    if (bird.x < 0 || bird.x > W) bird.launched = false;

    // blocks
    blocks.forEach((b) => {
      if (b.hp <= 0) return;
      if (Math.hypot(bird.x - (b.x + b.w / 2), bird.y - (b.y + b.h / 2)) < b.w / 2 + bird.r * 0.7) {
        b.hp -= 1;
        bird.vy *= -0.35; bird.vx *= 0.6;
        burst(b.x + b.w / 2, b.y + b.h / 2, '#8d6e63');
        if (b.hp <= 0) { score += 10; updateHud(); }
      }
    });
    // pigs
    pigs.forEach((p) => {
      if (p.hp <= 0) return;
      if (Math.hypot(bird.x - p.x, bird.y - p.y) < p.r + bird.r * 0.7) {
        p.hp -= 1;
        burst(p.x, p.y, '#69db7c');
        bird.vy *= -0.3; bird.vx *= 0.5;
        if (p.hp <= 0) { score += 50; updateHud(); }
      }
    });

    if (!pigs.some((p) => p.hp > 0)) {
      done = true;
      burstConfetti();
      if (level >= LEVELS.length - 1) {
        wins();
      } else {
        setTimeout(() => showModal('\uD83C\uDF89 Level Clear!', 'All pigs popped!', 'Next level', () => { level++; loadLevel(); }), 500);
      }
    } else if (Math.abs(bird.vx) < 0.4 && !bird.launched && birdsLeft > 0) {
      // bird stopped, ready again
    }
  }

  if (!done && !bird.launched && birdsLeft <= 0 &&
      Math.abs(bird.vx) < 0.5 && bird.y + bird.r >= GROUND - 1) {
    setTimeout(() => {
      if (pigs.some((p) => p.hp > 0) && !done) {
        showModal('\uD83D\uDE22 Out of birds', 'Try this level again!', 'Retry', () => { level--; loadLevel(); level++; });
      }
    }, 1200);
  }
}

function wins() {
  if (score > best) { best = score; localStorage.setItem(KEY, String(best)); }
  showModal('\uD83C\uDFC6 All levels clear!', 'Final score ' + score, 'Play Again', reset);
}

function draw() {
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#74c0fc'); g.addColorStop(1, '#d0ebff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(120, 60, 30, 0, Math.PI * 2); ctx.arc(160, 50, 24, 0, Math.PI * 2); ctx.arc(90, 55, 20, 0, Math.PI * 2); ctx.fill();
  // ground
  ctx.fillStyle = '#8fce6a'; ctx.fillRect(0, GROUND, W, H - GROUND);

  // slingshot
  ctx.strokeStyle = '#795241'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(110, GROUND); ctx.lineTo(104, GROUND - 50); ctx.moveTo(104, GROUND - 50); ctx.lineTo(90, GROUND - 70); ctx.moveTo(104, GROUND - 50); ctx.lineTo(124, GROUND - 70); ctx.stroke();

  // trail
  if (bird.launched && trail.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    trail.forEach((t) => { ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI * 2); ctx.fill(); });
  }

  // blocks
  blocks.forEach((b) => {
    if (b.hp <= 0) return;
    ctx.fillStyle = '#b5651d';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#7f3d0d'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
  });
  // pigs
  pigs.forEach((p) => {
    if (p.hp <= 0) return;
    ctx.fillStyle = '#69db7c';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath(); ctx.ellipse(p.x - 5, p.y - 3, 3, 4, 0, 0, Math.PI * 2); ctx.ellipse(p.x + 5, p.y - 3, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
  });

  // bird
  if (bird) {
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bird.x + 5, bird.y - 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#212529';
    ctx.beginPath(); ctx.arc(bird.x + 7, bird.y - 4, 2.5, 0, Math.PI * 2); ctx.fill();
    // beak
    ctx.fillStyle = '#fd7e14';
    ctx.beginPath(); ctx.moveTo(bird.x + 11, bird.y); ctx.lineTo(bird.x + 22, bird.y + 3); ctx.lineTo(bird.x + 11, bird.y + 6); ctx.fill();
  }

  particles.forEach((p) => {
    ctx.globalAlpha = p.life / 30; ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  });
  ctx.globalAlpha = 1;
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
let dragStart = null;
canvas.addEventListener('mousedown', (e) => { if (!bird.launched) { dragStart = pos(e); dragging = true; } });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (!bird.launched) { dragStart = pos(e); dragging = true; } }, { passive: false });
canvas.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const p = pos(e);
  const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
  bird.x = 110 + dx * 0.6; bird.y = GROUND - 22 + dy * 0.6;
  bird.y = Math.min(bird.y, GROUND - 22);
});
canvas.addEventListener('touchmove', (e) => {
  if (!dragging) return; e.preventDefault();
  const p = pos(e);
  bird.x = 110 + (p.x - dragStart.x) * 0.6; bird.y = Math.min(GROUND - 22, GROUND - 22 + (p.y - dragStart.y) * 0.6);
}, { passive: false });
canvas.addEventListener('mouseup', () => {
  if (!dragging) return; dragging = false;
  bird.vx = (110 - bird.x) * 0.22; bird.vy = (GROUND - 22 - bird.y) * 0.22;
  bird.x = 110; bird.y = GROUND - 22;
  launch();
});
canvas.addEventListener('touchend', (e) => {
  if (!dragging) return; e.preventDefault(); dragging = false;
  bird.vx = (110 - bird.x) * 0.22; bird.vy = (GROUND - 22 - bird.y) * 0.22;
  bird.x = 110; bird.y = GROUND - 22;
  launch();
});

initGameFrame({ title: 'Slingshot Birds', emoji: '\uD83D\uDC21', onRestart: reset });

reset(); loop();
