'use strict';

const SUITS = ['\u2660','\u2665','\u2666','\u2663'];
const RED = new Set(['\u2665','\u2666']);
const RANKS = [6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
const KEY = 'best-durak';

let deck, you, cpu, trump, table, turn, attacking, wins, busy;

const rankVal = (r) => (typeof r === 'number' ? r : RANKS.indexOf(r) + 6);

function buildDeck() {
  const d = [];
  RANKS.forEach((r) => SUITS.forEach((s) => d.push({ rank: r, suit: s })));
  return shuffle(d);
}

function cardEl(c, faceDown) {
  const d = document.createElement('div');
  d.className = 'card';
  if (faceDown) { d.classList.add('back'); return d; }
  if (RED.has(c.suit)) d.classList.add('red');
  d.innerHTML = '<div>' + c.rank + '</div><div>' + c.suit + '</div>';
  return d;
}

// A card beats the one on top when it is the same suit and higher,
// or when it is a trump and the top card is not.
function beats(def, top) {
  if (def.suit === top.suit) return rankVal(def.rank) > rankVal(top.rank);
  return def.suit === trump && top.suit !== trump;
}

function drawUp(hand) {
  while (hand.length < 6 && deck.length) hand.push(deck.pop());
}

function msg(t) { $('#message').textContent = t; }

function updateHud() {
  $('#your-cards').textContent = you.length;
  $('#cpu-cards').textContent = cpu.length;
  $('#deck').textContent = deck.length;
  $('#trump').textContent = trump;
  $('#best').textContent = wins;
}

function canPlay(c) {
  if (turn !== 'you' || busy) return false;
  if (!table.length) return attacking;      // leading needs an empty table
  return !attacking && beats(c, table[table.length - 1]);
}

function render() {
  const yh = $('#you-hand');
  yh.innerHTML = '';
  you.forEach((c) => {
    const el = cardEl(c, false);
    if (canPlay(c)) el.addEventListener('click', () => playYou(c));
    else el.style.cursor = 'default';
    yh.appendChild(el);
  });
  const ch = $('#cpu-hand');
  ch.innerHTML = '';
  cpu.forEach(() => ch.appendChild(cardEl(null, true)));
  updateHud();
}

function checkWin() {
  if (!you.length) {
    busy = false; turn = null;
    burstConfetti();
    wins++; localStorage.setItem(KEY, String(wins));
    showModal('\uD83C\uDF89 You Win!', 'You played off every card!', 'Play Again', newGame);
    return true;
  }
  if (!cpu.length) {
    busy = false; turn = null;
    showModal('\uD83D\uDE22 Computer Wins', 'The computer played off every card.', 'Play Again', newGame);
    return true;
  }
  return false;
}

function playYou(c) {
  if (!canPlay(c)) return;
  busy = true;
  you.splice(you.indexOf(c), 1);
  table.push(c);
  render();
  setTimeout(computerAct, 420);
}

// Whoever is on turn: if `attacking` they must lead, otherwise they must defend.
function computerAct() {
  if (turn !== 'you' || checkWin()) return;
  const top = table[table.length - 1];
  let choice = -1;
  cpu.forEach((c, i) => {
    if (choice === -1 && (!attacking ? beats(c, top) : c.suit !== trump || rankVal(c.rank) <= 6)) choice = i;
  });

  if (choice !== -1) {
    const c = cpu.splice(choice, 1)[0];
    table.push(c);
    attacking = !attacking;         // role swaps back
    turn = 'you';
    msg('Computer played ' + c.rank + c.suit + '. ' + (attacking ? 'Now beat it or pick up.' : 'Pick a card to attack.'));
  } else {
    cpu.push(...table.splice(0, table.length));
    drawUp(cpu);
    attacking = true;
    turn = 'you';
    msg('Computer could not beat it and picked up the pile. You attack!');
  }
  drawUp(you); drawUp(cpu);
  render();
  busy = false;
  if (checkWin()) return;
  render();
}

$('#attack-btn').addEventListener('click', () => {
  if (turn !== 'you' || busy) return;
  if (table.length) { msg('Defend first — beat the card on the table or pick it up.'); return; }
  msg('Tap one of your cards to attack with it.');
});

$('#defend-btn').addEventListener('click', () => {
  if (turn !== 'you' || busy || !table.length) return;
  busy = true;
  you.push(...table.splice(0, table.length));
  drawUp(you);
  // computer leads the next attack
  const c = cpu.shift();
  if (c) table.push(c);
  drawUp(you); drawUp(cpu);
  attacking = false;
  turn = 'you';
  msg('You picked up. Computer attacks with ' + (c ? c.rank + c.suit : '—') + '. Beat it or pick up.');
  busy = false;
  render();
  if (checkWin()) return;
});

function newGame() {
  deck = buildDeck();
  trump = pick(SUITS);
  you = []; cpu = []; table = [];
  for (let i = 0; i < 6; i++) { you.push(deck.pop()); cpu.push(deck.pop()); }
  turn = 'you';
  attacking = true;
  wins = Number(localStorage.getItem(KEY) || 0);
  busy = false;
  render();
  msg('Trump is ' + trump + '. You attack first — tap a card!');
}

initGameFrame({ title: 'Durak', emoji: '\uD83C\uDCD3', onRestart: newGame });

newGame();
