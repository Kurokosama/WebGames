'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const WIN = 7;
const KEY = 'best-air-hockey';

const P_R = 26;          // paddle radius
const PC_R = 16;         // puck radius
const GOAL_H = 46;       // goal mouth height

let you, cpu, puck, scoreYou, scoreCpu, streak, best, running;

function bestKey() { return KEY; }

function reset() {
  scoreYou = 0; scoreCpu = 0;
  streak = 0;
  best = Number(localStorage.getItem(bestKey()) || 0);
  newPositions();
  running = true;
  updateHud();
}

function newPositions() {
  you = { x: W / 2, y: H - 90, r: P_R };
  cpu = { x: W / 2, y: 90, r: P_R };
  serve();
}

function serve() {
  const dir = Math.random() < 0.5 ? -1 : 1;
  const speed = 6 + (scoreYou + scoreCpu) * 0.55;
  puck = {
    x: W / 2, y: H / 2,
    vx: (Math.random() * 0.5 + 0.5) * speed * (Math.random() < 0.5 ? -1 : 1),
    vy: dir * speed,
    r: PC_R
  };
  clampPuck();
}

function clampPuck() {
  if (puck.vx * puck.vx + puck.vy * puck.vy > 14 * 14) {
    const s = 14 / Math.hypot(puck.vx, puck.vy);
    puck.vx *= s; puck.vy *= s;
  }
}

function updateHud() {
  $('#score-you').textContent = scoreYou;
  $('#score-cpu').textContent = scoreCpu;
  $('#best').textContent = best;
}

function movePaddle(p, vx, vy) {
  p.x += vx; p.y += vy;
  p.x = Math.max(p.r, Math.min(W - p.r, p.x));
  p.y = Math.max(p.r, Math.min(H - p.r, p.y));
}

function collide(p) {
  const dx = puck.x - p.x, dy = puck.y - p.y;
  const dist = Math.hypot(dx, dy);
  const min = p.r + puck.r;
  if (dist === 0 || dist > min) return;
  const nx = dx / dist, ny = dy / dist;
  const push = min - dist;
  puck.x += nx * push;
  puck.y += ny * push;
  const dot = puck.vx * nx + puck.vy * ny;
  puck.vx = (puck.vx - 2 * dot * nx) * 1.02;
  puck.vy = (puck.vy - 2 * dot * ny) * 1.02;
  if (Math.abs(puck.vx) < 1.6) puck.vx += (puck.vx >= 0 ? 1.6 : -1.6);
  clampPuck();
}

function goal(scoredByPlayer) {
  if (scoredByPlayer) {
    scoreYou++; streak++;
    if (streak > best) { best = streak; localStorage.setItem(bestKey(), String(best)); }
  } else {
    scoreCpu++; streak = 0;
  }
  updateHud();
  if (scoreYou >= WIN || scoreCpu >= WIN) {
    running = false;
    const won = scoreYou >= WIN;
    if (won) burstConfetti();
    showModal(won ? '🏆 You Win!' : '😢 Computer Wins',
      `Final score — You ${scoreYou} : ${scoreCpu} Computer`,
      'Play Again', reset);
    return;
  }
  serve();
}

function update() {
  // Computer AI: track the puck, but only reach a fraction of the speed.
  const targetY = Math.max(cpu.r + 12, Math.min(H - GOAL_H - cpu.r - 12,
    cpu.y + (puck.y - cpu.y) * 0.09 + Math.sin(Date.now() / 300) * 1.6));
  cpu.y += Math.max(-9, Math.min(9, targetY - cpu.y));
  cpu.x += Math.max(-9, Math.min(9, puck.x - cpu.x));

  puck.x += puck.vx;
  puck.y += puck.vy;

  if (puck.x - puck.r < 0) { puck.x = puck.r; puck.vx *= -1; }
  if (puck.x + puck.r > W) { puck.x = W - puck.r; puck.vx *= -1; }

  // Goals
  const inMouth = Math.abs(puck.x - W / 2) < 70;
  if (puck.y - puck.r < 0 && inMouth) { goal(true); return; }
  if (puck.y + puck.r > H && inMouth) { goal(false); return; }

  if (puck.y - puck.r < 0) { puck.y = puck.r; puck.vy *= -1; }
  if (puck.y + puck.r > H) { puck.y = H - puck.r; puck.vy *= -1; }

  collide(you);
  collide(cpu);

  // gentle friction
  puck.vx *= 0.9992;
  puck.vy *= 0.9992;
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // centre line + circle
  ctx.strokeStyle = '#b7dcf7';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.stroke();

  // goals
  ctx.fillStyle = '#ff8787';
  ctx.fillRect(W / 2 - 70, 0, 140, GOAL_H);
  ctx.fillStyle = '#74c0fc';
  ctx.fillRect(W / 2 - 70, H - GOAL_H, 140, GOAL_H);

  const drawPaddle = (p, fill, stroke) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = stroke; ctx.stroke();
  };
  drawPaddle(cpu, '#e599f7', '#9c36b5');
  drawPaddle(you, '#63e6be', '#087f5b');

  ctx.beginPath(); ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
  ctx.fillStyle = '#495057'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#212529'; ctx.stroke();
}

function loop() {
  if (running) update();
  draw();
  requestAnimationFrame(loop);
}

// Pointer control
function pointer(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX ?? e.touches[0].clientX) - rect.left) * (W / rect.width);
  const y = ((e.clientY ?? e.touches[0].clientY) - rect.top) * (H / rect.height);
  movePaddle(you, x - you.x, y - you.y);
}
canvas.addEventListener('mousemove', pointer);
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); pointer(e); }, { passive: false });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); pointer(e); }, { passive: false });

// Keyboard fallback
const keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });
setInterval(() => {
  if (!running) return;
  movePaddle(you,
    (keys.ArrowRight || keys.d ? 9 : 0) - (keys.ArrowLeft || keys.a ? 9 : 0),
    (keys.ArrowDown || keys.s ? 9 : 0) - (keys.ArrowUp || keys.w ? 9 : 0));
}, 1000 / 60);

reset();
loop();

initGameFrame({
  title: 'Air Hockey',
  emoji: '🏒',
  onRestart: reset
});