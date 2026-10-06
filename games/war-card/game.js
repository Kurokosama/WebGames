'use strict';

const BEST_KEY = 'best-war-card';
const SUITS = ['♠', '♥', '♦', '♣'];
const RED_SUITS = ['♥', '♦'];
const RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

const el = {
  playerTricks: $('#player-tricks'),
  cpuTricks: $('#cpu-tricks'),
  best: $('#best'),
  playerSlot: $('#player-slot'),
  cpuSlot: $('#cpu-slot'),
  playerCount: $('#player-count'),
  cpuCount: $('#cpu-count'),
  pot: $('#pot'),
  potLabel: $('#pot-label'),
  log: $('#log'),
  flipBtn: $('#flip-btn')
};

let state = null;

const rankName = (rank) => RANK_NAMES[rank] || String(rank);
const cardLabel = (card) => rankName(card.rank) + card.suit;
const isRed = (card) => RED_SUITS.includes(card.suit);
const deckOf = (side) => (side === 'player' ? state.player : state.cpu);

function buildDeck() {
  const deck = [];
  SUITS.forEach((suit) => {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  });
  return shuffle(deck);
}

function loadBest() {
  const value = parseInt(localStorage.getItem(BEST_KEY), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function newGame() {
  const deck = buildDeck();
  state = {
    player: deck.slice(0, 26),
    cpu: deck.slice(26),
    playerTricks: 0,
    cpuTricks: 0,
    collected: { player: 0, cpu: 0 },
    pot: [],
    winner: null,
    flips: 0,
    best: loadBest(),
    over: false
  };
  hideModal();
  el.flipBtn.disabled = false;
  say('The deck is split — 26 cards each. Tap Flip to play!', false);
  render();
}

function addWarCards(side, pot) {
  const deck = deckOf(side);
  if (deck.length >= 2) {
    pot.push({ side, card: deck.shift(), faceDown: true });
    pot.push({ side, card: deck.shift(), faceDown: false });
  } else if (deck.length === 1) {
    pot.push({ side, card: deck.shift(), faceDown: true });
  }
}

function topFaceUp(pot, side) {
  return pot.filter((entry) => entry.side === side && !entry.faceDown).pop();
}

function flip() {
  if (state.over) return;
  if (!state.player.length || !state.cpu.length) return endGame(state.player.length ? 'player' : 'cpu');

  state.flips++;
  const pot = [];
  const pCard = state.player.shift();
  const cCard = state.cpu.shift();
  pot.push({ side: 'player', card: pCard, faceDown: false });
  pot.push({ side: 'cpu', card: cCard, faceDown: false });

  const war = pCard.rank === cCard.rank;
  if (war) {
    addWarCards('player', pot);
    addWarCards('cpu', pot);
  }

  let winner = null;
  if (war) {
    const pUp = topFaceUp(pot, 'player');
    const cUp = topFaceUp(pot, 'cpu');
    if (pUp && cUp) winner = pUp.card.rank > cUp.card.rank ? 'player' : 'cpu';
    else if (pUp) winner = 'player';
    else if (cUp) winner = 'cpu';
  } else {
    winner = pCard.rank > cCard.rank ? 'player' : 'cpu';
  }

  state.pot = pot;
  state.winner = winner;

  if (winner) {
    pot.forEach((entry) => deckOf(winner).push(entry.card));
    state[winner + 'Tricks']++;
    state.collected[winner] += pot.length;
    if (war) {
      say(`WAR! ${winner === 'player' ? 'You take all 6 cards 🎉' : 'The computer takes all 6 cards.'}`, true);
    } else {
      const winCard = winner === 'player' ? pCard : cCard;
      const loseCard = winner === 'player' ? cCard : pCard;
      say(`${winner === 'player' ? 'You win the trick' : 'Computer wins the trick'} — ${cardLabel(winCard)} beats ${cardLabel(loseCard)}.`, false);
    }
  } else {
    pot.forEach((entry) => deckOf(entry.side).push(entry.card));
    say('Nobody can play more cards — the cards go back. Tap Flip to keep going!', false);
  }

  render();
  if (state.collected.player >= 26) endGame('player');
  else if (state.collected.cpu >= 26) endGame('cpu');
}

function endGame(winner) {
  state.over = true;
  el.flipBtn.disabled = true;

  if (winner === 'player') {
    if (!state.best || state.flips < state.best) {
      state.best = state.flips;
      localStorage.setItem(BEST_KEY, String(state.best));
    }
    burstConfetti();
    showModal(
      '🎉 You Win!',
      `You collected all the cards in ${state.flips} flips. Best win: ${state.best} flips.`,
      'Play Again',
      newGame
    );
  } else {
    showModal(
      '😢 Computer Wins',
      `The computer collected all the cards in ${state.flips} flips. Try again — you can beat it!`,
      'Play Again',
      newGame
    );
  }
  render();
}

function cardMarkup(card, faceDown) {
  if (faceDown) return '<div class="card down"><span class="pip">⭐</span></div>';
  const colour = isRed(card) ? 'red' : 'dark';
  return `<div class="card ${colour}"><span class="corner">${cardLabel(card)}</span><span class="pip">${card.suit}</span></div>`;
}

function miniMarkup(entry) {
  if (entry.faceDown) return '<div class="mini down">⭐</div>';
  const colour = isRed(entry.card) ? 'red' : 'dark';
  return `<div class="mini ${colour}">${cardLabel(entry.card)}</div>`;
}

function renderSlot(slot, entry) {
  if (!entry) {
    slot.innerHTML = '<div class="card down"><span class="pip">⭐</span></div>';
    slot.classList.remove('winner');
    return;
  }
  slot.innerHTML = cardMarkup(entry.card, entry.faceDown);
  slot.classList.toggle('winner', !state.over && state.winner === entry.side);
}

function render() {
  el.playerTricks.textContent = state.playerTricks;
  el.cpuTricks.textContent = state.cpuTricks;
  el.best.textContent = state.best ? state.best + ' flips' : '—';
  el.playerCount.textContent = state.player.length + ' cards left';
  el.cpuCount.textContent = state.cpu.length + ' cards left';

  renderSlot(el.playerSlot, state.pot.find((entry) => entry.side === 'player'));
  renderSlot(el.cpuSlot, state.pot.find((entry) => entry.side === 'cpu'));

  el.pot.classList.toggle('hot', state.pot.length > 2);
  el.potLabel.textContent = state.pot.length
    ? `Trick pot: ${state.pot.length} cards${state.winner ? ' → ' + (state.winner === 'player' ? 'You win it!' : 'Computer wins it!') : ''}`
    : 'Tap Flip to start the battle!';

  const potCards = el.pot.querySelector('.pot-cards');
  if (potCards) potCards.remove();
  if (state.pot.length) {
    const wrap = document.createElement('div');
    wrap.className = 'pot-cards';
    state.pot.forEach((entry) => { wrap.innerHTML += miniMarkup(entry); });
    el.pot.appendChild(wrap);
  }
}

function say(text, war) {
  el.log.textContent = text;
  el.log.classList.toggle('war', !!war);
}

el.flipBtn.addEventListener('click', flip);

initGameFrame({
  title: 'War (Card Game)',
  emoji: '⚔️',
  onRestart: newGame
});

newGame();
