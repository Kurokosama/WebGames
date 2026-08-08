'use strict';

const WORDS = {
  easy: ['cat', 'dog', 'sun', 'hat', 'red', 'fun', 'bus', 'cup', 'toy', 'bug', 'jam', 'pig', 'egg', 'map', 'zip', 'net', 'hen', 'box'],
  medium: ['apple', 'green', 'happy', 'house', 'water', 'school', 'candy', 'smile', 'tiger', 'chair', 'bread', 'music', 'pencil', 'rabbit', 'flower', 'winter'],
  hard: ['elephant', 'rainbow', 'butterfly', 'mountain', 'umbrella', 'dinosaur', 'computer', 'chocolate', 'strawberry', 'adventure', 'wonderful', 'helicopter', 'kangaroo', 'pineapple']
};

const TOTAL = 10;
let state = null;

function scrambleWord(word) {
  const letters = word.split('');
  let shuffled = shuffle(letters).join('');
  let guard = 0;
  while (shuffled === word && guard < 50) {
    shuffled = shuffle(letters).join('');
    guard++;
  }
  return shuffled.split('');
}

function init(diff) {
  const words = shuffle(WORDS[diff]).slice(0, TOTAL);
  state = {
    diff,
    words,
    index: 0,
    score: 0,
    answerLetters: [],
    tiles: [],
    locked: false
  };
  $('#score').textContent = '0';
  loadRound();
}

function loadRound() {
  state.locked = false;
  state.answerLetters = [];
  state.tiles = scrambleWord(state.words[state.index]);
  $('#progress').textContent = `${state.index + 1}/${state.total}`;
  $('#feedback').textContent = 'Click the letters to build the word!';
  $('#feedback').className = 'feedback';
  renderDots();
  render();
}

function renderDots() {
  const dots = $('#dots');
  dots.innerHTML = '';
  for (let i = 0; i < state.words.length; i++) {
    const d = document.createElement('span');
    d.className = 'dot' + (i < state.index ? ' done' : '');
    dots.appendChild(d);
  }
}

function render() {
  const answer = $('#answer');
  answer.innerHTML = '';
  state.answerLetters.forEach((char, i) => {
    const t = document.createElement('button');
    t.className = 'letter-tile answer-tile';
    t.textContent = char;
    t.addEventListener('click', () => unplace(i));
    answer.appendChild(t);
  });

  const letters = $('#letters');
  letters.innerHTML = '';
  state.tiles.forEach((char, i) => {
    const t = document.createElement('button');
    t.className = 'letter-tile' + (state.tiles[i] === null ? ' used' : '');
    t.textContent = char === null ? '' : char;
    if (char !== null) t.addEventListener('click', () => place(i));
    letters.appendChild(t);
  });
}

function place(tileIndex) {
  if (state.locked) return;
  const char = state.tiles[tileIndex];
  if (char === null) return;
  state.tiles[tileIndex] = null;
  state.answerLetters.push(char);
  render();
  if (state.answerLetters.length === state.words[state.index].length) {
    checkAnswer();
  }
}

function unplace(answerIndex) {
  if (state.locked) return;
  const char = state.answerLetters[answerIndex];
  state.answerLetters.splice(answerIndex, 1);
  const freeIndex = state.tiles.indexOf(null);
  state.tiles[freeIndex] = char;
  render();
}

function clearAnswer() {
  if (state.locked) return;
  // Put every letter (still in the tile row + placed in the answer) back into
  // the tile row, shuffled, so the player can start over.
  const unused = state.tiles.filter((t) => t !== null);
  state.tiles = shuffle(unused.concat(state.answerLetters));
  state.answerLetters = [];
  render();
}

function checkAnswer() {
  const word = state.words[state.index];
  const guess = state.answerLetters.join('');
  if (guess === word) {
    state.locked = true;
    state.score++;
    $('#score').textContent = state.score;
    setFeedback('🎉 Correct! Well done!', 'correct');
    state.index++;
    setTimeout(() => {
      if (state.index >= state.total) endRound();
      else loadRound();
    }, 900);
  } else {
    state.locked = true;
    setFeedback(`😅 Not quite — the word has ${word.length} letters. Try again!`, 'wrong');
    setTimeout(() => {
      state.locked = false;
      // clear answer back to tiles
      const saved = state.answerLetters;
      state.answerLetters = [];
      state.tiles = shuffle(state.tiles.filter((t) => t !== null).concat(saved));
      setFeedback('Click the letters to build the word!', '');
      render();
    }, 1100);
  }
}

function setFeedback(text, cls) {
  const el = $('#feedback');
  el.textContent = text;
  el.className = 'feedback' + (cls ? ' ' + cls : '');
}

function endRound() {
  burstConfetti();
  const title = state.score === state.total ? '🏆 Perfect!' : '🎉 Round Complete!';
  showModal(title, `You unscrambled ${state.score}/${state.total} words!`, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Word Scramble',
  emoji: '🔤',
  difficulties: [
    { value: 'easy', label: 'Easy (3-4 letters)' },
    { value: 'medium', label: 'Medium (5-6 letters)' },
    { value: 'hard', label: 'Hard (7+ letters)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

$('#clear-btn').addEventListener('click', clearAnswer);

init('easy');
