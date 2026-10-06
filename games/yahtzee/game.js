'use strict';

/* ============================================================
   Yahtzee — kid scorecard: 5 dice, up to 3 rolls per round
   ============================================================ */

const BEST_KEY = 'best-yahtzee';
const MAX_ROLLS = 3;
const ROUNDS_BY_LEVEL = { easy: 5, normal: 8, hard: 11 };

const CATEGORIES = [
  { key: 'ones', face: 1, label: 'Ones', hint: 'add up the 1s' },
  { key: 'twos', face: 2, label: 'Twos', hint: 'add up the 2s' },
  { key: 'threes', face: 3, label: 'Threes', hint: 'add up the 3s' },
  { key: 'fours', face: 4, label: 'Fours', hint: 'add up the 4s' },
  { key: 'fives', face: 5, label: 'Fives', hint: 'add up the 5s' },
  { key: 'sixes', face: 6, label: 'Sixes', hint: 'add up the 6s' },
  { key: 'kind3', label: 'Three of a Kind', hint: '3 same dice — add them all' },
  { key: 'full', label: 'Full House', hint: '3 same + 2 same = 25' },
  { key: 'straight', label: 'Straight', hint: '3 in a row = 30 · 4 in a row = 40' },
  { key: 'chance', label: 'Chance', hint: 'add up every die' },
  { key: 'yahtzee', label: 'Yahtzee', hint: 'all 5 the same = 50' }
];

// Pip layout on a 3x3 grid (cell indexes 0..8)
const PIP_MAP = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

const roundEl = $('#round');
const totalEl = $('#total');
const bestEl = $('#best');
const rollsEl = $('#rolls-left');
const feedbackEl = $('#feedback');
const diceRow = $('#dice-row');
const cardEl = $('#scorecard');
const rollBtn = $('#roll-btn');

let dice, kept, rollsLeft, round, rounds, scores, best, rolling, hasRolled;

/* ---------- Build the board once ---------- */
const diceCells = [];
for (let i = 0; i < 5; i++) {
  const die = document.createElement('div');
  die.className = 'die';
  const cells = [];
  for (let c = 0; c < 9; c++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const pip = document.createElement('span');
    pip.className = 'pip';
    cell.appendChild(pip);
    die.appendChild(cell);
    cells.push(cell);
  }
  die.addEventListener('click', () => toggleKeep(i));
  diceRow.appendChild(die);
  diceCells.push({ el: die, cells });
}

const cardRows = CATEGORIES.map((cat) => {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'score-row';
  row.innerHTML = '<span class="cat-name">' + cat.label + '</span>' +
    '<span class="cat-hint">' + cat.hint + '</span>' +
    '<span class="cat-points">—</span>';
  row.addEventListener('click', () => pickCategory(cat));
  cardEl.appendChild(row);
  return { cat, el: row, points: $('.cat-points', row) };
});

/* ---------- Storage ---------- */
function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (err) { return 0; }
}
function saveBest(value) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch (err) { /* storage unavailable */ }
}

/* ---------- Scoring ---------- */
function counts() {
  const c = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((face) => c[face]++);
  return c;
}

function scoreFor(cat) {
  const c = counts();
  const sum = dice.reduce((a, b) => a + b, 0);
  const top = Math.max.apply(null, c);

  if (cat.face) return c[cat.face] * cat.face;
  if (cat.key === 'kind3') return top >= 3 ? sum : 0;
  if (cat.key === 'full') return top === 3 && c.indexOf(2) > 0 ? 25 : 0;
  if (cat.key === 'straight') {
    let run = 0, longest = 0;
    for (let face = 1; face <= 6; face++) {
      run = c[face] ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    return longest >= 4 ? 40 : longest >= 3 ? 30 : 0;
  }
  if (cat.key === 'chance') return sum;
  return top === 5 ? 50 : 0; // Yahtzee
}

function total() {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

/* ---------- Rendering ---------- */
function setFace(index, face) {
  const die = diceCells[index];
  const on = PIP_MAP[face] || [];
  die.cells.forEach((cell, i) => cell.classList.toggle('on', on.includes(i)));
  die.el.dataset.face = String(face);
}

function renderDice() {
  diceCells.forEach((die, i) => {
    setFace(i, dice[i]);
    die.el.classList.toggle('kept', kept[i]);
    die.el.classList.toggle('rolling', rolling);
    die.el.classList.toggle('settled', !rolling && hasRolled);
  });
}

function renderCard() {
  cardRows.forEach((row) => {
    const used = scores[row.cat.key] !== undefined;
    const value = used ? scores[row.cat.key] : (hasRolled ? scoreFor(row.cat) : null);
    row.el.classList.toggle('used', used);
    row.el.disabled = used || !hasRolled;
    row.points.textContent = used ? String(value) : (value === null ? '—' : String(value));
    row.el.classList.toggle('zero', !used && value === 0);
  });
}

function renderStats() {
  roundEl.textContent = Math.min(round, rounds) + ' / ' + rounds;
  totalEl.textContent = String(total());
  bestEl.textContent = String(best);
  rollsEl.textContent = String(rollsLeft);
}

function setFeedback(text, tone) {
  feedbackEl.textContent = text;
  feedbackEl.className = 'feedback' + (tone ? ' ' + tone : '');
}

/* ---------- Actions ---------- */
function toggleKeep(index) {
  if (rolling || !hasRolled || rollsLeft === 0) return;
  kept[index] = !kept[index];
  renderDice();
}

function roll() {
  if (rolling || rollsLeft === 0 || round > rounds) return;

  rolling = true;
  rollBtn.disabled = true;
  setFeedback('Rolling…', '');
  renderDice();

  const ticks = 12;
  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    dice = dice.map((face, i) => (kept[i] ? face : randInt(1, 6)));
    renderDice();
    if (tick >= ticks) {
      clearInterval(timer);
      rolling = false;
      hasRolled = true;
      rollsLeft--;
      rollBtn.disabled = rollsLeft === 0;
      renderDice();
      renderCard();
      renderStats();
      setFeedback(rollsLeft > 0
        ? 'Nice! Tap dice you want to keep, or pick a scorecard box.'
        : 'No rolls left — pick a scorecard box now.', 'good');
    }
  }, 90);
}

function pickCategory(cat) {
  if (rolling || !hasRolled || round > rounds || scores[cat.key] !== undefined) return;

  const points = scoreFor(cat);
  scores[cat.key] = points;
  setFeedback('You scored ' + points + ' on ' + cat.label + '!', points > 0 ? 'good' : 'bad');

  if (Object.keys(scores).length >= rounds) { finish(); return; }

  round++;
  dice = [1, 1, 1, 1, 1];
  kept = [false, false, false, false, false];
  rollsLeft = MAX_ROLLS;
  hasRolled = false;
  renderDice();
  renderCard();
  renderStats();
}

function finish() {
  const finalTotal = total();
  const beatBest = finalTotal > best;
  if (beatBest) { best = finalTotal; saveBest(best); }
  renderStats();

  const text = beatBest
    ? 'You scored ' + finalTotal + ' points — a new best! 🌟'
    : 'You scored ' + finalTotal + ' points. Your best is still ' + best + '. Try again!';

  if (beatBest) burstConfetti();
  showModal(beatBest ? '🎉 You Win!' : '🎲 Game Over', text, 'Play Again', reset);
}

function reset() {
  hideModal();
  dice = [1, 1, 1, 1, 1];
  kept = [false, false, false, false, false];
  rollsLeft = MAX_ROLLS;
  round = 1;
  scores = {};
  hasRolled = false;
  rolling = false;
  rollBtn.disabled = false;
  renderDice();
  renderCard();
  renderStats();
  setFeedback('Roll the dice, then tap a scorecard box.', '');
}

/* ---------- Start ---------- */
rollBtn.addEventListener('click', roll);

initGameFrame({
  title: 'Yahtzee',
  emoji: '🎯',
  difficulties: [
    { value: 'easy', label: 'Easy · 5 rounds' },
    { value: 'normal', label: 'Normal · 8 rounds' },
    { value: 'hard', label: 'Hard · full card' }
  ],
  defaultDifficulty: 'normal',
  onDifficulty: (level) => {
    rounds = ROUNDS_BY_LEVEL[level] || 8;
    reset();
  },
  onRestart: reset
});

rounds = 8;
best = readBest();
reset();
