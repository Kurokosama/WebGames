'use strict';

/* ============================================================
   Mancala — basic two-player Kalaha.
   6 pits per side + a store, 6 stones per pit. Sowing moves
   counterclockwise; landing the LAST stone in an empty pit on
   your side captures the pit straight across. First to 13 wins.
   ============================================================ */

const BEST_KEY = 'best-mancala';
const SIDE = 6;
const PER_PIT = 6;
const WIN_TARGET = 13;
const AI_DELAY_MS = 700;
const SOW_STEP_MS = 140;

/* Board indices: 0-5 = player pits (bottom row, left to right),
   6-11 = computer pits (top row, left to right).
   Counterclockwise sowing order: player pits left→right, then
   computer pits right→left, with each store after its side. */
const SOW_SEQUENCE = [0, 1, 2, 3, 4, 5, 'P', 11, 10, 9, 8, 7, 6, 'C'];

let board, store, turn, gameOver, aiThinking, difficulty, timer, aiTimer;
let best = readBest();

function readBest() {
  try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
}
function saveBest(value) {
  if (value > best) {
    best = value;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage unavailable */ }
  }
}

function isPlayerSide(i) { return i >= 0 && i < SIDE; }
function oppositeOf(i, owner) { return isPlayerSide(i) ? i + SIDE : i - SIDE; }

function legalMoves(owner, arr) {
  const b = arr || board;
  const first = owner === 'player' ? 0 : SIDE;
  const moves = [];
  for (let i = first; i < first + SIDE; i++) if (b[i] > 0) moves.push(i);
  return moves;
}

/* Where each stone lands, skipping the opponent's store. */
function buildPath(arr, startIdx, owner) {
  const pos = SOW_SEQUENCE.indexOf(startIdx);
  const count = arr[startIdx];
  const path = [];
  let i = pos;
  while (path.length < count) {
    const slot = SOW_SEQUENCE[i % SOW_SEQUENCE.length];
    if (slot === 'P' && owner !== 'player') { i++; continue; }
    if (slot === 'C' && owner !== 'computer') { i++; continue; }
    path.push(slot);
    i++;
  }
  return path;
}

function placeOn(arr, st, slot, owner) {
  if (slot === 'P') { if (owner === 'player') st.player++; return; }
  if (slot === 'C') { if (owner === 'computer') st.computer++; return; }
  arr[slot]++;
}

/* Full move simulation (used by the AI): returns { board, store, captured }. */
function simulate(startIdx, owner, state) {
  const b = (state ? state.board : board).slice();
  const s = state ? { player: state.store.player, computer: state.store.computer }
                  : { player: store.player, computer: store.computer };
  const path = buildPath(b, startIdx, owner);
  b[startIdx] = 0;
  path.forEach((slot) => placeOn(b, s, slot, owner));
  const last = path[path.length - 1];
  let captured = 0;
  if (typeof last === 'number' && isPlayerSide(last) === (owner === 'player') && b[last] === 1) {
    const opp = oppositeOf(last, owner);
    if (b[opp] > 0) {
      captured = b[last] + b[opp];
      s[owner] += captured;
      b[last] = 0;
      b[opp] = 0;
    }
  }
  return { board: b, store: s, captured };
}

/* Simple AI: winning sows first, then captures, then a safe pit. */
function aiChooseMove() {
  const moves = legalMoves('computer');
  if (!moves.length) return -1;

  const winning = moves.filter((m) => simulate(m, 'computer').store.computer >= WIN_TARGET);
  if (winning.length) return pick(winning);

  if (difficulty === 'easy') return pick(moves);

  const capturing = moves.filter((m) => simulate(m, 'computer').captured > 0);
  if (capturing.length) return pick(capturing);

  if (difficulty === 'medium') return pick(moves);

  /* Hard: avoid sows that let the player capture on their next turn. */
  const safe = moves.filter((m) => {
    const after = simulate(m, 'computer');
    return !legalMoves('player', after.board).some((r) => simulate(r, 'player', after).captured > 0);
  });
  const pool = safe.length ? safe : moves;
  return pick(pool.sort((a, b) => board[b] - board[a]).slice(0, Math.max(1, Math.floor(pool.length / 2))));
}

/* ---------- Rendering ---------- */

function buildPits(container, first, owner) {
  container.innerHTML = '';
  for (let i = first; i < first + SIDE; i++) {
    const pit = document.createElement('div');
    pit.className = 'pit';
    pit.dataset.index = String(i);
    pit.dataset.owner = owner;
    pit.innerHTML = '<span class="pit-label">' + (owner === 'player' ? 'You' : 'Computer') +
      '</span><div class="stones"></div><span class="pit-count">0</span>';
    if (owner === 'player') pit.addEventListener('click', () => onPitClick(i));
    container.appendChild(pit);
  }
}

function render() {
  $$('.pit').forEach((pit) => {
    const idx = parseInt(pit.dataset.index, 10);
    const owner = pit.dataset.owner;
    const n = board[idx];
    let dots = '';
    for (let s = 0; s < n; s++) dots += '<span class="stone"></span>';
    $('.stones', pit).innerHTML = dots;
    $('.pit-count', pit).textContent = String(n);
    const clickable = owner === 'player' && !gameOver && turn === 'player' && !aiThinking && n > 0;
    pit.classList.toggle('clickable', clickable);
    pit.classList.toggle('disabled', owner === 'player' && !clickable);
    pit.classList.toggle('sowing', pit.dataset.index === String(flashIndex));
    pit.classList.toggle('capture-flash', pit.dataset.index === String(captureIndex));
  });

  $('#my-store').textContent = String(store.player);
  $('#cpu-store').textContent = String(store.computer);
  $('#my-store-visual').textContent = String(store.player);
  $('#cpu-store-visual').textContent = String(store.computer);
  $('#best-score').textContent = String(best);

  $('#turn-name').textContent = gameOver ? 'Game over' : (turn === 'player' ? 'You' : 'Computer');
  $('#turn-hint').textContent = gameOver ? 'Press 🔄 Restart to play again.'
    : (turn === 'player' ? 'Your turn — click one of your pits to sow.' : 'The computer is thinking… 🤔');
}

let flashIndex = -1;
let captureIndex = -1;

function onPitClick(i) {
  if (gameOver || aiThinking || turn !== 'player' || board[i] < 1) return;
  runMove(i, 'player', () => {
    if (finishTurn()) return;
    startTurn('computer');
  });
}

function aiTurn() {
  if (gameOver) return;
  const move = aiChooseMove();
  runMove(move, 'computer', () => {
    aiThinking = false;
    if (finishTurn()) return;
    startTurn('player');
  });
}

/* A side with no stones left cannot move: the opponent gathers the board. */
function startTurn(owner) {
  if (gameOver) return;
  if (!legalMoves(owner).length) {
    sweep(owner === 'player' ? 'computer' : 'player');
    return;
  }
  turn = owner;
  aiThinking = owner === 'computer';
  render();
  if (owner === 'computer') aiTimer = setTimeout(aiTurn, AI_DELAY_MS);
}

function runMove(startIdx, owner, onDone) {
  const path = buildPath(board, startIdx, owner);
  board[startIdx] = 0;
  render();
  let i = 0;
  const step = () => {
    const slot = path[i];
    if (typeof slot === 'number') {
      board[slot]++;
      flashIndex = slot;
    } else if (slot === 'P') {
      store.player++;
      flashIndex = -1;
    } else {
      store.computer++;
      flashIndex = -1;
    }
    i++;
    render();
    if (i < path.length) {
      timer = setTimeout(step, SOW_STEP_MS);
    } else {
      const last = path[path.length - 1];
      if (typeof last === 'number' && isPlayerSide(last) === (owner === 'player') && board[last] === 1) {
        const opp = oppositeOf(last, owner);
        if (board[opp] > 0) {
          captureIndex = last;
          store[owner] += board[last] + board[opp];
          board[last] = 0;
          board[opp] = 0;
          render();
        }
      }
      flashIndex = -1;
      render();
      onDone();
    }
  };
  timer = setTimeout(step, SOW_STEP_MS);
}

/* If a player has no stones left, the opponent gathers the board. */
function sweep(winner) {
  const remaining = board.reduce((a, n) => a + n, 0);
  board = board.map(() => 0);
  store[winner] += remaining;
  render();
  endGame(winner, remaining);
}

function finishTurn() {
  if (store.player >= WIN_TARGET) { endGame('player', 0); return true; }
  if (store.computer >= WIN_TARGET) { endGame('computer', 0); return true; }
  return false;
}

function endGame(winner, extra) {
  gameOver = true;
  flashIndex = -1;
  captureIndex = -1;
  render();
  if (winner === 'player') {
    saveBest(store.player);
    burstConfetti();
    const note = extra > 0 ? ' You also gathered the ' + extra + ' leftover stones.' : '';
    showModal('🎉 You Win!', 'Your store has ' + store.player + ' stones, the computer has ' + store.computer + '.' + note, 'Play Again', () => init());
  } else {
    showModal('😅 Computer Wins!', 'The computer reached ' + store.computer + ' stones (you had ' + store.player + '). Try to capture more pits next time!', 'Play Again', () => init());
  }
}

function init() {
  clearTimeout(timer);
  clearTimeout(aiTimer);
  board = new Array(SIDE * 2).fill(PER_PIT);
  store = { player: 0, computer: 0 };
  turn = 'player';
  gameOver = false;
  aiThinking = false;
  flashIndex = -1;
  captureIndex = -1;
  buildPits($('#player-pits'), 0, 'player');
  buildPits($('#computer-pits'), SIDE, 'computer');
  hideModal();
  startTurn('player');
}

initGameFrame({
  title: 'Mancala',
  emoji: '🥣',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'medium',
  onDifficulty: (value) => { difficulty = value; init(); },
  onRestart: () => init()
});

difficulty = 'medium';
init();
