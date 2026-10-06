'use strict';

const TARGET = 1000;
const KEY = 'best-farkle';
const PIPS = {
  1: [[50,50]], 2: [[28,28],[72,72]], 3: [[25,25],[50,50],[75,75]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,26],[72,26],[28,50],[72,50],[28,74],[72,74]]
};

let bankYou, bankCpu, turnPoints, rolling, turn, wins;

function msg(t) { $('#message').textContent = t; }

/* Standard Farkle scoring. Returns 0 when the roll scores nothing (a Farkle). */
function scoreHand(vals) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  vals.forEach((v) => { c[v]++; });
  const n = vals.length;

  // Six-dice specials first, they beat every other combination.
  const sorted = c.slice(1);
  if (n === 6 && sorted.every((k) => k === 1)) return 1500;            // 1-2-3-4-5-6
  const pairs = sorted.filter((k) => k === 2).length;
  const trips = sorted.filter((k) => k === 3).length;
  if (n === 6 && pairs === 3) return 1500;                             // three pairs
  if (n === 6 && trips === 2) return 2500;                             // two triplets

  let pts = 0;
  for (let face = 1; face <= 6; face++) {
    const k = c[face];
    if (k >= 6) { pts += 3000; continue; }
    if (k >= 5) { pts += 2000; continue; }
    if (k >= 4) { pts += 1000; continue; }
    if (k === 3) { pts += face === 1 ? 1000 : face * 100; continue; }
    // leftover single 1s and 5s still score
    if (face === 1) pts += k * 100;
    else if (face === 5) pts += k * 50;
  }
  return pts;
}

function rollDice(n) {
  const vals = [];
  for (let i = 0; i < n; i++) vals.push(randInt(1, 6));
  return vals;
}

function dieEl(v) {
  const d = document.createElement('div');
  d.className = 'die';
  (PIPS[v] || []).forEach(([x, y]) => {
    const p = document.createElement('span');
    p.className = 'pip';
    p.style.left = x + '%'; p.style.top = y + '%';
    d.appendChild(p);
  });
  return d;
}

function renderRow(sel, vals) {
  const row = $(sel);
  row.innerHTML = '';
  if (vals && vals.length) vals.forEach((v) => row.appendChild(dieEl(v)));
}

function updateHud() {
  $('#your-score').textContent = bankYou;
  $('#cpu-score').textContent = bankCpu;
  $('#turn-points').textContent = turnPoints;
  $('#best').textContent = wins;
  $('#bank-you').textContent = bankYou;
  $('#bank-cpu').textContent = bankCpu;
  $('#bank-btn').disabled = turn !== 'you' || turnPoints === 0 || rolling;
}

function playerRoll() {
  if (turn !== 'you' || rolling) return;
  rolling = true;
  const n = 6;
  const vals = rollDice(n);
  const pts = scoreHand(vals);
  renderRow('#you-dice', vals);
  setTimeout(() => {
    rolling = false;
    if (pts === 0) {
      msg('Farkle! You lose ' + turnPoints + ' turn points.');
      turnPoints = 0;
      setTimeout(() => { cpuTurn(); }, 1400);
      updateHud();
    } else {
      turnPoints += pts;
      msg('You scored ' + pts + ' this roll (turn: ' + turnPoints + ')');
      updateHud();
      if (bankYou + turnPoints >= TARGET) {
        bankYou += turnPoints;
        wins++; localStorage.setItem(KEY, String(wins));
        burstConfetti();
        showModal('\uD83C\uDF89 You Win!', 'You reached ' + TARGET + ' first!', 'Play Again', newGame);
        return;
      }
    }
  }, 700);
}

function bankPoints() {
  if (turn !== 'you' || !turnPoints) return;
  bankYou += turnPoints;
  turnPoints = 0;
  updateHud();
  if (bankYou >= TARGET) {
    wins++; localStorage.setItem(KEY, String(wins));
    burstConfetti();
    showModal('\uD83C\uDF89 You Win!', 'You reached ' + TARGET + ' first!', 'Play Again', newGame);
    return;
  }
  cpuTurn();
}

function cpuTurn() {
  if (turn !== 'you') return;
  turn = 'cpu';
  updateHud();
  msg('Computer is rolling…');
  renderRow('#cpu-dice', rollDice(6));
  setTimeout(() => {
    let cpuPts = 0, tries = 0;
    // simple AI: roll, if good keep rolling up to 4 times
    while (tries < 4 && bankCpu + cpuPts < TARGET) {
      const vals = rollDice(6);
      const pts = scoreHand(vals);
      if (pts === 0) { cpuPts = 0; break; }
      cpuPts += pts;
      tries++;
      renderRow('#cpu-dice', vals);
    }
    setTimeout(() => {
      if (cpuPts === 0) {
        msg('Computer farked!');
      } else {
        bankCpu += cpuPts;
        msg('Computer banked ' + cpuPts + ' (total ' + bankCpu + ')');
      }
      updateHud();
      if (bankCpu >= TARGET) {
        showModal('\uD83D\uDE22 Computer Wins', 'The computer reached ' + TARGET + ' first.', 'Play Again', newGame);
        return;
      }
      turn = 'you';
      turnPoints = 0;
      updateHud();
      msg('Your turn — roll to start');
    }, 900);
  }, 700);
}

function newGame() {
  bankYou = 0; bankCpu = 0; turnPoints = 0; rolling = false; turn = 'you';
  wins = Number(localStorage.getItem(KEY) || 0);
  msg('Your turn — roll to start');
  renderRow('#you-dice', null); renderRow('#cpu-dice', null);
  updateHud();
}

/* ---------- wire up the controls (these were never bound) ---------- */
$('#roll-btn').addEventListener('click', playerRoll);
$('#bank-btn').addEventListener('click', bankPoints);

initGameFrame({ title: 'Farkle', emoji: '\uD83C\uDFB2', onRestart: newGame });

newGame();
