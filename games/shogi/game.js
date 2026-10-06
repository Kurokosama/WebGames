'use strict';

const N = 9;
const YOU = 'y', THEM = 't';
const KANJI = { K: '\u7389', G: '\u91d1', S: '\u9280', N: '\u6842', L: '\u9999', P: '\u52c4', R: '\u99ac', B: '\u89d2' };
const KEY = 'best-shogi';

let board, turn, captured, yourCap, theirCap, selected, wins, gameOver;

function reset() {
  board = Array.from({ length: N }, () => Array(N).fill(null));
  // Black (player) at the bottom, rows 6-8; White (computer) at the top.
  board[8][4] = { t: 'K', you: true };
  board[8][0] = { t: 'L', you: true }; board[8][8] = { t: 'L', you: true };
  board[8][1] = { t: 'N', you: true }; board[8][7] = { t: 'N', you: true };
  board[8][2] = { t: 'S', you: true }; board[8][6] = { t: 'S', you: true };
  board[8][3] = { t: 'G', you: true }; board[8][5] = { t: 'G', you: true };
  for (let c = 0; c < N; c++) board[6][c] = { t: 'P', you: true };

  board[0][4] = { t: 'K', you: false };
  board[0][0] = { t: 'L', you: false }; board[0][8] = { t: 'L', you: false };
  board[0][1] = { t: 'N', you: false }; board[0][7] = { t: 'N', you: false };
  board[0][2] = { t: 'S', you: false }; board[0][6] = { t: 'S', you: false };
  board[0][3] = { t: 'G', you: false }; board[0][5] = { t: 'G', you: false };
  for (let c = 0; c < N; c++) board[2][c] = { t: 'P', you: false };

  turn = 'you';
  captured = 0; yourCap = 0; theirCap = 0;
  selected = null;
  wins = Number(localStorage.getItem(KEY) || 0);
  gameOver = false;
  render();
}

const fwd = (you) => (you ? -1 : 1);   // row delta toward the enemy

// Returns array of [r,c] squares the piece can move to.
function movesFor(r, c, piece) {
  const f = fwd(piece.you);
  const out = [];
  const push = (rr, cc) => { if (rr >= 0 && cc >= 0 && rr < N && cc < N) out.push([rr, cc]); };
  const isGold = piece.t === 'K' || piece.t === 'G';
  const promoted = piece.t + 'P';   // tokin markers use '+'

  switch (piece.t) {
    case 'K':
      [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,b]) => push(r+f+a, c+b));
      break;
    case 'G':
      [[0,0],[-1,0],[1,0],[0,-1],[0,1],[f,-1],[f,1]].forEach(([a,b]) => push(r+a, c+b));
      break;
    case 'S':
      [[0,0],[-1,0],[1,0],[f,-1],[f,1]].forEach(([a,b]) => push(r+a, c+b));
      break;
    case 'N':
      push(r + 2*f, c - 1); push(r + 2*f, c + 1);
      break;
    case 'L':
      for (let i = 1; i < N; i++) { const rr = r + i*f; if (rr < 0 || rr >= N) break; out.push([rr, c]); }
      break;
    case 'P':
      push(r + f, c);
      break;
    case 'R':
      for (let i = 1; i < N; i++) { const cc = c + i; if (cc >= N) break; out.push([r, cc]); }
      for (let i = 1; i < N; i++) { const cc = c - i; if (cc < 0) break; out.push([r, cc]); }
      for (let i = 1; i < N; i++) { const rr = r + i*f; if (rr < 0 || rr >= N) break; out.push([rr, c]); }
      for (let i = 1; i < N; i++) { const rr = r - i*f; if (rr < 0 || rr >= N) break; out.push([rr, c]); }
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,b]) => push(r+a, c+b));
      break;
    default: break;
  }
  return out;
}

function canPromote(r, piece) {
  if (piece.you && r <= 2) return true;
  if (!piece.you && r >= N - 3) return true;
  return false;
}

function legalTargets(r, c) {
  const p = board[r][c];
  if (!p) return [];
  return movesFor(r, c, p).filter(([rr, cc]) => {
    const t = board[rr][cc];
    return !t || t.you !== p.you;
  });
}

function render() {
  const el = $('#board');
  el.innerHTML = '';
  const legal = selected ? legalTargets(selected[0], selected[1]) : [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq';
      if (selected && selected[0] === r && selected[1] === c) sq.classList.add('sel');
      if (legal.some(([lr, lc]) => lr === r && lc === c)) sq.classList.add('legal');
      const p = board[r][c];
      if (p) {
        const d = document.createElement('div');
        d.className = 'pc ' + (p.you ? 'yours' : 'theirs') + (p.t === 'K' && p.you ? ' red' : '');
        d.textContent = (p.promoted ? '\u30f4' : '') + KANJI[p.t] + (p.promoted ? '' : '');
        sq.appendChild(d);
      }
      sq.addEventListener('click', () => onSquare(r, c));
      el.appendChild(sq);
    }
  }
  $('#you-cap').textContent = yourCap;
  $('#cpu-cap').textContent = theirCap;
  $('#turn').textContent = gameOver ? '—' : (turn === 'you' ? 'You (\u7389)' : 'Computer');
  $('#best').textContent = wins;
}

function onSquare(r, c) {
  if (gameOver || turn !== 'you') return;
  const p = board[r][c];

  if (selected) {
    const [sr, sc] = selected;
    const target = legalTargets(sr, sc);
    if (target.some(([lr, lc]) => lr === r && lc === c)) {
      movePiece(sr, sc, r, c);
      selected = null;
      turn = 'computer';
      render();
      setTimeout(computerAct, 380);
      return;
    }
    selected = null;
    render();
  }

  if (p && p.you) {
    selected = [r, c];
    render();
  }
}

function movePiece(sr, sc, tr, tc) {
  const piece = board[sr][sc];
  const victim = board[tr][tc];
  if (victim) {
    // capture
    piece.t = 'G'; piece.promoted = false;    // anything captured drops to gold-grade power
    if (piece.you) yourCap++; else theirCap++;
  }
  board[tr][tc] = piece;
  board[sr][sc] = null;
  // auto-promote pawns/lances/knights that reach the last rank
  const f = fwd(piece.you);
  if ((piece.t === 'P' || piece.t === 'L' || (piece.t === 'N' && piece.you && tr === 0) ||
       (piece.t === 'N' && !piece.you && tr === N - 1)) && (piece.you ? tr === 0 : tr === N - 1)) {
    piece.promoted = true;
  }
  checkKingTaken();
}

function checkKingTaken() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const p = board[r][c];
    if (!p) continue;
    if (p.t === 'K') return;
  }
  // a king is missing -> the side that lost it loses
  const youKingExists = board.some((row) => row.some((p) => p && p.t === 'K' && p.you));
  gameOver = true;
  if (youKingExists) {
    wins++; localStorage.setItem(KEY, String(wins)); burstConfetti();
    showModal('\uD83C\uDF89 Checkmate!', 'You won by capturing the enemy king.', 'Play Again', reset);
  } else {
    showModal('\uD83D\uDE22 Your King Fell', 'The computer captured your king.', 'Play Again', reset);
  }
}

function computerAct() {
  if (gameOver) return;
  let bestMove = null, bestScore = -1e9;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = board[r][c];
      if (!p || p.you) continue;
      const targets = legalTargets(r, c);
      targets.forEach(([tr, tc]) => {
        let s = Math.random() * 4;
        const victim = board[tr][tc];
        if (victim && victim.you) s += 50;                       // capture
        if (victim && victim.t === 'K') s += 500;
        if (p.t === 'P' && tr === N - 1) s += 8;                 // push toward your king
        if (r + fwd(false) === tr) s += 4;
        if (s > bestScore) { bestScore = s; bestMove = [r, c, tr, tc]; }
      });
    }
  }
  if (bestMove) movePiece(bestMove[0], bestMove[1], bestMove[2], bestMove[3]);
  turn = 'you';
  render();
}

initGameFrame({ title: 'Shogi (Mini)', emoji: '\uD83C\uDF0C', onRestart: reset });

reset();
