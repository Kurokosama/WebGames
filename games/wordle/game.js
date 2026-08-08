'use strict';

const WORDS = {
  easy: ['apple', 'beach', 'brain', 'brick', 'brush', 'candy', 'chair', 'chick', 'cloud', 'daisy', 'dance', 'eagle', 'earth', 'fairy', 'flame', 'grape', 'green', 'happy', 'honey', 'house', 'lemon', 'light', 'melon', 'mouse', 'ocean', 'piano', 'pizza', 'plane', 'plant', 'queen', 'river', 'robot', 'shark', 'sheep', 'smile', 'snake', 'stone', 'sunny', 'tiger', 'train', 'tulip', 'water', 'whale', 'wheel', 'zebra'],
  medium: ['amber', 'arise', 'blaze', 'brick', 'crisp', 'dodge', 'eager', 'frost', 'ghost', 'globe', 'guild', 'haste', 'ivory', 'jolly', 'jumbo', 'kayak', 'knack', 'latch', 'magic', 'mango', 'noble', 'north', 'oasis', 'olive', 'pluck', 'prism', 'quilt', 'quota', 'radar', 'raven', 'sandy', 'savvy', 'spark', 'tango', 'thyme', 'ultra', 'uncle', 'vapor', 'vivid', 'waltz', 'winds', 'yacht', 'young', 'zesty', 'zebra'],
  hard: ['abyss', 'blitz', 'cacti', 'crypt', 'dwarf', 'eerie', 'fjord', 'frown', 'ghoul', 'glint', 'gnome', 'humor', 'joker', 'knead', 'knots', 'kraft', 'lucid', 'lynx', 'mirth', 'naive', 'pique', 'quill', 'quirk', 'rhyme', 'rusty', 'scarf', 'sleek', 'sprig', 'stomp', 'swoop', 'swirl', 'taunt', 'tramp', 'twang', 'udder', 'viper', 'vouch', 'whelp', 'whisk', 'wrist', 'xenon', 'yield', 'zonal', 'zesty']
};

const TOTAL = 6;
const LEN = 5;

let state = null;
let sessionWins = 0;

function init(diff) {
  state = {
    diff,
    answer: pick(WORDS[diff]).toUpperCase(),
    row: 0,
    current: '',
    done: false,
    keyStatus: {}
  };
  $('#progress').textContent = '0/6';
  $('#wins').textContent = sessionWins;
  $('#hint').textContent = diff === 'easy' ? `💡 Hint: it starts with ${state.answer[0]}` : '';
  buildGrid();
  buildKeyboard();
}

function buildGrid() {
  const grid = $('#grid');
  grid.innerHTML = '';
  for (let r = 0; r < TOTAL; r++) {
    const row = document.createElement('div');
    row.className = 'guess-row';
    row.dataset.row = r;
    for (let c = 0; c < LEN; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.col = c;
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }
  render();
}

function render() {
  $$('#grid .guess-row').forEach((rowEl, r) => {
    if (r < state.row) return; // evaluated rows keep their colors
    $$('.cell', rowEl).forEach((cell, c) => {
      cell.className = 'cell';
      if (r === state.row) {
        cell.textContent = state.current[c] || '';
        if (state.current[c]) cell.classList.add('filled');
      } else {
        cell.textContent = '';
      }
    });
  });
}

function typeLetter(ch) {
  if (state.done || state.current.length >= LEN) return;
  state.current += ch;
  render();
}

function backspace() {
  if (state.done || state.current.length === 0) return;
  state.current = state.current.slice(0, -1);
  render();
}

function submit() {
  if (state.done || state.current.length < LEN) return;
  const guess = state.current;
  const colors = evaluate(guess);
  const rowEl = $$('#grid .guess-row')[state.row];
  $$('.cell', rowEl).forEach((cell, c) => {
    cell.textContent = guess[c];
    cell.classList.remove('filled');
    setTimeout(() => cell.classList.add(colors[c]), c * 180);
  });
  // update keyboard
  guess.split('').forEach((ch, i) => {
    const key = ch;
    const prev = state.keyStatus[key] || '';
    if (colors[i] === 'correct') state.keyStatus[key] = 'correct';
    else if (colors[i] === 'present' && prev !== 'correct') state.keyStatus[key] = 'present';
    else if (!prev) state.keyStatus[key] = 'absent';
  });
  renderKeyboard();

  state.row++;
  state.current = '';
  $('#progress').textContent = `${state.row}/${TOTAL}`;

  setTimeout(() => {
    if (guess === state.answer) {
      win();
    } else if (state.row >= TOTAL) {
      lose();
    } else {
      render();
    }
  }, LEN * 180 + 200);
}

function evaluate(guess) {
  const colors = Array(LEN).fill('absent');
  const used = {};
  // pass 1: greens
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === state.answer[i]) {
      colors[i] = 'correct';
      used[guess[i]] = (used[guess[i]] || 0) + 1;
    }
  }
  // pass 2: yellows
  for (let i = 0; i < LEN; i++) {
    if (colors[i] === 'correct') continue;
    const ch = guess[i];
    const totalInWord = (state.answer.match(new RegExp(ch, 'g')) || []).length;
    if ((used[ch] || 0) < totalInWord) {
      colors[i] = 'present';
      used[ch] = (used[ch] || 0) + 1;
    }
  }
  return colors;
}

function win() {
  state.done = true;
  sessionWins++;
  $('#wins').textContent = sessionWins;
  burstConfetti();
  showModal('🎉 You Got It!', `The word was ${state.answer}. Amazing!`, 'Play Again', () => init(state.diff));
}

function lose() {
  state.done = true;
  showModal('😅 Out of Tries!', `The word was ${state.answer}. Try again!`, 'Play Again', () => init(state.diff));
}

const KB_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
];

function buildKeyboard() {
  const kb = $('#keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach((key) => {
      const btn = document.createElement('button');
      btn.className = 'kb-key' + (key.length > 1 ? ' wide' : '');
      btn.textContent = key === 'DEL' ? '⌫' : key;
      btn.addEventListener('click', () => {
        if (key === 'ENTER') submit();
        else if (key === 'DEL') backspace();
        else typeLetter(key);
      });
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
  renderKeyboard();
}

function renderKeyboard() {
  $$('#keyboard .kb-key').forEach((btn) => {
    const key = btn.textContent === '⌫' ? 'DEL' : btn.textContent;
    btn.className = 'kb-key' + (key.length > 1 ? ' wide' : '');
    const st = state.keyStatus[key];
    if (st) btn.classList.add(st);
  });
}

document.addEventListener('keydown', (e) => {
  if (!state || state.done) return;
  if (e.key === 'Enter') { e.preventDefault(); submit(); }
  else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
  else if (/^[a-zA-Z]$/.test(e.key)) { typeLetter(e.key.toUpperCase()); }
});

initGameFrame({
  title: 'Wordle',
  emoji: '🟩',
  difficulties: [
    { value: 'easy', label: 'Easy (hint)' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
