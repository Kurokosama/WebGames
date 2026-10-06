'use strict';

const N = 8;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const KEY = 'best-othello';

let board, turn, over, legalFor, lastMove, wins;

function bestKey() { return KEY; }

function reset() {
  board = Array.from({ length: N }, () => Array(N).fill(EMPTY));
  board[3][3] = BLACK; board[3][4] = WHITE;
  board[4][3] = WHITE; board[4][4] = BLACK;
  turn = BLACK;
  over = false;
  lastMove = null;
  wins = Number(localStorage.getItem(bestKey()) || 0);
  render();
  cpuTurn();
}

function inside(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

function flipsFor(r, c, me) {
  if (!inside(r, c) || board[r][c] !== EMPTY) return [];
  const out = [];
  DIRS.forEach(([dr, dc]) => {
    const line = [];
    let rr = r + dr, cc = c + dc;
    while (inside(rr, cc) && board[rr][cc] === (me === BLACK ? WHITE : BLACK)) {
      line.push([rr, cc]);
      rr += dr; cc += dc;
    }
    if (line.length && inside(rr, cc) && board[rr][cc] === me) out.push(...line);
  });
  return out;
}

function legalMoves(me) {
  const moves = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] === EMPTY && flipsFor(r, c, me).length) moves.push([r, c]);
    }
  }
  return moves;
}

function play(r, c, me) {
  const flips = flipsFor(r, c, me);
  if (!flips.length) return false;
  board[r][c] = me;
  flips.forEach(([rr, cc]) => { board[rr][cc] = me; });
  lastMove = [r, c];
  return true;
}

function score() {
  let b = 0, w = 0;
  board.forEach((row) => row.forEach((v) => { if (v === BLACK) b++; if (v === WHITE) w++; }));
  return { b, w };
}

function finishIfDone() {
  const me = legalMoves(turn).length > 0;
  const opp = legalMoves(turn === BLACK ? WHITE : BLACK).length > 0;
  if (!me && !opp) {
    over = true;
    const s = score();
    let title, text;
    if (s.b > s.w) { title = '🎉 You Win!'; burstConfetti(); wins++; localStorage.setItem(bestKey(), String(wins)); }
    else if (s.w > s.b) { title = '😢 Computer Wins'; }
    else { title = '🤝 It’s a Tie!'; }
    text = `You ${s.b} : ${s.w} Computer`;
    setTimeout(() => showModal(title, text, 'Play Again', reset), 600);
  } else if (!me) {
    turn = turn === BLACK ? WHITE : BLACK;
    setTimeout(cpuTurn, 420);
  } else {
    setTimeout(cpuTurn, 420);
  }
}

// --- Computer AI: corners > edges, avoid X-squares, maximise flips ---
const isCorner = (r, c) => (r === 0 || r === N - 1) && (c === 0 || c === N - 1);
const isXSquare = (r, c) =>
  ((r === 3 || r === 4) && (c === 2 || c === 5)) ||
  ((c === 3 || c === 4) && (r === 2 || r === 5));

function cpuTurn() {
  if (over) return;
  if (turn !== WHITE) return;
  const moves = legalMoves(WHITE);
  if (!moves.length) { turn = BLACK; render(); finishIfDone(); return; }

  let best = moves[0], bestScore = -Infinity;
  moves.forEach(([r, c]) => {
    const f = flipsFor(r, c, WHITE);
    let s = f.length * 10;
    if (isCorner(r, c)) s += 90;
    else if (r === 0 || r === N - 1 || c === 0 || c === N - 1) s += 22;
    else if (isXSquare(r, c)) s -= 70;
    // mobility after the move
    const sim = board.map((row) => row.slice());
    sim[r][c] = WHITE;
    f.forEach(([rr, cc]) => { sim[rr][cc] = WHITE; });
    let mob = 0;
    for (let rr = 0; rr < N; rr++) {
      for (let cc = 0; cc < N; cc++) {
        if (sim[rr][cc] === EMPTY) {
          DIRS.forEach(([dr, dc]) => {
            const line = [];
            let y = rr + dr, x = cc + dc;
            while (inside(y, x) && sim[y][x] === BLACK) { line.push(1); y += dr; x += dc; }
            if (line.length && inside(y, x) && sim[y][x] === WHITE) mob++;
          });
        }
      }
    }
    s += mob * 3;
    if (s > bestScore) { bestScore = s; best = [r, c]; }
  });

  play(best[0], best[1], WHITE);
  turn = BLACK;
  render();
  finishIfDone();
}

function render() {
  const el = $('#board');
  el.innerHTML = '';
  const legal = over ? [] : legalMoves(turn);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (legal.some(([lr, lc]) => lr === r && lc === c)) cell.classList.add('legal');
      if (lastMove && lastMove[0] === r && lastMove[1] === c) cell.classList.add('last');
      if (board[r][c] !== EMPTY) {
        const s = document.createElement('div');
        s.className = 'stone ' + (board[r][c] === BLACK ? 'black' : 'white');
        cell.appendChild(s);
      } else if (turn === BLACK && !over && legal.some(([lr, lc]) => lr === r && lc === c)) {
        cell.addEventListener('click', () => {
          if (over || turn !== BLACK) return;
          play(r, c, BLACK);
          turn = WHITE;
          render();
          finishIfDone();
        });
      }
      el.appendChild(cell);
    }
  }
  const s = score();
  $('#score-you').textContent = s.b;
  $('#score-cpu').textContent = s.w;
  $('#turn').textContent = over ? '—' : (turn === BLACK ? 'You' : 'Computer');
  $('#best').textContent = wins;
}

initGameFrame({
  title: 'Othello',
  emoji: '⚫',
  onRestart: reset
});

reset();