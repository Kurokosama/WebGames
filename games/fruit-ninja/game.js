/* ============================================================
   Fruit Ninja 水果忍者 — game logic (canvas)
   ============================================================ */
'use strict';

const canvas = $('#game-canvas');
const ctx = canvas.getContext('2d');

const FRUITS = ['🍉', '🍎', '🍌', '🍇', '🍓', '🍊', '🍋', '🥝'];
const BOMB = '💣';
const W = 900;
const H = 560;
const GRAVITY = 0.22;
const MAX_LIVES = 3;

let state = null;
let rafId = null;
let lastTime = 0;

function initState() {
  state = {
    score: 0,
    combo: 0,
    comboCount: 0,
    lives: MAX_LIVES,
    fruits: [],
    slices: [],          // active swipe trails
    spawnTimer: 0,
    gameOver: false,
    pointerDown: false,
    lastPointer: null,
    slicePoints: []      // points of current swipe
  };
}

// ---------- Spawning ----------
function spawnFruit() {
  const isBomb = Math.random() < 0.16;
  const emoji = isBomb ? BOMB : pick(FRUITS);
  const x = randInt(80, W - 80);
  const vy = -(randInt(11, 16) + (state.score / 400));
  const vx = randInt(-3, 3);
  state.fruits.push({
    x, y: H + 40,
    vx, vy,
    radius: 34,
    emoji,
    isBomb,
    sliced: false,
    missed: false,
    rot: 0,
    vrot: (Math.random() - 0.5) * 0.2
  });
}

// ---------- Physics update ----------
function update(dt) {
  if (state.gameOver) return;

  // Spawn fruits
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnFruit();
    const count = Math.min(3, 1 + Math.floor(state.score / 300));
    for (let i = 1; i < count; i++) spawnFruit();
    state.spawnTimer = Math.max(0.5, 1.1 - state.score / 1500);
  }

  // Update fruits
  for (const f of state.fruits) {
    if (f.sliced) {
      f.vy += GRAVITY * 1.4;
      f.y += f.vy * dt * 60;
      f.x += f.vx * dt * 60;
      f.rot += f.vrot * dt * 60;
      continue;
    }
    f.vy += GRAVITY;
    f.x += f.vx * dt * 60;
    f.y += f.vy * dt * 60;
    f.rot += f.vrot * dt * 60;

    // Bounce off sides
    if (f.x < f.radius || f.x > W - f.radius) { f.vx *= -0.9; f.x = Math.max(f.radius, Math.min(W - f.radius, f.x)); }

    // Missed (fell off bottom)
    if (f.y - f.radius > H + 30 && !f.isBomb) {
      f.missed = true;
      state.lives--;
      state.combo = 0;
      updateLivesUI();
      if (state.lives <= 0) endGame(false);
    }
  }

  // Remove off-screen fruits
  state.fruits = state.fruits.filter((f) => f.y - f.radius < H + 60);

  // Update slices
  state.slices = state.slices.filter((s) => s.life > 0);
  for (const s of state.slices) s.life -= dt;
}

// ---------- Slicing ----------
function sliceAt(x, y) {
  if (state.gameOver) return;
  let slicedAny = false;
  for (const f of state.fruits) {
    if (f.sliced || f.missed) continue;
    const dx = f.x - x;
    const dy = f.y - y;
    if (dx * dx + dy * dy < f.radius * f.radius) {
      f.sliced = true;
      if (f.isBomb) {
        endGame(true);
        return;
      }
      slicedAny = true;
      state.comboCount++;
      const comboBonus = state.comboCount > 1 ? state.comboCount * 10 : 0;
      state.score += 10 + comboBonus;
      state.combo = state.comboCount;
      updateScoreUI();
      // Slice particles
      for (let i = 0; i < 8; i++) {
        state.slices.push({
          x: f.x, y: f.y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8 - 2,
          life: 0.5,
          color: f.isBomb ? '#333' : '#ff7e67'
        });
      }
    }
  }
  if (!slicedAny) {
    state.comboCount = 0;
    state.combo = 0;
    updateScoreUI();
  }
}

// ---------- Rendering ----------
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Draw fruits
  for (const f of state.fruits) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.font = (f.radius * 2) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (f.sliced) {
      ctx.globalAlpha = Math.max(0, 1 - (f.y / (H + 60)));
      ctx.font = (f.radius * 1.4) + 'px serif';
      ctx.fillText('💥', 0, 0);
    } else {
      ctx.fillText(f.emoji, 0, 0);
    }
    ctx.restore();
  }

  // Draw slice particles
  for (const s of state.slices) {
    ctx.globalAlpha = Math.max(0, s.life * 2);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.3;
  }
  ctx.globalAlpha = 1;
}

// ---------- UI ----------
function updateScoreUI() {
  $('#score').textContent = state.score;
  $('#combo').textContent = state.combo > 1 ? '🔥 x' + state.combo : '0';
}

function updateLivesUI() {
  const hearts = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, MAX_LIVES - state.lives));
  $('#lives').textContent = hearts || '💀';
}

function endGame(hitBomb) {
  state.gameOver = true;
  cancelAnimationFrame(rafId);
  const overlay = $('#fruit-overlay');
  overlay.classList.remove('hidden');
  $('#fruit-overlay-title').textContent = hitBomb ? '💣 切到炸弹！' : '🍉 游戏结束';
  $('#fruit-overlay-text').textContent = `最终得分: ${state.score} 分`;
  if (state.score > 0 && !hitBomb) burstConfetti();
}

// ---------- Input ----------
function setupInput() {
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startSwipe = (e) => {
    e.preventDefault();
    if (state.gameOver) return;
    state.pointerDown = true;
    const p = getPos(e);
    state.lastPointer = p;
    state.slicePoints = [p];
  };

  const moveSwipe = (e) => {
    e.preventDefault();
    if (!state.pointerDown || state.gameOver) return;
    const p = getPos(e);
    const last = state.lastPointer;
    if (last) {
      // Sample along the line for fast swipes
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      const steps = Math.max(1, Math.floor(dist / 12));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        sliceAt(last.x + (p.x - last.x) * t, last.y + (p.y - last.y) * t);
      }
      // Draw swipe trail
      state.slices.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.18, color: 'rgba(255,255,255,0.9)' });
    }
    state.lastPointer = p;
  };

  const endSwipe = () => {
    state.pointerDown = false;
    state.lastPointer = null;
    state.comboCount = 0;
    state.combo = 0;
    updateScoreUI();
  };

  canvas.addEventListener('mousedown', startSwipe);
  canvas.addEventListener('mousemove', moveSwipe);
  window.addEventListener('mouseup', endSwipe);
  canvas.addEventListener('touchstart', startSwipe, { passive: false });
  canvas.addEventListener('touchmove', moveSwipe, { passive: false });
  canvas.addEventListener('touchend', endSwipe);
}

// ---------- Loop ----------
function loop(t) {
  const dt = Math.min(0.05, (t - lastTime) / 1000 || 0.016);
  lastTime = t;
  update(dt);
  draw();
  if (!state.gameOver) rafId = requestAnimationFrame(loop);
}

// ---------- Init ----------
function restart() {
  cancelAnimationFrame(rafId);
  initState();
  $('#fruit-overlay').classList.add('hidden');
  updateScoreUI();
  updateLivesUI();
  lastTime = 0;
  rafId = requestAnimationFrame(loop);
}

initGameFrame({
  title: '水果忍者',
  emoji: '🍉',
  onRestart: restart
});

$('#fruit-restart-btn').addEventListener('click', restart);

initState();
updateScoreUI();
updateLivesUI();
setupInput();
rafId = requestAnimationFrame(loop);