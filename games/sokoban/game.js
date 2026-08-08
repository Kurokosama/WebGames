'use strict';

const LEVELS = [
  [
    '######',
    '#    #',
    '#@$ .#',
    '#    #',
    '######'
  ],
  [
    '#######',
    '#     #',
    '# @$. #',
    '# $ . #',
    '#     #',
    '#######'
  ],
  [
    '#######',
    '#  .  #',
    '#  $  #',
    '# @   #',
    '#  $  #',
    '#  .  #',
    '#     #',
    '#######'
  ]
];

let state = null;

function parseLevel(idx) {
  const lines = LEVELS[idx];
  const terrain = [];
  const boxes = [];
  let player = null;
  for (let r = 0; r < lines.length; r++) {
    terrain.push([]);
    for (let c = 0; c < lines[r].length; c++) {
      const ch = lines[r][c];
      if (ch === '#') terrain[r].push('#');
      else if (ch === '.') terrain[r].push('.');
      else if (ch === ' ') terrain[r].push(' ');
      else if (ch === '@') { terrain[r].push(' '); player = { r, c }; }
      else if (ch === '+') { terrain[r].push('.'); player = { r, c }; }
      else if (ch === '$') { terrain[r].push(' '); boxes.push({ r, c }); }
      else if (ch === '*') { terrain[r].push('.'); boxes.push({ r, c }); }
    }
  }
  return { terrain, boxes, player };
}

function init(levelIdx) {
  state = {
    levelIdx,
    ...parseLevel(levelIdx),
    moves: 0,
    done: false
  };
  $('#level').textContent = `${levelIdx + 1}/${LEVELS.length}`;
  $('#moves').textContent = '0';
  render();
}

function boxAt(r, c) {
  return state.boxes.find((b) => b.r === r && b.c === c);
}

function isOnGoal(r, c) {
  return state.terrain[r][c] === '.';
}

function allDone() {
  return state.boxes.every((b) => isOnGoal(b.r, b.c));
}

function tryMove(dr, dc) {
  if (state.done) return;
  const p = state.player;
  const nr = p.r + dr;
  const nc = p.c + dc;
  if (state.terrain[nr][nc] === '#') return;

  const box = boxAt(nr, nc);
  if (box) {
    const br = nr + dr;
    const bc = nc + dc;
    if (state.terrain[br][bc] === '#' || boxAt(br, bc)) return; // can't push
    box.r = br;
    box.c = bc;
  }

  state.player = { r: nr, c: nc };
  state.moves++;
  $('#moves').textContent = state.moves;
  render();

  if (allDone()) {
    state.done = true;
    const lastLevel = state.levelIdx === LEVELS.length - 1;
    if (lastLevel) {
      burstConfetti();
      showModal('🏆 You Beat All Levels!', `You finished in ${state.moves} moves!`, 'Play Again', () => init(0));
    } else {
      showModal('🎉 Level Complete!', 'Great job! Ready for the next one?', 'Next Level', () => init(state.levelIdx + 1));
    }
  }
}

function render() {
  const board = $('#board');
  board.style.gridTemplateColumns = `repeat(${state.terrain[0].length}, 1fr)`;
  board.innerHTML = '';
  for (let r = 0; r < state.terrain.length; r++) {
    for (let c = 0; c < state.terrain[r].length; c++) {
      const tile = document.createElement('div');
      const t = state.terrain[r][c];
      const isPlayer = state.player.r === r && state.player.c === c;
      const box = boxAt(r, c);

      if (t === '#') tile.className = 'tile wall';
      else if (t === '.') tile.className = 'tile goal';
      else tile.className = 'tile floor';

      if (box) {
        if (isOnGoal(r, c)) { tile.className = 'tile boxgoal'; tile.textContent = '📦'; }
        else { tile.className = 'tile floor box'; tile.textContent = '📦'; }
      } else if (isPlayer) {
        tile.textContent = '🧍';
      }
      board.appendChild(tile);
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (!state) return;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); tryMove(-1, 0); }
  else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); tryMove(1, 0); }
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); tryMove(0, -1); }
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); tryMove(0, 1); }
});

initGameFrame({
  title: 'Sokoban',
  emoji: '📦',
  difficulties: [],
  onRestart: () => init(state.levelIdx)
});

init(0);
