'use strict';

const PIECES = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

let state = null;
let sessionScore = { player: 0, computer: 0 };

function colorOf(p) { return p && p === p.toUpperCase() ? 'w' : 'b'; }
function typeOf(p) { return p ? p.toLowerCase() : null; }
function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function freshBoard() {
  return [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ];
}

function findKing(board, color) {
  const k = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === k) return { r, c };
  return null;
}

function isAttacked(board, r, c, byColor) {
  // Look backwards from the target square to the attacking pawn. White pawns
  // move toward smaller row indexes, so a white attacker sits one row below.
  const dir = byColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const rr = r + dir, cc = c + dc;
    if (inB(rr, cc)) { const p = board[rr][cc]; if (p && typeOf(p) === 'p' && colorOf(p) === byColor) return true; }
  }
  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) { const p = board[rr][cc]; if (p && typeOf(p) === 'n' && colorOf(p) === byColor) return true; }
  }
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const rr = r + dr, cc = c + dc;
    if (inB(rr, cc)) { const p = board[rr][cc]; if (p && typeOf(p) === 'k' && colorOf(p) === byColor) return true; }
  }
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = board[rr][cc];
      if (p) { if (colorOf(p) === byColor && (typeOf(p) === 'r' || typeOf(p) === 'q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      const p = board[rr][cc];
      if (p) { if (colorOf(p) === byColor && (typeOf(p) === 'b' || typeOf(p) === 'q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

function inCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return true;
  return isAttacked(board, king.r, king.c, color === 'w' ? 'b' : 'w');
}

function applyMove(board, from, to, castling, enPassant) {
  const nb = board.map((row) => row.slice());
  const piece = nb[from.r][from.c];
  nb[from.r][from.c] = null;
  let captured = nb[to.r][to.c];
  let newEP = null;
  if (typeOf(piece) === 'p' && to.c !== from.c && !captured) {
    captured = nb[from.r][to.c];
    nb[from.r][to.c] = null;
  }
  if (typeOf(piece) === 'p' && Math.abs(to.r - from.r) === 2) {
    newEP = { r: (from.r + to.r) / 2, c: from.c };
  }
  const newCastling = { ...castling };
  if (typeOf(piece) === 'k') {
    if (colorOf(piece) === 'w') { newCastling.K = false; newCastling.Q = false; }
    else { newCastling.k = false; newCastling.q = false; }
    if (to.c - from.c === 2) { nb[to.r][to.c - 1] = nb[to.r][7]; nb[to.r][7] = null; }
    else if (to.c - from.c === -2) { nb[to.r][to.c + 1] = nb[to.r][0]; nb[to.r][0] = null; }
  }
  if (piece === 'R' && from.r === 7 && from.c === 7) newCastling.K = false;
  if (piece === 'R' && from.r === 7 && from.c === 0) newCastling.Q = false;
  if (piece === 'r' && from.r === 0 && from.c === 7) newCastling.k = false;
  if (piece === 'r' && from.r === 0 && from.c === 0) newCastling.q = false;
  // Capturing an unmoved rook on its home square also removes that side's
  // castling right. This must be based on the captured square, not the mover.
  if (to.r === 7 && to.c === 7 && captured === 'R') newCastling.K = false;
  if (to.r === 7 && to.c === 0 && captured === 'R') newCastling.Q = false;
  if (to.r === 0 && to.c === 7 && captured === 'r') newCastling.k = false;
  if (to.r === 0 && to.c === 0 && captured === 'r') newCastling.q = false;
  if (typeOf(piece) === 'p' && (to.r === 0 || to.r === 7)) {
    nb[to.r][to.c] = colorOf(piece) === 'w' ? 'Q' : 'q';
  } else {
    nb[to.r][to.c] = piece;
  }
  return { board: nb, captured, enPassant: newEP, castling: newCastling };
}

function pseudoMoves(board, r, c, castling, enPassant) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = colorOf(piece);
  const type = typeOf(piece);
  const moves = [];
  const add = (tr, tc) => {
    if (inB(tr, tc)) {
      const t = board[tr][tc];
      if (!t || colorOf(t) !== color) moves.push({ r: tr, c: tc });
    }
  };
  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const start = color === 'w' ? 6 : 1;
    if (inB(r + dir, c) && !board[r + dir][c]) {
      add(r + dir, c);
      if (r === start && !board[r + 2 * dir][c]) add(r + 2 * dir, c);
    }
    for (const dc of [-1, 1]) {
      const tr = r + dir, tc = c + dc;
      if (inB(tr, tc)) {
        const t = board[tr][tc];
        if (t && colorOf(t) !== color) add(tr, tc);
        else if (enPassant && enPassant.r === tr && enPassant.c === tc) moves.push({ r: tr, c: tc, ep: true });
      }
    }
  } else if (type === 'n') {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) add(r + dr, c + dc);
  } else if (type === 'b' || type === 'q') {
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc)) { const t = board[rr][cc]; if (!t) { add(rr, cc); } else { if (colorOf(t) !== color) add(rr, cc); break; } rr += dr; cc += dc; }
    }
  }
  if (type === 'r' || type === 'q') {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let rr = r + dr, cc = c + dc;
      while (inB(rr, cc)) { const t = board[rr][cc]; if (!t) { add(rr, cc); } else { if (colorOf(t) !== color) add(rr, cc); break; } rr += dr; cc += dc; }
    }
  }
  if (type === 'k') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
    const row = color === 'w' ? 7 : 0;
    if (r === row && c === 4) {
      const enemy = color === 'w' ? 'b' : 'w';
      const canK = color === 'w' ? castling.K : castling.k;
      const canQ = color === 'w' ? castling.Q : castling.q;
      if (canK && !board[row][5] && !board[row][6] && board[row][7] && typeOf(board[row][7]) === 'r' && colorOf(board[row][7]) === color &&
          !isAttacked(board, row, 4, enemy) && !isAttacked(board, row, 5, enemy) && !isAttacked(board, row, 6, enemy)) {
        moves.push({ r: row, c: 6, castle: 'K' });
      }
      if (canQ && !board[row][3] && !board[row][2] && !board[row][1] && board[row][0] && typeOf(board[row][0]) === 'r' && colorOf(board[row][0]) === color &&
          !isAttacked(board, row, 4, enemy) && !isAttacked(board, row, 3, enemy) && !isAttacked(board, row, 2, enemy)) {
        moves.push({ r: row, c: 2, castle: 'Q' });
      }
    }
  }
  return moves;
}

function legalMoves(board, color, castling, enPassant) {
  const res = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && colorOf(p) === color) {
        for (const m of pseudoMoves(board, r, c, castling, enPassant)) {
          const resState = applyMove(board, { r, c }, m, castling, enPassant);
          if (!inCheck(resState.board, color)) {
            res.push({ from: { r, c }, to: { r: m.r, c: m.c }, captured: resState.captured, castle: m.castle });
          }
        }
      }
    }
  }
  return res;
}

function init(diff, mode) {
  clearTimeout(state ? state.aiTimer : null);
  state = {
    diff,
    mode: mode || 'ai',
    board: freshBoard(),
    turn: 'w',
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null,
    selected: null,
    legal: [],
    lastMove: null,
    over: false,
    aiTimer: null
  };
  $('#turn').textContent = 'White';
  $('#check').textContent = '—';
  $('#player').textContent = sessionScore.player;
  $('#computer').textContent = sessionScore.computer;
  render();
  updateModeButtons();
}

function setMode(mode) {
  clearTimeout(state.aiTimer);
  init(state.diff, mode);
}

function updateModeButtons() {
  $('#mode-ai').classList.toggle('active', state.mode === 'ai');
  $('#mode-2p').classList.toggle('active', state.mode === '2p');
}

function clickSquare(r, c) {
  if (state.over) return;
  if (state.mode === 'ai' && state.turn === 'b') return;
  const piece = state.board[r][c];

  // if a piece is selected and this square is a legal target → move
  if (state.selected) {
    const move = state.legal.find((m) => m.to.r === r && m.to.c === c);
    if (move) {
      doMove(move);
      return;
    }
    // reselect if clicking own piece
    if (piece && colorOf(piece) === state.turn) {
      selectPiece(r, c);
      return;
    }
    state.selected = null;
    state.legal = [];
    render();
    return;
  }
  // select own piece
  if (piece && colorOf(piece) === state.turn) {
    selectPiece(r, c);
  }
}

function selectPiece(r, c) {
  state.selected = { r, c };
  const pieceMoves = [];
  for (const m of pseudoMoves(state.board, r, c, state.castling, state.enPassant)) {
    const resState = applyMove(state.board, { r, c }, m, state.castling, state.enPassant);
    if (!inCheck(resState.board, state.turn)) {
      pieceMoves.push({ from: { r, c }, to: { r: m.r, c: m.c }, captured: resState.captured, castle: m.castle });
    }
  }
  state.legal = pieceMoves;
  render();
}

function doMove(move) {
  const resState = applyMove(state.board, move.from, move.to, state.castling, state.enPassant);
  state.board = resState.board;
  state.castling = resState.castling;
  state.enPassant = resState.enPassant;
  state.lastMove = { from: move.from, to: move.to };
  state.selected = null;
  state.legal = [];
  state.turn = state.turn === 'w' ? 'b' : 'w';
  render();
  afterMove();
}

function afterMove() {
  const color = state.turn;
  const moves = legalMoves(state.board, color, state.castling, state.enPassant);
  const check = inCheck(state.board, color);
  $('#check').textContent = check ? '⚠️ Yes!' : '—';

  if (moves.length === 0) {
    endGame(check ? 'checkmate' : 'stalemate');
    return;
  }
  $('#turn').textContent = color === 'w' ? 'White' : 'Black';

  if (state.mode === 'ai' && color === 'b') {
    state.aiTimer = setTimeout(() => {
      const aiMove = pickAiMove(moves);
      doMove(aiMove);
    }, 500);
  }
}

function pickAiMove(moves) {
  if (state.diff === 'easy') return pick(moves);
  // prefer: checkmate > capture by value > random-ish
  const scored = moves.map((m) => {
    let score = 0;
    if (m.captured) score += VALUE[typeOf(m.captured)] * 10;
    const resState = applyMove(state.board, m.from, m.to, state.castling, state.enPassant);
    const opp = state.turn === 'w' ? 'b' : 'w';
    const oppMoves = legalMoves(resState.board, opp, resState.castling, resState.enPassant);
    if (oppMoves.length === 0 && inCheck(resState.board, opp)) score += 100000;
    if (m.castle) score += 30;
    if (state.diff === 'hard') {
      // avoid leaving own pieces hanging: penalty if the moved piece can be captured
      const val = VALUE[typeOf(state.board[m.from.r][m.from.c])];
      const res2 = applyMove(state.board, m.from, m.to, state.castling, state.enPassant);
      if (val > 1 && isAttacked(res2.board, m.to.r, m.to.c, opp)) score -= val * 2;
    }
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // pick among top few with randomness for variety
  const top = scored.slice(0, Math.min(3, scored.length));
  return pick(top).m;
}

function endGame(kind) {
  state.over = true;
  const winner = state.turn === 'w' ? 'Black' : 'White';
  let title, text;
  if (kind === 'checkmate') {
    title = `🏆 Checkmate!`;
    text = `${winner} wins the game!`;
    if (state.mode === 'ai') {
      if (winner === 'White') { sessionScore.player++; $('#player').textContent = sessionScore.player; burstConfetti(); }
      else { sessionScore.computer++; $('#computer').textContent = sessionScore.computer; }
    } else if (winner === 'White') {
      burstConfetti();
    }
  } else {
    title = '🤝 Stalemate!';
    text = 'Nobody can move — it’s a draw.';
  }
  showModal(title, text, 'Play Again', () => init(state.diff, state.mode));
}

function render() {
  const board = $('#board');
  board.innerHTML = '';
  const king = findKing(state.board, state.turn);
  const inCheckNow = king ? isAttacked(state.board, king.r, king.c, state.turn === 'w' ? 'b' : 'w') : false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('button');
      const light = (r + c) % 2 === 0;
      sq.className = 'square ' + (light ? 'light' : 'dark');
      const p = state.board[r][c];
      if (p) sq.textContent = PIECES[colorOf(p) + typeOf(p).toUpperCase()];
      if (state.selected && state.selected.r === r && state.selected.c === c) sq.classList.add('selected');
      if (state.lastMove && ((state.lastMove.from.r === r && state.lastMove.from.c === c) || (state.lastMove.to.r === r && state.lastMove.to.c === c))) {
        sq.classList.add('last-move');
      }
      if (king && king.r === r && king.c === c && inCheckNow) sq.classList.add('in-check');
      const legalTarget = state.legal.find((m) => m.to.r === r && m.to.c === c);
      if (legalTarget) {
        sq.classList.add('legal');
        if (legalTarget.captured) sq.classList.add('capture');
      }
      sq.addEventListener('click', () => clickSquare(r, c));
      board.appendChild(sq);
    }
  }
}

initGameFrame({
  title: 'Chess',
  emoji: '♟️',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'medium',
  onDifficulty: (d) => init(d, state.mode),
  onRestart: () => init(state.diff, state.mode)
});

init('medium', 'ai');
