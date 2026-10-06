'use strict';

/* ============================================================
   Old Maid — 5 pairs + the 👻 Old Maid
   Player draws from the computer's fan, then the computer draws back.
   Whoever is left holding the Old Maid loses.
   ============================================================ */

const BEST_KEY = 'best-old-maid';

const KINDS = [
  { key: 'dog', emoji: '🐶' },
  { key: 'cat', emoji: '🐱' },
  { key: 'bunny', emoji: '🐰' },
  { key: 'panda', emoji: '🐼' },
  { key: 'fox', emoji: '🦊' }
];
const MAID = { key: 'maid', emoji: '👻' };

const state = {
  player: [],
  cpu: [],
  pairs: [],
  draws: 0,
  best: 0,
  turn: 'player',
  busy: false,
  over: false
};

const els = {
  playerCount: $('#player-count'),
  cpuCount: $('#cpu-count'),
  pairsCount: $('#pairs-count'),
  bestCount: $('#best-count'),
  fan: $('#cpu-fan'),
  hand: $('#player-hand'),
  discard: $('#discard'),
  message: $('#message'),
  playerTurn: $('#player-turn'),
  cpuTurn: $('#cpu-turn')
};

/* ---------- helpers ---------- */

function loadBest() {
  const raw = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  state.best = Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function saveBest() {
  localStorage.setItem(BEST_KEY, String(state.best));
}

function say(text, tone) {
  els.message.textContent = text;
  els.message.classList.remove('good', 'bad');
  if (tone) els.message.classList.add(tone);
}

/* Toss away any matching pair in a hand. Returns the cards removed. */
function discardPairs(hand) {
  const removed = [];
  for (let i = 0; i < hand.length; i++) {
    const match = hand.findIndex((c, j) => j !== i && c.key === hand[i].key);
    if (match > -1) {
      removed.push(hand[i], hand[match]);
      hand.splice(match, 1);
      hand.splice(i, 1);
      i--;
    }
  }
  removed.forEach((c) => state.pairs.push(c));
  return removed;
}

/* ---------- rendering ---------- */

function cardEl(card, faceDown) {
  const el = document.createElement('div');
  el.className = 'card' + (card.key === 'maid' && !faceDown ? ' queen' : '');
  el.textContent = faceDown ? '?' : card.emoji;
  return el;
}

function renderFan(revealIndex, revealCard) {
  els.fan.innerHTML = '';
  const n = state.cpu.length;
  state.cpu.forEach((card, i) => {
    const el = cardEl(card, true);
    if (i === revealIndex && revealCard) {
      el.textContent = revealCard.emoji;
      el.classList.add('revealed');
    }
    el.style.setProperty('--tilt', ((i - (n - 1) / 2) * 5).toFixed(1) + 'deg');
    el.addEventListener('click', () => playerDraw(i));
    els.fan.appendChild(el);
  });
}

function renderHand(highlightKey) {
  els.hand.innerHTML = '';
  state.player.forEach((card) => {
    const el = cardEl(card, false);
    if (card.key === highlightKey) el.classList.add('new');
    els.hand.appendChild(el);
  });
}

function renderDiscard() {
  els.discard.innerHTML = '';
  if (state.pairs.length === 0) {
    const note = document.createElement('span');
    note.className = 'empty-note';
    note.textContent = 'No pairs yet — match two cards to toss them here.';
    els.discard.appendChild(note);
    return;
  }
  const byKey = {};
  state.pairs.forEach((c) => { byKey[c.key] = (byKey[c.key] || 0) + 1; });
  Object.keys(byKey).forEach((key) => {
    const emoji = state.pairs.find((c) => c.key === key).emoji;
    for (let i = 0; i < byKey[key] / 2; i++) {
      const chip = document.createElement('span');
      chip.className = 'pair';
      chip.textContent = emoji + ' ' + emoji;
      els.discard.appendChild(chip);
    }
  });
}

function renderStats() {
  els.playerCount.textContent = state.player.length;
  els.cpuCount.textContent = state.cpu.length;
  els.pairsCount.textContent = state.pairs.length / 2;
  els.bestCount.textContent = state.best;
  els.playerTurn.classList.toggle('active', !state.over && state.turn === 'player');
  els.cpuTurn.classList.toggle('active', !state.over && state.turn === 'cpu');
}

function render() {
  renderFan();
  renderHand();
  renderDiscard();
  renderStats();
}

/* ---------- game flow ---------- */

function deal() {
  const deck = [];
  KINDS.forEach((k) => deck.push({ key: k.key, emoji: k.emoji }, { key: k.key, emoji: k.emoji }));
  deck.push({ key: MAID.key, emoji: MAID.emoji });

  const mixed = shuffle(deck);
  state.player = mixed.slice(0, 5);
  state.cpu = mixed.slice(5, 11);
  state.pairs = [];
  state.draws = 0;
  state.turn = 'player';
  state.busy = false;
  state.over = false;

  const tossed = discardPairs(state.player) + discardPairs(state.cpu);
  render();
  say(tossed > 0
    ? `Cards dealt! ${tossed} cards were already pairs and went straight to the pile. Pick a face-down card!`
    : 'Cards dealt! Pick a face-down card from the computer\'s fan.', 'good');
}

/* Player clicks any face-down card: it reveals a random card from the computer's hand. */
function playerDraw(slot) {
  if (state.over || state.busy || state.turn !== 'player' || state.cpu.length === 0) return;
  state.busy = true;
  state.draws++;

  const drawn = pick(state.cpu);
  const index = state.cpu.indexOf(drawn);
  state.cpu.splice(index, 1);
  renderFan(slot, drawn);

  say(`You drew ${drawn.emoji}!`, drawn.key === 'maid' ? 'bad' : null);

  setTimeout(() => {
    state.player.push(drawn);
    const made = discardPairs(state.player);
    renderHand(drawn.key);
    renderStats();
    renderDiscard();

    if (made.length) {
      say(`You matched a pair — tossed away! 🎉`, 'good');
    } else if (drawn.key === 'maid') {
      say('Uh oh… you are holding the Old Maid! 👻', 'bad');
    }

    if (checkEnd()) return;

    state.turn = 'cpu';
    renderStats();
    setTimeout(computerDraw, 900);
  }, 500);
}

function computerDraw() {
  if (state.over) return;
  if (state.player.length === 0) { checkEnd(); return; }

  const drawn = pick(state.player);
  const index = state.player.indexOf(drawn);
  state.player.splice(index, 1);

  const takenEl = els.hand.children[index];
  if (takenEl) takenEl.classList.add('taken');

  setTimeout(() => {
    state.cpu.push(drawn);
    const made = discardPairs(state.cpu);
    renderHand();
    renderFan();
    renderStats();
    renderDiscard();

    if (made.length) {
      say(`The computer drew ${drawn.emoji} and matched a pair!`, null);
    } else {
      say(`The computer drew ${drawn.emoji}. Your turn — pick a card!`, null);
    }

    if (checkEnd()) return;

    state.turn = 'player';
    state.busy = false;
    renderStats();
  }, 600);
}

/* A hand that is empty means the other hand still holds the Old Maid. */
function checkEnd() {
  if (state.player.length === 0) { win(); return true; }
  if (state.cpu.length === 0) { lose(); return true; }
  return false;
}

function win() {
  state.over = true;
  state.best += 1;
  saveBest();
  renderStats();
  burstConfetti();
  showModal(
    '🎉 You Win!',
    `You got rid of all your cards in ${state.draws} draws — the computer is stuck with the 👻 Old Maid! Best: ${state.best} wins.`,
    'Play Again',
    () => deal()
  );
}

function lose() {
  state.over = true;
  renderStats();
  showModal(
    '👻 Oh no — you kept the Old Maid!',
    `The computer cleared its hand in ${state.draws} draws. Try again! Best: ${state.best} wins.`,
    'Play Again',
    () => deal()
  );
}

/* ---------- start ---------- */

loadBest();
initGameFrame({
  title: 'Old Maid',
  emoji: '👻',
  onRestart: () => { hideModal(); deal(); }
});
deal();
