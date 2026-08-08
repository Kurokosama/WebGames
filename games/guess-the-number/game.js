'use strict';

const RANGES = { easy: 20, medium: 50, hard: 100 };

let state = null;

function init(diff) {
  const max = RANGES[diff];
  state = { diff, secret: randInt(1, max), attempts: 0, low: 1, high: max, done: false };
  $('#attempts').textContent = '0';
  $('#range').textContent = `1 – ${max}`;
  $('#feedback').textContent = 'Start guessing to find my secret number!';
  $('#feedback').className = 'feedback';
  $('#input').value = '';
  $('#input').focus();
}

function guess() {
  if (state.done) return;
  const val = parseInt($('#input').value, 10);
  if (isNaN(val) || val < 1 || val > RANGES[state.diff]) {
    setFeedback(`Please type a number between 1 and ${RANGES[state.diff]}!`, false);
    return;
  }
  state.attempts++;
  $('#attempts').textContent = state.attempts;

  if (val < state.secret) {
    state.low = Math.max(state.low, val + 1);
    setFeedback('📈 Higher! Try a bigger number.', false);
  } else if (val > state.secret) {
    state.high = Math.min(state.high, val - 1);
    setFeedback('📉 Lower! Try a smaller number.', false);
  } else {
    state.done = true;
    setFeedback(`🎉 Correct! The secret number was ${state.secret}!`, true);
    burstConfetti();
    showModal('🎉 You Got It!', `You found the number in ${state.attempts} guess${state.attempts === 1 ? '' : 'es'}!`, 'Play Again', () => init(state.diff));
  }
  $('#range').textContent = `${state.low} – ${state.high}`;
  $('#input').value = '';
  $('#input').focus();
}

function setFeedback(text, correct) {
  const el = $('#feedback');
  el.textContent = text;
  el.className = 'feedback' + (correct ? ' correct' : '');
}

initGameFrame({
  title: 'Guess the Number',
  emoji: '🔢',
  difficulties: [
    { value: 'easy', label: 'Easy (1–20)' },
    { value: 'medium', label: 'Medium (1–50)' },
    { value: 'hard', label: 'Hard (1–100)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

$('#guess-btn').addEventListener('click', guess);
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter') guess(); });

init('easy');
