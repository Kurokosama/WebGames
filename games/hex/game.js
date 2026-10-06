'use strict';

const N = 7;
const HUMAN = 1; // connects top -> bottom
const CPU = 2;   // connects left -> right
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, -1], [-1, 1]];

let diff = 'medium';
let board = [];
let cells = [];
let over = false;
let myMoves = 0;
let cpuMoves = 0;

const key = (r, c) => r + ',' + c;
const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const nbrs = (r, c) => DIRS.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => inB(nr, nc));

function emptyCells() {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] === 0) out.push([r, c]);
  return out;
}

/* BFS from the player's start edge; returns the winning chain of cells or null */
function findPath(player) {
  const start = [];
  for (let i = 0; i < N; i++) {
    if (player === HUMAN && board[0][i] === player) start.push([0, i]);
    if (player === CPU && board[i][0] === player) start.push([i, 0]);
  }
  const parent = new Map();
  start.forEach(([r, c]) => parent.set(key(r, c), null));
  const q = start.slice();
  while (q.length) {
    const [r, c] = q.shift();
    if (player === HUMAN ? r === N - 1 : c === N - 1) {
      const path = [];
      let cur = key(r, c);
      while (cur) { path.push(cur.split(',').map(Number)); cur = parent.get(cur); }
      return path;
    }
    for (const [nr, nc] of nbrs(r, c)) {
      const k = key(nr, nc);
      if (!parent.has(k) && board[nr][nc] === player) { parent.set(k, key(r, c)); q.push([nr, nc]); }
    }
  }
  return null;
}

function winsWith(r, c, player) {
  board[r][c] = player;
  const path = findPath(player);
  board[r][c] = 0;
  return path;
}

/* Connected groups of a player: labels, sizes, and which groups touch the start edge */
function groupInfo(player) {
  const label = Array.from({ length: N }, () => Array(N).fill(-1));
  const size = [];
  const startEdge = [];
  let id = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] !== player || label[r][c] !== -1) continue;
      const q = [[r, c]];
      label[r][c] = id;
      let n = 0;
      let touches = false;
      while (q.length) {
        const [cr, cc] = q.shift();
        n++;
        if (player === HUMAN ? cr === 0 : cc === 0) touches = true;
        for (const [nr, nc] of nbrs(cr, cc)) {
          if (board[nr][nc] === player && label[nr][nc] === -1) { label[nr][nc] = id; q.push([nr, nc]); }
        }
      }
      size.push(n);
      startEdge.push(touches);
      id++;
    }
  }
  return { label, size, startEdge };
}

function cellScore(r, c, player, own, oppInfo) {
  const opp = player === HUMAN ? CPU : HUMAN;
  let score = 0;
  const ownGroups = new Set();
  const oppGroups = new Set();
  for (const [nr, nc] of nbrs(r, c)) {
    if (board[nr][nc] === player) ownGroups.add(own.label[nr][nc]);
    else if (board[nr][nc] === opp) oppGroups.add(oppInfo.label[nr][nc]);
  }
  ownGroups.forEach((g) => { score += own.size[g] * 2 + (own.startEdge[g] ? 3 : 0); });
  if (ownGroups.size > 1) score += ownGroups.size * 5; // merging groups is powerful
  if (player === HUMAN ? r === 0 : c === 0) score += 3;
  if (player === HUMAN ? r === N - 1 : c === N - 1) score += 3;
  score += oppGroups.size * 2; // blocking the opponent
  score += (6 - Math.abs(r - 3) - Math.abs(c - 3)) * 0.4; // gentle pull toward the middle
  return score;
}

function aiMove() {
  const empty = emptyCells();
  if (!empty.length) return null;

  // 1. Take an immediate win.
  const winning = empty.filter(([r, c]) => winsWith(r, c, CPU));
  if (winning.length) return pick(winning);

  // 2. Block the player's immediate win.
  const threats = empty.filter(([r, c]) => winsWith(r, c, HUMAN));
  if (threats.length && diff !== 'easy') return pick(threats);

  // 3. Heuristic choice (easy = mostly random, hard = lookahead).
  const own = groupInfo(CPU);
  const oppInfo = groupInfo(HUMAN);
  let best = null;
  let bestScore = -Infinity;
  for (const [r, c] of empty) {
    let s = cellScore(r, c, CPU, own, oppInfo);
    if (diff === 'easy') s += Math.random() * 20;
    else if (diff === 'medium') s += Math.random() * 3;
    else {
      board[r][c] = CPU;
      const reply = emptyCells().some(([ar, ac]) => winsWith(ar, ac, HUMAN));
      if (reply) s -= 12; // do not leave the player a free win
      board[r][c] = 0;
    }
    if (s > bestScore) { bestScore = s; best = [r, c]; }
  }
  return best || pick(empty);
}

function buildBoard() {
  const boardEl = $('#hex-board');
  boardEl.innerHTML = '';
  cells = [];
  for (let r = 0; r < N; r++) {
    const row = document.createElement('div');
    row.className = 'hex-row';
    row.style.setProperty('--shift', r);
    const rowCells = [];
    for (let c = 0; c < N; c++) {
      const cell = document.createElement('button');
      cell.className = 'hex-cell';
      cell.type = 'button';
      cell.setAttribute('aria-label', 'Hex cell ' + (r + 1) + ',' + (c + 1));
      cell.addEventListener('click', () => playerMove(r, c));
      row.appendChild(cell);
      rowCells.push(cell);
    }
    cells.push(rowCells);
    boardEl.appendChild(row);
  }
}

function paint() {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const el = cells[r][c];
      el.classList.toggle('you', board[r][c] === HUMAN);
      el.classList.toggle('cpu', board[r][c] === CPU);
      el.classList.toggle('taken', board[r][c] !== 0);
    }
  }
  $('#you').textContent = myMoves;
  $('#computer').textContent = cpuMoves;
  const best = parseInt(localStorage.getItem('best-hex') || '0', 10);
  $('#best').textContent = best > 0 ? best : '—';
}

function playerMove(r, c) {
  if (over || board[r][c] !== 0) return;
  board[r][c] = HUMAN;
  myMoves++;
  paint();
  const path = findPath(HUMAN);
  if (path) return endGame('win', path);
  if (!emptyCells().length) return endGame('draw', null);
  $('#turn').textContent = 'Computer…';
  setTimeout(() => {
    const move = aiMove();
    if (!move) return;
    board[move[0]][move[1]] = CPU;
    cpuMoves++;
    paint();
    const cpuPath = findPath(CPU);
    if (cpuPath) return endGame('lose', cpuPath);
    if (!emptyCells().length) return endGame('draw', null);
    $('#turn').textContent = 'You';
  }, 350);
}

function endGame(result, path) {
  over = true;
  if (path) path.forEach(([r, c]) => cells[r][c].classList.add('winning'));
  if (result === 'win') {
    const best = parseInt(localStorage.getItem('best-hex') || '0', 10);
    const record = best === 0 || myMoves < best;
    if (record) localStorage.setItem('best-hex', String(myMoves));
    paint();
    $('#turn').textContent = 'You win!';
    burstConfetti();
    showModal('🎉 You Win!', record ? 'Amazing! You connected top to bottom in ' + myMoves + ' moves — a new record!' : 'You connected top to bottom in ' + myMoves + ' moves. Best: ' + best, 'Play Again', () => start(diff));
  } else if (result === 'lose') {
    $('#turn').textContent = 'Computer';
    showModal('🙂 Computer Wins!', 'The computer connected left to right. Try again — you can beat it!', 'Play Again', () => start(diff));
  } else {
    $('#turn').textContent = 'Draw';
    showModal('🤝 It’s a Draw!', 'The board is full and nobody built a full chain.', 'Play Again', () => start(diff));
  }
}

function start(d) {
  diff = d || diff;
  board = Array.from({ length: N }, () => Array(N).fill(0));
  over = false;
  myMoves = 0;
  cpuMoves = 0;
  hideModal();
  $('#turn').textContent = 'You';
  $$('.hex-cell').forEach((el) => el.classList.remove('winning'));
  paint();
}

buildBoard();

initGameFrame({
  title: 'Hex',
  emoji: '⬡',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'medium',
  onDifficulty: (d) => start(d),
  onRestart: () => start(diff)
});

start('medium');
