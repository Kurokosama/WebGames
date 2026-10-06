'use strict';

/* ============================================================
   Dice Guess — guess the total of two dice, 10 rounds
   ============================================================ */

const TOTAL_ROUNDS = 10;
const BEST_KEY = 'best-dice';
const HIGH_SCORE = 50;

// Pip layout on a 3x3 grid (cell indexes 0..8)
const PIP_MAP = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

const scoreEl = $('#score');
const bestEl = $('#best');
const roundEl = $('#round');
const totalEl = $('#roll-total b');
const feedbackEl = $('#feedback');
const historyEl = $('#history');
const guessGrid = $('#guess-grid');
const rollBtn = $('#roll-btn');
const surpriseBtn = $('#surprise-btn');

const diceEls = [$('#die-1'), $('#die-2')];
const diceCells = diceEls.map((die) => {
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const pip = document.createElement('span');
    pip.className = 'pip';
    cell.appendChild(pip);
    die.appendChild(cell);
    cells.push(cell);
  }
  return cells;
});

let score = 0;
let round = 1;
let guess = null;
let rolling = false;
let best = 0;

try {
  best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch (err) {
  best = 0;
}

/* ---------- Helpers ---------- */
function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch (err) {
    /* storage unavailable — keep the session best only */
  }
}

function renderStats() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  roundEl.textContent = Math.min(round, TOTAL_ROUNDS);
}

function setFace(dieIndex, face) {
  const cells = diceCells[dieIndex];
  const on = PIP_MAP[face] || [];
  cells.forEach((cell, i) => cell.classList.toggle('on', on.includes(i)));
  diceEls[dieIndex].dataset.face = face;
}

function setFeedback(text, tone) {
  feedbackEl.textContent = text;
  feedbackEl.className = 'feedback' + (tone ? ' ' + tone : '');
}

function addHistoryChip(points) {
  const chip = document.createElement('span');
  const tone = points === 10 ? 'big' : points === 5 ? 'mid' : points === 2 ? 'small' : 'zero';
  chip.className = 'chip ' + tone;
  chip.textContent = 'R' + round + ' +' + points;
  historyEl.appendChild(chip);
}

/* ---------- Guess picker ---------- */
function buildGuessGrid() {
  for (let sum = 2; sum <= 12; sum++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'guess-btn';
    btn.textContent = sum;
    btn.addEventListener('click', () => selectGuess(sum));
    guessGrid.appendChild(btn);
  }
}

function selectGuess(sum) {
  if (rolling || round > TOTAL_ROUNDS) return;
  guess = sum;
  $$('.guess-btn', guessGrid).forEach((btn) => btn.classList.toggle('active', Number(btn.textContent) === sum));
  rollBtn.disabled = false;
  setFeedback('You guessed ' + sum + '. Roll the dice!', '');
}

function surprise() {
  if (rolling || round > TOTAL_ROUNDS) return;
  selectGuess(randInt(2, 12));
  setFeedback('The game picked ' + guess + ' for you. Roll the dice!', '');
}

/* ---------- Rolling ---------- */
function roll() {
  if (rolling || guess === null || round > TOTAL_ROUNDS) return;

  rolling = true;
  rollBtn.disabled = true;
  diceEls.forEach((die) => {
    die.classList.remove('settled');
    die.classList.add('rolling');
  });

  const d1 = randInt(1, 6);
  const d2 = randInt(1, 6);
  let tick = 0;
  const ticks = 14;

  const timer = setInterval(() => {
    tick++;
    setFace(0, randInt(1, 6));
    setFace(1, randInt(1, 6));
    if (tick >= ticks) {
      clearInterval(timer);
      settle(d1, d2);
    }
  }, 90);
}

function settle(d1, d2) {
  diceEls.forEach((die) => {
    die.classList.remove('rolling');
    die.classList.add('settled');
  });
  setFace(0, d1);
  setFace(1, d2);

  const total = d1 + d2;
  const diff = Math.abs(total - guess);
  const points = diff === 0 ? 10 : diff === 1 ? 5 : diff === 2 ? 2 : 0;

  totalEl.textContent = total;
  score += points;
  if (score > best) {
    best = score;
    saveBest();
  }
  addHistoryChip(points);

  if (diff === 0) {
    setFeedback('🎯 Exact! You guessed ' + guess + ' and rolled ' + total + '. +10 points!', 'good');
  } else if (diff === 1) {
    setFeedback('👏 So close! Rolled ' + total + ', off by 1. +5 points.', 'good');
  } else if (diff === 2) {
    setFeedback('🙂 Nearly! Rolled ' + total + ', off by 2. +2 points.', 'okay');
  } else {
    setFeedback('😅 Rolled ' + total + ', off by ' + diff + '. No points this round.', 'bad');
  }

  renderStats();

  if (round >= TOTAL_ROUNDS) {
    rolling = false;
    finish();
    return;
  }

  round++;
  rolling = false;
  guess = null;
  $$('.guess-btn', guessGrid).forEach((btn) => btn.classList.remove('active'));
  renderStats();
  setFeedback('Round ' + round + ' — pick a new number!', '');
}

/* ---------- End of game ---------- */
function finish() {
  const newBest = score >= best;
  const strong = score >= HIGH_SCORE;
  const text = 'You scored ' + score + ' points in ' + TOTAL_ROUNDS + ' rounds. Best score: ' + best + '.';

  if (strong) burstConfetti();

  if (strong) {
    showModal('🎉 Amazing Score!', text, 'Play Again', reset);
  } else if (newBest) {
    showModal('🏆 New Best Score!', text, 'Play Again', reset);
  } else {
    showModal('🎲 Game Over!', text, 'Play Again', reset);
  }
}

/* ---------- Restart ---------- */
function reset() {
  score = 0;
  round = 1;
  guess = null;
  rolling = false;
  historyEl.innerHTML = '';
  $$('.guess-btn', guessGrid).forEach((btn) => btn.classList.remove('active'));
  diceEls.forEach((die) => {
    die.classList.remove('rolling', 'settled');
  });
  setFace(0, 1);
  setFace(1, 1);
  totalEl.textContent = '—';
  rollBtn.disabled = true;
  renderStats();
  setFeedback('Fresh start! Pick a number, then roll the dice.', '');
}

/* ---------- Boot ---------- */
buildGuessGrid();
rollBtn.addEventListener('click', roll);
surpriseBtn.addEventListener('click', surprise);
reset();

initGameFrame({
  title: 'Dice Guess',
  emoji: '🎲',
  onRestart: reset
});
