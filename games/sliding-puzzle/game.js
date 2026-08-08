'use strict';

const SIZES = { easy: 3, medium: 4, hard: 5 };
let state = null;
let timerId = null;

function neighbors(idx, n) {
  const res = [];
  const row = Math.floor(idx / n);
  const col = idx % n;
  if (row > 0) res.push(idx - n);
  if (row < n - 1) res.push(idx + n);
  if (col > 0) res.push(idx - 1);
  if (col < n - 1) res.push(idx + 1);
  return res;
}

function init(diff) {
  clearInterval(timerId);
  const n = SIZES[diff];
  const total = n * n;
  // Standard solved order: 1, 2, ... n²-1, followed by the empty tile (0).
  const board = Array.from({ length: total }, (_, i) => (i + 1) % total);
  let empty = total - 1;
  let prev = -1;
  const shuffleMoves = 120 + n * 80;
  do {
    for (let k = 0; k < shuffleMoves; k++) {
      const options = neighbors(empty, n).filter((idx) => idx !== prev);
      const next = pick(options);
      [board[empty], board[next]] = [board[next], board[empty]];
      prev = empty;
      empty = next;
    }
  } while (board.every((v, i) => v === (i + 1) % total));

  state = { diff, n, board, empty, moves: 0, seconds: 0, done: false };
  $('#moves').textContent = '0';
  $('#timer').textContent = '0s';
  render();
  timerId = setInterval(() => {
    if (state.done) return;
    state.seconds++;
    $('#timer').textContent = state.seconds + 's';
  }, 1000);
}

function clickTile(idx) {
  if (state.done) return;
  if (!neighbors(state.empty, state.n).includes(idx)) return;
  [state.board[state.empty], state.board[idx]] = [state.board[idx], state.board[state.empty]];
  state.empty = idx;
  state.moves++;
  $('#moves').textContent = state.moves;
  render();
  if (state.board.every((v, i) => v === (i + 1) % state.board.length)) win();
}

function win() {
  state.done = true;
  clearInterval(timerId);
  burstConfetti();
  showModal('🎉 You Solved It!', `You finished in ${state.moves} moves and ${state.seconds}s!`, 'Play Again', () => init(state.diff));
}

function render() {
  const boardEl = $('#board');
  boardEl.style.gridTemplateColumns = `repeat(${state.n}, 1fr)`;
  boardEl.innerHTML = '';
  state.board.forEach((val, idx) => {
    const tile = document.createElement('button');
    const isEmpty = val === 0;
    tile.className = 'tile' + (isEmpty ? ' empty' : '');
    tile.textContent = isEmpty ? '' : val;
    if (!isEmpty) tile.addEventListener('click', () => clickTile(idx));
    boardEl.appendChild(tile);
  });
}

initGameFrame({
  title: 'Sliding Puzzle',
  emoji: '🧊',
  difficulties: [
    { value: 'easy', label: 'Easy (3×3)' },
    { value: 'medium', label: 'Medium (4×4)' },
    { value: 'hard', label: 'Hard (5×5)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
