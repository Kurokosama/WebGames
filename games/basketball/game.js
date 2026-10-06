'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const TOTAL = 20, KEY = 'best-basketball';

let ball, hoop, made, left, streak, best, flying, particles, shake;

function reset() {
  ball = { x: W / 2, y: H - 70, vx: 0, vy: 0, rot: 0, vr: 0 };
  hoop = { x: W / 2, y: 140, w: 120 };
  made = 0; left = TOTAL; streak = 0;
  best = Number(localStorage.getItem(KEY) || 0);
  flying = false; particles = []; shake = 0;
  updateHud();
}

function updateHud() {
  $('#made').textContent = made;
  $('#left').textContent = left;
  $('#streak').textContent = streak;
  $('#best').textContent = best;
}

function shoot() {
  if (flying || left <= 0) return;
  const angle = ($('#angle').value / 180) * Math.PI;
  const power = Number($('#power').value) / 22;
  ball.x = W / 2; ball.y = H - 70;
  ball.vx = Math.cos(angle) * power * (Math.random() < 0.5 ? -1 : 1) * (hoop.x < W / 2 ? 1 : -1) || (Math.random() - 0.5) * 2;
  // aim toward the hoop with a fixed launch angle
  const dx = hoop.x - ball.x, dy = hoop.y - ball.y;
  const g = 0.36;
  const v = Math.sqrt((dx * dx + 2 * g * Math.abs(dy)) / Math.max(0.05, Math.sin(2 * angle) / g * -1) * 0.55) || power;
  ball.vx = dx / 14;
  ball.vy = -power * 1.5;
  ball.vr = (Math.random() - 0.5) * 0.3;
  flying = true;
  left--;
  updateHud();
}

function splash(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 4 + 1;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 26, color });
  }
}

function scorePoint() {
  made++;
  streak++;
  if (streak > best) { best = streak; localStorage.setItem(KEY, String(best)); }
  splash(hoop.x, hoop.y + 12, '#ffd43b', 16);
  if (made >= 10) burstConfetti();
  updateHud();
}

function update() {
  if (flying) {
    ball.vy += 0.36;
    ball.x += ball.vx; ball.y += ball.vy;
    ball.rot += ball.vr;
    const l = hoop.x - hoop.w / 2, r = hoop.x + hoop.w / 2;
    // entering from above with downward speed
    if (ball.y - 11 >= hoop.y && ball.y - 11 <= hoop.y + 10 &&
        ball.x > l && ball.x < r && ball.vy > 0) {
      scorePoint();
      ball.y = hoop.y + 22;
      ball.vy *= 0.2;
      flying = false;
      shake = 6;
    }
    if (ball.y > H || ball.x < -30 || ball.x > W + 30) {
      ball.y = H - 70; ball.x = W / 2; ball.vy = 0; ball.vx = 0;
      flying = false;
      streak = 0; updateHud();
      splash(ball.x, ball.y, '#fff', 6);
    }
  }
  if (left <= 0 && !flying) {
    setTimeout(() => {
      if (made >= 10) burstConfetti();
      showModal(made >= 10 ? '\uD83C\uDF89 Great Shooting!' : '\uD83C\uDFB0 Nice Try!',
        'You made ' + made + ' of ' + TOTAL + ' shots (best streak ' + best + ').', 'Play Again', reset);
    }, 700);
  }
  if (shake > 0) shake--;
  particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.life--; });
  particles = particles.filter((p) => p.life > 0);
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  // court
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c88a4a'); g.addColorStop(1, '#a86a33');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, H - 60, 120, 0, Math.PI * 2); ctx.stroke();

  // backboard + hoop
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(hoop.x - 55, hoop.y - 62, 110, 58);
  ctx.strokeStyle = '#495057'; ctx.lineWidth = 3;
  ctx.strokeRect(hoop.x - 55, hoop.y - 62, 110, 58);
  ctx.fillStyle = '#e03131';
  ctx.fillRect(hoop.x - 34, hoop.y - 30, 68, 22);
  ctx.strokeStyle = '#fd7e14'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(hoop.x - hoop.w / 2, hoop.y + 6); ctx.lineTo(hoop.x + hoop.w / 2, hoop.y + 6); ctx.stroke();
  ctx.fillStyle = '#f8f9fa';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(hoop.x - 50 + i * 12, hoop.y + 10, 5, 0, Math.PI * 2); ctx.fill(); }

  // pole
  ctx.fillStyle = '#868e96';
  ctx.fillRect(hoop.x - 6, hoop.y - 4, 12, 120);

  // ball
  ctx.save();
  ctx.translate(ball.x, ball.y); ctx.rotate(ball.rot);
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#e8590c'; ctx.fill();
  ctx.strokeStyle = '#7f2704'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke();
  ctx.restore();

  particles.forEach((p) => {
    ctx.globalAlpha = p.life / 26;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 5, 5);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function loop() { if (!$('#modal').classList.contains('hidden')) { draw(); requestAnimationFrame(loop); return; } update(); draw(); requestAnimationFrame(loop); }

$('#shoot-btn').addEventListener('click', shoot);

initGameFrame({ title: 'Basketball Shoot', emoji: '\uD83C\uDFC0', onRestart: reset });

reset(); loop();
