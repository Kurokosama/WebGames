'use strict';

const DIFFS = {
  easy: { rows: 8, cols: 8, mines: 10 },
  medium: { rows: 10, cols: 10, mines: 15 },
  hard: { rows: 12, cols: 12, mines: 24 }
};

let state = null;
let sessionBest = null;

function init(diff) {
  clearInterval(state ? state.timerId : null);
  const { rows, cols, mines } = DIFFS[diff];
  state = {
    diff, rows, cols, mines,
    grid: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ mine: false, revealed: false, flag: false, adj: 0 }))
    ),
    started: false,
    seconds: 0,
    revealed: 0,
    over: false,
    timerId: null
  };
  $('#mines').textContent = mines;
  $('#time').textContent = '0s';
  $('#best').textContent = sessionBest === null ? '—' : sessionBest + 's';
  render();
}

function placeMines(safeR, safeC) {
  const cells = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const isSafe = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
      if (!isSafe) cells.push({ r, c });
    }
  }
  shuffle(cells).slice(0, state.mines).forEach(({ r, c }) => { state.grid[r][c].mine = true; });
  // compute adjacent counts
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < state.rows && cc >= 0 && cc < state.cols && state.grid[rr][cc].mine) cnt++;
        }
      }
      state.grid[r][c].adj = cnt;
    }
  }
}

function reveal(r, c) {
  if (state.over) return;
  const cell = state.grid[r][c];
  if (cell.revealed || cell.flag) return;

  if (!state.started) {
    state.started = true;
    placeMines(r, c);
    state.timerId = setInterval(() => {
      if (state.over) return;
      state.seconds++;
      $('#time').textContent = state.seconds + 's';
    }, 1000);
  }

  if (cell.mine) {
    cell.revealed = true;
    state.over = true;
    clearInterval(state.timerId);
    revealAllMines();
    showModal('💥 Boom!', 'You hit a bomb! Try again.', 'Play Again', () => init(state.diff));
    render();
    return;
  }

  floodReveal(r, c);
  render();
  if (state.revealed === state.rows * state.cols - state.mines) win();
}

function floodReveal(r, c) {
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return;
  const cell = state.grid[r][c];
  if (cell.revealed || cell.flag || cell.mine) return;
  cell.revealed = true;
  state.revealed++;
  if (cell.adj === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        floodReveal(r + dr, c + dc);
      }
    }
  }
}

function toggleFlag(r, c) {
  if (state.over) return;
  const cell = state.grid[r][c];
  if (cell.revealed) return;
  cell.flag = !cell.flag;
  render();
}

function revealAllMines() {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c].mine) state.grid[r][c].revealed = true;
    }
  }
}

function win() {
  state.over = true;
  clearInterval(state.timerId);
  if (sessionBest === null || state.seconds < sessionBest) sessionBest = state.seconds;
  $('#best').textContent = sessionBest + 's';
  burstConfetti();
  showModal('🎉 You Win!', `You cleared the minefield in ${state.seconds}s!`, 'Play Again', () => init(state.diff));
}

function render() {
  const board = $('#board');
  board.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
  board.innerHTML = '';
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      const el = document.createElement('button');
      let cls = 'cell';
      let text = '';
      if (cell.revealed) {
        cls += ' revealed';
        if (cell.mine) { cls += ' mine'; text = '💣'; }
        else if (cell.adj > 0) { cls += ' n' + cell.adj; text = cell.adj; }
      } else if (cell.flag) {
        cls += ' flag';
        text = '🚩';
      }
      el.className = cls;
      el.textContent = text;
      el.addEventListener('click', () => reveal(r, c));
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleFlag(r, c); });
      board.appendChild(el);
    }
  }
}

initGameFrame({
  title: 'Minesweeper',
  emoji: '💣',
  difficulties: [
    { value: 'easy', label: 'Easy (8×8)' },
    { value: 'medium', label: 'Medium (10×10)' },
    { value: 'hard', label: 'Hard (12×12)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
