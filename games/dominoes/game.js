'use strict';

/* Dominoes — full double-six set, play against the computer */

const PIPE_POS = {
  0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};

let difficulty = 'easy';
let hand = [], cpuHand = [], boneYard = [], chain = [];
let leftEnd = null, rightEnd = null;
let turn = 'player', passes = 0, moveCount = 0, epoch = 0;
let best = loadBest();

function loadBest() {
  try {
    const v = parseInt(localStorage.getItem('best-dominoes'), 10);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch (e) { return null; }
}

function makeSet() {
  const tiles = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  return tiles;
}

const pipSum = (t) => t[0] + t[1];

function canPlay(t) {
  if (!chain.length) return true;
  return t[0] === leftEnd || t[1] === leftEnd || t[0] === rightEnd || t[1] === rightEnd;
}

const playableTiles = (arr) => arr.filter(canPlay);

function placeTile(arr, tile) {
  const idx = arr.indexOf(tile);
  if (idx >= 0) arr.splice(idx, 1);
  if (!chain.length) {
    chain.push(tile.slice());
    leftEnd = tile[0]; rightEnd = tile[1];
  } else if (tile[0] === leftEnd || tile[1] === leftEnd) {
    const t = tile[1] === leftEnd ? tile.slice() : [tile[1], tile[0]];
    chain.unshift(t); leftEnd = t[0];
  } else {
    const t = tile[0] === rightEnd ? tile.slice() : [tile[1], tile[0]];
    chain.push(t); rightEnd = t[1];
  }
  passes = 0;
}

/* ---------- Rendering ---------- */

function pipsHTML(n) {
  const on = PIPE_POS[n];
  let html = '';
  for (let i = 0; i < 9; i++) html += '<span class="pip-cell' + (on.indexOf(i) >= 0 ? ' pip' : '') + '"></span>';
  return html;
}

function tileHTML(a, b) {
  return '<div class="domino"><div class="half">' + pipsHTML(a) +
    '</div><div class="divider"></div><div class="half">' + pipsHTML(b) + '</div></div>';
}

function setMessage(text) { $('#message').textContent = text; }

function renderStatus() {
  $('#my-count').textContent = hand.length;
  $('#cpu-count').textContent = cpuHand.length;
  $('#bone-count').textContent = boneYard.length;
  $('#best').textContent = best === null ? '—' : best + ' moves';
}

function renderEnds() {
  const el = $('#ends');
  if (!chain.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="end-chip">⬅️ <span class="pip-preview">' + pipsHTML(leftEnd) + '</span></div>' +
    '<div class="end-chip">➡️ <span class="pip-preview">' + pipsHTML(rightEnd) + '</span></div>';
}

function renderChain() {
  const el = $('#chain');
  if (!chain.length) { el.innerHTML = '<p class="chain-empty">The chain is empty — play any tile to start!</p>'; return; }
  el.innerHTML = chain.map((t) => tileHTML(t[0], t[1])).join('');
}

function renderHand() {
  const el = $('#hand');
  if (!hand.length) { el.innerHTML = '<p class="hand-empty-note">Your hand is empty! 🎉</p>'; return; }
  el.innerHTML = hand.map((t, i) => {
    const ok = turn === 'player' && canPlay(t);
    return '<button type="button" class="tile' + (ok ? ' playable' : '') + '" data-i="' + i + '">' + tileHTML(t[0], t[1]) + '</button>';
  }).join('');
}

function render() { renderStatus(); renderEnds(); renderChain(); renderHand(); }

/* ---------- Game flow ---------- */

function newGame() {
  epoch++;
  const tiles = shuffle(makeSet());
  hand = tiles.slice(0, 7);
  cpuHand = tiles.slice(7, 14);
  boneYard = tiles.slice(14);
  chain = []; leftEnd = null; rightEnd = null;
  turn = 'player'; passes = 0; moveCount = 0;
  hideModal();
  setMessage('🎲 Your turn! Click a glowing tile to start the chain.');
  render();
}

function drawTile(arr) {
  if (!boneYard.length) return null;
  const tile = boneYard.pop();
  arr.push(tile);
  return tile;
}

function finishWin(winner, text) {
  if (winner === 'player') {
    if (best === null || moveCount < best) {
      best = moveCount;
      try { localStorage.setItem('best-dominoes', String(best)); } catch (e) { /* ignore */ }
    }
    renderStatus();
    burstConfetti();
    showModal('🎉 You Win!', text, 'Play Again', newGame);
  } else {
    showModal('🤖 Computer Wins!', text, 'Play Again', newGame);
  }
}

function handlePass(who) {
  passes++;
  setMessage(who === 'player' ? '😴 You passed — no tile matches and the bone yard is empty.' : '🤖 The computer passed.');
  if (passes >= 2) {
    const myPips = hand.reduce((s, t) => s + pipSum(t), 0);
    const cpuPips = cpuHand.reduce((s, t) => s + pipSum(t), 0);
    if (myPips === cpuPips) { showModal('🤝 Blocked Game!', 'Nobody can play — it is a tie.', 'Play Again', newGame); return; }
    if (myPips < cpuPips) finishWin('player', 'Blocked! You have fewer pips in hand (' + myPips + ' vs ' + cpuPips + ').');
    else finishWin('cpu', 'Blocked! The computer has fewer pips in hand (' + cpuPips + ' vs ' + myPips + ').');
    return;
  }
  turn = who === 'player' ? 'cpu' : 'player';
  if (turn === 'player') startPlayerTurn(); else computerTurn();
}

function startPlayerTurn() {
  turn = 'player';
  render();
  if (playableTiles(hand).length) { setMessage('🎯 Your turn — click a glowing tile.'); return; }
  if (boneYard.length) {
    drawTile(hand);
    setMessage('📦 You cannot play — you drew a tile from the bone yard.');
    render();
    if (!playableTiles(hand).length) handlePass('player');
  } else handlePass('player');
}

function computerChoice() {
  const options = playableTiles(cpuHand);
  if (!options.length) return null;
  if (difficulty === 'easy') return pick(options);
  if (difficulty === 'medium') return options.reduce((b, t) => pipSum(t) > pipSum(b) ? t : b);
  const score = (t) => (t[0] === t[1] ? 3 : 0) +
    cpuHand.filter((o) => o !== t && (o[0] === t[0] || o[1] === t[0] || o[0] === t[1] || o[1] === t[1])).length;
  return options.reduce((b, t) => score(t) > score(b) ? t : b);
}

function computerPlay(tile) {
  placeTile(cpuHand, tile);
  moveCount++;
  setMessage('🤖 The computer played ' + tile[0] + '-' + tile[1] + '.');
  render();
  if (!cpuHand.length) { finishWin('cpu', 'The computer emptied its hand!'); return; }
  startPlayerTurn();
}

function computerTurn() {
  turn = 'cpu';
  render();
  const myEpoch = epoch;
  setTimeout(() => {
    if (myEpoch !== epoch || turn !== 'cpu') return;
    const choice = computerChoice();
    if (choice) { computerPlay(choice); return; }
    if (boneYard.length) {
      drawTile(cpuHand);
      setMessage('🤖 The computer drew a tile from the bone yard.');
      render();
      const again = computerChoice();
      if (again) computerPlay(again); else handlePass('cpu');
    } else handlePass('cpu');
  }, 800);
}

/* ---------- Player input ---------- */

$('#hand').addEventListener('click', (e) => {
  const btn = e.target.closest('.tile');
  if (!btn || turn !== 'player') return;
  const tile = hand[parseInt(btn.dataset.i, 10)];
  if (!tile || !canPlay(tile)) return;
  placeTile(hand, tile);
  moveCount++;
  setMessage('✅ You played ' + tile[0] + '-' + tile[1] + '!');
  render();
  if (!hand.length) { finishWin('player', 'You emptied your hand in ' + moveCount + ' moves! Best: ' + best + ' moves.'); return; }
  computerTurn();
});

/* ---------- Init ---------- */

initGameFrame({
  title: 'Dominoes',
  emoji: '🁣',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (value) => { difficulty = value; newGame(); },
  onRestart: () => newGame()
});

newGame();
