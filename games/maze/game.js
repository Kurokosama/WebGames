'use strict';

const SIZES = { easy: 9, medium: 13, hard: 17 };
const W = 560;
const H = 560;
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let state = null;
let timer = null;

// walls: each cell { t, r, b, l } booleans
function generateMaze(n) {
  const grid = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ t: true, r: true, b: true, l: true, visited: false }))
  );
  const stack = [{ r: 0, c: 0 }];
  grid[0][0].visited = true;
  const dirs = [
    { dr: -1, dc: 0, wall: 't', opp: 'b' },
    { dr: 1, dc: 0, wall: 'b', opp: 't' },
    { dr: 0, dc: -1, wall: 'l', opp: 'r' },
    { dr: 0, dc: 1, wall: 'r', opp: 'l' }
  ];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const neighbors = dirs
      .map((d) => ({ d, nr: cur.r + d.dr, nc: cur.c + d.dc }))
      .filter(({ nr, nc }) => nr >= 0 && nr < n && nc >= 0 && nc < n && !grid[nr][nc].visited);
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const pickN = pick(neighbors);
    const { d, nr, nc } = pickN;
    grid[cur.r][cur.c][d.wall] = false;
    grid[nr][nc][d.opp] = false;
    grid[nr][nc].visited = true;
    stack.push({ r: nr, c: nc });
  }
  return grid;
}

function init(diff) {
  clearInterval(timer);
  const n = SIZES[diff];
  state = {
    diff, n, cell: W / n,
    grid: generateMaze(n),
    player: { r: 0, c: 0 },
    goal: { r: n - 1, c: n - 1 },
    moves: 0,
    seconds: 0,
    done: false
  };
  $('#moves').textContent = '0';
  $('#time').textContent = '0s';
  draw();
  timer = setInterval(() => {
    if (state.done) return;
    state.seconds++;
    $('#time').textContent = state.seconds + 's';
  }, 1000);
}

function tryMove(dr, dc) {
  if (state.done) return;
  const p = state.player;
  const cell = state.grid[p.r][p.c];
  // determine wall between
  let wallBlocked = false;
  if (dr === -1) wallBlocked = cell.t;
  else if (dr === 1) wallBlocked = cell.b;
  else if (dc === -1) wallBlocked = cell.l;
  else if (dc === 1) wallBlocked = cell.r;
  if (wallBlocked) return;

  const nr = p.r + dr;
  const nc = p.c + dc;
  if (nr < 0 || nr >= state.n || nc < 0 || nc >= state.n) return;

  state.player = { r: nr, c: nc };
  state.moves++;
  $('#moves').textContent = state.moves;
  draw();
  if (nr === state.goal.r && nc === state.goal.c) win();
}

function win() {
  state.done = true;
  clearInterval(timer);
  burstConfetti();
  showModal('🎉 You Made It!', `You escaped the maze in ${state.moves} moves and ${state.seconds}s!`, 'Play Again', () => init(state.diff));
}

function draw() {
  const n = state.n;
  const cell = state.cell;
  ctx.clearRect(0, 0, W, H);

  // walls
  ctx.strokeStyle = '#33505e';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = c * cell;
      const y = r * cell;
      const cellW = state.grid[r][c];
      if (cellW.t) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cell, y); ctx.stroke(); }
      if (cellW.b) { ctx.beginPath(); ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); ctx.stroke(); }
      if (cellW.l) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cell); ctx.stroke(); }
      if (cellW.r) { ctx.beginPath(); ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); ctx.stroke(); }
    }
  }

  // goal
  ctx.font = `${Math.round(cell * 0.75)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏁', state.goal.c * cell + cell / 2, state.goal.r * cell + cell / 2);

  // player
  ctx.font = `${Math.round(cell * 0.8)}px serif`;
  ctx.fillText('😀', state.player.c * cell + cell / 2, state.player.r * cell + cell / 2);
}

document.addEventListener('keydown', (e) => {
  if (!state) return;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); tryMove(-1, 0); }
  else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); tryMove(1, 0); }
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); tryMove(0, -1); }
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); tryMove(0, 1); }
});

initGameFrame({
  title: 'Maze',
  emoji: '🌀',
  difficulties: [
    { value: 'easy', label: 'Easy (9×9)' },
    { value: 'medium', label: 'Medium (13×13)' },
    { value: 'hard', label: 'Hard (17×17)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
