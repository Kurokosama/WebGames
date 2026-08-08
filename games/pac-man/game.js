'use strict';

const TILE = 24;
const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '#   #.........#   #',
  '####.###.#.###.####',
  '#....#...#...#....#',
  '#.##.#.#####.#.##.#',
  '#.................#',
  '#o##.###.#.###.##o#',
  '#........#........#',
  '###################'
];
const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const W = COLS * TILE;
const H = ROWS * TILE;

const GHOST_COLORS = ['#ff7e67', '#4cc9f0', '#f47ba1', '#06d6a0'];

const DIFFS = {
  easy: { pac: 4.4, ghost: 3.2, fright: 9 },
  medium: { pac: 4.6, ghost: 3.8, fright: 7 },
  hard: { pac: 4.8, ghost: 4.3, fright: 5 }
};

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let raf = null;

const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 }
};

function open(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
  return state.maze[r][c] !== '#';
}

function init(diff) {
  cancelAnimationFrame(raf);
  const cfg = DIFFS[diff];
  // deep copy maze (consume dots in place)
  const maze = MAZE.map((row) => row.split(''));
  let dots = 0;
  for (const row of maze) for (const ch of row) if (ch === '.' || ch === 'o') dots++;

  state = {
    diff, cfg, maze, dots,
    pac: { r: 7, c: 6, dir: { ...DIRS.right }, nextDir: { ...DIRS.right }, progress: 0, speed: cfg.pac, justLanded: true },
    ghosts: [
      { r: 7, c: 8, dir: { ...DIRS.left }, progress: 0, speed: cfg.ghost, color: GHOST_COLORS[0], homeR: 7, homeC: 8, cooldown: 2.5, justLanded: true },
      { r: 7, c: 9, dir: { ...DIRS.left }, progress: 0, speed: cfg.ghost, color: GHOST_COLORS[1], homeR: 7, homeC: 9, cooldown: 2.5, justLanded: true },
      { r: 7, c: 10, dir: { ...DIRS.right }, progress: 0, speed: cfg.ghost, color: GHOST_COLORS[2], homeR: 7, homeC: 10, cooldown: 2.5, justLanded: true },
      { r: 7, c: 11, dir: { ...DIRS.right }, progress: 0, speed: cfg.ghost, color: GHOST_COLORS[3], homeR: 7, homeC: 11, cooldown: 2.5, justLanded: true }
    ],
    score: 0,
    lives: 3,
    fright: 0,
    over: false,
    last: performance.now()
  };
  $('#score').textContent = '0';
  $('#lives').textContent = '❤️❤️❤️';
  $('#dots').textContent = state.dots;
  draw();
  raf = requestAnimationFrame(loop);
}

function eatTile(r, c) {
  const ch = state.maze[r][c];
  if (ch === '.') { state.maze[r][c] = ' '; state.dots--; state.score += 10; $('#dots').textContent = state.dots; }
  else if (ch === 'o') { state.maze[r][c] = ' '; state.dots--; state.score += 50; state.fright = state.cfg.fright; $('#dots').textContent = state.dots; }
  $('#score').textContent = state.score;
}

function updatePac(dt) {
  const p = state.pac;
  // Direction change happens at a tile centre. Because progress accumulates as a
  // float, it is never exactly 0, so we track "justLanded" (set right after a
  // step completes, and initially true at spawn) instead of comparing to 0.
  if (p.justLanded) {
    if (open(p.r + p.nextDir.dr, p.c + p.nextDir.dc)) {
      p.dir = { ...p.nextDir };
      p.justLanded = false;
    } else if (open(p.r + p.dir.dr, p.c + p.dir.dc)) {
      // can't turn, but can keep going straight
      p.justLanded = false;
    } else {
      // Fully blocked: stay centred on this tile and keep justLanded set so we
      // re-check every frame (this is what lets Pac-Man respond to the player
      // pressing a new direction while pinned against a wall).
      p.progress = 0;
      return;
    }
  }
  p.progress += p.speed * (dt / 1000);
  while (p.progress >= 1) {
    p.progress -= 1;
    p.r += p.dir.dr;
    p.c += p.dir.dc;
    p.justLanded = true;
    eatTile(p.r, p.c);
    checkGhostHit();
    if (state.over) return;
    if (state.dots === 0) { win(); return; }
  }
}

function openDirs(ghost) {
  const res = [];
  for (const key of Object.keys(DIRS)) {
    const d = DIRS[key];
    if (open(ghost.r + d.dr, ghost.c + d.dc)) res.push(d);
  }
  return res;
}

function chooseDir(ghost, dirs) {
  if (dirs.length === 0) return null;
  const nonReverse = dirs.filter((d) => !(d.dr === -ghost.dir.dr && d.dc === -ghost.dir.dc));
  const pool = nonReverse.length ? nonReverse : dirs;
  if (state.fright > 0) return pick(pool);
  // chase: minimize distance to pac
  let best = null;
  let bestD = Infinity;
  const shuffled = shuffle(pool);
  for (const d of shuffled) {
    const dist = Math.abs(ghost.r + d.dr - state.pac.r) + Math.abs(ghost.c + d.dc - state.pac.c);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best;
}

function updateGhost(ghost, dt) {
  if (ghost.cooldown > 0) {
    ghost.cooldown -= dt / 1000;
    return;
  }
  // Re-pick a direction at each tile centre (see updatePac for why we use a
  // "justLanded" flag instead of comparing progress to 0).
  if (ghost.justLanded) {
    const dir = chooseDir(ghost, openDirs(ghost));
    if (!dir) {
      // dead end — stay put and re-try next frame
      ghost.progress = 0;
      return;
    }
    ghost.dir = dir;
    ghost.justLanded = false;
  }
  const speed = state.fright > 0 ? ghost.speed * 0.7 : ghost.speed;
  ghost.progress += speed * (dt / 1000);
  while (ghost.progress >= 1) {
    ghost.progress -= 1;
    ghost.r += ghost.dir.dr;
    ghost.c += ghost.dir.dc;
    ghost.justLanded = true;
  }
}

function ghostPix(ghost) {
  return {
    x: ghost.c * TILE + TILE / 2 + ghost.dir.dc * ghost.progress * TILE,
    y: ghost.r * TILE + TILE / 2 + ghost.dir.dr * ghost.progress * TILE
  };
}

function checkGhostHit() {
  const pp = {
    x: state.pac.c * TILE + TILE / 2 + state.pac.dir.dc * state.pac.progress * TILE,
    y: state.pac.r * TILE + TILE / 2 + state.pac.dir.dr * state.pac.progress * TILE
  };
  for (const ghost of state.ghosts) {
    // Ghosts still spawning/respawning are intangible — Pac-Man can walk
    // through them instead of instantly losing a life before play begins.
    if (ghost.cooldown > 0) continue;
    const gp = ghostPix(ghost);
    if (Math.hypot(pp.x - gp.x, pp.y - gp.y) < TILE * 0.75) {
      if (state.fright > 0) {
        // eat ghost
        state.score += 200;
        $('#score').textContent = state.score;
        ghost.r = ghost.homeR;
        ghost.c = ghost.homeC;
        ghost.progress = 0;
        ghost.dir = { ...DIRS.left };
        ghost.cooldown = 1.5;
        ghost.justLanded = true;
      } else {
        loseLife();
      }
      return;
    }
  }
}

function loseLife() {
  state.lives--;
  $('#lives').textContent = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, 3 - state.lives));
  if (state.lives <= 0) {
    state.over = true;
    cancelAnimationFrame(raf);
    showModal('😅 Game Over', `You scored ${state.score} points!`, 'Play Again', () => init(state.diff));
  } else {
    // reset positions
    state.pac = { r: 7, c: 6, dir: { ...DIRS.right }, nextDir: { ...DIRS.right }, progress: 0, speed: state.cfg.pac, justLanded: true };
    state.fright = 0;
    state.ghosts.forEach((g, i) => {
      g.r = g.homeR; g.c = g.homeC; g.progress = 0;
      g.dir = { ...(i < 2 ? DIRS.left : DIRS.right) };
      g.cooldown = 1.5;
      g.justLanded = true;
    });
  }
}

function win() {
  state.over = true;
  cancelAnimationFrame(raf);
  burstConfetti();
  showModal('🎉 You Win!', `You ate every dot with ${state.score} points!`, 'Play Again', () => init(state.diff));
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (!state.over) {
    if (state.fright > 0) state.fright = Math.max(0, state.fright - dt / 1000);
    updatePac(dt);
    if (!state.over) {
      for (const ghost of state.ghosts) updateGhost(ghost, dt);
      checkGhostHit();
    }
  }
  draw();
  if (!state.over) raf = requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // maze
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = state.maze[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#1d2b6e';
        ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      } else if (ch === '.') {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (ch === 'o') {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ghosts
  for (const ghost of state.ghosts) {
    const gp = ghostPix(ghost);
    // spawning/respawning ghosts are semi-transparent to signal they are safe
    ctx.globalAlpha = ghost.cooldown > 0 ? 0.45 : 1;
    ctx.fillStyle = state.fright > 0 ? '#6b8dff' : ghost.color;
    ctx.beginPath();
    ctx.arc(gp.x, gp.y - 4, 10, Math.PI, 0);
    ctx.lineTo(gp.x + 10, gp.y + 10);
    ctx.lineTo(gp.x + 5, gp.y + 5);
    ctx.lineTo(gp.x, gp.y + 10);
    ctx.lineTo(gp.x - 5, gp.y + 5);
    ctx.lineTo(gp.x - 10, gp.y + 10);
    ctx.closePath();
    ctx.fill();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(gp.x - 4, gp.y - 4, 3.4, 0, Math.PI * 2);
    ctx.arc(gp.x + 4, gp.y - 4, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // pac-man
  const p = state.pac;
  const px = p.c * TILE + TILE / 2 + p.dir.dc * p.progress * TILE;
  const py = p.r * TILE + TILE / 2 + p.dir.dr * p.progress * TILE;
  ctx.fillStyle = '#ffd166';
  const mouth = 0.18;
  const baseAngle = Math.atan2(p.dir.dr, p.dir.dc);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, 11, baseAngle + mouth, baseAngle - mouth + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

document.addEventListener('keydown', (e) => {
  if (!state || state.over) return;
  const p = state.pac;
  if (e.key === 'ArrowUp') { e.preventDefault(); p.nextDir = { ...DIRS.up }; }
  else if (e.key === 'ArrowDown') { e.preventDefault(); p.nextDir = { ...DIRS.down }; }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); p.nextDir = { ...DIRS.left }; }
  else if (e.key === 'ArrowRight') { e.preventDefault(); p.nextDir = { ...DIRS.right }; }
});

initGameFrame({
  title: 'Pac-Man',
  emoji: '👻',
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
