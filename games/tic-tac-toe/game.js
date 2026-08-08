'use strict';

const HUMAN = 'X';
const AI = 'O';

let board = null;      // array of 9, null | 'X' | 'O'
let gameOver = false;
let diff = 'medium';
let score = { you: 0, draws: 0, computer: 0 };
let aiTimer = null;

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function init(d) {
  if (d) diff = d;
  clearTimeout(aiTimer);
  board = Array(9).fill(null);
  gameOver = false;
  $('#you').textContent = score.you;
  $('#draws').textContent = score.draws;
  $('#computer').textContent = score.computer;
  render();
  setTurn('Your turn! (X)');
}

function render() {
  const boardEl = $('#board');
  boardEl.innerHTML = '';
  board.forEach((val, i) => {
    const cell = document.createElement('button');
    cell.className = 'cell' + (val ? ' taken ' + (val === HUMAN ? 'x' : 'o') : '');
    cell.textContent = val === HUMAN ? '✕' : val === AI ? '◯' : '';
    if (!val && !gameOver) cell.addEventListener('click', () => humanMove(i));
    boardEl.appendChild(cell);
  });
}

function humanMove(i) {
  if (gameOver || board[i]) return;
  board[i] = HUMAN;
  if (checkEnd()) return;
  setTurn('Computer is thinking… 🤔');
  aiTimer = setTimeout(() => {
    const move = aiMove();
    if (move !== null) {
      board[move] = AI;
      checkEnd();
    }
  }, 450);
}

function aiMove() {
  const empty = board.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  if (empty.length === 0) return null;

  // hard: win, block, center, corner, random
  // medium: block, center, corner, random
  // easy: random
  if (diff === 'hard' || diff === 'medium') {
    // win
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (board[a] === AI && board[b] === AI && board[c] === null) return c;
      if (board[a] === AI && board[c] === AI && board[b] === null) return b;
      if (board[b] === AI && board[c] === AI && board[a] === null) return a;
    }
    // block
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (board[a] === HUMAN && board[b] === HUMAN && board[c] === null) return c;
      if (board[a] === HUMAN && board[c] === HUMAN && board[b] === null) return b;
      if (board[b] === HUMAN && board[c] === HUMAN && board[a] === null) return a;
    }
  }
  if (diff === 'hard' || diff === 'medium') {
    if (board[4] === null) return 4; // center
    const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
    if (corners.length) return pick(corners);
  }
  return pick(empty);
}

function checkEnd() {
  const winner = getWinner();
  if (winner) {
    gameOver = true;
    highlightWin(winner.line);
    if (winner.player === HUMAN) {
      score.you++;
      $('#you').textContent = score.you;
      setTimeout(() => { burstConfetti(); showModal('🎉 You Win!', 'Great job, three in a row!', 'Play Again', () => init()); }, 400);
    } else {
      score.computer++;
      $('#computer').textContent = score.computer;
      setTimeout(() => { showModal('😅 Computer Wins!', 'Nice try! Let’s go again.', 'Play Again', () => init()); }, 400);
    }
    setTurn('');
    return true;
  }
  if (board.every((v) => v !== null)) {
    gameOver = true;
    score.draws++;
    $('#draws').textContent = score.draws;
    setTurn('');
    setTimeout(() => { showModal('🤝 It’s a Draw!', 'Nobody wins this time.', 'Play Again', () => init()); }, 400);
    return true;
  }
  setTurn('Your turn! (X)');
  render();
  return false;
}

function getWinner() {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { player: board[a], line };
    }
  }
  return null;
}

function highlightWin(line) {
  const cells = $$('#board .cell');
  line.forEach((i) => cells[i].classList.add('win-cell'));
}

function setTurn(text) {
  $('#turn').textContent = text;
}

initGameFrame({
  title: 'Tic-Tac-Toe',
  emoji: '⭕',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'medium',
  onDifficulty: (d) => init(d),
  onRestart: () => init()
});

init();
