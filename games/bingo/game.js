'use strict';

const LINES_TO_WIN = 3;
const AUTO_MS = 3000;

// All 12 winning lines as cell-index arrays (5 rows, 5 columns, 2 diagonals)
const LINE_SETS = (() => {
  const sets = [];
  for (let r = 0; r < 5; r++) sets.push(Array.from({ length: 5 }, (_, i) => r * 5 + i));
  for (let c = 0; c < 5; c++) sets.push(Array.from({ length: 5 }, (_, i) => i * 5 + c));
  sets.push(Array.from({ length: 5 }, (_, i) => i * 6));
  sets.push(Array.from({ length: 5 }, (_, i) => i * 4));
  return sets;
})();

let state = null;
let autoTimer = null;

function getBest() {
  const v = parseInt(localStorage.getItem('best-bingo'), 10);
  return Number.isFinite(v) ? v : null;
}

function init() {
  stopAuto();
  hideModal();

  // Build a fresh card: column pools B(1-15) I(16-30) N(31-45) G(46-60) O(61-75)
  const pools = [];
  for (let c = 0; c < 5; c++) {
    const lo = c * 15 + 1;
    pools.push(shuffle(Array.from({ length: 15 }, (_, i) => lo + i)).slice(0, 5));
  }

  const card = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const free = r === 2 && c === 2;
      card.push({ num: free ? 0 : pools[c][r], free, marked: free });
    }
  }

  state = {
    card,
    called: new Set(),
    calledCount: 0,
    completedLines: new Set(),
    lines: 0,
    over: false
  };

  renderCard();
  updateStats();
  const lastCall = $('#last-call');
  lastCall.textContent = '🎱';
  lastCall.classList.remove('pop');
}

function renderCard() {
  const letters = $('#bingo-letters');
  letters.innerHTML = '';
  'BINGO'.split('').forEach((ch) => {
    const span = document.createElement('span');
    span.textContent = ch;
    letters.appendChild(span);
  });

  const board = $('#bingo-card');
  board.innerHTML = '';
  state.card.forEach((cell, idx) => {
    const el = document.createElement('div');
    el.className = 'cell' + (cell.free ? ' free marked' : '');
    el.textContent = cell.free ? 'FREE' : cell.num;
    board.appendChild(el);
    cell.el = el;
  });
}

function callNumber() {
  if (!state || state.over) return;

  const pool = [];
  for (let n = 1; n <= 75; n++) {
    if (!state.called.has(n)) pool.push(n);
  }
  if (pool.length === 0) {
    stopAuto();
    showModal('😅 All numbers called!', 'No more numbers left — press "New card" to try a fresh card.', 'New card', init);
    return;
  }

  const n = pick(pool);
  state.called.add(n);
  state.calledCount++;

  const lastCall = $('#last-call');
  lastCall.textContent = n;
  lastCall.classList.remove('pop');
  void lastCall.offsetWidth; // restart animation
  lastCall.classList.add('pop');

  const cell = state.card.find((c) => c.num === n);
  if (cell) markCell(cell);

  updateStats();
  checkLines();
}

function markCell(cell) {
  if (cell.marked) return;
  cell.marked = true;
  cell.el.classList.add('marked');
}

function checkLines() {
  LINE_SETS.forEach((line, li) => {
    if (state.completedLines.has(li)) return;
    if (line.every((idx) => state.card[idx].marked)) {
      state.completedLines.add(li);
      state.lines++;
      line.forEach((idx) => state.card[idx].el.classList.add('line-complete'));
    }
  });
  updateStats();
  if (state.lines >= LINES_TO_WIN) win();
}

function win() {
  state.over = true;
  stopAuto();

  const best = getBest();
  if (best === null || state.calledCount < best) {
    localStorage.setItem('best-bingo', String(state.calledCount));
    updateStats();
    showModal('🎉 BINGO!', `You completed ${state.lines} lines with only ${state.calledCount} numbers called — new best!`, 'Play Again', init);
  } else {
    showModal('🎉 You Win!', `You completed ${state.lines} lines with ${state.calledCount} numbers called. Best: ${best}`, 'Play Again', init);
  }
  burstConfetti();
}

function startAuto() {
  if (autoTimer) return;
  autoTimer = setInterval(callNumber, AUTO_MS);
  const btn = $('#auto-toggle');
  btn.classList.add('on');
  btn.textContent = '🤖 Auto-call: ON';
  btn.setAttribute('aria-pressed', 'true');
}

function stopAuto() {
  clearInterval(autoTimer);
  autoTimer = null;
  const btn = $('#auto-toggle');
  if (btn) {
    btn.classList.remove('on');
    btn.textContent = '🤖 Auto-call: OFF';
    btn.setAttribute('aria-pressed', 'false');
  }
}

function updateStats() {
  if (!state) return;
  $('#lines').textContent = state.lines;
  $('#called').textContent = state.calledCount;
  const best = getBest();
  $('#best').textContent = best === null ? '—' : best;
}

$('#call-btn').addEventListener('click', callNumber);
$('#auto-toggle').addEventListener('click', () => {
  if (autoTimer) stopAuto();
  else startAuto();
});

initGameFrame({
  title: 'Bingo',
  emoji: '🎉',
  onRestart: () => init()
});

init();
