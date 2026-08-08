'use strict';

const BOX_ROWS = 4;
const BOX_COLS = 4;

let state = null;
let score = { you: 0, computer: 0 };

function init(diff) {
  // edges: h[i][j] i in 0..ROWS, j in 0..COLS-1 ; v[i][j] i in 0..ROWS-1, j in 0..COLS
  state = {
    diff,
    h: Array.from({ length: BOX_ROWS + 1 }, () => Array(BOX_COLS).fill(0)),
    v: Array.from({ length: BOX_ROWS }, () => Array(BOX_COLS + 1).fill(0)),
    boxes: Array.from({ length: BOX_ROWS }, () => Array(BOX_COLS).fill(0)),
    you: 0,
    computer: 0,
    playerTurn: true,
    over: false,
    aiTimer: null
  };
  $('#you').textContent = '0';
  $('#computer').textContent = '0';
  $('#turn').textContent = 'Your turn! Draw a line.';
  render();
}

function boxEdges(r, c) {
  return [
    { type: 'h', i: r, j: c },
    { type: 'h', i: r + 1, j: c },
    { type: 'v', i: r, j: c },
    { type: 'v', i: r, j: c + 1 }
  ];
}

function edgeValue(type, i, j) {
  return type === 'h' ? state.h[i][j] : state.v[i][j];
}

function setEdge(type, i, j, val) {
  if (type === 'h') state.h[i][j] = val;
  else state.v[i][j] = val;
}

function completeBoxes(player) {
  let completed = 0;
  for (let r = 0; r < BOX_ROWS; r++) {
    for (let c = 0; c < BOX_COLS; c++) {
      if (state.boxes[r][c] !== 0) continue;
      const edges = boxEdges(r, c);
      if (edges.every((e) => edgeValue(e.type, e.i, e.j) !== 0)) {
        state.boxes[r][c] = player;
        completed++;
      }
    }
  }
  return completed;
}

function drawEdge(type, i, j) {
  if (edgeValue(type, i, j) !== 0) return 0;
  const player = state.playerTurn ? 1 : 2;
  setEdge(type, i, j, player);
  const boxes = completeBoxes(player);
  if (boxes > 0) {
    if (player === 1) state.you += boxes;
    else state.computer += boxes;
    $('#you').textContent = state.you;
    $('#computer').textContent = state.computer;
    // got a box → same player again
    return boxes;
  }
  // no box → switch turn
  state.playerTurn = !state.playerTurn;
  return 0;
}

function allBoxesDone() {
  return state.boxes.every((row) => row.every((v) => v !== 0));
}

function playerDraw(type, i, j) {
  if (state.over || !state.playerTurn) return;
  if (edgeValue(type, i, j) !== 0) return;
  const boxes = drawEdge(type, i, j);
  render();
  if (allBoxesDone()) return finish();
  if (boxes === 0) {
    $('#turn').textContent = 'Computer’s turn… 🤖';
    state.aiTimer = setTimeout(aiTurn, 450);
  } else {
    $('#turn').textContent = 'You made a box! Go again!';
  }
}

function aiTurn() {
  if (state.over) return;
  const move = aiMove();
  if (!move) return finish();
  const boxes = drawEdge(move.type, move.i, move.j);
  render();
  if (allBoxesDone()) return finish();
  if (boxes > 0) {
    $('#turn').textContent = 'Computer made a box! It goes again…';
    state.aiTimer = setTimeout(aiTurn, 450);
  } else {
    $('#turn').textContent = 'Your turn! Draw a line.';
  }
}

function availableEdges() {
  const list = [];
  for (let i = 0; i <= BOX_ROWS; i++) {
    for (let j = 0; j < BOX_COLS; j++) {
      if (state.h[i][j] === 0) list.push({ type: 'h', i, j });
    }
  }
  for (let i = 0; i < BOX_ROWS; i++) {
    for (let j = 0; j <= BOX_COLS; j++) {
      if (state.v[i][j] === 0) list.push({ type: 'v', i, j });
    }
  }
  return list;
}

function aiMove() {
  const avail = availableEdges();
  if (avail.length === 0) return null;

  // completing a move
  for (const e of avail) {
    if (wouldComplete(e, 2)) return e;
  }
  // block: don't give the player an easy box (2-edge box)
  const avoid = avail.filter((e) => wouldComplete(e, 1) === 0 && givesTwoEdge(e, 1));
  const safe = avail.filter((e) => wouldComplete(e, 1) === 0 && !givesTwoEdge(e, 1));
  const pool = state.diff === 'hard' && safe.length ? safe : (avoid.length ? avoid : avail);
  return pick(pool);
}

function wouldComplete(edge, player) {
  const list = [];
  const boxesTouching = [];
  const { type, i, j } = edge;
  // find boxes this edge belongs to
  const cand = [];
  if (type === 'h') {
    if (i > 0) cand.push([i - 1, j]);
    if (i < BOX_ROWS) cand.push([i, j]);
  } else {
    if (j > 0) cand.push([i, j - 1]);
    if (j < BOX_COLS) cand.push([i, j]);
  }
  for (const [r, c] of cand) {
    if (state.boxes[r][c] !== 0) continue;
    const edges = boxEdges(r, c).filter((e) => !(e.type === type && e.i === i && e.j === j));
    if (edges.every((e) => edgeValue(e.type, e.i, e.j) !== 0)) return true;
  }
  return false;
}

function givesTwoEdge(edge, player) {
  // does drawing this edge leave an opponent box with 2 edges filled (easy box)?
  const { type, i, j } = edge;
  const cand = [];
  if (type === 'h') {
    if (i > 0) cand.push([i - 1, j]);
    if (i < BOX_ROWS) cand.push([i, j]);
  } else {
    if (j > 0) cand.push([i, j - 1]);
    if (j < BOX_COLS) cand.push([i, j]);
  }
  return cand.some(([r, c]) => {
    if (state.boxes[r][c] !== 0) return false;
    const edges = boxEdges(r, c);
    const filled = edges.filter((e) => edgeValue(e.type, e.i, e.j) !== 0).length;
    return filled === 2;
  });
}

function finish() {
  state.over = true;
  clearTimeout(state.aiTimer);
  const text = `You: ${state.you} boxes · Computer: ${state.computer} boxes.`;
  if (state.you > state.computer) {
    burstConfetti();
    showModal('🎉 You Win!', text, 'Play Again', () => init(state.diff));
  } else if (state.computer > state.you) {
    showModal('😅 Computer Wins!', text, 'Play Again', () => init(state.diff));
  } else {
    showModal('🤝 It’s a Tie!', text, 'Play Again', () => init(state.diff));
  }
}

function render() {
  const board = $('#board');
  const total = BOX_ROWS * 2 + 1;
  board.style.gridTemplateColumns = `repeat(${total}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${total}, 1fr)`;
  board.innerHTML = '';
  const dots = [];
  for (let r = 0; r < total; r++) {
    for (let c = 0; c < total; c++) {
      const cell = document.createElement('div');
      const even = r % 2 === 0 && c % 2 === 0;
      const hEdge = r % 2 === 0 && c % 2 === 1;
      const vEdge = r % 2 === 1 && c % 2 === 0;
      const boxCell = r % 2 === 1 && c % 2 === 1;

      if (even) {
        cell.className = 'dot';
        cell.style.gridRowStart = r + 1;
        cell.style.gridColumnStart = c + 1;
        board.appendChild(cell);
        dots.push(cell);
      } else if (hEdge) {
        const i = r / 2;
        const j = (c - 1) / 2;
        cell.className = 'edge h' + (state.h[i][j] !== 0 ? ' done p' + state.h[i][j] : '');
        if (state.h[i][j] === 0) cell.addEventListener('click', () => playerDraw('h', i, j));
        cell.style.gridRowStart = r + 1;
        cell.style.gridColumnStart = c + 1;
        board.appendChild(cell);
      } else if (vEdge) {
        const i = (r - 1) / 2;
        const j = c / 2;
        cell.className = 'edge v' + (state.v[i][j] !== 0 ? ' done p' + state.v[i][j] : '');
        if (state.v[i][j] === 0) cell.addEventListener('click', () => playerDraw('v', i, j));
        cell.style.gridRowStart = r + 1;
        cell.style.gridColumnStart = c + 1;
        board.appendChild(cell);
      } else if (boxCell) {
        const i = (r - 1) / 2;
        const j = (c - 1) / 2;
        cell.className = 'box' + (state.boxes[i][j] === 1 ? ' p1' : state.boxes[i][j] === 2 ? ' p2' : '');
        cell.style.gridRowStart = r + 1;
        cell.style.gridColumnStart = c + 1;
        board.appendChild(cell);
      }
    }
  }
}

initGameFrame({
  title: 'Dots & Boxes',
  emoji: '✏️',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
