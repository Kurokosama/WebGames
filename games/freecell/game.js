/* FreeCell — 🃏 full solitaire (52 cards, 4 free cells, 4 foundations) */
'use strict';

const SUITS = ['♠', '♥', '♦', '♣'];
const IS_RED = [false, true, true, false];
const RANK_TEXT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const BEST_KEY = 'best-freecell';

let tableau, freeCells, foundations;
let moves = 0, selected = null, difficulty = 'normal', landed = null;

/* ---------- helpers ---------- */
function pileOf(slot, idx) {
  if (slot === 'tableau') return tableau[idx] || [];
  if (slot === 'free') return freeCells[idx] ? [freeCells[idx]] : [];
  return foundations[idx] || [];
}

function foundationOk(card, idx) {
  const f = foundations[idx];
  if (!f.length) return card.rank === 1;
  return f[f.length - 1].suit === card.suit && f[f.length - 1].rank === card.rank - 1;
}

function isRun(cards) {
  for (let i = 0; i < cards.length - 1; i++) {
    if (cards[i].rank !== cards[i + 1].rank + 1) return false;
    if (IS_RED[cards[i].suit] === IS_RED[cards[i + 1].suit]) return false;
  }
  return true;
}

function maxGroupMove(srcIdx) {
  const openCells = freeCells.filter((c) => c === null).length;
  const emptyCols = tableau.filter((c, i) => i !== srcIdx && !c.length).length;
  return difficulty === 'easy' ? 99 : (openCells + 1) * Math.pow(2, emptyCols);
}

function destOk(card, slot, idx, runLen) {
  if (runLen > 1 && slot !== 'tableau') return false;
  if (slot === 'free') return freeCells[idx] === null;
  if (slot === 'found') return foundationOk(card, idx);
  const col = tableau[idx];
  if (!col.length) return true;
  const top = col[col.length - 1];
  return top.rank === card.rank + 1 && IS_RED[top.suit] !== IS_RED[card.suit];
}

/* ---------- moves ---------- */
function tryMove(slot, idx) {
  if (!selected) return false;
  const run = pileOf(selected.slot, selected.idx).slice(selected.pos);
  if (!run.length || !destOk(run[0], slot, idx, run.length)) return false;
  if (run.length > 1 && run.length > maxGroupMove(selected.idx)) return false;

  const srcSlot = selected.slot, srcIdx = selected.idx;
  if (srcSlot === 'free') freeCells[srcIdx] = null;
  else if (srcSlot === 'found') foundations[srcIdx].pop();
  else tableau[srcIdx].length = selected.pos;

  if (slot === 'free') freeCells[idx] = run[0];
  else if (slot === 'found') foundations[idx].push(run[0]);
  else tableau[idx].push(...run);

  moves++;
  landed = { slot, idx };
  selected = null;
  render();
  updateStats();
  checkWin();
  return true;
}

function selectCard(slot, idx, pos) {
  const run = pileOf(slot, idx).slice(pos);
  if (!run.length) return false;
  if (slot === 'tableau' && !isRun(run)) return false;
  selected = { slot, idx, pos };
  return true;
}

function checkWin() {
  if (foundations.reduce((n, f) => n + f.length, 0) !== 52) return;
  const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  if (!best || moves < best) localStorage.setItem(BEST_KEY, String(moves));
  updateStats();
  burstConfetti();
  showModal('🎉 You Win!', 'All 52 cards home in ' + moves + ' moves. Your best is ' + localStorage.getItem(BEST_KEY) + ' moves.', 'Play Again');
}

/* ---------- click handling (mouse + touch) ---------- */
function handleClick(e) {
  const holder = e.target.closest('[data-slot]');
  if (!holder) return;
  const slot = holder.dataset.slot;
  const idx = parseInt(holder.dataset.index, 10);
  const cardEl = e.target.closest('.card');
  const pos = cardEl ? parseInt(cardEl.dataset.pos, 10) : null;

  if (pos === null) { if (selected) tryMove(slot, idx); return; }
  if (selected && slot === selected.slot && idx === selected.idx && pos === selected.pos) {
    selected = null; render(); return;
  }
  const card = pileOf(slot, idx)[pos];
  if (!card) return;
  if (selected && tryMove(slot, idx)) return;
  if (selectCard(slot, idx, pos)) {
    if (difficulty === 'easy' && foundationOk(card, card.suit)) { tryMove('found', card.suit); return; }
    render();
  }
}

/* ---------- rendering ---------- */
function makeSlot(kind, index, label) {
  const el = document.createElement('div');
  el.className = 'slot ' + (kind === 'free' ? 'free-cell' : 'foundation');
  el.dataset.slot = kind;
  el.dataset.index = String(index);
  el.title = label;
  return el;
}

function buildTopRow() {
  const top = $('#top-row');
  if (!top) return;
  top.innerHTML = '';
  for (let i = 0; i < 4; i++) top.appendChild(makeSlot('free', i, 'Free cell'));
  const gap = document.createElement('div');
  gap.className = 'gap';
  top.appendChild(gap);
  for (let i = 0; i < 4; i++) {
    const slot = makeSlot('found', i, 'Foundation');
    slot.dataset.suit = SUITS[i];
    top.appendChild(slot);
  }
}

function makeCard(card, isSelected) {
  const el = document.createElement('div');
  el.className = 'card' + (isSelected ? ' selected' : '');
  const face = document.createElement('div');
  face.className = 'card-face ' + (IS_RED[card.suit] ? 'red' : 'black');
  const rank = document.createElement('span');
  rank.className = 'card-rank';
  rank.textContent = RANK_TEXT[card.rank];
  const suit = document.createElement('span');
  suit.className = 'card-suit';
  suit.textContent = SUITS[card.suit];
  face.appendChild(rank);
  face.appendChild(suit);
  el.appendChild(face);
  return el;
}

function render() {
  $$('#top-row [data-slot]').forEach((holder) => {
    const slot = holder.dataset.slot, idx = parseInt(holder.dataset.index, 10);
    const pile = pileOf(slot, idx);
    holder.innerHTML = '';
    if (pile.length) {
      const el = makeCard(pile[pile.length - 1], !!selected && selected.slot === slot && selected.idx === idx);
      el.dataset.pos = '0';
      holder.appendChild(el);
    }
    const run = selected ? pileOf(selected.slot, selected.idx).slice(selected.pos) : [];
    const canLand = selected && destOk(run[0], slot, idx, run.length);
    holder.classList.toggle('targetable', canLand && !(selected.slot === slot && selected.idx === idx));
  });

  const board = $('#tableau');
  board.innerHTML = '';
  tableau.forEach((col, idx) => {
    const holder = document.createElement('div');
    holder.className = 'col';
    holder.dataset.slot = 'tableau';
    holder.dataset.index = String(idx);
    col.forEach((card, pos) => {
      const el = makeCard(card, !!selected && selected.slot === 'tableau' && selected.idx === idx && selected.pos === pos);
      el.dataset.pos = String(pos);
      holder.appendChild(el);
    });
    if (selected) {
      const run = pileOf(selected.slot, selected.idx).slice(selected.pos);
      const canLand = destOk(run[0], 'tableau', idx, run.length) && run.length <= maxGroupMove(selected.idx);
      holder.classList.toggle('targetable', canLand && !(selected.slot === 'tableau' && selected.idx === idx));
    }
    if (landed && landed.slot === 'tableau' && landed.idx === idx) holder.classList.add('armed');
    board.appendChild(holder);
  });

  const hint = $('#move-hint');
  if (hint) {
    const openCells = freeCells.filter((c) => c === null).length;
    const emptyCols = tableau.filter((c) => !c.length).length;
    hint.textContent = 'Free cells open: ' + openCells + ' · Empty columns: ' + emptyCols +
      ' · Biggest group move: ' + Math.min(13, (openCells + 1) * Math.pow(2, emptyCols)) + ' cards';
  }
}

function updateStats() {
  $('#moves').textContent = String(moves);
  $('#found-count').textContent = String(foundations.reduce((n, f) => n + f.length, 0));
  const best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  $('#best-count').textContent = best ? String(best) : '—';
}

function newDeal() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ suit: s, rank: r });
  const cards = shuffle(deck);
  tableau = Array.from({ length: 8 }, () => []);
  freeCells = [null, null, null, null];
  foundations = [[], [], [], []];
  moves = 0; selected = null; landed = null;
  let k = 0;
  for (let c = 0; c < 8; c++) {
    const count = c < 4 ? 6 : 7;
    for (let i = 0; i < count; i++) tableau[c].push(cards[k++]);
  }
  render();
  updateStats();
}

/* ---------- boot ---------- */
$('#board').addEventListener('click', handleClick);

initGameFrame({
  title: 'FreeCell',
  emoji: '🃏',
  difficulties: [
    { value: 'easy', label: 'Easy (no group limit)' },
    { value: 'normal', label: 'Normal (standard rules)' }
  ],
  defaultDifficulty: 'normal',
  onDifficulty: (value) => { difficulty = value; render(); },
  onRestart: () => { hideModal(); newDeal(); }
});

buildTopRow();
newDeal();
