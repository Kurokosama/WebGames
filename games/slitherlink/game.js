'use strict';

const N = 5;                 // 5x5 cells, 6x6 vertices
const MIN_FILL = 11;         // keep the loop small enough to be solvable by hand

let H, V, clues, puzzleNo, totalClues;

// Grow a simply-connected blob of cells. Its boundary is guaranteed to be a
// single closed loop, which gives us a valid puzzle to hand the player.
function makeLoop() {
  const region = new Set(['2,2']);
  let guard = 0;
  while (region.size < MIN_FILL && guard++ < 400) {
    const candidates = [];
    region.forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) return;
        const k = nr + ',' + nc;
        if (region.has(k)) return;
        // accept only if it touches the region on exactly one side,
        // otherwise a pinch point could split the boundary into two loops
        let touches = 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ar, ac]) => {
          if (region.has((nr + ar) + ',' + (nc + ac))) touches++;
        });
        if (touches === 1) candidates.push(k);
      });
    });
    if (!candidates.length) break;
    region.add(pick(candidates));
  }

  const h = Array.from({ length: N + 1 }, () => Array(N).fill(false));
  const v = Array.from({ length: N }, () => Array(N + 1).fill(false));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!region.has(r + ',' + c)) continue;
      // a boundary edge is one whose neighbour cell is outside the region
      if (r === 0 || !region.has((r - 1) + ',' + c)) h[r][c] = true;
      if (r === N - 1 || !region.has((r + 1) + ',' + c)) h[r + 1][c] = true;
      if (c === 0 || !region.has(r + ',' + (c - 1))) v[r][c] = true;
      if (c === N - 1 || !region.has(r + ',' + (c + 1))) v[r][c + 1] = true;
    }
  }

  const clue = [];
  for (let r = 0; r < N; r++) {
    const row = [];
    for (let c = 0; c < N; c++) {
      row.push((h[r][c] ? 1 : 0) + (h[r + 1][c] ? 1 : 0) + (v[r][c] ? 1 : 0) + (v[r][c + 1] ? 1 : 0));
    }
    clue.push(row);
  }
  return { h, v, clue };
}

function newPuzzle() {
  const p = makeLoop();
  // The generated loop is only used to derive the clues. The player must start
  // from an empty grid — seeding H/V with the loop handed them a solved puzzle.
  H = Array.from({ length: N + 1 }, () => Array(N).fill(false));
  V = Array.from({ length: N }, () => Array(N + 1).fill(false));
  clues = p.clue;
  totalClues = clues.flat().filter((n) => n > 0).length;
  render();
}

function reset() {
  puzzleNo = 1;
  newPuzzle();
}

const hOn = (r, c) => !!H[r][c];
const vOn = (r, c) => !!V[r][c];

function clueMet(r, c) {
  const n = (hOn(r, c) ? 1 : 0) + (hOn(r + 1, c) ? 1 : 0) + (vOn(r, c) ? 1 : 0) + (vOn(r, c + 1) ? 1 : 0);
  return n === clues[r][c];
}

function countMet() {
  let n = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (clues[r][c] > 0 && clueMet(r, c)) n++;
  return n;
}

function countEdges() {
  let n = 0;
  for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) if (hOn(r, c)) n++;
  for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) if (vOn(r, c)) n++;
  return n;
}

const degree = (r, c) =>
  (c > 0 && hOn(r, c - 1) ? 1 : 0) + (c < N && hOn(r, c) ? 1 : 0) +
  (r > 0 && vOn(r - 1, c) ? 1 : 0) + (r < N && vOn(r, c) ? 1 : 0);

// A correct solution is a single closed loop: every used vertex has degree 2,
// and walking from any edge returns to the start after visiting every edge.
function isSingleLoop() {
  let start = null, edges = 0;
  for (let r = 0; r <= N; r++) {
    for (let c = 0; c <= N; c++) {
      const d = degree(r, c);
      if (d === 1 || d > 2) return false;
      if (d === 2 && !start) start = [r, c];
    }
  }
  for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) if (hOn(r, c)) edges++;
  for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) if (vOn(r, c)) edges++;
  if (!start || edges < 4) return false;

  const seen = new Set();
  let [r, c] = start, prev = -1, walked = 0;
  while (walked <= edges + 2) {
    if (seen.has(r + ',' + c)) break;
    seen.add(r + ',' + c);
    walked++;
    let moved = false;
    const opts = [
      [c > 0 && hOn(r, c - 1), 'h' + r + ',' + (c - 1), r, c - 1],
      [c < N && hOn(r, c), 'h' + r + ',' + c, r, c],
      [r > 0 && vOn(r - 1, c), 'v' + (r - 1) + ',' + c, r - 1, c],
      [r < N && vOn(r, c), 'v' + r + ',' + c, r, c]
    ];
    for (const [has, id, er, ec] of opts) {
      if (!has || id === prev) continue;
      prev = id;
      r = er + (id[0] === 'v' ? 1 : 0);
      c = ec + (id[0] === 'h' ? 1 : 0);
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return walked === edges / 2;
}

let celebrated = false;

function render() {
  const svg = $('#board');
  const S = 360, cell = S / N;
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';
  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  };

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      svg.appendChild(mk('rect', { class: 'cell-bg', x: c * cell, y: r * cell, width: cell, height: cell }));
      if (clues[r][c] > 0) {
        const t = mk('text', { class: 'clue', x: c * cell + cell / 2, y: r * cell + cell / 2 });
        t.textContent = clues[r][c];
        if (clueMet(r, c)) t.classList.add('met');
        svg.appendChild(t);
      }
    }
  }
  for (let r = 0; r <= N; r++) {
    for (let c = 0; c <= N; c++) svg.appendChild(mk('circle', { class: 'dot', cx: c * cell, cy: r * cell, r: 2.5 }));
  }
  for (let r = 0; r <= N; r++) {
    for (let c = 0; c < N; c++) {
      const line = mk('line', { class: 'edge' + (hOn(r, c) ? ' on' : ''), x1: c * cell, y1: r * cell, x2: (c + 1) * cell, y2: r * cell });
      line.style.cursor = 'pointer';
      line.addEventListener('click', () => { H[r][c] = !H[r][c]; render(); });
      svg.appendChild(line);
    }
  }
  for (let r = 0; r < N; r++) {
    for (let c = 0; c <= N; c++) {
      const line = mk('line', { class: 'edge' + (vOn(r, c) ? ' on' : ''), x1: c * cell, y1: r * cell, x2: c * cell, y2: (r + 1) * cell });
      line.style.cursor = 'pointer';
      line.addEventListener('click', () => { V[r][c] = !V[r][c]; render(); });
      svg.appendChild(line);
    }
  }

  $('#lines').textContent = countEdges();
  $('#satisfied').textContent = countMet();
  $('#clue-total').textContent = totalClues;
  $('#puzzle-name').textContent = puzzleNo;

  if (!celebrated && countMet() === totalClues && isSingleLoop()) {
    celebrated = true;
    burstConfetti();
    setTimeout(() => {
      showModal('\uD83C\uDF89 Loop Complete!', 'You matched every clue with a single loop.', 'New puzzle', () => {
        puzzleNo++;
        celebrated = false;
        newPuzzle();
      });
    }, 250);
  }
}

initGameFrame({ title: 'Slitherlink', emoji: '\uD83D\uDD22', onRestart: reset });

reset();
