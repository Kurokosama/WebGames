'use strict';

const SIZE = 4;
let state = null;
let sessionBest = 0;

function init() {
  state = { grid: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)), score: 0, over: false, won: false };
  $('#score').textContent = '0';
  $('#best').textContent = sessionBest;
  addRandomTile();
  addRandomTile();
  render();
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (state.grid[r][c] === 0) empty.push({ r, c });
    }
  }
  if (empty.length === 0) return;
  const spot = pick(empty);
  state.grid[spot.r][spot.c] = Math.random() < 0.9 ? 2 : 4;
}

function slideLine(line) {
  const filtered = line.filter((v) => v !== 0);
  const out = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      out.push(filtered[i] * 2);
      state.score += filtered[i] * 2;
      i++;
    } else {
      out.push(filtered[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return out;
}

function slideLeft(g) { return g.map(slideLine); }
function slideRight(g) { return g.map((line) => slideLine(line.slice().reverse()).reverse()); }
function transpose(g) {
  const res = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) res[c][r] = g[r][c];
  return res;
}

function move(dir) {
  if (state.over) return;
  let newGrid;
  if (dir === 'left') newGrid = slideLeft(state.grid);
  else if (dir === 'right') newGrid = slideRight(state.grid);
  else if (dir === 'up') newGrid = transpose(slideLeft(transpose(state.grid)));
  else if (dir === 'down') newGrid = transpose(slideRight(transpose(state.grid)));
  else return;

  if (JSON.stringify(newGrid) === JSON.stringify(state.grid)) return; // nothing moved
  state.grid = newGrid;
  $('#score').textContent = state.score;
  if (state.score > sessionBest) {
    sessionBest = state.score;
    $('#best').textContent = sessionBest;
  }
  addRandomTile();
  render();

  if (!state.won && state.grid.flat().includes(2048)) {
    state.won = true;
    burstConfetti();
    showModal('🎉 You reached 2048!', `Your score is ${state.score}. Keep going for a new record!`, 'Keep Going', () => hideModal());
  }
  if (noMoves()) {
    state.over = true;
    showModal('😅 Game Over', `Your final score is ${state.score}.`, 'Play Again', init);
  }
}

function noMoves() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (state.grid[r][c] === 0) return false;
      if (c + 1 < SIZE && state.grid[r][c] === state.grid[r][c + 1]) return false;
      if (r + 1 < SIZE && state.grid[r][c] === state.grid[r + 1][c]) return false;
    }
  }
  return true;
}

function render() {
  const board = $('#board');
  board.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = state.grid[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell' + (v ? ' v' + v : '');
      cell.textContent = v || '';
      board.appendChild(cell);
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (!state) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); move('left'); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); move('right'); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move('up'); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); move('down'); }
});

initGameFrame({
  title: '2048',
  emoji: '🎯',
  difficulties: [],
  onRestart: init
});

init();
