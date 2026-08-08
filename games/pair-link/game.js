'use strict';

const EMOJIS = ['🍎','🍌','🍇','🍓','🍒','🍑','🍉','🥝','🍍','🥕','🌽','🍄','🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨','🦁','🐸','🦄','🐧','🐷','🐔','🚗','🚌','✈️','⚽','🎈','🎁','⭐','🌙','☀️','🍦'];

const DIFFS = {
  easy: { rows: 6, cols: 6 },
  medium: { rows: 6, cols: 8 },
  hard: { rows: 8, cols: 8 }
};

let state = null;
let timerId = null;

function init(diff) {
  clearInterval(timerId);
  const { rows, cols } = DIFFS[diff];
  const pairs = (rows * cols) / 2;
  const chosen = shuffle(EMOJIS).slice(0, pairs);
  const flat = shuffle([].concat(chosen, chosen));
  const board = [];
  for (let r = 0; r < rows; r++) {
    board.push([]);
    for (let c = 0; c < cols; c++) {
      board[r].push(flat[r * cols + c]);
    }
  }
  state = { diff, rows, cols, board, selected: null, seconds: 0 };
  $('#pairs').textContent = pairs;
  $('#timer').textContent = '0s';
  $('#feedback').textContent = 'Click two matching tiles that can be connected with a path!';
  $('#feedback').className = 'feedback';
  render();
  timerId = setInterval(() => {
    state.seconds++;
    $('#timer').textContent = state.seconds + 's';
  }, 1000);
}

function render() {
  const boardEl = $('#board');
  boardEl.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
  boardEl.innerHTML = '';
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const val = state.board[r][c];
      const tile = document.createElement('button');
      tile.className = 'tile' + (val === null ? ' cleared' : '');
      tile.textContent = val || '';
      if (val !== null) {
        tile.addEventListener('click', () => clickTile(r, c, tile));
      }
      boardEl.appendChild(tile);
    }
  }
}

function clickTile(r, c, tile) {
  if (state.board[r][c] === null) return;
  const key = `${r},${c}`;

  if (state.selected === null) {
    state.selected = { r, c, key, tile };
    tile.classList.add('selected');
    return;
  }

  if (state.selected.key === key) {
    state.selected.tile.classList.remove('selected');
    state.selected = null;
    return;
  }

  const a = state.selected;
  const b = { r, c, key, tile };

  if (state.board[a.r][a.c] === state.board[b.r][b.c] && canConnect(a, b)) {
    a.tile.classList.remove('selected');
    state.board[a.r][a.c] = null;
    state.board[b.r][b.c] = null;
    a.tile.classList.add('cleared');
    b.tile.classList.add('cleared');
    state.selected = null;
    const remaining = state.board.flat().filter((v) => v !== null).length;
    $('#pairs').textContent = remaining / 2;
    if (remaining === 0) {
      win();
      return;
    }
    // check for available moves; reshuffle if stuck
    if (!hasMove()) reshuffle();
  } else {
    a.tile.classList.remove('selected');
    state.selected = null;
    flashFeedback('Oops! Those can’t connect. Try another pair.');
  }
}

// ---------- path finding (classic 连连看, ≤ 2 turns, with border) ----------
function padCoords(r, c) { return { r: r + 1, c: c + 1 }; }

function isFreePad(pr, pc, a, b) {
  if ((pr === a.pr && pc === a.pc) || (pr === b.pr && pc === b.pc)) return true;
  if (pr === 0 || pr === state.rows + 1 || pc === 0 || pc === state.cols + 1) return true;
  return state.board[pr - 1][pc - 1] === null;
}

function segFree(r1, c1, r2, c2, a, b) {
  if (r1 === r2) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
      if (!isFreePad(r1, c, a, b)) return false;
    }
    return true;
  }
  if (c1 === c2) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      if (!isFreePad(r, c1, a, b)) return false;
    }
    return true;
  }
  return false;
}

function canConnect(a, b) {
  const pa = padCoords(a.r, a.c);
  const pb = padCoords(b.r, b.c);
  a = { ...a, ...pa };
  b = { ...b, ...pb };

  // 0 turns (straight line)
  if (a.r === b.r || a.c === b.c) {
    if (segFree(a.r, a.c, b.r, b.c, a, b)) return true;
  }
  // 1 turn
  if (isFreePad(a.r, b.c, a, b) && segFree(a.r, a.c, a.r, b.c, a, b) && segFree(a.r, b.c, b.r, b.c, a, b)) return true;
  if (isFreePad(b.r, a.c, a, b) && segFree(a.r, a.c, b.r, a.c, a, b) && segFree(b.r, a.c, b.r, b.c, a, b)) return true;
  // 2 turns
  for (let c = 0; c <= state.cols + 1; c++) {
    if (segFree(a.r, a.c, a.r, c, a, b) && segFree(a.r, c, b.r, c, a, b) && segFree(b.r, c, b.r, b.c, a, b)) return true;
  }
  for (let r = 0; r <= state.rows + 1; r++) {
    if (segFree(a.r, a.c, r, a.c, a, b) && segFree(r, a.c, r, b.c, a, b) && segFree(r, b.c, b.r, b.c, a, b)) return true;
  }
  return false;
}

function hasMove() {
  const cells = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.board[r][c] !== null) cells.push({ r, c });
    }
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i];
      const b = cells[j];
      if (state.board[a.r][a.c] === state.board[b.r][b.c] && canConnect(a, b)) return true;
    }
  }
  return false;
}

function reshuffle() {
  const remaining = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.board[r][c] !== null) remaining.push(state.board[r][c]);
    }
  }
  const shuffled = shuffle(remaining);
  let i = 0;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.board[r][c] !== null) state.board[r][c] = shuffled[i++];
    }
  }
  state.selected = null;
  flashFeedback('🔄 No more moves — I reshuffled the tiles!');
  render();
}

function flashFeedback(text) {
  const el = $('#feedback');
  el.textContent = text;
  el.className = 'feedback warn';
  setTimeout(() => {
    if (state) {
      el.textContent = 'Click two matching tiles that can be connected with a path!';
      el.className = 'feedback';
    }
  }, 1400);
}

function win() {
  clearInterval(timerId);
  burstConfetti();
  showModal('🎉 You Cleared It!', `You cleared the board in ${state.seconds}s!`, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Pair Link',
  emoji: '🍎',
  difficulties: [
    { value: 'easy', label: 'Easy (6×6)' },
    { value: 'medium', label: 'Medium (6×8)' },
    { value: 'hard', label: 'Hard (8×8)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
