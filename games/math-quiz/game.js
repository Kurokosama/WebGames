'use strict';

const DIFFS = {
  easy: { ops: ['+', '-'], maxA: 20, maxB: 10 },
  medium: { ops: ['+', '-', '×'], maxA: 50, maxB: 12 },
  hard: { ops: ['+', '-', '×', '÷'], maxA: 100, maxB: 12 }
};

const TOTAL = 10;
let state = null;

function init(diff) {
  state = {
    diff,
    total: TOTAL,
    index: 0,
    score: 0,
    streak: 0,
    best: 0,
    answer: 0,
    options: [],
    locked: false
  };
  $('#score').textContent = '0';
  $('#streak').textContent = '0';
  $('#best').textContent = '0';
  newQuestion();
}

function makeQuestion() {
  const cfg = DIFFS[state.diff];
  const op = pick(cfg.ops);
  let a, b, answer;
  if (op === '÷') {
    b = randInt(2, 10);
    answer = randInt(2, 10);
    a = b * answer;
  } else if (op === '×') {
    a = randInt(2, cfg.maxB);
    b = randInt(2, cfg.maxB);
    answer = a * b;
  } else if (op === '+') {
    a = randInt(1, cfg.maxA);
    b = randInt(1, cfg.maxB);
    answer = a + b;
  } else {
    a = randInt(2, cfg.maxA);
    b = randInt(1, a - 1);
    answer = a - b;
  }
  return { text: `${a} ${op} ${b}`, answer };
}

function makeOptions(answer) {
  const opts = new Set([answer]);
  const span = Math.max(4, Math.abs(answer) + 4);
  let guard = 0;
  while (opts.size < 4 && guard < 100) {
    guard++;
    const v = answer + (Math.random() < 0.5 ? -1 : 1) * randInt(1, span);
    if (v >= 0) opts.add(v);
  }
  while (opts.size < 4) opts.add(opts.size); // safety fallback
  return shuffle(Array.from(opts));
}

function newQuestion() {
  state.locked = false;
  const q = makeQuestion();
  state.answer = q.answer;
  state.options = makeOptions(q.answer);
  $('#question').textContent = q.text + ' = ?';
  $('#progress').textContent = `${state.index + 1}/${state.total}`;

  const wrap = $('#options');
  wrap.innerHTML = '';
  state.options.forEach((v) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = v;
    btn.addEventListener('click', () => choose(v, btn));
    wrap.appendChild(btn);
  });
}

function choose(v, btn) {
  if (state.locked) return;
  state.locked = true;
  $$('#options .option-btn').forEach((b) => b.classList.add('disabled'));
  const correct = v === state.answer;

  if (correct) {
    state.score++;
    state.streak++;
    state.best = Math.max(state.best, state.streak);
    btn.classList.add('correct');
  } else {
    state.streak = 0;
    btn.classList.add('wrong');
    $$('#options .option-btn').forEach((b) => {
      if (parseInt(b.textContent, 10) === state.answer) b.classList.add('correct');
    });
  }

  $('#score').textContent = state.score;
  $('#streak').textContent = state.streak;
  $('#best').textContent = state.best;

  state.index++;
  setTimeout(() => {
    if (state.index >= state.total) endQuiz();
    else newQuestion();
  }, correct ? 700 : 1300);
}

function endQuiz() {
  const pct = Math.round((state.score / state.total) * 100);
  let title, text;
  if (state.score === state.total) {
    title = '🏆 Perfect Score!';
    text = `You got ${state.score}/${state.total} right — amazing!`;
    burstConfetti();
  } else if (state.score >= 7) {
    title = '🎉 Great Job!';
    text = `You got ${state.score}/${state.total} right. Keep it up!`;
    burstConfetti();
  } else {
    title = '😊 Good Try!';
    text = `You got ${state.score}/${state.total} right (${pct}%). Practice makes perfect!`;
  }
  showModal(title, text, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Math Quiz',
  emoji: '➕',
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
