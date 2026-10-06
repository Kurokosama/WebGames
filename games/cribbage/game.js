'use strict';

const SUITS = ['\u2660','\u2665','\u2666','\u2663'];
const RED = new Set(['\u2665','\u2666']);
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const KEY = 'best-cribbage';

let deck, you, cpu, pointsYou, pointsCpu, played, starter, turn, wins, busy;

const val = (r) => (r === 'A' ? 1 : r === 'J' ? 11 : r === 'Q' ? 12 : r === 'K' ? 13 : Number(r));

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

function updateHud() {
  $('#your-points').textContent = pointsYou;
  $('#cpu-points').textContent = pointsCpu;
  $('#deck').textContent = deck.length;
  $('#best').textContent = wins;
}

function msg(t) { $('#message').textContent = t; }

// Count 15s and any 3/4-card runs among the played cards.
function playScore(cards) {
  const total = cards.reduce((a, c) => a + val(c.rank), 0);
  let pts = 0;
  if (total === 15) pts += 2;
  // runs
  const sorted = cards.map((c) => val(c.rank)).sort((a, b) => a - b);
  let run = 1, bestRun = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) { run++; bestRun = Math.max(bestRun, run); }
    else if (sorted[i] !== sorted[i - 1]) run = 1;
  }
  if (bestRun >= 3) pts += bestRun;
  return pts;
}

function render() {
  const yh = $('#you-hand'); yh.innerHTML = '';
  you.forEach((c) => {
    const el = cardEl(c, false);
    if (turn === 'you' && !busy) el.addEventListener('click', () => playCard(c, 'you'));
    else el.style.cursor = 'default';
    yh.appendChild(el);
  });
  const ch = $('#cpu-hand'); ch.innerHTML = '';
  cpu.forEach(() => ch.appendChild(cardEl(null, true)));

  const pl = $('#played'); pl.innerHTML = '';
  played.forEach((c) => pl.appendChild(cardEl(c, false)));
  $('#starter').textContent = 'Starter: ' + (starter ? starter.rank + starter.suit : '—');
  updateHud();
}

function playCard(c, who) {
  if (busy || turn !== who) return;
  const hand = who === 'you' ? you : cpu;
  const last = played[played.length - 1];
  if (last && val(c.rank) <= val(last.rank)) return;   // must go up
  busy = true;
  hand.splice(hand.indexOf(c), 1);
  played.push(c);
  const gain = playScore(played);
  if (gain) {
    if (who === 'you') pointsYou += gain; else pointsCpu += gain;
    msg(who === 'you' ? '+' + gain + ' points!' : 'Computer scores ' + gain + '.');
  } else {
    msg(who === 'you' ? 'Your card.' : 'Computer plays.');
  }
  render();
  if (checkWin()) return;
  busy = false;
  turn = who === 'you' ? 'cpu' : 'you';
  if (turn === 'cpu') setTimeout(computerAct, 600);
  render();
}

function computerAct() {
  if (turn !== 'cpu') return;
  const last = played[played.length - 1];
  const opts = cpu.filter((c) => !last || val(c.rank) > val(last.rank));
  const choices = opts.length ? opts : cpu;
  if (!choices.length) { endPlay(); return; }
  const c = pick(choices);
  playCard(c, 'cpu');
}

function endPlay() {
  // whoever played last takes the pile
  const last = played[played.length - 1];
  if (!last) { resetRound(); return; }
  const pts = 3;
  const taker = last.suit === starter.suit && starter.rank === 'K' ? null : null;
  // Simple: the last player to play scores 3 for the pile.
  // Determine last player from turn state.
  const lastPlayer = turn === 'cpu' ? 'you' : 'cpu';
  if (lastPlayer === 'you') pointsYou += pts; else pointsCpu += pts;
  msg('Pile scored! +' + pts + '.');
  burstConfetti();
  if (checkWin()) return;
  setTimeout(resetRound, 900);
}

function checkWin() {
  if (pointsYou >= 61) {
    busy = false; turn = null;
    wins++; localStorage.setItem(KEY, String(wins)); burstConfetti();
    showModal('\uD83C\uDF89 You Win!', pointsYou + ' – ' + pointsCpu, 'Play Again', newGame);
    return true;
  }
  if (pointsCpu >= 61) {
    busy = false; turn = null;
    showModal('\uD83D\uDE22 Computer Wins', pointsYou + ' – ' + pointsCpu, 'Play Again', newGame);
    return true;
  }
  return false;
}

function resetRound() {
  for (let i = 0; i < 6; i++) { if (deck.length) you.push(deck.pop()); if (deck.length) cpu.push(deck.pop()); }
  if (!deck.length) {
    showModal('\uD83C\uDFB2 Game Over', 'The deck ran out. Final: ' + pointsYou + ' – ' + pointsCpu, 'Play Again', newGame);
    return;
  }
  starter = deck.pop();
  played = [];
  turn = randInt(0, 1) ? 'you' : 'cpu';
  busy = false;
  render();
  msg(turn === 'you' ? 'You play first!' : 'Computer plays first.');
  if (turn === 'cpu') setTimeout(computerAct, 700);
}

function newGame() {
  deck = buildDeck();
  you = []; cpu = []; played = []; starter = null;
  pointsYou = 0; pointsCpu = 0;
  wins = Number(localStorage.getItem(KEY) || 0);
  for (let i = 0; i < 6; i++) { you.push(deck.pop()); cpu.push(deck.pop()); }
  starter = deck.pop();
  turn = 'you'; busy = false;
  render();
  msg('You play first!');
}

initGameFrame({ title: 'Cribbage', emoji: '\uD83C\uDF31', onRestart: newGame });

newGame();
