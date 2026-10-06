'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc'];
const GAP = 24;              // pixels between neighbouring marbles
const SPEED = 0.0055;        // GAP-units the chain advances per frame (~35s to cross)
const CHAIN_SIZE = 20;       // marbles in play
const KEY = 'best-zuma';

let path, maxAlong, chain, head, ball, score, best, dead;

/* ---------- path ---------- */
function buildPath() {
  const p = [];
  const pts = [
    [-30, 150], [180, 150], [180, 330], [420, 330], [420, 120], [640, 120],
    [640, 440], [330, 440], [330, 540]
  ];
  const steps = 90;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    for (let t = 0; t < steps; t++) {
      p.push({ x: x1 + (x2 - x1) * (t / steps), y: y1 + (y2 - y1) * (t / steps) });
    }
  }
  p.push({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
  return p;
}

/* Distance along the path measured in GAP units: 0 = the far entrance,
 * maxAlong = the skull the chain is crawling toward. */
function pointAt(along) {
  const idx = Math.round(Math.max(0, Math.min(maxAlong, along)) * GAP);
  return path[Math.min(idx, path.length - 1)];
}

/* ---------- setup ---------- */
function reset() {
  path = buildPath();
  maxAlong = (path.length - 1) / GAP;
  score = 0;
  best = Number(localStorage.getItem(KEY) || 0);
  dead = false;

  // The chain enters from the far end and crawls toward the skull.
  const count = Math.min(CHAIN_SIZE, Math.max(6, Math.floor(maxAlong) - 6));
  const palette = shuffle([...COLORS, ...COLORS, ...COLORS, ...COLORS]);
  chain = [];
  for (let i = 0; i < count; i++) {
    // index 0 is the front (closest to the skull)
    chain.push({ c: palette[i % palette.length], alive: true, pos: 0 });
  }
  head = count - 1;             // front sits `count-1` gaps ahead of the tail
  ball = { x: 330, y: 555, color: pick(COLORS), flying: false, vx: 0, vy: 0 };
  layout();
  updateHud();
}

function layout() {
  chain.forEach((m, i) => { if (m.alive) m.pos = head - i; });
}

function updateHud() {
  $('#score').textContent = score;
  $('#left').textContent = chain.filter((m) => m.alive).length;
  $('#best').textContent = best;
}

/* ---------- shooting ---------- */
function shoot(x, y) {
  if (dead || ball.flying) return;
  const dx = x - ball.x, dy = y - ball.y;
  const d = Math.hypot(dx, dy) || 1;
  ball.vx = (dx / d) * 16;
  ball.vy = (dy / d) * 16;
  ball.flying = true;
}

/* Nearest chain marble within reach of the flying ball. */
function hitIndex() {
  let bestIdx = -1, bestDist = GAP * 0.8;
  for (let i = 0; i < chain.length; i++) {
    if (!chain[i].alive) continue;
    const p = pointAt(chain[i].pos);
    const d = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

/* Pop every marble in the run containing `from`, then score it. */
function popRun(from) {
  const colour = chain[from].c;
  let lo = from, hi = from;
  while (lo - 1 >= 0 && chain[lo - 1].alive && chain[lo - 1].c === colour) lo--;
  while (hi + 1 < chain.length && chain[hi + 1].alive && chain[hi + 1].c === colour) hi++;
  const run = hi - lo + 1;
  if (run < 3) return false;
  for (let i = lo; i <= hi; i++) chain[i].alive = false;
  score += run * 10;
  if (score > best) { best = score; localStorage.setItem(KEY, String(best)); }
  chain = chain.filter((m) => m.alive);
  layout();
  updateHud();
  if (!chain.length) {
    dead = true;
    burstConfetti();
    showModal('\uD83C\uDF89 You Win!', 'All marbles cleared! Score ' + score, 'Play Again', reset);
  }
  return true;
}

/* Insert the shot marble, but only keep it when it completes a run of 3+.
 * Otherwise the chain would grow with every shot and could never be cleared. */
function insertBall(index) {
  const m = { c: ball.color, alive: true, pos: chain[index].pos };
  chain.splice(index, 0, m);
  layout();
  const matched = popRun(index) || (index > 0 && popRun(index - 1));
  if (!matched) {
    chain.splice(index, 1);      // bounced off — the chain stays the same size
    layout();
    updateHud();
  }
}

/* ---------- loop ---------- */
function update() {
  if (dead) return;

  if (ball.flying) {
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.x < -20 || ball.x > W + 20 || ball.y < -20 || ball.y > H + 20) {
      ball.flying = false;
      ball.x = 330; ball.y = 555;
      ball.color = pick(COLORS);
    } else {
      const hit = hitIndex();
      if (hit !== -1) {
        ball.flying = false;
        insertBall(hit);
        ball.x = 330; ball.y = 555;
        ball.color = pick(COLORS);
      }
    }
  }

  head += SPEED;
  layout();

  // the front marble reaching the skull ends the game
  if (chain.length && chain[0].pos >= maxAlong) {
    dead = true;
    showModal('\uD83D\uDC80 Game Over', 'The chain reached the skull! Score ' + score, 'Play Again', reset);
  }
  updateHud();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b2352');
  g.addColorStop(1, '#2f3b6b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // the groove the chain travels along
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = GAP - 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();

  // skull at the end of the path
  const end = path[path.length - 1];
  ctx.fillStyle = '#e9ecef';
  ctx.beginPath(); ctx.arc(end.x, end.y, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#495057';
  ctx.beginPath(); ctx.arc(end.x - 8, end.y - 4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(end.x + 8, end.y - 4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(end.x - 7, end.y + 6, 14, 6);

  // chain
  chain.forEach((m) => {
    if (!m.alive) return;
    const p = pointAt(m.pos);
    ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = m.c; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, 3.5, 0, Math.PI * 2); ctx.fill();
  });

  // frog
  ctx.fillStyle = '#69db7c';
  ctx.beginPath(); ctx.ellipse(ball.x, ball.y + 16, 24, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ball.x - 10, ball.y - 4, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ball.x + 10, ball.y - 4, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#212529';
  ctx.beginPath(); ctx.arc(ball.x - 10, ball.y - 6, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ball.x + 10, ball.y - 6, 2.5, 0, Math.PI * 2); ctx.fill();
  // loaded marble
  ctx.beginPath(); ctx.arc(ball.x, ball.y - 18, 12, 0, Math.PI * 2);
  ctx.fillStyle = ball.color; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
}

function loop() {
  if (!$('#modal').classList.contains('hidden')) { draw(); requestAnimationFrame(loop); return; }
  update();
  draw();
  requestAnimationFrame(loop);
}

function pos(e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - rect.left) * (W / rect.width), y: (src.clientY - rect.top) * (H / rect.height) };
}

canvas.addEventListener('mousedown', (e) => { const p = pos(e); shoot(p.x, p.y); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const p = pos(e); shoot(p.x, p.y); }, { passive: false });

initGameFrame({ title: 'Zuma', emoji: '\uD83D\uDC0D', onRestart: reset });

reset();
loop();
