'use strict';

const TOTAL = 10;
const BASE = [
  { name: 'Red', hex: '#e53935' },
  { name: 'Blue', hex: '#1e88e5' },
  { name: 'Green', hex: '#43a047' },
  { name: 'Yellow', hex: '#fdd835' },
  { name: 'Orange', hex: '#fb8c00' },
  { name: 'Purple', hex: '#8e24aa' },
  { name: 'Pink', hex: '#ec407a' },
  { name: 'Brown', hex: '#795548' }
];

const CHOICES = { easy: 4, medium: 5, hard: 6 };

let state = null;
let nextTimer = null;

// Lerp a hex color toward white (factor > 0) or black (factor < 0).
function shade(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = factor > 0 ? 255 : 0;
  const p = Math.min(1, Math.abs(factor));
  const mix = (c) => Math.round((1 - p) * c + p * t);
  const to2 = (v) => v.toString(16).padStart(2, '0');
  return '#' + to2(mix(r)) + to2(mix(g)) + to2(mix(b));
}

function init(diff) {
  clearTimeout(nextTimer);
  state = { diff, index: 0, score: 0, streak: 0, locked: false, target: null, options: [], total: TOTAL };
  $('#score').textContent = '0';
  $('#streak').textContent = '0';
  newRound();
}

function newRound() {
  state.locked = false;
  const target = pick(BASE);
  const count = CHOICES[state.diff];
  const hexes = [target.hex];

  if (state.diff === 'hard') {
    // Add similar shades of the same color, then fill with other colors.
    hexes.push(shade(target.hex, 0.22), shade(target.hex, -0.28));
    while (hexes.length < count) {
      const other = pick(BASE.filter((c) => c.name !== target.name));
      if (!hexes.includes(other.hex)) hexes.push(other.hex);
    }
  } else {
    while (hexes.length < count) {
      const other = pick(BASE.filter((c) => c.name !== target.name));
      if (!hexes.includes(other.hex)) hexes.push(other.hex);
    }
  }

  state.target = target;
  state.options = shuffle(hexes);
  $('#target').textContent = target.name;
  $('#target').style.color = target.hex;
  $('#progress').textContent = `${state.index + 1}/${state.total}`;
  renderOptions();
}

function renderOptions() {
  const wrap = $('#options');
  wrap.innerHTML = '';
  state.options.forEach((hex) => {
    const btn = document.createElement('button');
    btn.className = 'color-circle';
    btn.dataset.hex = hex;
    btn.style.background = hex;
    btn.addEventListener('click', () => choose(hex, btn));
    wrap.appendChild(btn);
  });
}

function choose(hex, btn) {
  if (state.locked) return;
  state.locked = true;
  $$('#options .color-circle').forEach((b) => b.classList.add('disabled'));

  if (hex === state.target.hex) {
    state.score++;
    state.streak++;
    btn.classList.add('correct');
  } else {
    state.streak = 0;
    btn.classList.add('wrong');
    $$('#options .color-circle').forEach((b) => {
      if (b.dataset.hex === state.target.hex) b.classList.add('correct');
    });
  }

  $('#score').textContent = state.score;
  $('#streak').textContent = state.streak;

  state.index++;
  nextTimer = setTimeout(() => {
    if (state.index >= state.total) endRound();
    else newRound();
  }, 900);
}

function endRound() {
  let title, text;
  if (state.score === state.total) {
    title = '🏆 Perfect Score!';
    text = 'You matched every color — incredible!';
    burstConfetti();
  } else if (state.score >= 7) {
    title = '🎉 Great Job!';
    text = `You matched ${state.score}/${state.total} colors!`;
    burstConfetti();
  } else {
    title = '😊 Good Try!';
    text = `You matched ${state.score}/${state.total} colors. Keep practicing!`;
  }
  showModal(title, text, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Color Match',
  emoji: '🌈',
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
