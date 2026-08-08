'use strict';

const SIZE = 8;
const EMOJIS = ['🍎', '🍇', '🍋', '🍓', '🫐', '🍊', '🍒', '🥝', '🍉'];
const DIFFS = {
  easy: { types: 5, time: 60 },
  medium: { types: 6, time: 50 },
  hard: { types: 6, time: 40 }
};

let state = null;
let countdown = null;

function init(diff) {
  clearInterval(countdown);
  state = {
    diff,
    types: DIFFS[diff].types,
    grid: [],
    score: 0,
    time: DIFFS[diff].time,
    selected: null,
    over: false
  };
  do {
    state.grid = makeGrid();
  } while (findMatches().size > 0);
  $('#score').textContent = '0';
  $('#time').textContent = state.time + 's';
  countdown = setInterval(() => {
    state.time--;
    $('#time').textContent = state.time + 's';
    if (state.time <= 0) endGame();
  }, 1000);
  render();
}

function makeGrid() {
  const g = [];
  for (let r = 0; r < SIZE; r++) {
    g.push([]);
    for (let c = 0; c < SIZE; c++) g[r].push(randInt(0, state.types - 1));
  }
  return g;
}

function findMatches() {
  const matches = new Set();
  // horizontal
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c < SIZE; c++) {
      if (state.grid[r][c] !== null && state.grid[r][c] === state.grid[r][c - 1]) run++;
      else {
        if (run >= 3) for (let k = c - run; k < c; k++) matches.add(r + ',' + k);
        run = 1;
      }
    }
    if (run >= 3) for (let k = SIZE - run; k < SIZE; k++) matches.add(r + ',' + k);
  }
  // vertical
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r < SIZE; r++) {
      if (state.grid[r][c] !== null && state.grid[r][c] === state.grid[r - 1][c]) run++;
      else {
        if (run >= 3) for (let k = r - run; k < r; k++) matches.add(k + ',' + c);
        run = 1;
      }
    }
    if (run >= 3) for (let k = SIZE - run; k < SIZE; k++) matches.add(k + ',' + c);
  }
  return matches;
}

function resolve() {
  let total = 0;
  let guard = 0;
  while (true) {
    const matches = findMatches();
    if (matches.size === 0 || guard++ > 50) break;
    for (const key of matches) {
      const [r, c] = key.split(',').map(Number);
      state.grid[r][c] = null;
    }
    total += matches.size;
    // gravity + fill
    for (let c = 0; c < SIZE; c++) {
      const col = [];
      for (let r = SIZE - 1; r >= 0; r--) {
        if (state.grid[r][c] !== null) col.push(state.grid[r][c]);
      }
      for (let r = SIZE - 1; r >= 0; r--) {
        const idx = SIZE - 1 - r;
        state.grid[r][c] = idx < col.length ? col[idx] : randInt(0, state.types - 1);
      }
    }
  }
  state.score += total * 10;
  $('#score').textContent = state.score;
  if (!hasMove()) reshuffle();
}

function hasMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE) {
        [state.grid[r][c], state.grid[r][c + 1]] = [state.grid[r][c + 1], state.grid[r][c]];
        const ok = findMatches().size > 0;
        [state.grid[r][c], state.grid[r][c + 1]] = [state.grid[r][c + 1], state.grid[r][c]];
        if (ok) return true;
      }
      if (r + 1 < SIZE) {
        [state.grid[r][c], state.grid[r + 1][c]] = [state.grid[r + 1][c], state.grid[r][c]];
        const ok = findMatches().size > 0;
        [state.grid[r][c], state.grid[r + 1][c]] = [state.grid[r + 1][c], state.grid[r][c]];
        if (ok) return true;
      }
    }
  }
  return false;
}

function reshuffle() {
  let guard = 0;
  do {
    state.grid = makeGrid();
  } while (findMatches().size > 0 || (!hasMove() && guard++ < 20));
}

function clickTile(r, c) {
  if (state.over) return;
  const key = r + ',' + c;
  if (state.selected === null) {
    state.selected = key;
    render();
    return;
  }
  if (state.selected === key) {
    state.selected = null;
    render();
    return;
  }
  const [sr, sc] = state.selected.split(',').map(Number);
  if (Math.abs(sr - r) + Math.abs(sc - c) !== 1) {
    state.selected = key;
    render();
    return;
  }
  // swap
  [state.grid[sr][sc], state.grid[r][c]] = [state.grid[r][c], state.grid[sr][sc]];
  state.selected = null;
  if (findMatches().size > 0) {
    resolve();
  } else {
    [state.grid[sr][sc], state.grid[r][c]] = [state.grid[r][c], state.grid[sr][sc]];
  }
  render();
}

function endGame() {
  state.over = true;
  clearInterval(countdown);
  showModal('⏰ Time’s Up!', `You scored ${state.score} points!`, 'Play Again', () => init(state.diff));
}

function render() {
  const board = $('#board');
  board.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
  board.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = document.createElement('button');
      tile.className = 'tile' + (state.selected === r + ',' + c ? ' selected' : '');
      tile.textContent = EMOJIS[state.grid[r][c]];
      tile.addEventListener('click', () => clickTile(r, c));
      board.appendChild(tile);
    }
  }
}

initGameFrame({
  title: 'Match Three',
  emoji: '🍬',
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
