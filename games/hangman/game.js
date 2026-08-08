'use strict';

const WORDS = {
  easy: ['cat', 'dog', 'sun', 'hat', 'red', 'fun', 'bus', 'cup', 'toy', 'bug', 'pig', 'egg', 'map', 'hen'],
  medium: ['apple', 'green', 'happy', 'house', 'water', 'school', 'candy', 'smile', 'tiger', 'chair', 'bread', 'music', 'flower', 'rabbit'],
  hard: ['elephant', 'rainbow', 'butterfly', 'mountain', 'umbrella', 'dinosaur', 'computer', 'chocolate', 'strawberry', 'adventure', 'kangaroo', 'pineapple']
};

const MAX_LIVES = 6;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

let state = null;

function init(diff) {
  state = {
    diff,
    word: pick(WORDS[diff]),
    lives: MAX_LIVES,
    guessed: new Set(),
    correctLetters: 0,
    score: 0
  };
  $('#score').textContent = '0';
  $('#feedback').textContent = 'Guess a letter to find the secret word!';
  renderLives();
  renderWord();
  renderKeyboard();
}

function renderLives() {
  let hearts = '';
  for (let i = 0; i < MAX_LIVES; i++) hearts += i < state.lives ? '❤️' : '🖤';
  $('#lives').textContent = hearts;
}

function renderWord() {
  const wrap = $('#word');
  wrap.innerHTML = '';
  state.correctLetters = 0;
  state.word.split('').forEach((ch) => {
    const el = document.createElement('div');
    const revealed = state.guessed.has(ch);
    if (revealed) state.correctLetters++;
    el.className = 'word-letter' + (revealed ? '' : ' hidden');
    el.textContent = revealed ? ch : ch;
    wrap.appendChild(el);
  });
}

function renderKeyboard() {
  const kb = $('#keyboard');
  kb.innerHTML = '';
  ALPHABET.forEach((ch) => {
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.textContent = ch;
    btn.addEventListener('click', () => guessLetter(ch, btn));
    kb.appendChild(btn);
  });
}

function guessLetter(ch, btn) {
  if (state.lives <= 0) return;
  if (state.guessed.has(ch)) return;
  state.guessed.add(ch);

  if (state.word.includes(ch)) {
    btn.classList.add('used', 'good');
    renderWord();
    if (state.correctLetters === state.word.length) win();
  } else {
    state.lives--;
    btn.classList.add('used', 'bad');
    renderLives();
    if (state.lives <= 0) lose();
  }
}

function win() {
  state.score++;
  $('#score').textContent = state.score;
  burstConfetti();
  showModal('🎉 You Win!', `The word was "${state.word}". Great guessing!`, 'Play Again', () => init(state.diff));
}

function lose() {
  showModal('😅 Game Over!', `The word was "${state.word}". Try again!`, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Hangman',
  emoji: '🙈',
  difficulties: [
    { value: 'easy', label: 'Easy (3-4 letters)' },
    { value: 'medium', label: 'Medium (5-6 letters)' },
    { value: 'hard', label: 'Hard (7+ letters)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
