'use strict';

const N = 9;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const NEI = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const MAX_MOVES = 60;
const KEY = 'best-go';

let board, turn, passes, moves, captured, koHash, lastHash, wins, over;

function bestKey() { return KEY; }

function reset() {
  board = Array.from({ length: N }, () => Array(N).fill(EMPTY));
  turn = BLACK;
  passes = 0;
  moves = 0;
  captured = 0;
  over = false;
  lastHash = '';
  koHash = '';
  wins = Number(localStorage.getItem(bestKey()) || 0);
  render();
}

function groupAt(b, r, c) {
  const color = b[r][c];
  const seen = new Set();
  const group = [];
  const stack = [[r, c]];
  let libs = 0;
  while (stack.length) {
    const [rr, cc] = stack.pop();
    const k = rr * N + cc;
    if (seen.has(k)) continue;
    seen.add(k);
    group.push([rr, cc]);
    NEI.forEach(([dr, dc]) => {
      const y = rr + dr, x = cc + dc;
      if (y < 0 || x < 0 || y >= N || x >= N) return;
      if (b[y][x] === EMPTY) libs++;
      else if (b[y][x] === color && !seen.has(y * N + x)) stack.push([y, x]);
    });
  }
  return { group, libs };
}

function hashOf(b) { return b.map((row) => row.join('')).join(''); }

function playMove(r, c, me) {
  if (b[r][c] !== EMPTY) return null;
  const b = board.map((row) => row.slice());
  b[r][c] = me;
  const opp = me === BLACK ? WHITE : BLACK;

  NEI.forEach(([dr, dc]) => {
    const y = r + dr, x = c + dc;
    if (y < 0 || x < 0 || y >= N || x >= N) return;
    if (b[y][x] !== opp) return;
    const { group, libs } = groupAt(b, y, x);
    if (libs === 0) group.forEach(([gy, gx]) => { b[gy][gx] = EMPTY; });
  });

  const { group, libs } = groupAt(b, r, c);
  if (libs === 0) return null; // suicide not allowed

  const next = hashOf(b);
  if (next === koHash) return null; // simple ko

  return next;
}

function moveIsLegal(r, c, me) {
  if (board[r][c] !== EMPTY) return false;
  const b = board.map((row) => row.slice());
  b[r][c] = me;
  const opp = me === BLACK ? WHITE : BLACK;
  NEI.forEach(([dr, dc]) => {
    const y = r + dr, x = c + dc;
    if (y < 0 || x < 0 || y >= N || x >= N) return;
    if (b[y][x] !== opp) return;
    const { group, libs } = groupAt(b, y, x);
    if (libs === 0) group.forEach(([gy, gx]) => { b[gy][gx] = EMPTY; });
  });
  const { libs } = groupAt(b, r, c);
  return libs > 0;
}

function applyMove(r, c, me) {
  const b = board.map((row) => row.slice());
  b[r][c] = me;
  const opp = me === BLACK ? WHITE : BLACK;
  let taken = 0;
  NEI.forEach(([dr, dc]) => {
    const y = r + dr, x = c + dc;
    if (y < 0 || x < 0 || y >= N || x >= N) return;
    if (b[y][x] !== opp) return;
    const { group, libs } = groupAt(b, y, x);
    if (libs === 0) {
      group.forEach(([gy, gx]) => { b[gy][gx] = EMPTY; });
      taken += group.length;
    }
  });
  koHash = lastHash;
  lastHash = hashOf(b);
  board = b;
  return taken;
}

function scoreArea() {
  const visited = Array.from({ length: N }, () => Array(N).fill(0));
  let black = 0, white = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] !== EMPTY) continue;
      // flood fill region
      const region = [];
      const stack = [[r, c]];
      const seen = new Set([r * N + c]);
      let touchesBlack = false, touchesWhite = false;
      while (stack.length) {
        const [rr, cc] = stack.pop();
        region.push([rr, cc]);
        if (board[rr][cc] === BLACK) touchesBlack = true;
        else if (board[rr][cc] === WHITE) touchesWhite = true;
        NEI.forEach(([dr, dc]) => {
          const y = rr + dr, x = cc + dc;
          if (y < 0 || x < 0 || y >= N || x >= N) return;
          if (seen.has(y * N + x)) return;
          seen.add(y * N + x);
          stack.push([y, x]);
        });
      }
      region.forEach(([rr, cc]) => { visited[rr][cc] = 1; });
      if (touchesBlack && !touchesWhite) black += region.length;
      else if (touchesWhite && !touchesBlack) white += region.length;
    }
  }
  board.forEach((row, r) => row.forEach((v, c) => {
    if (v === BLACK) black++;
    else if (v === WHITE) white++;
  }));
  return { black, white };
}

function endGame() {
  over = true;
  const { black, white } = scoreArea();
  const blackTotal = black + captured;
  const youWin = blackTotal >= white;
  if (youWin) { wins++; localStorage.setItem(bestKey(), String(wins)); burstConfetti(); }
  showModal(
    youWin ? '🎉 You Win!' : '😢 Computer Wins',
    `You ${blackTotal} : ${white} Computer`,
    'Play Again', reset
  );
}

function hasMove(me) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (moveIsLegal(r, c, me)) return true;
  return false;
}

function cpuTurn() {
  if (over) return;
  const opts = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (moveIsLegal(r, c, WHITE)) {
      // heuristic: prefer nearby stones and middle
      let s = 0;
      NEI.forEach(([dr, dc]) => {
        const y = r + dr, x = c + dc;
        if (y < 0 || x < 0 || y >= N || x >= N) return;
        if (board[y][x] !== EMPTY) s += 6;
      });
      if (board[r][c] === EMPTY) s += 2;
      s += (4 - (Math.abs(4 - r) + Math.abs(4 - c))) * 0.5;
      opts.push([r, c, s]);
    }
  }
  if (!opts.length) {
    passes = 0;
    turn = BLACK;
    afterMove();
    return;
  }
  opts.sort((a, b) => b[2] - a[2]);
  const top = opts.slice(0, Math.max(1, Math.ceil(opts.length * 0.25)));
  const [r, c] = pick(top);
  applyMove(r, c, WHITE);
  turn = BLACK;
  moves++;
  passes = 0;
  render();
  setTimeout(afterMove, 260);
}

function afterMove() {
  if (moves >= MAX_MOVES) { endGame(); return; }
  if (!hasMove(turn)) {
    passes++;
    turn = turn === BLACK ? WHITE : BLACK;
    if (passes >= 2) { endGame(); return; }
    if (turn === WHITE) { setTimeout(cpuTurn, 300); return; }
  } else {
    passes = 0;
    if (turn === WHITE) { setTimeout(cpuTurn, 260); return; }
  }
  render();
}

function render() {
  const el = $('#board');
  el.innerHTML = '';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] !== EMPTY) {
        const s = document.createElement('div');
        s.className = 'pt ' + (board[r][c] === BLACK ? 'black' : 'white');
        s.style.left = (5.55 + (c * 11.111)) + '%';
        s.style.top = (5.55 + (r * 11.111)) + '%';
        el.appendChild(s);
      }
    }
  }
  // star points
  [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]].forEach(([r, c]) => {
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = (5.55 + c * 11.111) + '%';
    m.style.top = (5.55 + r * 11.111) + '%';
    el.appendChild(m);
  });

  let stones = 0;
  board.forEach((row) => row.forEach((v) => { if (v === BLACK) stones++; }));
  $('#score-you').textContent = stones;
  $('#captured').textContent = captured;
  $('#turn').textContent = over ? '—' : (turn === BLACK ? 'You (⚫)' : 'Computer (⚪)');
  $('#best').textContent = wins;
}

$('#board').addEventListener('click', (e) => {
  if (over || turn !== BLACK) return;
  const rect = $('#board').getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  const c = Math.round((px - 0.0555) / 0.11111);
  const r = Math.round((py - 0.0555) / 0.11111);
  if (r < 0 || c < 0 || r >= N || c >= N) return;
  if (!moveIsLegal(r, c, BLACK)) return;
  captured += applyMove(r, c, BLACK);
  turn = WHITE;
  moves++;
  passes = 0;
  render();
  afterMove();
});

$('#pass-btn').addEventListener('click', () => {
  if (over || turn !== BLACK) return;
  turn = WHITE;
  passes++;
  render();
  afterMove();
});

initGameFrame({
  title: 'Go (9x9)',
  emoji: '⚪',
  onRestart: reset
});

reset();