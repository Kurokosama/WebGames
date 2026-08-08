'use strict';

const WORDS = {
  easy: ['cat', 'dog', 'sun', 'hat', 'red', 'fun', 'bus', 'cup', 'toy', 'bug', 'pig', 'egg', 'map', 'hen', 'net', 'box'],
  medium: ['apple', 'green', 'happy', 'house', 'water', 'school', 'candy', 'smile', 'tiger', 'chair', 'bread', 'music', 'flower', 'rabbit', 'pencil'],
  hard: ['elephant', 'rainbow', 'butterfly', 'mountain', 'umbrella', 'dinosaur', 'computer', 'chocolate', 'strawberry', 'adventure', 'kangaroo', 'pineapple']
};

const DIFFS = {
  easy: { speed: 42, time: 60 },
  medium: { speed: 66, time: 45 },
  hard: { speed: 92, time: 30 }
};

const AREA_H = 380;

let state = null;
let raf = null;
let countdown = null;

function init(diff) {
  cancelAnimationFrame(raf);
  clearInterval(countdown);
  const cfg = DIFFS[diff];
  state = {
    diff, cfg,
    word: null,
    typed: 0,
    y: -30,
    score: 0,
    lives: 3,
    time: cfg.time,
    over: false,
    last: performance.now()
  };
  spawnWord();
  $('#score').textContent = '0';
  $('#lives').textContent = '❤️❤️❤️';
  $('#time').textContent = state.time + 's';
  countdown = setInterval(() => {
    state.time--;
    $('#time').textContent = state.time + 's';
    if (state.time <= 0) endGame();
  }, 1000);
  raf = requestAnimationFrame(loop);
}

function spawnWord() {
  state.word = pick(WORDS[state.diff]);
  state.typed = 0;
  state.y = -30;
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  if (!state.over) {
    state.y += (state.cfg.speed * dt) / 1000;
    if (state.y > AREA_H) {
      state.lives--;
      $('#lives').textContent = '❤️'.repeat(Math.max(0, state.lives)) + '🖤'.repeat(Math.max(0, 3 - state.lives));
      if (state.lives <= 0) { endGame(); }
      else spawnWord();
    }
    render();
  }
  if (!state.over) raf = requestAnimationFrame(loop);
}

function render() {
  const area = $('#area');
  area.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'falling-word';
  el.style.top = Math.max(-40, state.y) + 'px';
  let html = '';
  for (let i = 0; i < state.word.length; i++) {
    html += i < state.typed ? `<span class="typed">${state.word[i]}</span>` : `<span>${state.word[i]}</span>`;
  }
  el.innerHTML = html;
  area.appendChild(el);
}

document.addEventListener('keydown', (e) => {
  if (!state || state.over) return;
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
    const ch = e.key.toLowerCase();
    if (ch === state.word[state.typed]) {
      state.typed++;
      if (state.typed >= state.word.length) {
        state.score++;
        $('#score').textContent = state.score;
        spawnWord();
      }
      render();
    }
  }
});

function endGame() {
  state.over = true;
  cancelAnimationFrame(raf);
  clearInterval(countdown);
  showModal(state.lives <= 0 ? '😅 Out of Lives!' : '⏰ Time’s Up!', `You typed ${state.score} words!`, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Typing Race',
  emoji: '⌨️',
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
