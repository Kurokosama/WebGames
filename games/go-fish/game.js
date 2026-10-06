'use strict';

/* Go Fish — ranks 2-10 in 4 suits, first to 3 books wins.
   Player asks for a rank they hold; the computer answers with a simple AI. */
const BEST_KEY = 'best-go-fish';
const WIN_BOOKS = 3;
const HAND_SIZE = 5;

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const SUITS = ['♠', '♥', '♦', '♣'];
const RED = new Set(['♥', '♦']);

const state = {
  deck: [], you: [], cpu: [], booksYou: [], booksCpu: [],
  turn: 'you', busy: false, over: false, asks: 0, best: 0, difficulty: 'easy'
};

/* ---------- helpers ---------- */

function countRank(hand, rank) {
  return hand.filter((c) => c.rank === rank).length;
}

// Move every card of `rank` from one hand to the other; returns how many moved.
function takeFrom(from, to, rank) {
  let moved = 0;
  for (let i = from.length - 1; i >= 0; i--) {
    if (from[i].rank === rank) { to.push(from.splice(i, 1)[0]); moved++; }
  }
  return moved;
}

// A hand holding 4 of a kind lays that book down.
function collectBooks(hand, books) {
  RANKS.forEach((r) => {
    if (countRank(hand, r) >= 4) { takeFrom(hand, [], r); books.push(r); }
  });
}

function drawFor(hand) {
  if (!state.deck.length) return false;
  hand.push(state.deck.pop());
  return true;
}

function loadBest() {
  try { state.best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (err) { state.best = 0; }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, String(state.best)); } catch (err) { /* storage unavailable */ }
}

function message(text) { $('#message').textContent = text; }

/* ---------- rendering ---------- */

function updateHud() {
  $('#you-books').textContent = state.booksYou.length;
  $('#cpu-books').textContent = state.booksCpu.length;
  $('#deck-count').textContent = state.deck.length;
  const best = $('#best-count');
  if (best) best.textContent = state.best;
  $('#you-dot').classList.toggle('active', state.turn === 'you' && !state.over);
  $('#cpu-dot').classList.toggle('active', state.turn === 'cpu' && !state.over);
  const pool = $('#pool');
  pool.classList.toggle('empty', state.deck.length === 0);
  pool.textContent = state.deck.length ? '🃏' : '🐟';
}

function cardEl(card, faceDown) {
  const d = document.createElement('div');
  d.className = 'card';
  if (faceDown) {
    d.classList.add('back');
    d.innerHTML = '<div class="fish">🐟</div>';
    return d;
  }
  d.classList.add(RED.has(card.suit) ? 'red' : 'black');
  d.innerHTML = '<div class="rank">' + card.rank + '</div><div class="suit">' + card.suit + '</div>';
  return d;
}

function renderBooks(sel, books) {
  const box = $(sel);
  box.innerHTML = '';
  books.forEach((r) => {
    const b = document.createElement('div');
    b.className = 'book';
    b.textContent = '📖 ' + r;
    box.appendChild(b);
  });
}

function renderAsks() {
  const wrap = $('#rank-buttons');
  wrap.innerHTML = '';
  const held = Array.from(new Set(state.you.map((c) => c.rank))).sort((a, b) => a - b);
  held.forEach((r) => {
    const b = document.createElement('button');
    b.className = 'rank-btn';
    b.type = 'button';
    b.textContent = r;
    b.disabled = state.busy || state.turn !== 'you' || state.over;
    b.addEventListener('click', () => ask(r));
    wrap.appendChild(b);
  });
  if (!held.length) {
    const hint = document.createElement('span');
    hint.className = 'ask-label';
    hint.textContent = 'No cards left — draw one.';
    wrap.appendChild(hint);
  }
}

function renderHands() {
  const yh = $('#you-hand');
  yh.innerHTML = '';
  state.you.slice().sort((a, b) => a.rank - b.rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))
    .forEach((c) => yh.appendChild(cardEl(c, false)));

  const ch = $('#cpu-hand');
  ch.innerHTML = '';
  state.cpu.forEach(() => ch.appendChild(cardEl(null, true)));

  renderBooks('#you-books-list', state.booksYou);
  renderBooks('#cpu-books-list', state.booksCpu);
  renderAsks();
  updateHud();
}

/* ---------- turns ---------- */

function win(who) {
  state.over = true;
  state.busy = false;
  if (who === 'you') {
    state.best += 1;
    saveBest();
    renderHands();
    burstConfetti();
    showModal('🎉 You Win!', 'You collected ' + state.booksYou.length + ' books in ' + state.asks + ' asks. Best: ' + state.best + ' wins.', 'Play Again', newGame);
  } else {
    renderHands();
    showModal('🤖 The Computer Wins!', 'It made ' + state.booksCpu.length + ' books first — you got ' + state.booksYou.length + '. Best: ' + state.best + ' wins.', 'Play Again', newGame);
  }
  return true;
}

function checkEnd() {
  if (state.booksYou.length >= WIN_BOOKS) return win('you');
  if (state.booksCpu.length >= WIN_BOOKS) return win('cpu');
  return false;
}

// Lay books down, check for a win, then hand the turn back to the player.
// `thenComputer` is true only right after the player asked, so the computer
// answers once per ask instead of taking turn after turn.
function endTurn(thenComputer, note) {
  collectBooks(state.you, state.booksYou);
  collectBooks(state.cpu, state.booksCpu);
  if (checkEnd()) return;

  // Nothing left to draw or ask for: the player with more books wins.
  if (!state.deck.length && (!state.you.length || !state.cpu.length)) {
    return win(state.booksYou.length >= state.booksCpu.length ? 'you' : 'cpu');
  }

  if (!state.you.length && drawFor(state.you)) note = 'Your hand was empty, so you drew a card. 🎴 ' + note;

  state.turn = 'you';
  state.busy = false;
  renderHands();
  message(note);
  if (thenComputer) setTimeout(cpuTurn, 700);
}

function ask(rank) {
  if (state.busy || state.turn !== 'you' || state.over || countRank(state.you, rank) === 0) return;
  state.busy = true;
  state.asks += 1;
  const got = countRank(state.cpu, rank);
  let note;
  if (got > 0) {
    takeFrom(state.cpu, state.you, rank);
    note = '🎉 "Do you have a ' + rank + '?" — Yes! You take ' + got + '.';
  } else {
    note = '🐟 "Do you have a ' + rank + '?" — No. Go Fish!';
    if (!drawFor(state.you)) note = 'No ' + rank + 's and the deck is empty — nothing to draw.';
  }
  endTurn(true, note + ' Your turn — pick a rank.');
}

function cpuTurn() {
  if (state.over || state.turn !== 'you' || state.busy) return;
  state.turn = 'cpu';
  state.busy = true;

  let held = Array.from(new Set(state.cpu.map((c) => c.rank)));
  if (!held.length) {
    if (!drawFor(state.cpu)) { endTurn(false, 'The deck is empty — nothing to draw.'); return; }
    held = Array.from(new Set(state.cpu.map((c) => c.rank)));
    if (!held.length) { endTurn(false, 'The computer has nothing to ask for. Your turn — pick a rank.'); return; }
  }

  // Easy: any rank it holds. Hard: the rank it holds most of.
  const rank = state.difficulty === 'hard'
    ? held.reduce((best, r) => (countRank(state.cpu, r) > countRank(state.cpu, best) ? r : best), held[0])
    : pick(held);

  const got = countRank(state.you, rank);
  let note;
  if (got > 0) {
    takeFrom(state.you, state.cpu, rank);
    note = '🤖 The computer asked for ' + rank + ' and took ' + got + '!';
  } else {
    note = '🤖 The computer asked for ' + rank + ' — no fish, so it draws.';
    drawFor(state.cpu);
  }
  endTurn(false, note + ' Your turn — pick a rank.');
}

/* ---------- start ---------- */

function newGame() {
  const all = [];
  RANKS.forEach((r) => SUITS.forEach((s) => all.push({ rank: r, suit: s })));
  state.deck = shuffle(all);
  state.you = []; state.cpu = []; state.booksYou = []; state.booksCpu = [];
  state.turn = 'you'; state.busy = false; state.over = false; state.asks = 0;

  for (let i = 0; i < HAND_SIZE; i++) { state.you.push(state.deck.pop()); state.cpu.push(state.deck.pop()); }
  collectBooks(state.you, state.booksYou);
  collectBooks(state.cpu, state.booksCpu);

  hideModal();
  renderHands();
  message('Your turn — pick a rank and ask the computer for it.');
}

loadBest();
initGameFrame({
  title: 'Go Fish',
  emoji: '🐟',
  difficulties: [{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard' }],
  defaultDifficulty: 'easy',
  onDifficulty: (value) => { state.difficulty = value; },
  onRestart: newGame
});

newGame();
