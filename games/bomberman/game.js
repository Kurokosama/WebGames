'use strict';

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const COLS = 13, ROWS = 9, TS = 48;
const FLOOR = 1, WALL = 2, BRICK = 3, EXIT = 4;
const KEY = 'best-bomberman';

let grid, player, bombs, flames, enemies, coins, score, lives, level, best, tick, exitPlaced, playing;

function bestKey() { return KEY; }

function buildLevel() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      let v = FLOOR;
      if (c % 2 === 0 && r % 2 === 0) v = WALL;
      else if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1) v = WALL;
      else if (Math.random() < 0.72) v = BRICK;
      row.push(v);
    }
    grid.push(row);
  }

  // clear spawn area
  [0, 1, 2].forEach((dc) => {
    grid[ROWS - 3][1 + dc] = FLOOR;
    grid[ROWS - 2][1 + dc] = FLOOR;
  });
  // second spawn area
  [0, 1, 2].forEach((dc) => {
    grid[1][COLS - 2 - dc] = FLOOR;
    grid[2][COLS - 2 - dc] = FLOOR;
  });

  player = { c: 1, r: ROWS - 2, x: 1 * TS, y: (ROWS - 2) * TS, speed: 0.16, anim: 0 };
  bombs = [];
  flames = [];
  coins = [];
  tick = 0;
  exitPlaced = false;

  // place exit under a random brick
  const spots = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) if (grid[r][c] === BRICK) spots.push([r, c]);
  }
  if (spots.length) {
    const [r, c] = pick(spots);
    grid[r][c] = EXIT;
    exitPlaced = true;
  }

  enemies = [];
  // Enemy spawn points, excluding the player's own tile — spawning on top of
  // the player killed them on frame one.
  const spawns = [[1, 1], [1, COLS - 2], [ROWS - 2, COLS - 2], [3, 3], [ROWS - 4, 3]]
    .filter(([r, c]) => !(r === player.r && c === player.c));
  shuffle(spawns).slice(0, Math.min(spawns.length, 2 + Math.min(2, level))).forEach(([r, c]) => {
    if (grid[r][c] === FLOOR) {
      // x/y are tile top-left, matching how the renderer draws every actor.
      enemies.push({ c, r, x: c * TS, y: r * TS, speed: 0.1 + level * 0.012, dir: pick([0, 1, 2, 3]) });
    }
  });

  for (let i = 0; i < 5; i++) {
    const [r, c] = pick(spots);
    if (grid[r][c] === BRICK && Math.random() < 0.4) {
      coins.push({ r, c });
      grid[r][c] = FLOOR;
    }
  }
}

function reset() {
  score = 0; lives = 3; level = 1;
  best = Number(localStorage.getItem(bestKey()) || 0);
  playing = true;
  buildLevel();
  updateHud();
}

function updateHud() {
  $('#score').textContent = score;
  $('#lives').textContent = lives;
  $('#level').textContent = level;
  $('#best').textContent = best;
}

function walkable(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  const v = grid[r][c];
  return v === FLOOR || v === EXIT;
}

function isFlame(c, r) { return flames.some((f) => f.c === c && f.r === r); }

function tryMove(p, dc, dr) {
  const nc = p.c + dc, nr = p.r + dr;
  if (!walkable(nc, nr)) return false;
  if (dc && !walkable(p.c, nr)) return false;
  if (dr && !walkable(nc, p.r)) return false;
  if (isFlame(nc, nr)) return false;
  p.c = nc; p.r = nr;
  return true;
}

function placeBomb() {
  if (bombs.length >= 3) return;
  if (bombs.some((b) => b.c === player.c && b.r === player.r)) return;
  bombs.push({ c: player.c, r: player.r, t: 100, range: 2 });
}

function ignite(b) {
  flames.push({ c: b.c, r: b.r, t: 22 });
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dc, dr]) => {
    for (let i = 1; i <= b.range; i++) {
      const c = b.c + dc * i, r = b.r + dr * i;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) break;
      const v = grid[r][c];
      if (v === WALL) break;
      if (v === BRICK) {
        grid[r][c] = FLOOR;
        score += 10;
        if (score > best) { best = score; localStorage.setItem(bestKey(), String(best)); }
        if (Math.random() < 0.35) coins.push({ r, c });
        break;
      }
      flames.push({ c, r, t: 22 });
    }
  });
}

function killPlayer() {
  lives--;
  updateHud();
  burstParticles(player.x + TS / 2, player.y + TS / 2);
  if (lives <= 0) {
    playing = false;
    showModal('💥 Game Over', `Score ${score}, reached level ${level}.`, 'Play Again', reset);
    return;
  }
  player = { c: 1, r: ROWS - 2, x: 1 * TS, y: (ROWS - 2) * TS, speed: 0.16, anim: 0 };
  bombs = []; flames = [];
}

function collect() {
  coins = coins.filter((co) => {
    if (co.c === player.c && co.r === player.r) {
      score += 30;
      if (score > best) { best = score; localStorage.setItem(bestKey(), String(best)); }
      return false;
    }
    return true;
  });
  if (grid[player.r][player.c] === EXIT && coins.length === 0 && bombs.length === 0) {
    burstConfetti();
    if (level >= 5) {
      playing = false;
      showModal('🏆 You Win!', `You cleared all ${level} levels! Score ${score}.`, 'Play Again', reset);
    } else {
      level++;
      updateHud();
      buildLevel();
    }
  }
}

function moveEnemies() {
  enemies.forEach((e) => {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const [dc, dr] = dirs[e.dir];
    const ok = walkable(e.c + dc, e.r + dr) && !isFlame(e.c + dc, e.r + dr);
    if (!ok || Math.random() < 0.08) e.dir = randInt(0, 3);
    else { e.c += dc; e.r += dr; }
    e.x += (e.c * TS - e.x) * 0.25;
    e.y += (e.r * TS - e.y) * 0.25;
  });
  enemies.forEach((e) => {
    if (isFlame(e.c, e.r)) {
      score += 50;
      enemies = enemies.filter((x) => x !== e);
      if (score > best) { best = score; localStorage.setItem(bestKey(), String(best)); }
    }
  });
}

let particles = [];
function burstParticles(x, y) {
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 3 + 1;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 });
  }
}

const DIRS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
const held = {};
document.addEventListener('keydown', (e) => {
  held[e.key] = true;
  if (e.key === ' ') { e.preventDefault(); placeBomb(); }
});
document.addEventListener('keyup', (e) => { held[e.key] = false; });

$$('.tc-btn').forEach((b) => {
  b.addEventListener('touchstart', (e) => { e.preventDefault(); if (b.dataset.act === 'bomb') placeBomb(); else held[mapKey(b.dataset.act)] = true; }, { passive: false });
  b.addEventListener('mousedown', (e) => { e.preventDefault(); if (b.dataset.act === 'bomb') placeBomb(); else held[mapKey(b.dataset.act)] = true; });
  b.addEventListener('touchend', () => { if (b.dataset.act !== 'bomb') held[mapKey(b.dataset.act)] = false; });
  b.addEventListener('mouseup', () => { if (b.dataset.act !== 'bomb') held[mapKey(b.dataset.act)] = false; });
});
const mapKey = (act) => ({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' })[act];

function update() {
  if (!playing) return;

  Object.keys(held).forEach((k) => {
    if (DIRS[k]) tryMove(player, DIRS[k][0], DIRS[k][1]);
  });

  // player visual easing
  player.x += (player.c * TS - player.x) * 0.35;
  player.y += (player.r * TS - player.y) * 0.35;

  bombs.forEach((b) => {
    b.t -= 1;
    if (b.t <= 0) {
      ignite(b);
      b.done = true;
    }
  });
  bombs = bombs.filter((b) => !b.done);

  flames.forEach((f) => f.t -= 1);
  flames = flames.filter((f) => f.t > 0);

  if (isFlame(player.c, player.r) || bombs.some((b) => b.c === player.c && b.r === player.r)) killPlayer();
  moveEnemies();
  enemies.forEach((e) => {
    if (e.c === player.c && e.r === player.r) { killPlayer(); return; }
  });

  collect();

  particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.life--; });
  particles = particles.filter((p) => p.life > 0);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#c9a27a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = grid[r][c], x = c * TS, y = r * TS;
      if (v === FLOOR) {
        ctx.fillStyle = (c + r) % 2 ? '#d9b58c' : '#d1a87d';
        ctx.fillRect(x, y, TS, TS);
      } else if (v === WALL) {
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(x, y, TS, TS);
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
      } else if (v === BRICK) {
        ctx.fillStyle = '#b5651d';
        ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4);
        ctx.fillStyle = '#8a4b16';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 4, y + 6 + i * 14, TS - 8, 4);
      } else if (v === EXIT) {
        ctx.fillStyle = '#d9b58c';
        ctx.fillRect(x, y, TS, TS);
        ctx.fillStyle = '#2f9e44';
        ctx.fillRect(x + 8, y + 8, TS - 16, TS - 16);
        ctx.fillStyle = '#fff';
        ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🚪', x + TS / 2, y + TS / 2);
      }
    }
  }

  coins.forEach((co) => {
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(co.c * TS + TS / 2, co.r * TS + TS / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59f00';
    ctx.fillRect(co.c * TS + TS / 2 - 2, co.r * TS + TS / 2 - 6, 4, 12);
  });

  flames.forEach((f) => {
    const t = f.t / 22;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 60));
    ctx.fillStyle = t > 0.4 ? '#ff922b' : '#ffa94d';
    ctx.beginPath();
    ctx.arc(f.c * TS + TS / 2, f.r * TS + TS / 2, TS * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(f.c * TS + TS / 2, f.r * TS + TS / 2, TS * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  bombs.forEach((b) => {
    const s = 1 + Math.sin(Date.now() / 90) * 0.08;
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.arc(b.c * TS + TS / 2, b.r * TS + TS / 2, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#868e96'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.c * TS + TS / 2 + 6, b.r * TS + TS / 2 - 8);
    ctx.lineTo(b.c * TS + TS / 2 + 14, b.r * TS + TS / 2 - 15);
    ctx.stroke();
  });

  enemies.forEach((e) => {
    ctx.fillStyle = '#5f3dc4';
    ctx.beginPath();
    ctx.arc(e.x + TS / 2, e.y + TS / 2, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e.x + TS / 2 - 5, e.y + TS / 2 - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x + TS / 2 + 5, e.y + TS / 2 - 3, 3, 0, Math.PI * 2); ctx.fill();
  });

  // player
  ctx.fillStyle = '#f8f9fa';
  ctx.beginPath(); ctx.arc(player.x + TS / 2, player.y + TS / 2, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#212529';
  ctx.beginPath(); ctx.arc(player.x + TS / 2 - 5, player.y + TS / 2 - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(player.x + TS / 2 + 5, player.y + TS / 2 - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#212529'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(player.x + TS / 2, player.y + TS / 2, 16, 0, Math.PI * 2); ctx.stroke();

  particles.forEach((p) => {
    ctx.globalAlpha = p.life / 30;
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  });
  ctx.globalAlpha = 1;
}

function loop() {
  if (!$('#modal').classList.contains('hidden')) { draw(); requestAnimationFrame(loop); return; }
  update();
  draw();
  requestAnimationFrame(loop);
}

reset();
loop();

initGameFrame({
  title: 'Bomberman',
  emoji: '💣',
  onRestart: reset
});