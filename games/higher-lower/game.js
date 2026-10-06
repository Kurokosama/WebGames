'use strict';

/* Higher or Lower (Cards) — full 52-card deck, drawn without replacement. */

const BEST_KEY = 'best-higher-lower';
const SUITS = [
  { symbol: '♠', color: 'black' },
  { symbol: '♥', color: 'red' },
  { symbol: '♦', color: 'red' },
  { symbol: '♣', color: 'black' }
];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const el = {
  currentCard: $('#current-card'),
  streak: $('#streak'),
  best: $('#best-streak'),
  cardsLeft: $('#cards-left'),
  playCard: $('#play-card'),
  playRank: $('#play-rank'),
  playSuit: $('#play-suit'),
  playBigSuit: $('#play-big-suit'),
  bottomCorner: $('.card-corner.bottom'),
  deckNote: $('#deck-note'),
  feedback: $('#feedback'),
  higherBtn: $('#guess-higher'),
  lowerBtn: $('#guess-lower')
};

let deck = [];
let current = null;
let streak = 0;
let bestStreak = 0;
let gameOver = true;

function buildDeck() {
  const cards = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank, index) => {
      cards.push({ rank, suit: suit.symbol, color: suit.color, value: index + 1 });
    });
  });
  return shuffle(cards);
}

function loadBest() {
  const raw = parseInt(localStorage.getItem(BEST_KEY), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function showCard(card) {
  el.playRank.textContent = card.rank;
  el.playSuit.textContent = card.suit;
  el.playBigSuit.textContent = card.suit;
  el.bottomCorner.querySelector('.card-rank').textContent = card.rank;
  el.bottomCorner.querySelector('.card-suit').textContent = card.suit;

  el.playCard.classList.remove('red', 'black', 'hot');
  el.playCard.classList.add(card.color);
  if (streak >= 5) el.playCard.classList.add('hot');

  el.currentCard.textContent = card.rank + card.suit;
  el.cardsLeft.textContent = String(deck.length);
  el.streak.textContent = String(streak);
  el.best.textContent = String(bestStreak);
}

function animateCard() {
  el.playCard.classList.remove('flip');
  void el.playCard.offsetWidth; // force the flip animation to restart
  el.playCard.classList.add('flip');
}

function setFeedback(text, kind) {
  el.feedback.textContent = text;
  el.feedback.classList.remove('good', 'bad');
  if (kind) el.feedback.classList.add(kind);
}

function setGuessEnabled(on) {
  el.higherBtn.disabled = !on;
  el.lowerBtn.disabled = !on;
}

function saveBest() {
  if (streak > bestStreak) bestStreak = streak;
  localStorage.setItem(BEST_KEY, String(bestStreak));
  el.best.textContent = String(bestStreak);
}

function startGame() {
  deck = buildDeck();
  current = deck.pop();
  streak = 0;
  gameOver = false;

  showCard(current);
  setGuessEnabled(true);
  el.deckNote.textContent = 'Deck shuffled — make your guess!';
  setFeedback('Is the next card higher or lower?');
}

function endGame(kind) {
  gameOver = true;
  setGuessEnabled(false);
  saveBest();
  if (streak >= 5) burstConfetti();

  const reached = 'You got ' + streak + ' in a row.';
  if (kind === 'perfect') {
    showModal('🏆 Perfect Run!', 'You flipped all 52 cards without a wrong guess! ' + reached, 'New Game', startGame);
  } else if (kind === 'tie') {
    showModal('😅 It was a tie!', 'Same value ends the streak. ' + reached + ' Best streak: ' + bestStreak + '.', 'New Game', startGame);
  } else {
    showModal('🎉 Streak Over!', reached + ' Best streak: ' + bestStreak + '. Fresh deck, new try!', 'New Game', startGame);
  }
}

function guess(direction) {
  if (gameOver || !deck.length) return;

  const next = deck.pop();
  const wasTie = next.value === current.value;
  const right = direction === 'higher' ? next.value > current.value : next.value < current.value;

  current = next;
  showCard(current);
  animateCard();

  if (wasTie) {
    setFeedback('Same card value — the streak ends!', 'bad');
    endGame('tie');
    return;
  }

  if (!right) {
    setFeedback('Wrong! It was ' + (direction === 'higher' ? 'lower' : 'higher') + '.', 'bad');
    endGame('wrong');
    return;
  }

  streak += 1;
  showCard(current);
  if (streak >= 5 && streak % 5 === 0) burstConfetti();
  setFeedback('✅ Correct! Streak: ' + streak + (streak >= 5 ? ' — on fire!' : ''));

  if (!deck.length) {
    setFeedback('You used the whole deck!', 'good');
    endGame('perfect');
  }
}

el.higherBtn.addEventListener('click', () => guess('higher'));
el.lowerBtn.addEventListener('click', () => guess('lower'));

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') guess('higher');
  if (event.key === 'ArrowDown') guess('lower');
});

bestStreak = loadBest();
initGameFrame({
  title: 'Higher or Lower (Cards)',
  emoji: '🃏',
  onRestart: startGame
});
startGame();
