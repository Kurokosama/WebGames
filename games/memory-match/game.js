'use strict';

const EMOJIS = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🍉', '🥝', '🍍', '🥕', '🌽', '🍄', '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁', '🐸', '🦄', '🐧'];

const DIFFS = {
  easy: { cols: 4, rows: 4 },
  medium: { cols: 6, rows: 4 },
  hard: { cols: 6, rows: 6 }
};

let state = null;
let timerId = null;

function init(diff) {
  clearInterval(timerId);
  const { cols, rows } = DIFFS[diff];
  const pairs = (cols * rows) / 2;
  const chosen = shuffle(EMOJIS).slice(0, pairs);
  const cards = shuffle([].concat(chosen, chosen)).map((emoji, id) => ({ id, emoji, matched: false, el: null }));
  state = { diff, cards, open: [], lock: false, matched: 0, moves: 0, seconds: 0 };
  $('#score').textContent = '0';
  $('#moves').textContent = '0';
  $('#timer').textContent = '0s';
  render();
  timerId = setInterval(tick, 1000);
}

function tick() {
  state.seconds++;
  $('#timer').textContent = state.seconds + 's';
}

function render() {
  const board = $('#board');
  board.style.gridTemplateColumns = `repeat(${DIFFS[state.diff].cols}, 1fr)`;
  board.innerHTML = '';
  state.cards.forEach((card) => {
    const el = document.createElement('button');
    el.className = 'card';
    el.addEventListener('click', () => flip(card.id));
    card.el = el;
    board.appendChild(el);
  });
}

function flip(id) {
  const card = state.cards[id];
  if (state.lock || card.matched || state.open.includes(id)) return;
  state.moves++;
  $('#moves').textContent = state.moves;
  state.open.push(id);
  card.el.classList.add('open');
  card.el.textContent = card.emoji;

  if (state.open.length === 2) {
    state.lock = true;
    const [a, b] = state.open;
    if (state.cards[a].emoji === state.cards[b].emoji) {
      state.cards[a].matched = true;
      state.cards[b].matched = true;
      state.matched++;
      state.open = [];
      state.lock = false;
      $('#score').textContent = state.matched;
      state.cards[a].el.classList.add('matched');
      state.cards[b].el.classList.add('matched');
      if (state.matched === state.cards.length / 2) win();
    } else {
      setTimeout(() => {
        state.cards[a].el.classList.remove('open');
        state.cards[b].el.classList.remove('open');
        state.cards[a].el.textContent = '';
        state.cards[b].el.textContent = '';
        state.open = [];
        state.lock = false;
      }, 800);
    }
  }
}

function win() {
  clearInterval(timerId);
  burstConfetti();
  showModal('🎉 You Win!', `You found all pairs in ${state.moves} moves and ${state.seconds}s!`, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Memory Match',
  emoji: '🧠',
  difficulties: [
    { value: 'easy', label: 'Easy (4×4)' },
    { value: 'medium', label: 'Medium (6×4)' },
    { value: 'hard', label: 'Hard (6×6)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
