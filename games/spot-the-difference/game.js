'use strict';

/* Spot the Difference — two 6x6 emoji scenes with 5 hidden differences. */

const COLS = 6;
const CELLS = 36;
const DIFF_COUNT = 5;
const BEST_KEY = 'best-spot-the-difference';

const SCENES = [
  {
    name: 'Ocean',
    tiles: [
      '🐠', '🐢', '🐙', '🦀', '🐳', '🐬',
      '🦈', '⭐', '🐡', '🦞', '🐚', '🪸',
      '🦑', '🐋', '🦩', '🌊', '🏖️', '⛵',
      '🐧', '🦭', '🌴', '🦴', '🦢', '🐦',
      '🐵', '🐼', '🦚', '🐨', '🦥', '🐸',
      '🦜', '🦍', '🐨', '🐨', '🐨', '🐨'
    ],
    swaps: ['🍎', '🎈', '🧸', '🍩', '🚗', '🎨', '🍕', '⚽', '🎁', '🌈']
  },
  {
    name: 'Farm',
    tiles: [
      '🐮', '🐖', '🐓', '🐇', '🦔', '🐐',
      '🐑', '🐴', '🌽', '🥕', '🌻', '🚜',
      '🏡', '🌳', '🐨', '🐨', '🐨', '🐨',
      '🐨', '🐨', '🐨', '🐨', '🐨', '🐨',
      '🐨', '🐨', '🐨', '🐨', '🐨', '🐨',
      '🐨', '🐨', '🐨', '🐨', '🐨', '🐨'
    ],
    swaps: ['🍎', '🎈', '🧸', '🍩', '🚗', '🎨', '🍕', '⚽', '🎁', '🌈']
  },
  {
    name: 'Space',
    tiles: [
      '🚀', '🛸', '🌙', '⭐', '🪐', '☄️',
      '👽', '🛰️', '🌍', '🔭', '🌌', '✨',
      '👨‍🚀', '🌠', '🌟', '💫', '🌞', '🌛',
      '🐨', '🐨', '🐨', '🐨', '🐨', '🐨',
      '🐨', '🐨', '🐨', '🐨', '🐨', '🐨',
      '🐨', '🐨', '🐨', '🐨', '🐨', '🐨'
    ],
    swaps: ['🍎', '🎈', '🧸', '🍩', '🚗', '🎨', '🍕', '⚽', '🎁', '🌈']
  }
];

const leftBoard = $('#left-board');
const rightBoard = $('#right-board');

let leftTiles = [];
let rightTiles = [];
let diffSet = new Set();
let foundCount = 0;
let mistakes = 0;
let best = loadBest();

function loadBest() {
  const raw = localStorage.getItem(BEST_KEY);
  const n = raw === null ? null : parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function buildGrid(board, tiles, clickable) {
  board.innerHTML = '';
  tiles.forEach((emoji, i) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.textContent = emoji;
    tile.dataset.index = String(i);
    tile.setAttribute('aria-label', clickable ? 'Tile ' + (i + 1) : 'Original tile ' + (i + 1));
    if (clickable) tile.addEventListener('click', () => onTileClick(i, tile));
    board.appendChild(tile);
  });
}

function tileAt(board, index) {
  return board.querySelector('.tile[data-index="' + index + '"]');
}

function onTileClick(index, tile) {
  if (tile.classList.contains('found')) return;

  if (diffSet.has(index)) {
    tile.classList.add('found');
    const mirror = tileAt(leftBoard, index);
    if (mirror) mirror.classList.add('found');
    foundCount++;
    updateStats();
    if (foundCount === DIFF_COUNT) win();
  } else {
    mistakes++;
    updateStats();
    tile.classList.add('wrong');
    setTimeout(() => tile.classList.remove('wrong'), 400);
  }
}

function win() {
  if (best === null || mistakes < best) {
    best = mistakes;
    localStorage.setItem(BEST_KEY, String(best));
  }
  updateStats();
  burstConfetti();
  showModal(
    '🎉 You Win!',
    'You found all ' + DIFF_COUNT + ' differences with ' + mistakes +
      (mistakes === 1 ? ' mistake' : ' mistakes') + '. Best: ' + best + '!',
    'Play Again'
  );
}

function updateStats() {
  $('#found-count').textContent = String(foundCount);
  $('#total-count').textContent = String(DIFF_COUNT);
  $('#mistakes-count').textContent = String(mistakes);
  $('#best-count').textContent = best === null ? '—' : String(best);
}

function newGame() {
  hideModal();

  const scene = pick(SCENES);
  leftTiles = scene.tiles.slice();
  rightTiles = leftTiles.slice();

  diffSet = new Set(shuffle(Array.from({ length: CELLS }, (_, i) => i)).slice(0, DIFF_COUNT));
  diffSet.forEach((i) => {
    const options = scene.swaps.filter((s) => s !== leftTiles[i]);
    rightTiles[i] = pick(options);
  });

  foundCount = 0;
  mistakes = 0;

  buildGrid(leftBoard, leftTiles, false);
  buildGrid(rightBoard, rightTiles, true);
  updateStats();
}

initGameFrame({
  title: 'Spot the Difference',
  emoji: '🔎',
  onRestart: newGame
});

newGame();
