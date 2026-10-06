'use strict';

const SUITS = ['\u2660','\u2665','\u2666','\u2663'];
const RED = new Set(['\u2665','\u2666']);
const KEY = 'best-crazy-eights';

let deck, you, cpu, discard, activeSuit, turn, busy, pendingSuit, yourScore, wins;

function buildDeck() {
  const d = [];
  for (let r = 2; r <= 14; r++) SUITS.forEach((s) => d.push({ rank: r, suit: s }));
  return shuffle(d);
}

function cardEl(card, faceDown) {
  const d = document.createElement('div');
  d.className = 'card';
  if (faceDown) { d.classList.add('back'); return d; }
  if (RED.has(card.suit)) d.classList.add('red');
  const label = card.rank === 14 ? 'A' : card.rank === 1 ? 'A' : card.rank;
  d.innerHTML = '<div>' + label + '</div><div>' + card.suit + '</div>';
  return d;
}

function canPlay(card) {
  const top = discard[discard.length - 1];
  if (!top) return true;
  if (card.rank === 1) return true;             // 8 is wild
  return card.suit === top.suit || card.rank === top.rank;
}

function scoreOf(card) {
  if (card.rank === 1) return 25;                 // eight
  if (card.rank === 14) return 20;                // ace
  if (card.rank === 13) return 10;
  if (card.rank === 12) return 10;
  if (card.rank === 11) return 5;
  return card.rank;
}

function message(t) { $('#your-score-line').textContent = t; }

function updateHud() {
  $('#your-cards').textContent = you.length;
  $('#cpu-cards').textContent = cpu.length;
  $('#your-score').textContent = yourScore;
  $('#best').textContent = wins;
}

function render() {
  const yh = $('#you-hand'); yh.innerHTML = '';
  you.forEach((c, i) => {
    const el = cardEl(c, false);
    if (turn === 'you' && !busy && canPlay(c)) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => playYou(i));
    } else { el.style.cursor = 'default'; }
    yh.appendChild(el);
  });

  const ch = $('#cpu-hand'); ch.innerHTML = '';
  cpu.forEach(() => ch.appendChild(cardEl(null, true)));

  const ds = $('#discard'); ds.innerHTML = '';
  const top = discard[discard.length - 1];
  if (top) { const e = cardEl(top, false); e.style.position = 'absolute'; ds.appendChild(e); }

  updateHud();
}

function drawCard(hand) {
  if (!deck.length) {
    if (!discard.length) return false;
    deck = shuffle(discard.splice(0, discard.length));
    // keep the top card on the pile
    if (deck.length) discard.push(deck.pop());
  }
  if (!deck.length) return false;
  hand.push(deck.pop());
  return true;
}

function checkWin() {
  if (!you.length) {
    busy = false; turn = null;
    burstConfetti();
    wins++; localStorage.setItem(KEY, String(wins));
    showModal('\uD83C\uDF89 You Win!', 'You emptied your hand first!', 'Play Again', newGame);
    return true;
  }
  if (!cpu.length) {
    busy = false; turn = null;
    showModal('\uD83D\uDE22 Computer Wins', 'The computer emptied its hand first.', 'Play Again', newGame);
    return true;
  }
  return false;
}

function playYou(i) {
  if (turn !== 'you' || busy) return;
  const card = you[i];
  if (!canPlay(card)) { message('That card does not match \u2014 try another!'); return; }
  busy = true;
  if (card.rank === 1) {
    yourScore += scoreOf(card);
    you.splice(i, 1); discard.push(card);
    render(); message('8 played! Choose the next suit.');
    $('#suit-picker').classList.remove('hidden');
    pendingSuit = card;
    return;
  }
  yourScore += scoreOf(card);
  you.splice(i, 1); discard.push(card);
  activeSuit = card.suit;
  render();
  if (checkWin()) return;
  message('Nice! Computer is thinking\u2026');
  setTimeout(cpuTurn, 700);
}

function afterWild(suit) {
  activeSuit = suit;
  $('#suit-picker').classList.add('hidden');
  busy = false;
  render();
  if (checkWin()) return;
  message('Suit set to ' + suit + '. Computer is thinking\u2026');
  setTimeout(cpuTurn, 600);
}

$$('.suit-btn').forEach((b) => b.addEventListener('click', () => afterWild(b.dataset.s)));

function cpuTurn() {
  if (turn !== 'you' || busy) return;
  busy = true;
  const options = cpu.map((c, i) => i).filter((i) => canPlay(cpu[i]));
  if (!options.length) {
    if (!drawCard(cpu)) { afterTurn(); return; }
    message('Computer had to draw.');
  } else {
    // prefer dumping a card that empties the hand, else wild 8s, else first option
    let idx = options[0];
    options.forEach((i) => { if (cpu[i].rank === 1) idx = i; });
    if (cpu.length === 1) idx = options[0];
    const card = cpu.splice(idx, 1)[0];
    discard.push(card);
    if (card.rank === 1) { activeSuit = pick(SUITS); message('Computer played an 8 \u2014 suit is now ' + activeSuit + '.'); }
    else { activeSuit = card.suit; message('Computer played ' + card.rank + card.suit + '.'); }
  }
  render();
  if (checkWin()) return;
  afterTurn();
}

function afterTurn() {
  busy = false;
  render();
  message('Your turn \u2014 play a card or draw.');
}

$('#draw-btn').addEventListener('click', () => {
  if (turn !== 'you' || busy) return;
  busy = true;
  if (!drawCard(you)) { afterTurn(); return; }
  render();
  message('Drew a card.');
  setTimeout(() => { if (checkWin()) return; afterTurn(); }, 300);
});

function newGame() {
  deck = buildDeck();
  you = []; cpu = []; discard = [];
  for (let i = 0; i < 7; i++) { you.push(deck.pop()); cpu.push(deck.pop()); }
  discard.push(deck.pop());
  activeSuit = discard[0].suit;
  turn = 'you'; busy = false; pendingSuit = null;
  yourScore = 0;
  wins = Number(localStorage.getItem(KEY) || 0);
  $('#suit-picker').classList.add('hidden');
  render();
  message('Your turn \u2014 play a card or draw.');
}

initGameFrame({ title: 'Crazy Eights', emoji: '8\uFE0F', onRestart: newGame });

newGame();
