/* ============================================================
   Battleship 海战棋 — game logic
   ============================================================ */
'use strict';

const SIZE = 10;
const SHIPS = [
  { name: '航母', size: 5, emoji: '🛳️' },
  { name: '战列舰', size: 4, emoji: '🚢' },
  { name: '巡洋舰', size: 3, emoji: '⛴️' },
  { name: '潜艇', size: 3, emoji: '🛥️' },
  { name: '驱逐舰', size: 2, emoji: '🚤' }
];

let state = null;

function makeEmptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill('empty'));
}

function initState() {
  state = {
    phase: 'place',            // 'place' | 'battle' | 'over'
    turn: 'player',            // 'player' | 'enemy'
    playerGrid: makeEmptyGrid(),
    enemyGrid: makeEmptyGrid(),
    playerShips: [],
    enemyShips: [],
    placingIndex: 0,
    placingOrientation: 'h',
    playerHits: 0,
    enemyHits: 0,
    playerSunk: 0,
    enemySunk: 0,
    enemyTargets: []           // AI targeting queue
  };
}

// ---------- Ship placement helpers ----------
function canPlace(grid, ships, r, c, size, orientation) {
  if (orientation === 'h') {
    if (c + size > SIZE) return false;
    for (let i = 0; i < size; i++) {
      if (grid[r][c + i] !== 'empty') return false;
    }
  } else {
    if (r + size > SIZE) return false;
    for (let i = 0; i < size; i++) {
      if (grid[r + i][c] !== 'empty') return false;
    }
  }
  return true;
}

function placeShip(grid, ships, r, c, size, orientation) {
  const cells = [];
  if (orientation === 'h') {
    for (let i = 0; i < size; i++) { grid[r][c + i] = 'ship'; cells.push({ r, c: c + i }); }
  } else {
    for (let i = 0; i < size; i++) { grid[r + i][c] = 'ship'; cells.push({ r: r + i, c }); }
  }
  ships.push({ size, cells, hits: 0, sunk: false });
}

function randomPlace(grid, ships) {
  for (const ship of SHIPS) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 500) {
      attempts++;
      const orientation = Math.random() < 0.5 ? 'h' : 'v';
      const r = randInt(0, SIZE - 1);
      const c = randInt(0, SIZE - 1);
      if (canPlace(grid, ships, r, c, ship.size, orientation)) {
        placeShip(grid, ships, r, c, ship.size, orientation);
        placed = true;
      }
    }
  }
}

// ---------- Rendering ----------
function renderBoard(gridEl, grid, showShips) {
  gridEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      const v = grid[r][c];
      if (v === 'ship' && showShips) cell.classList.add('ship');
      else if (v === 'hit') { cell.classList.add('hit'); cell.textContent = '💥'; }
      else if (v === 'miss') { cell.classList.add('miss'); cell.textContent = '·'; }
      else if (v === 'sunk') { cell.classList.add('sunk'); cell.textContent = '💀'; }
      gridEl.appendChild(cell);
    }
  }
}

function renderAll() {
  renderBoard($('#player-board'), state.playerGrid, true);
  renderBoard($('#enemy-board'), state.enemyGrid, false);
  $('#turn').textContent = state.turn === 'player' ? '你' : '电脑';
  $('#hits').textContent = state.playerHits;
  $('#sunk').textContent = state.enemySunk + ' / 5';
  updatePhasePanel();
}

function updatePhasePanel() {
  const panel = $('#phase-panel');
  const text = $('#phase-text');
  if (state.phase === 'place') {
    panel.style.display = 'block';
    if (state.placingIndex < SHIPS.length) {
      const ship = SHIPS[state.placingIndex];
      text.textContent = `🚢 布置舰队 (${state.placingIndex + 1}/5)：放置「${ship.emoji} ${ship.name}」(${ship.size}格) — 点击格子放置，点「随机布置」一键完成`;
    } else {
      text.textContent = '✅ 舰队布置完成！点击「开始战斗」';
    }
    $('#auto-place-btn').style.display = 'inline-block';
    $('#start-btn').style.display = 'inline-block';
    $('#start-btn').disabled = state.placingIndex < SHIPS.length;
  } else {
    panel.style.display = 'none';
  }
}

// ---------- Placement interaction ----------
function setupPlacement() {
  const board = $('#player-board');
  board.addEventListener('click', (e) => {
    if (state.phase !== 'place') return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    const ship = SHIPS[state.placingIndex];
    if (canPlace(state.playerGrid, state.playerShips, r, c, ship.size, state.placingOrientation)) {
      placeShip(state.playerGrid, state.playerShips, r, c, ship.size, state.placingOrientation);
      state.placingIndex++;
      renderAll();
      if (state.placingIndex >= SHIPS.length) {
        $('#phase-text').textContent = '✅ 舰队布置完成！点击「开始战斗」';
      }
    }
  });

  // Rotate on right-click
  board.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.phase !== 'place') return;
    state.placingOrientation = state.placingOrientation === 'h' ? 'v' : 'h';
    renderAll();
  });

  $('#auto-place-btn').addEventListener('click', () => {
    if (state.phase !== 'place') return;
    state.playerGrid = makeEmptyGrid();
    state.playerShips = [];
    state.placingIndex = 0;
    randomPlace(state.playerGrid, state.playerShips);
    state.placingIndex = SHIPS.length;
    renderAll();
    $('#phase-text').textContent = '✅ 舰队布置完成！点击「开始战斗」';
  });

  $('#start-btn').addEventListener('click', () => {
    if (state.placingIndex < SHIPS.length) {
      // Auto-place remaining
      randomPlace(state.playerGrid, state.playerShips);
      state.placingIndex = SHIPS.length;
    }
    state.phase = 'battle';
    state.turn = 'player';
    renderAll();
  });
}

// ---------- Battle ----------
function fireAt(grid, ships, r, c) {
  const v = grid[r][c];
  if (v === 'hit' || v === 'miss' || v === 'sunk') return null;
  if (v === 'ship') {
    grid[r][c] = 'hit';
    const ship = ships.find((s) => s.cells.some((cell) => cell.r === r && cell.c === c));
    if (ship) {
      ship.hits++;
      if (ship.hits >= ship.size) {
        ship.sunk = true;
        for (const cell of ship.cells) grid[cell.r][cell.c] = 'sunk';
        return 'sunk';
      }
    }
    return 'hit';
  }
  grid[r][c] = 'miss';
  return 'miss';
}

function allSunk(ships) {
  return ships.every((s) => s.sunk);
}

function playerFire(r, c) {
  if (state.phase !== 'battle' || state.turn !== 'player') return;
  const result = fireAt(state.enemyGrid, state.enemyShips, r, c);
  if (!result) return;
  if (result === 'hit') state.playerHits++;
  if (result === 'sunk') {
    state.playerHits++;
    state.enemySunk++;
  }
  renderAll();
  if (allSunk(state.enemyShips)) {
    endGame(true);
    return;
  }
  state.turn = 'enemy';
  renderAll();
  setTimeout(enemyTurn, 700);
}

function enemyTurn() {
  if (state.phase !== 'battle' || state.turn !== 'enemy') return;
  let r, c;
  // Smart targeting: if we have a pending target, try adjacent cells
  if (state.enemyTargets.length > 0) {
    const t = state.enemyTargets.shift();
    r = t.r; c = t.c;
  } else {
    // Random shot
    do {
      r = randInt(0, SIZE - 1);
      c = randInt(0, SIZE - 1);
    } while (state.playerGrid[r][c] === 'hit' || state.playerGrid[r][c] === 'miss' || state.playerGrid[r][c] === 'sunk');
  }
  const result = fireAt(state.playerGrid, state.playerShips, r, c);
  if (result === 'hit') {
    state.enemyHits++;
    // Add adjacent cells to targeting queue
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE &&
          state.playerGrid[nr][nc] !== 'hit' && state.playerGrid[nr][nc] !== 'miss' && state.playerGrid[nr][nc] !== 'sunk') {
        state.enemyTargets.push({ r: nr, c: nc });
      }
    }
  }
  if (result === 'sunk') {
    state.enemyHits++;
    state.playerSunk++;
    state.enemyTargets = [];
  }
  renderAll();
  if (allSunk(state.playerShips)) {
    endGame(false);
    return;
  }
  state.turn = 'player';
  renderAll();
}

function endGame(playerWon) {
  state.phase = 'over';
  if (playerWon) {
    burstConfetti();
    showModal('🎉 你赢了！', `你击沉了电脑的全部 5 艘舰船，只用了 ${state.playerHits} 次命中！`, '再来一局', restart);
  } else {
    showModal('💀 你输了…', `电脑击沉了你的全部舰队。再试一次，指挥官！`, '再来一局', restart);
  }
}

// ---------- Enemy board interaction ----------
function setupBattle() {
  $('#enemy-board').addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    playerFire(r, c);
  });
}

// ---------- Init ----------
function restart() {
  initState();
  randomPlace(state.enemyGrid, state.enemyShips);
  renderAll();
}

initGameFrame({
  title: '海战棋',
  emoji: '🚢',
  onRestart: restart
});

initState();
randomPlace(state.enemyGrid, state.enemyShips);
setupPlacement();
setupBattle();
renderAll();