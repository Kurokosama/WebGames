/* ============================================================
   Emoji Jigsaw — rebuild the garden scene by swapping tiles
   ============================================================ */
'use strict';

const GRID = 4;
const BEST_KEY = 'best-jigsaw';

/* The target scene: a sunny garden (sky, flowers, bugs, ground). */
const SCENE = [
  '☀️', '🌤️', '🌈', '☁️',
  '🌷', '🌼', '🌻', '🌸',
  '🐝', '🦋', '🐞', '🐌',
  '🌱', '🌿', '🐸', '🍄'
];

const boardEl = $('#board');
const refEl = $('#reference');
const movesEl = $('#moves');
const bestEl = $('#best');

let tiles = [];      // tiles[position] = original index of the emoji sitting there
let moves = 0;
let selected = -1;   // position of the first tapped tile
let won = false;

/* ---------- Best score ---------- */
function getBest() {
  const n = parseInt(localStorage.getItem(BEST_KEY), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function renderStats() {
  movesEl.textContent = moves;
  const best = getBest();
  bestEl.textContent = best === null ? '—' : best;
}

/* ---------- Reference thumbnail ---------- */
function renderReference() {
  refEl.innerHTML = '';
  SCENE.forEach((emoji) => {
    const cell = document.createElement('div');
    cell.className = 'ref-cell';
    cell.textContent = emoji;
    refEl.appendChild(cell);
  });
}

/* ---------- Board ---------- */
function isSolved() {
  return tiles.every((originalIndex, position) => originalIndex === position);
}

function renderBoard(justSwapped) {
  boardEl.innerHTML = '';
  tiles.forEach((originalIndex, position) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.textContent = SCENE[originalIndex];
    tile.setAttribute('aria-label', 'Tile ' + (position + 1));
    if (originalIndex === position) tile.classList.add('correct');
    if (position === selected) tile.classList.add('selected');
    if (justSwapped && justSwapped.includes(position)) tile.classList.add('just-swapped');
    tile.addEventListener('click', () => handleTileClick(position));
    boardEl.appendChild(tile);
  });
}

function handleTileClick(position) {
  if (won) return;

  if (selected === -1) {
    selected = position;
    renderBoard();
    return;
  }

  if (selected === position) {
    selected = -1; // tap the same tile again to unselect
    renderBoard();
    return;
  }

  const swapped = [selected, position];
  [tiles[selected], tiles[position]] = [tiles[position], tiles[selected]];
  selected = -1;
  moves += 1;
  renderStats();
  renderBoard(swapped);

  if (isSolved()) win();
}

/* ---------- Win ---------- */
function win() {
  won = true;
  const best = getBest();
  if (best === null || moves < best) {
    localStorage.setItem(BEST_KEY, String(moves));
    renderStats();
    showModal(
      '🎉 You Win!',
      'You rebuilt the garden in ' + moves + ' moves — a new best! 🌷',
      'Play Again',
      startNewGame
    );
  } else {
    showModal(
      '🎉 You Win!',
      'You rebuilt the garden in ' + moves + ' moves! Best: ' + best + ' moves. Can you beat it?',
      'Play Again',
      startNewGame
    );
  }
  burstConfetti();
}

/* ---------- New game ---------- */
function startNewGame() {
  won = false;
  moves = 0;
  selected = -1;

  const order = shuffle(SCENE.map((_, i) => i));
  // Never start with the puzzle already solved.
  if (order.every((originalIndex, position) => originalIndex === position)) {
    [order[0], order[15]] = [order[15], order[0]];
  }
  tiles = order;

  renderStats();
  renderBoard();
}

/* ---------- Start ---------- */
renderReference();

initGameFrame({
  title: 'Emoji Jigsaw',
  emoji: '🧩',
  onRestart: startNewGame
});

startNewGame();
