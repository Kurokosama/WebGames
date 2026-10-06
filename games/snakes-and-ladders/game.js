'use strict';

/* ============================================================
   Snakes & Ladders — You vs the Computer on a 10x10 board
   Boustrophedon numbering 1..100, exact roll to 100 to win.
   ============================================================ */

const BEST_KEY = 'best-snakes-and-ladders';
const LADDERS = { 2: 17, 8: 30, 18: 70, 32: 52, 44: 66 };
const SNAKES = { 24: 5, 36: 14, 51: 6, 76: 40, 95: 75 };

const boardEl = $('#board');
const overlayEl = $('#overlay');
const diceEl = $('#dice');
const diceDisplay = $('#dice-display');
const turnEl = $('#turn');
const playerSquareEl = $('#player-square');
const computerSquareEl = $('#computer-square');
const bestEl = $('#best');
const rollBtn = $('#roll-btn');
const messageEl = $('#message');

let dieMax = 6;
let busy = false;
let gameOver = false;
let playerTurn = true;
let playerPos = 0;
let computerPos = 0;
let playerRolls = 0;
let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
const cells = [];
let youToken = null;
let cpuToken = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Visual grid index (row-major, top row first) for board number n (1..100)
function posToCell(n) {
  const rowFromBottom = Math.floor((n - 1) / 10);
  let col = (n - 1) % 10;
  if (rowFromBottom % 2 === 1) col = 9 - col;
  return (9 - rowFromBottom) * 10 + col;
}

function buildBoard() {
  boardEl.innerHTML = '';
  overlayEl.innerHTML = '';
  cells.length = 0;
  for (let i = 0; i < 100; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (Math.floor(i / 10) % 2 === 1) cell.classList.add('alt');
    cells.push(cell);
    boardEl.appendChild(cell);
  }
  for (let n = 1; n <= 100; n++) {
    const cell = cells[posToCell(n)];
    const label = document.createElement('span');
    label.textContent = n;
    cell.appendChild(label);
    if (LADDERS[n]) {
      cell.classList.add('ladder-cell');
      const mark = document.createElement('span');
      mark.className = 'jump-mark';
      mark.textContent = '🪜';
      cell.appendChild(mark);
    }
    if (SNAKES[n]) {
      cell.classList.add('snake-cell');
      const mark = document.createElement('span');
      mark.className = 'jump-mark';
      mark.textContent = '🐍';
      cell.appendChild(mark);
    }
    if (n === 100) cell.classList.add('win-cell');
  }
  const drawLine = (from, to, cls) => {
    const a = posToCell(from);
    const b = posToCell(to);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', (a % 10) + 0.5);
    line.setAttribute('y1', Math.floor(a / 10) + 0.5);
    line.setAttribute('x2', (b % 10) + 0.5);
    line.setAttribute('y2', Math.floor(b / 10) + 0.5);
    line.setAttribute('class', cls);
    overlayEl.appendChild(line);
  };
  Object.entries(LADDERS).forEach(([from, to]) => drawLine(Number(from), Number(to), 'ladder-line'));
  Object.entries(SNAKES).forEach(([from, to]) => drawLine(Number(from), Number(to), 'snake-line'));
}

function makeTokens() {
  youToken = document.createElement('div');
  youToken.className = 'token you-token';
  youToken.textContent = '🐵';
  cpuToken = document.createElement('div');
  cpuToken.className = 'token cpu-token';
  cpuToken.textContent = '🤖';
}

function placeToken(token, pos) {
  const old = token.parentElement;
  if (old) {
    token.remove();
    old.classList.remove('token-two');
  }
  if (pos === 0) return;
  const cell = cells[posToCell(pos)];
  cell.appendChild(token);
  if ($$('.token', cell).length > 1) cell.classList.add('token-two');
}

function updateStatus() {
  turnEl.textContent = playerTurn ? 'You' : 'Computer';
  playerSquareEl.textContent = playerPos === 0 ? 'Start' : String(playerPos);
  computerSquareEl.textContent = computerPos === 0 ? 'Start' : String(computerPos);
  bestEl.textContent = best > 0 ? String(best) : '—';
}

function showDice(value) {
  diceEl.textContent = String(value);
  diceDisplay.textContent = String(value);
  diceDisplay.classList.remove('rolling');
  void diceDisplay.offsetWidth;
  diceDisplay.classList.add('rolling');
}

async function rollDice() {
  const value = randInt(1, dieMax);
  showDice(value);
  await sleep(500);
  return value;
}

async function moveToken(token, from, value) {
  let pos = from;
  let dir = 1;
  for (let s = 0; s < value; s++) {
    if (pos + dir > 100) dir = -1; // bounce back from 100
    pos += dir;
    placeToken(token, pos);
    await sleep(160);
  }
  return pos;
}

async function playTurn(token, isPlayer) {
  const who = isPlayer ? 'You' : 'Computer';
  const value = await rollDice();
  const from = isPlayer ? playerPos : computerPos;
  let landed = from + value;
  if (landed > 100) {
    landed = 100 - (landed - 100);
    messageEl.textContent = `${who} rolled ${value} — too far! Bounced back to ${landed}.`;
  } else {
    messageEl.textContent = `${who} rolled ${value}. Moving...`;
  }
  const pos = await moveToken(token, from, value);
  if (isPlayer) { playerPos = pos; playerRolls++; } else { computerPos = pos; }
  updateStatus();

  if (pos === 100) return win(isPlayer);

  const jump = LADDERS[pos] || SNAKES[pos];
  if (jump) {
    await sleep(400);
    const emoji = LADDERS[pos] ? '🪜' : '🐍';
    messageEl.textContent = `${who} hit ${emoji} at ${pos} — sliding to ${jump}!`;
    placeToken(token, jump);
    if (isPlayer) playerPos = jump; else computerPos = jump;
    updateStatus();
    await sleep(500);
  }
}

function win(isPlayer) {
  gameOver = true;
  if (isPlayer) {
    if (best === 0 || playerRolls < best) {
      best = playerRolls;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateStatus();
    burstConfetti();
    showModal('🎉 You Win!', `You reached square 100 in ${playerRolls} rolls! Best: ${best}.`, 'Play Again', reset);
  } else {
    showModal('Computer Wins! 🤖', `The computer reached square 100 first. Your best is still ${best > 0 ? best : 'not set'} — try again!`, 'Play Again', reset);
  }
}

async function computerTurn() {
  if (gameOver) return;
  playerTurn = false;
  updateStatus();
  rollBtn.disabled = true;
  messageEl.textContent = "Computer's turn...";
  await sleep(700);
  await playTurn(cpuToken, false);
  if (gameOver) return;
  playerTurn = true;
  updateStatus();
  rollBtn.disabled = false;
  messageEl.textContent = 'Your turn — tap Roll to move!';
}

async function handleRoll() {
  if (busy || gameOver || !playerTurn) return;
  busy = true;
  rollBtn.disabled = true;
  await playTurn(youToken, true);
  busy = false;
  if (!gameOver) rollBtn.disabled = false;
  await computerTurn();
}

function reset() {
  busy = false;
  gameOver = false;
  playerTurn = true;
  playerPos = 0;
  computerPos = 0;
  playerRolls = 0;
  diceEl.textContent = '—';
  diceDisplay.textContent = '🎲';
  rollBtn.disabled = false;
  messageEl.textContent = 'Your turn — tap Roll to move!';
  buildBoard();
  makeTokens();
  updateStatus();
}

rollBtn.addEventListener('click', handleRoll);

initGameFrame({
  title: 'Snakes & Ladders',
  emoji: '🐍',
  difficulties: [
    { value: 'easy', label: 'Easy (dice 1-4)' },
    { value: 'normal', label: 'Normal (dice 1-6)' },
    { value: 'hard', label: 'Hard (dice 1-8)' }
  ],
  defaultDifficulty: 'normal',
  onDifficulty: (value) => {
    dieMax = value === 'easy' ? 4 : value === 'hard' ? 8 : 6;
    reset();
  },
  onRestart: reset
});

reset();
