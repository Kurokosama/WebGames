/* 弹珠台 Pinball */
'use strict';

initGameFrame({
  title: '弹珠台',
  emoji: '🎯',
  onRestart: () => resetGame()
});

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const W = 400, H = 600;
canvas.width = W; canvas.height = H;

let score = 0, best = parseInt(localStorage.getItem('pinball_best') || '0');
let balls = 3, ball = null, plunger = 0, plungerDir = 1;
let flippers = { left: { angle: 0.5, target: 0.5 }, right: { angle: -0.5, target: -0.5 } };
let targets = [], bumpers = [];
let keys = {};
let gameOver = false;
let animId = null;

$('#best').textContent = best;

function resetGame() {
  hideModal();
  score = 0; balls = 3; gameOver = false;
  setupTargets();
  newBall();
  updateStatus();
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function setupTargets() {
  targets = [
    { x: 80, y: 100, r: 18, score: 100, hit: false },
    { x: 200, y: 80, r: 18, score: 150, hit: false },
    { x: 320, y: 100, r: 18, score: 100, hit: false },
    { x: 120, y: 180, r: 15, score: 200, hit: false },
    { x: 280, y: 180, r: 15, score: 200, hit: false },
    { x: 200, y: 250, r: 20, score: 300, hit: false },
  ];
  bumpers = [
    { x: 60, y: 300, r: 20 },
    { x: 340, y: 300, r: 20 },
    { x: 100, y: 400, r: 18 },
    { x: 300, y: 400, r: 18 },
  ];
}

function newBall() {
  ball = { x: 370, y: 550, vx: 0, vy: 0, r: 8, launched: false };
  plunger = 0; plungerDir = 1;
}

function updateStatus() {
  $('#score').textContent = score;
  $('#balls').textContent = balls;
  if (score > best) { best = score; localStorage.setItem('pinball_best', best); }
  $('#best').textContent = best;
}

function loop() {
  if (gameOver) return;
  update();
  draw();
  animId = requestAnimationFrame(loop);
}

function update() {
  // Plunger
  if (!ball.launched) {
    plunger += plungerDir * 0.02;
    if (plunger > 1) plungerDir = -1;
    if (plunger < 0) plungerDir = 1;
    ball.y = 550 + plunger * 20;
  }

  // Flippers
  if (keys['ArrowLeft'] || keys['a']) flippers.left.target = -0.5;
  else flippers.left.target = 0.5;
  if (keys['ArrowRight'] || keys['d']) flippers.right.target = -0.5;
  else flippers.right.target = 0.5;
  flippers.left.angle += (flippers.left.target - flippers.left.angle) * 0.3;
  flippers.right.angle += (flippers.right.target - flippers.right.angle) * 0.3;

  if (!ball.launched) return;

  // Gravity
  ball.vy += 0.35;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall collisions
  if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.8; }
  if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx) * 0.8; }
  if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * 0.8; }

  // Bumpers
  bumpers.forEach(b => {
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < ball.r + b.r) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = b.x + nx * (ball.r + b.r);
      ball.y = b.y + ny * (ball.r + b.r);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      ball.vx *= 1.1; ball.vy *= 1.1;
      score += 50;
      updateStatus();
    }
  });

  // Targets
  targets.forEach(t => {
    if (t.hit) return;
    const dx = ball.x - t.x, dy = ball.y - t.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < ball.r + t.r) {
      t.hit = true;
      score += t.score;
      updateStatus();
      // Check all hit
      if (targets.every(tt => tt.hit)) {
        setupTargets();
        score += 500;
        updateStatus();
      }
    }
  });

  // Flipper collision (simplified)
  const flL = { x: 140, y: 520, len: 50, angle: flippers.left.angle };
  const flR = { x: 260, y: 520, len: 50, angle: flippers.right.angle };
  [flL, flR].forEach(fl => {
    const tipX = fl.x + Math.cos(fl.angle) * fl.len;
    const tipY = fl.y + Math.sin(fl.angle) * fl.len;
    // Line segment collision
    const dx = tipX - fl.x, dy = tipY - fl.y;
    const t = Math.max(0, Math.min(1, ((ball.x - fl.x) * dx + (ball.y - fl.y) * dy) / (dx*dx + dy*dy)));
    const cx = fl.x + t * dx, cy = fl.y + t * dy;
    const ddx = ball.x - cx, ddy = ball.y - cy;
    const dist = Math.sqrt(ddx*ddx + ddy*ddy);
    if (dist < ball.r + 6) {
      const nx = ddx / dist, ny = ddy / dist;
      ball.x = cx + nx * (ball.r + 6);
      ball.y = cy + ny * (ball.r + 6);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
      ball.vy -= 3; // flipper boost
    }
  });

  // Bottom drain
  if (ball.y > H + 20) {
    balls--;
    updateStatus();
    if (balls <= 0) {
      gameOver = true;
      showModal('🎮 游戏结束', '最终分数: ' + score, '再来一局', resetGame);
    } else {
      newBall();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Walls
  ctx.strokeStyle = '#4a90c4';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W-4, H-4);

  // Bumpers
  bumpers.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ff7e67';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Targets
  targets.forEach(t => {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fillStyle = t.hit ? '#555' : '#ffd166';
    ctx.fill();
    ctx.strokeStyle = t.hit ? '#777' : '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!t.hit) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.score, t.x, t.y + 4);
    }
  });

  // Flippers
  ctx.strokeStyle = '#4caf9b';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  const flL = { x: 140, y: 520, len: 50, angle: flippers.left.angle };
  const flR = { x: 260, y: 520, len: 50, angle: flippers.right.angle };
  [flL, flR].forEach(fl => {
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fl.x + Math.cos(fl.angle) * fl.len, fl.y + Math.sin(fl.angle) * fl.len);
    ctx.stroke();
  });

  // Plunger
  if (!ball.launched) {
    ctx.fillStyle = '#f47ba1';
    ctx.fillRect(360, 560 + plunger * 20, 20, 30);
  }

  // Ball
  if (ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#e0e0e0';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (e.key === ' ' && !ball.launched) {
    ball.launched = true;
    ball.vy = -15;
    ball.vx = -2;
    e.preventDefault();
  }
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

resetGame();
