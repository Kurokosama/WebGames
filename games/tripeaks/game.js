'use strict';

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['\u2660','\u2665','\u2666','\u2663'];
const RED = new Set(['\u2665','\u2666']);
const KEY = 'best-tripeaks';

let stock, waste, current, peaks, currentRank, moves, best;

function val(r) { return RANKS.indexOf(r) + 1; }

function cardEl(card) {
  const d = document.createElement('div');
  d.className = 'pcard' + (RED.has(card.suit) ? ' red' : '');
  d.innerHTML = '<span>' + card.rank + card.suit + '</span><span>' + card.suit + '</span>';
  return d;
}

// peak layout: 3 peaks of 10/6/4 cards, with 1 gap between peaks
function layout() {
  const spots = [];
  const cols = [10, 6, 4];
  let x = 0;
  cols.forEach((n, pi) => {
    for (let i = 0; i < n; i++) {
      spots.push({ pi, i, x: x + i * 18, y: pi * 70 });
    }
    x += n + 2;
  });
  return spots;
}

function render() {
  const area = $('#peaks');
  area.innerHTML = '';
  peaks.forEach((p, i) => {
    const el = cardEl(p.card);
    el.style.left = (p.x * 2.1) + 'px';
    el.style.top = p.y + 'px';
    el.style.zIndex = p.i;
    if (p.i === peaks.length - 1 || p.free) el.addEventListener('click', () => tryTake(i));
    area.appendChild(el);
  });

  const st = $('#stock'); st.innerHTML = '';
  stock.forEach((c, i) => { if (i < 2) { const e = cardEl(c); e.style.position = 'absolute'; e.style.left = (i * 2) + 'px'; st.appendChild(e); } });
  const ws = $('#waste'); ws.innerHTML = '';
  if (waste.length) { const e = cardEl(waste[waste.length - 1]); e.style.position = 'absolute'; ws.appendChild(e); }

  const cc = $('#current-card'); cc.innerHTML = '';
  if (current) { const e = cardEl(current); e.style.position = 'absolute'; cc.appendChild(e); }

  $('#left').textContent = stock.length + waste.length + peaks.length;
  $('#current').textContent = current ? current.rank : '—';
  $('#moves').textContent = moves;
  $('#best').textContent = best;
}

function tryTake(i) {
  const p = peaks[i];
  if (!p.free) return;
  const diff = Math.abs(val(p.card.rank) - val(current.rank));
  if (diff === 1 || diff === 12) {
    waste.push(current);
    current = p.card;
    peaks.splice(i, 1);
    moves++;
    renumber();
    if (moves > best) { best = moves; localStorage.setItem(KEY, String(best)); }
    render();
    checkWin();
  }
}

function renumber() {
  peaks.forEach((p, i) => { p.i = i; });
  peaks.forEach((p, i) => {
    p.free = !peaks.slice(i + 1).some((q) => q.pi === p.pi);
  });
}

function drawStock() {
  if (!stock.length) return;
  waste.push(current);
  current = stock.pop();
  moves++;
  render();
}

function checkWin() {
  if (!peaks.length) {
    burstConfetti();
    showModal('\uD83C\uDF89 You Win!', 'All cards cleared in ' + moves + ' moves!', 'Play Again', newGame);
  }
}

function newGame() {
  const d = [];
  RANKS.forEach((r) => SUITS.forEach((s) => d.push({ rank: r, suit: s })));
  const all = shuffle(d).slice(0, 28);
  const spots = layout();
  // 20 cards sit on the three peaks, the remaining 8 start in the stock.
  const onPeaks = all.slice(0, spots.length);
  const spare = all.slice(spots.length).reverse();
  peaks = onPeaks.map((card, i) => ({
    card, pi: spots[i].pi, x: spots[i].x, y: spots[i].y, i, free: false
  }));
  peaks.forEach((p, i) => {
    p.free = !peaks.slice(i + 1).some((q) => q.pi === p.pi);
  });
  stock = spare.slice();
  current = { rank: 'K', suit: '\u2660' };
  waste = [];
  moves = 0;
  best = Number(localStorage.getItem(KEY) || 0);
  render();
}

$('#stock').addEventListener('click', drawStock);

initGameFrame({ title: 'TriPeaks', emoji: '\u26F0\uFE0F', onRestart: newGame });

newGame();
