/* 推箱子经典版 Sokoban Classic */
'use strict';

initGameFrame({
  title: '推箱子经典版',
  emoji: '📦',
  onRestart: () => loadLevel(currentLevel)
});

// Sokoban levels (classic)
const LEVELS = [
  // Level 1
  [
    "########",
    "#      #",
    "#  .   #",
    "#  $   #",
    "#  @   #",
    "#      #",
    "########"
  ],
  // Level 2
  [
    "########",
    "#      #",
    "# .$   #",
    "#  @   #",
    "#      #",
    "#      #",
    "########"
  ],
  // Level 3
  [
    "#########",
    "#       #",
    "#  . .  #",
    "#  $ $  #",
    "#   @   #",
    "#       #",
    "#########"
  ],
  // Level 4
  [
    "##########",
    "#        #",
    "#  ##    #",
    "#  $@    #",
    "#  $ .   #",
    "#  ##    #",
    "#        #",
    "##########"
  ],
  // Level 5
  [
    "##########",
    "#        #",
    "#  . .   #",
    "#  $ $   #",
    "#   @    #",
    "#  $ $   #",
    "#  . .   #",
    "#        #",
    "##########"
  ],
  // Level 6
  [
    "##########",
    "#   ##   #",
    "#   ..   #",
    "#   $$   #",
    "#    @   #",
    "#   $$   #",
    "#   ..   #",
    "#   ##   #",
    "##########"
  ],
  // Level 7
  [
    "##########",
    "#        #",
    "#  . . . #",
    "#  $ $ $ #",
    "#    @   #",
    "#  $ $ $ #",
    "#  . . . #",
    "#        #",
    "##########"
  ],
  // Level 8
  [
    "##########",
    "#   ##   #",
    "#  #..#  #",
    "#  #$$#  #",
    "#   @@   #",
    "#  #$$#  #",
    "#  #..#  #",
    "#   ##   #",
    "##########"
  ],
  // Level 9
  [
    "##########",
    "#        #",
    "#  . . . #",
    "#  $ $ $ #",
    "#   @    #",
    "#  $ $ $ #",
    "#  . . . #",
    "#        #",
    "##########"
  ],
  // Level 10
  [
    "##########",
    "#   ##   #",
    "#  #..#  #",
    "#  #$$#  #",
    "#   @@   #",
    "#  #$$#  #",
    "#  #..#  #",
    "#   ##   #",
    "##########"
  ]
];

let currentLevel = 0;
let grid = [];
let player = { r: 0, c: 0 };
let targets = [];
let boxes = [];
let moves = 0;
let history = [];

function loadLevel(idx) {
  currentLevel = idx;
  const level = LEVELS[idx];
  grid = [];
  targets = [];
  boxes = [];
  moves = 0;
  history = [];
  for (let r = 0; r < level.length; r++) {
    grid[r] = [];
    for (let c = 0; c < level[r].length; c++) {
      const ch = level[r][c];
      if (ch === '#') grid[r][c] = 'wall';
      else if (ch === '.') { grid[r][c] = 'target'; targets.push({ r, c }); }
      else if (ch === '$') { grid[r][c] = 'floor'; boxes.push({ r, c }); }
      else if (ch === '@') { grid[r][c] = 'floor'; player = { r, c }; }
      else grid[r][c] = 'floor';
    }
  }
  updateStatus();
  render();
  hideModal();
}

function updateStatus() {
  $('#level').textContent = currentLevel + 1;
  $('#moves').textContent = moves;
  const onTarget = boxes.filter(b => targets.some(t => t.r === b.r && t.c === b.c)).length;
  $('#boxes').textContent = onTarget + '/' + targets.length;
}

function render() {
  const board = $('#board');
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${grid[0].length}, 40px)`;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      const isTarget = targets.some(t => t.r === r && t.c === c);
      const box = boxes.find(b => b.r === r && b.c === c);
      const isPlayer = player.r === r && player.c === c;

      if (grid[r][c] === 'wall') {
        tile.classList.add('wall');
        tile.textContent = '🧱';
      } else if (isPlayer) {
        tile.classList.add(isTarget ? 'player-on-target' : 'player');
        tile.textContent = '🧑';
      } else if (box) {
        tile.classList.add(isTarget ? 'box-on-target' : 'box');
        tile.textContent = '📦';
      } else if (isTarget) {
        tile.classList.add('target');
        tile.textContent = '⭐';
      } else {
        tile.classList.add('floor');
      }
      board.appendChild(tile);
    }
  }
}

function movePlayer(dr, dc) {
  const nr = player.r + dr, nc = player.c + dc;
  if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) return;
  if (grid[nr][nc] === 'wall') return;

  const box = boxes.find(b => b.r === nr && b.c === nc);
  if (box) {
    const br = nr + dr, bc = nc + dc;
    if (br < 0 || bc < 0 || br >= grid.length || bc >= grid[0].length) return;
    if (grid[br][bc] === 'wall') return;
    if (boxes.some(b => b.r === br && b.c === bc)) return;
    // Save history
    history.push({ player: { ...player }, boxes: boxes.map(b => ({ ...b })) });
    box.r = br; box.c = bc;
    player.r = nr; player.c = nc;
    moves++;
  } else {
    history.push({ player: { ...player }, boxes: boxes.map(b => ({ ...b })) });
    player.r = nr; player.c = nc;
    moves++;
  }
  updateStatus();
  render();
  checkWin();
}

function undo() {
  if (history.length === 0) return;
  const state = history.pop();
  player = state.player;
  boxes = state.boxes;
  moves--;
  updateStatus();
  render();
}

function checkWin() {
  const allOnTarget = boxes.every(b => targets.some(t => t.r === b.r && t.c === b.c));
  if (allOnTarget) {
    if (currentLevel < LEVELS.length - 1) {
      showModal('🎉 过关！', '用了 ' + moves + ' 步', '下一关', () => loadLevel(currentLevel + 1));
    } else {
      burstConfetti();
      showModal('🏆 全部通关！', '你完成了所有关卡！', '重新开始', () => loadLevel(0));
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') { movePlayer(-1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowDown' || e.key === 's') { movePlayer(1, 0); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'a') { movePlayer(0, -1); e.preventDefault(); }
  else if (e.key === 'ArrowRight' || e.key === 'd') { movePlayer(0, 1); e.preventDefault(); }
  else if (e.key === 'r' || e.key === 'R') { loadLevel(currentLevel); }
  else if (e.key === 'u' || e.key === 'U') { undo(); }
});

loadLevel(0);