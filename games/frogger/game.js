'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const COLS = 13, ROWS = 13;
const CW = canvas.width / COLS;
const CH = canvas.height / ROWS;
const PAD_ROW = 1;              // goal row index
const START_ROW = ROWS - 2;
const KEY = 'best-frogger';

// row -> {speed, dir, offset, cars:[]}
const LANES = [
  { speed: 1.1, dir: 1, offset: 0,   cars: 4 },
  { speed: 1.5, dir: -1, offset: 120, cars: 3 },
  { speed: 1.9, dir: 1, offset: 260, cars: 4 },
  { speed: 2.4, dir: -1, offset: 40, cars: 3 },
  { speed: 2.9, dir: 1, offset: 200, cars: 3 }
];

let frog, pads, lanes, score, lives, best, state, hopT;

function bestKey() { return KEY; }

function reset() {
  score = 0; lives = 3;
  best = Number(localStorage.getItem(bestKey()) || 0);
  frog = { c: Math.floor(COLS / 2), r: START_ROW, tx: Math.floor(COLS / 2), ty: START_ROW };
  pads = [false, false, false, false, false];
  lanes = LANES.map((l) => {
    const gap = COLS / l.cars;
    const cars = [];
    for (let i = 0; i < l.cars; i++) cars.push(i * gap + l.offset / 60);
    return { ...l, cars };
  });
  state = 'hop';
  hopT = 0;
  updateHud();
}

function updateHud() {
  $('#score').textContent = score;
  $('#lives').textContent = lives;
  $('#pads').textContent = pads.filter(Boolean).length;
  $('#best').textContent = best;
}

function laneAt(r) {
  // rows 2..6 are traffic lanes (0-indexed from top)
  const idx = r - 2;
  return idx >= 0 && idx < lanes.length ? lanes[idx] : null;
}

function hop(dr, dc) {
  if (state !== 'hop') return;
  frog.ty = Math.max(0, Math.min(ROWS - 2, frog.r + dr));
  frog.tx = Math.max(0, Math.min(COLS - 1, frog.c + dc));
  state = 'moving';
  hopT = 0;
}

function stepMove() {
  hopT += 0.34;
  const t = Math.min(1, hopT);
  frog.c = frog.c + (frog.tx - frog.c) * t;
  frog.r = frog.r + (frog.ty - frog.r) * t;
  if (t >= 1) {
    frog.c = frog.tx; frog.r = frog.ty;
    state = 'hop';
    land();
  }
}

function land() {
  if (frog.r === PAD_ROW) {
    const padIdx = frog.c % 5;
    if (pads[padIdx]) {
      die();
      return;
    }
    pads[padIdx] = true;
    score += 50;
    if (score > best) { best = score; localStorage.setItem(bestKey(), String(best)); }
    if (pads.every(Boolean)) {
      burstConfetti();
      showModal('🐸 You Win!', 'All five pads are safe! Score: ' + score, 'Play Again', reset);
      updateHud();
      return;
    }
    updateHud();
    frog.c = Math.floor(COLS / 2); frog.r = START_ROW;
    frog.tx = frog.c; frog.ty = frog.r;
    return;
  }

  const lane = laneAt(frog.r);
  if (lane) {
    const rowTop = frog.r * CH;
    const carY = rowTop + CH / 2;
    const fx = frog.c * CW + CW / 2;
    const hit = lane.cars.some((cx) => Math.abs(cx * CW - fx) < CW * 0.62 &&
      Math.abs(carY - (rowTop + CH / 2)) < CH * 0.5);
    if (hit) { die(); return; }
    // ride the lane
    frog.c += (lane.speed * lane.dir) / 60;
    if (frog.c < 0) frog.c += COLS;
    if (frog.c >= COLS) frog.c -= COLS;
    frog.tx = frog.c;
  }
  updateHud();
}

function die() {
  lives--;
  updateHud();
  if (lives <= 0) {
    showModal('💥 Game Over', `You scored ${score} points.`, 'Play Again', reset);
  } else {
    frog.c = Math.floor(COLS / 2); frog.r = START_ROW;
    frog.tx = frog.c; frog.ty = frog.r;
    state = 'hop';
  }
}

function update() {
  lanes.forEach((l) => {
    l.cars = l.cars.map((c) => {
      let n = c + (l.speed * l.dir) / 60;
      if (n > COLS + 1) n -= COLS + 2;
      if (n < -1) n += COLS + 2;
      return n;
    });
  });
  if (state === 'moving') stepMove();
}

function draw() {
  // grass background
  ctx.fillStyle = '#d3f9d8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // top goal area
  ctx.fillStyle = '#c3fae8';
  ctx.fillRect(0, 0, canvas.width, CH * 2);

  // pads
  const padY = CH * 1.25;
  for (let i = 0; i < 5; i++) {
    const x = (i * 2 + 1) * CW;
    ctx.beginPath();
    ctx.arc(x, padY, CH * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = pads[i] ? '#20c997' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#087f5b'; ctx.stroke();
    if (!pads[i]) {
      ctx.fillStyle = '#087f5b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐸', x, padY);
    }
  }

  // lanes
  lanes.forEach((l, i) => {
    const y = (i + 2) * CH;
    ctx.fillStyle = '#868e96';
    ctx.fillRect(0, y, canvas.width, CH);
    ctx.fillStyle = '#dee2e6';
    for (let x = 0; x < canvas.width; x += 40) ctx.fillRect(x, y + CH - 4, 20, 3);
    l.cars.forEach((c) => {
      const x = c * CW, cy = y + CH / 2;
      ctx.save();
      ctx.fillStyle = ['#fa5252', '#fd7e14', '#4dabf7', '#40c057'][i % 4];
      roundRect(x + 3, cy - CH * 0.3, CW - 6, CH * 0.6, 6);
      ctx.fill();
      ctx.fillStyle = '#dee2e6';
      ctx.fillRect(x + 7, cy - CH * 0.18, 6, CH * 0.36);
      ctx.fillRect(x + CW - 15, cy - CH * 0.18, 6, CH * 0.36);
      ctx.restore();
    });
  });

  // frog
  const fx = frog.c * CW + CW / 2, fy = frog.r * CH + CH / 2;
  ctx.save();
  ctx.font = Math.floor(CH * 0.8) + 'px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🐸', fx, fy);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loop() {
  if (!$('#modal').classList.contains('hidden')) { draw(); requestAnimationFrame(loop); return; }
  update();
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', (e) => {
  const map = { ArrowUp: [-1, 0], w: [-1, 0], ArrowDown: [1, 0], s: [1, 0], ArrowLeft: [0, -1], a: [0, -1], ArrowRight: [0, 1], d: [0, 1] };
  if (map[e.key]) { e.preventDefault(); hop(map[e.key][0], map[e.key][1]); }
});

$$('.pad-btn').forEach((b) => {
  const map = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const d = map[b.dataset.dir];
  const go = (e) => { e.preventDefault(); hop(d[0], d[1]); };
  b.addEventListener('touchstart', go, { passive: false });
  b.addEventListener('mousedown', go);
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / rect.width * COLS);
  const r = Math.floor((e.clientY - rect.top) / rect.height * ROWS);
  if (r < frog.r) hop(-1, 0);
  else if (r > frog.r) hop(1, 0);
  else if (c < frog.c) hop(0, -1);
  else if (c > frog.c) hop(0, 1);
});

reset();
loop();

initGameFrame({
  title: 'Frogger',
  emoji: '🐸',
  onRestart: reset
});