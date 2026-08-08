'use strict';

const W = 420;
const H = 540;
const COLS = 12;
const S = 34;          // bubble diameter / horizontal spacing
const ROW_H = 30;      // vertical spacing between rows
const COLORS = ['#ff7e67', '#ffd166', '#4cc9f0', '#06d6a0', '#9b7edb'];
const SHOOTER_Y = H - 34;

const DIFFS = {
  easy: { rows: 6, colors: 4 },
  medium: { rows: 7, colors: 5 },
  hard: { rows: 8, colors: 5 }
};

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let raf = null;
let mouseAngle = -Math.PI / 2;

function bubbleX(r, c) {
  return S / 2 + c * S + (r % 2 === 1 ? S / 2 : 0);
}
function bubbleY(r) {
  return S / 2 + r * ROW_H;
}
function maxCols(r) {
  return r % 2 === 1 ? COLS - 1 : COLS;
}
function inGrid(r, c) {
  return r >= 0 && c >= 0 && c < maxCols(r);
}

function init(diff) {
  cancelAnimationFrame(raf);
  const cfg = DIFFS[diff];
  state = {
    diff, colors: cfg.colors, rows: cfg.rows,
    bubbles: [], bullet: null, currentColor: 0, score: 0, over: false,
    last: performance.now()
  };
  state.currentColor = randInt(0, cfg.colors - 1);
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < maxCols(r); c++) {
      if (Math.random() < 0.85) {
        state.bubbles.push({ r, c, color: randInt(0, cfg.colors - 1) });
      }
    }
  }
  $('#score').textContent = '0';
  $('#left').textContent = state.bubbles.length;
  draw();
  raf = requestAnimationFrame(loop);
}

function bubbleAt(r, c) {
  return state.bubbles.find((b) => b.r === r && b.c === c);
}

function fire() {
  if (state.over || state.bullet) return;
  const speed = 9;
  state.bullet = {
    x: W / 2,
    y: SHOOTER_Y,
    color: state.currentColor,
    vx: Math.cos(mouseAngle) * speed,
    vy: Math.sin(mouseAngle) * speed
  };
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (!state.over) {
    if (state.bullet) {
      const b = state.bullet;
      b.x += b.vx * (dt / 16.6);
      b.y += b.vy * (dt / 16.6);
      // hit top
      if (b.y <= S / 2) { land(b); }
      else {
        // hit an existing bubble
        let hit = null;
        for (const bubble of state.bubbles) {
          if (Math.hypot(b.x - bubbleX(bubble.r, bubble.c), b.y - bubbleY(bubble.r)) < S - 2) {
            hit = bubble;
            break;
          }
        }
        if (hit) land(b);
      }
      if (!state.over && state.bullet) {
        // bullet out of bounds side
        if (b.x < S / 2 || b.x > W - S / 2) land(b);
      }
    }
  }
  draw();
  if (!state.over) raf = requestAnimationFrame(loop);
}

function land(bullet) {
  state.bullet = null;
  const cell = snapCell(bullet.x, bullet.y);
  if (!cell) { gameOver(); return; }
  // lose check
  if (cell.r >= state.rows) { gameOver(); return; }
  state.bubbles.push({ r: cell.r, c: cell.c, color: bullet.color });
  resolve(cell);
  $('#left').textContent = state.bubbles.length;
  if (state.bubbles.length === 0) win();
  else if (!state.over) state.currentColor = randInt(0, state.colors - 1);
}

function snapCell(x, y) {
  const r = Math.max(0, Math.round((y - S / 2) / ROW_H));
  let c;
  if (r % 2 === 0) c = Math.round((x - S / 2) / S);
  else c = Math.round((x - S) / S);
  let best = null;
  let bestD = Infinity;
  // First look in the immediate neighbourhood (3x3 around the estimated cell).
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (!inGrid(rr, cc) || bubbleAt(rr, cc)) continue;
      const d = Math.hypot(bubbleX(rr, cc) - x, bubbleY(rr) - y);
      if (d < bestD) { bestD = d; best = { r: rr, c: cc }; }
    }
  }
  // If everything nearby is full, widen the search so the shot doesn't
  // unfairly end the game when landing in a crowded area.
  if (!best) {
    for (let rr = Math.max(0, r - 3); rr <= Math.min(state.rows - 1, r + 3); rr++) {
      for (let cc = 0; cc < maxCols(rr); cc++) {
        if (bubbleAt(rr, cc)) continue;
        const d = Math.hypot(bubbleX(rr, cc) - x, bubbleY(rr) - y);
        if (d < bestD) { bestD = d; best = { r: rr, c: cc }; }
      }
    }
  }
  return best;
}

function neighbors(r, c) {
  const res = [];
  const pairs = [[0, -1], [0, 1]];
  if (r % 2 === 0) pairs.push([-1, -1], [-1, 0], [1, -1], [1, 0]);
  else pairs.push([-1, 0], [-1, 1], [1, 0], [1, 1]);
  for (const [dr, dc] of pairs) {
    const rr = r + dr;
    const cc = c + dc;
    if (inGrid(rr, cc)) res.push({ r: rr, c: cc });
  }
  return res;
}

function resolve(cell) {
  // find same-color cluster
  const cluster = [];
  const seen = new Set();
  const queue = [cell];
  seen.add(cell.r + ',' + cell.c);
  const color = bubbleAt(cell.r, cell.c).color;
  while (queue.length) {
    const cur = queue.shift();
    cluster.push(cur);
    for (const n of neighbors(cur.r, cur.c)) {
      const b = bubbleAt(n.r, n.c);
      const key = n.r + ',' + n.c;
      if (b && b.color === color && !seen.has(key)) {
        seen.add(key);
        queue.push(n);
      }
    }
  }
  if (cluster.length >= 3) {
    state.bubbles = state.bubbles.filter((b) => !cluster.some((c) => c.r === b.r && c.c === b.c));
    state.score += cluster.length * 10;
    // drop floating bubbles
    const floating = findFloating();
    if (floating.length) {
      state.bubbles = state.bubbles.filter((b) => !floating.some((c) => c.r === b.r && c.c === b.c));
      state.score += floating.length * 20;
    }
    $('#score').textContent = state.score;
  }
}

function findFloating() {
  // BFS from all row-0 bubbles
  const visited = new Set();
  const queue = [];
  for (const b of state.bubbles) {
    if (b.r === 0) {
      visited.add(b.r + ',' + b.c);
      queue.push(b);
    }
  }
  while (queue.length) {
    const cur = queue.shift();
    for (const n of neighbors(cur.r, cur.c)) {
      const b = bubbleAt(n.r, n.c);
      const key = n.r + ',' + n.c;
      if (b && !visited.has(key)) {
        visited.add(key);
        queue.push(b);
      }
    }
  }
  return state.bubbles.filter((b) => !visited.has(b.r + ',' + b.c)).map((b) => ({ r: b.r, c: b.c }));
}

function win() {
  state.over = true;
  cancelAnimationFrame(raf);
  burstConfetti();
  showModal('🎉 You Win!', `You cleared the board with ${state.score} points!`, 'Play Again', () => init(state.diff));
}

function gameOver() {
  state.over = true;
  cancelAnimationFrame(raf);
  showModal('😅 So Close!', `You scored ${state.score} points. Try again!`, 'Play Again', () => init(state.diff));
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // aim line
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(51,80,94,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, SHOOTER_Y);
  ctx.lineTo(W / 2 + Math.cos(mouseAngle) * 60, SHOOTER_Y + Math.sin(mouseAngle) * 60);
  ctx.stroke();
  ctx.setLineDash([]);

  // bubbles
  for (const b of state.bubbles) {
    drawBubble(bubbleX(b.r, b.c), bubbleY(b.r), COLORS[b.color]);
  }

  // flying bullet
  if (state.bullet) drawBubble(state.bullet.x, state.bullet.y, COLORS[state.bullet.color]);

  // shooter
  drawBubble(W / 2, SHOOTER_Y, COLORS[state.currentColor]);
  ctx.fillStyle = '#33505e';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 26, SHOOTER_Y + 16, 52, 12, 6);
  ctx.fill();
}

function drawBubble(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, S / 2 - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(x - 4, y - 5, 5, 0, Math.PI * 2);
  ctx.fill();
}

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  mouseAngle = Math.atan2(my - SHOOTER_Y, mx - W / 2);
  // keep pointing up
  if (mouseAngle > -0.1) mouseAngle = -0.1;
  if (mouseAngle < -Math.PI + 0.1) mouseAngle = -Math.PI + 0.1;
});

canvas.addEventListener('click', fire);

initGameFrame({
  title: 'Bubble Shooter',
  emoji: '🫧',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
