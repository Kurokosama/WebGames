'use strict';

/* ============================================================
   Nim (Take Stones) — misère Nim, the player who takes the
   LAST stone loses. The computer plays perfectly with the
   XOR strategy (with the all-ones endgame adjustment).
   ============================================================ */

const BEST_KEY = 'best-nim';
const START_PILES = [3, 4, 5];
const STONE_EMOJI = '🪨';
const AI_DELAY_MS = 700;

let piles = START_PILES.slice();
let selected = -1;        // pile the player picked
let gameOver = false;
let aiThinking = false;
let aiTimer = null;
let wins = 0;
let streak = 0;
let best = readBest();

function readBest() {
  try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
}
function saveBest(value) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch (e) { /* storage unavailable */ }
}

function totalOf(arr) {
  return arr.reduce((a, n) => a + n, 0);
}

function totalStones() {
  return totalOf(piles);
}

/* Perfect misère play with the XOR strategy:
   hand the opponent a position where the XOR of the piles is 0.
   In the all-ones endgame the rule flips — leave an ODD number of
   single stones, because whoever takes the last stone loses. */
function handsOpponentALosingPosition(after) {
  const ones = after.filter((n) => n === 1).length;
  if (!after.some((n) => n > 1)) return ones % 2 === 1;
  return after.reduce((a, n) => a ^ n, 0) === 0;
}

function computerMove() {
  const nonEmpty = piles.map((n, i) => [n, i]).filter(([n]) => n > 0);
  if (!nonEmpty.length) return null;

  for (const [n, i] of nonEmpty) {
    for (let take = 1; take <= n; take++) {
      const after = piles.slice();
      after[i] -= take;
      if (totalOf(after) === 0) continue; // taking the last stone would lose
      if (handsOpponentALosingPosition(after)) return { idx: i, take };
    }
  }

  // Already a losing position: take one stone and hope the player slips up.
  return { idx: nonEmpty[0][1], take: 1 };
}

/* ---------- Rendering ---------- */

function renderStats() {
  $('#stones-left').textContent = totalStones();
  $('#wins').textContent = wins;
  $('#best-streak').textContent = best;
  $('#turn-name').textContent = gameOver ? '—' : aiThinking ? 'Computer' : 'You';
}

function renderPiles() {
  const board = $('#piles');
  board.innerHTML = '';

  piles.forEach((count, idx) => {
    const pile = document.createElement('div');
    pile.className = 'pile';
    if (idx === selected) pile.classList.add('selected');
    if (count === 0) pile.classList.add('empty');
    if (gameOver || aiThinking || count === 0) pile.classList.add('disabled');

    const name = document.createElement('div');
    name.className = 'pile-name';
    name.textContent = 'Pile ' + (idx + 1);
    pile.appendChild(name);

    const countEl = document.createElement('div');
    countEl.className = 'pile-count';
    countEl.textContent = count === 0 ? 'empty' : count + ' stones';
    pile.appendChild(countEl);

    for (let s = 0; s < START_PILES[idx]; s++) {
      const stone = document.createElement('div');
      stone.className = 'stone' + (s >= count ? ' gone' : '');
      stone.textContent = STONE_EMOJI;
      pile.appendChild(stone);
    }

    if (!gameOver && !aiThinking && count > 0) {
      pile.addEventListener('click', () => selectPile(idx));
    }
    board.appendChild(pile);
  });
}

function renderTakePanel() {
  const panel = $('#take-panel');
  const buttons = $('#take-buttons');
  buttons.innerHTML = '';

  if (selected < 0 || piles[selected] === 0) {
    panel.classList.add('hidden');
    return;
  }

  $('#take-label').textContent = 'Pile ' + (selected + 1) + ' — take how many?';
  const count = piles[selected];
  for (let k = 1; k <= count; k++) {
    const btn = document.createElement('button');
    btn.className = 'take-btn' + (k === count ? ' all' : '');
    btn.textContent = k === count ? 'Take all ' + k + ' 🪨' : 'Take ' + k;
    btn.addEventListener('click', () => takeStones(selected, k, 'You'));
    buttons.appendChild(btn);
  }

  const cancel = document.createElement('button');
  cancel.className = 'cancel-btn';
  cancel.textContent = 'Never mind';
  cancel.addEventListener('click', () => { selected = -1; render(); });
  buttons.appendChild(cancel);

  panel.classList.remove('hidden');
}

function setHint(text, thinking) {
  const hint = $('#turn-hint');
  hint.textContent = text;
  hint.classList.toggle('thinking', !!thinking);
}

function render() {
  renderStats();
  renderPiles();
  renderTakePanel();
  if (gameOver) setHint('Game over — press Restart to play again.', false);
  else if (aiThinking) setHint('Computer is thinking… 🤔', true);
  else if (selected >= 0) setHint('Choose how many stones to take.', false);
  else setHint('Your turn — click a pile.', false);
}

/* ---------- Game flow ---------- */

function selectPile(idx) {
  if (gameOver || aiThinking) return;
  selected = idx;
  render();
}

function takeStones(idx, count, who) {
  if (gameOver || piles[idx] < count) return;
  piles[idx] -= count;
  selected = -1;

  if (totalStones() === 0) {
    // Whoever takes the last stone loses.
    endGame(who === 'You' ? 'computer' : 'player');
    return;
  }

  if (who === 'You') {
    aiThinking = true;
    render();
    aiTimer = setTimeout(() => {
      const move = computerMove();
      aiThinking = false;
      if (move) takeStones(move.idx, move.take, 'Computer');
    }, AI_DELAY_MS);
  } else {
    render();
  }
}

function endGame(winner) {
  gameOver = true;
  if (winner === 'player') {
    wins++;
    streak++;
    if (streak > best) { best = streak; saveBest(best); }
    render();
    burstConfetti();
    showModal('🎉 You Win!', 'The computer took the last stone. Streak: ' + streak + '!', 'Play Again', () => init());
  } else {
    streak = 0;
    render();
    showModal('😅 Computer Wins!', 'You took the last stone. Perfect play wins — try again!', 'Play Again', () => init());
  }
}

function init() {
  clearTimeout(aiTimer);
  piles = START_PILES.slice();
  selected = -1;
  gameOver = false;
  aiThinking = false;
  render();
}

initGameFrame({
  title: 'Nim (Take Stones)',
  emoji: '🪨',
  onRestart: () => init()
});

init();
