'use strict';

// Faces: U=white, D=yellow, F=green, B=blue, L=orange, R=red
const COLORS = { U: '#f8f9fa', D: '#ffd43b', F: '#69db7c', B: '#4dabf7', L: '#ffa94d', R: '#ff6b6b' };
const NAMES = { U: 'U', D: 'D', F: 'F', B: 'B', L: 'L', R: 'R' };
const KEY = 'best-rubiks-cube';

let facelets, moves, best, scrambleLeft;

// Each face is a 3x3 array, row-major.
function solvedFacelets() {
  const f = {};
  Object.keys(COLORS).forEach((face) => { f[face] = Array(9).fill(face); });
  return f;
}

// edge/corner index cycles for each face turn (clockwise)
const CYCLES = {
  U: { face: 'U', ring: [['F', 0, 1, 2], ['R', 0, 1, 2], ['B', 0, 1, 2], ['L', 0, 1, 2]], rev: true },
  D: { face: 'D', ring: [['F', 6, 7, 8], ['R', 6, 7, 8], ['B', 6, 7, 8], ['L', 6, 7, 8]], rev: true },
  L: { face: 'L', ring: [['U', 0, 3, 6], ['B', 8, 5, 2], ['D', 0, 3, 6], ['F', 0, 3, 6]], rev: false },
  R: { face: 'R', ring: [['U', 2, 5, 8], ['F', 2, 5, 8], ['D', 2, 5, 8], ['B', 2, 5, 8]], rev: false },
  F: { face: 'F', ring: [['U', 6, 7, 8], ['R', 0, 3, 6], ['D', 2, 1, 0], ['L', 8, 5, 2]], rev: false },
  B: { face: 'B', ring: [['U', 2, 1, 0], ['L', 0, 3, 6], ['D', 6, 7, 8], ['R', 8, 5, 2]], rev: false }
};

function rotateFace(f, cw) {
  const old = f.slice();
  const map = cw
    ? [[6, 3, 0], [7, 4, 1], [8, 5, 2]]
    : [[2, 5, 8], [1, 4, 7], [0, 3, 6]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) f[map[r][c]] = old[r * 3 + c];
}

function turn(face, cw) {
  const cy = CYCLES[face];
  rotateFace(facelets[face], cw);
  const rings = cy.ring.map(([f]) => [f, cy.ring.find((x) => x[0] === f).slice(1)]);
  const grab = rings.map(([f, idxs]) => idxs.map((i) => facelets[f][i]));
  // shift
  for (let k = 0; k < rings.length; k++) {
    const src = grab[(k + (cw ? 1 : rings.length - 1)) % rings.length];
    const [f, idxs] = rings[k];
    idxs.forEach((i, j) => { facelets[f][i] = src[j]; });
  }
  // reverse order for faces needing it
  if (cy.rev && !cw) {
    rings.forEach(([f, idxs]) => {
      const vals = idxs.map((i) => facelets[f][i]);
      facelets[f][idxs[0]] = vals[2]; facelets[f][idxs[1]] = vals[1]; facelets[f][idxs[2]] = vals[0];
    });
  }
}

function isSolved() {
  return Object.keys(COLORS).every((f) => facelets[f].every((v) => v === f));
}

function render() {
  const cube = $('#cube');
  cube.innerHTML = '';
  // show 3 faces in a net: U on top, then L F R row
  const order = [];
  order.push('U', 'U', 'U');
  order.push('L', 'F', 'R');
  order.push('L', 'F', 'R');
  order.push('L', 'F', 'R');
  order.forEach((f) => {
    const idx = facelets[f][0]; // placeholder, replaced below
  });
  // simpler: build net cells
  const cells = [
    ['U', 0], ['U', 1], ['U', 2],
    ['L', 0], ['F', 0], ['R', 0],
    ['L', 3], ['F', 3], ['R', 3],
    ['L', 6], ['F', 6], ['R', 6]
  ];
  // Use facelet-by-facelet: display each face's 9 cells in the net order
  const netOrder = ['U', 'U', 'U', 'L', 'F', 'R', 'L', 'F', 'R', 'L', 'F', 'R'];
  let k = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const face = netOrder[k++];
      const pos = row === 0 ? col : ((row - 1) * 3) + col;
      const s = document.createElement('div');
      s.className = 'sticky';
      s.style.background = COLORS[facelets[face][pos]];
      s.textContent = NAMES[face];
      cube.appendChild(s);
    }
  }
  $('#moves').textContent = moves;
  $('#best').textContent = best;
  $('#t2go').textContent = scrambleLeft > 0 ? scrambleLeft : '—';
}

function doTurn(face, cw) {
  turn(face, cw);
  moves++;
  render();
  if (scrambleLeft > 0) scrambleLeft--;
  if (isSolved()) {
    if (moves <= 10 || localStorage.getItem(KEY) === null || moves < best) {
      if (best === 0 || moves < best) { best = moves; localStorage.setItem(KEY, String(best)); }
    }
    burstConfetti();
    showModal('\uD83C\uDF89 Solved!', 'You solved the cube in ' + moves + ' moves.', 'Play again', scramble);
  }
}

function scramble() {
  facelets = solvedFacelets();
  moves = 0;
  const faces = Object.keys(COLORS);
  for (let i = 0; i < 10; i++) {
    turn(pick(faces), Math.random() < 0.5);
  }
  scrambleLeft = 10;
  best = Number(localStorage.getItem(KEY) || 0);
  render();
}

$$('.turn-btn').forEach((b) => b.addEventListener('click', (e) => {
  doTurn(b.dataset.m, !e.shiftKey);
}));
$('#scramble-btn').addEventListener('click', scramble);

initGameFrame({ title: "Rubik's Cube", emoji: '\uD83E\uDDE6', onRestart: scramble });

scramble();
