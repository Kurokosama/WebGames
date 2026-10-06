'use strict';

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['\u2660','\u2665','\u2666','\u2663'];
const RED = new Set(['\u2665','\u2666']);
const KEY = 'best-pyramid-solitaire';

let stock, waste, removed, pyramid, picked, score, best;

function val(r) { return RANKS.indexOf(r) + 1; }

function buildDeck() {
  const d = [];
  RANKS.forEach((r) => SUITS.forEach((s) => d.push({ rank: r, suit: s })));
  return shuffle(d);
}

function render() {
  $('#left').textContent = stock.length + waste.length + pyramid.filter((p) => p.card).length;
  $('#score').textContent = score;
  $('#best').textContent = best;

  const st = $('#stock'); st.innerHTML = '';
  for (let i = 0; i < Math.min(stock.length, 3); i++) {
    const c = document.createElement('div');
    c.className = 'card back';
    st.appendChild(c);
  }

  const w = $('#waste'); w.innerHTML = '';
  if (waste.length) w.appendChild(cardEl(waste[waste.length - 1], false));

  const rm = $('#removed'); rm.innerHTML = '';
  removed.forEach((c) => rm.appendChild(cardEl(c, false)));

  const py = $('#pyramid'); py.innerHTML = '';
  pyramid.forEach((row, ri) => {
    const r = document.createElement('div');
    r.className = 'prow';
    row.forEach((slot) => {
      if (slot.card) {
        const free = isFree(ri, slot.i);
        const el = cardEl(slot.card, false);
        el.style.cursor = free ? 'pointer' : 'default';
        el.style.opacity = free ? '1' : '0.96';
        if (picked === slot) el.classList.add('picked');
        if (free) el.addEventListener('click', () => onPick(slot));
        r.appendChild(el);
      } else {
        const ph = document.createElement('div');
        ph.className = 'card back';
        r.appendChild(ph);
      }
    });
    py.appendChild(r);
  });
}

// A slot is free when it is in the last row, or when its left neighbour is empty.
function isFree(ri, ci) {
  if (ri === pyramid.length - 1) return true;
  return !pyramid[ri + 1][ci] || !pyramid[ri + 1][ci].card;
}

function cardEl(card, faceUp) {
  const d = document.createElement('div');
  d.className = 'card' + (RED.has(card.suit) ? ' red' : '');
  if (!faceUp) { d.classList.add('back'); return d; }
  d.innerHTML = '<span>' + card.rank + card.suit + '</span><span>' + card.suit + '</span>';
  return d;
}

function onPick(slot) {
  if (picked) {
    if (picked === slot) { picked = null; render(); return; }
    const a = val(picked.card.rank), b = val(slot.card.rank);
    if (a + b === 13) {
      removed.push(picked.card, slot.card);
      score += a + b === 13 ? 10 : 10;
      picked.card = null; slot.card = null;
      picked = null;
      if (score > best) { best = score; localStorage.setItem(KEY, String(best)); }
      render();
      checkWin();
      return;
    }
    picked = slot; render(); return;
  }
  picked = slot;
  render();
}

function drawStock() {
  if (!stock.length) return;
  waste.push(stock.pop());
  render();
}

function checkWin() {
  if (pyramid.every((r) => r.every((s) => !s.card))) {
    burstConfetti();
    showModal('\uD83C\uDF8A You Win!', 'Pyramid cleared! Score ' + score, 'Play Again', newGame);
  }
}

function newGame() {
  const deck = buildDeck();
  stock = deck.slice();
  waste = []; removed = []; picked = null; score = 0;
  best = Number(localStorage.getItem(KEY) || 0);

  pyramid = [];
  let idx = 0;
  for (let ri = 0; ri < 7; ri++) {
    const row = [];
    for (let ci = 0; ci <= ri; ci++) row.push({ card: stock.pop(), i: ci });
    pyramid.push(row);
    idx++;
  }
  render();
}

$('#stock').addEventListener('click', drawStock);
$('#waste').addEventListener('click', () => {
  // waste pairs can also be removed
  if (waste.length < 2) return;
  if (val(waste[waste.length - 1].rank) + val(waste[waste.length - 2].rank) === 13) {
    removed.push(waste.pop(), waste.pop());
    score += 10;
    render(); checkWin();
  }
});

initGameFrame({ title: 'Pyramid Solitaire', emoji: '\uD83D\uDDE0', onRestart: newGame });

newGame();
