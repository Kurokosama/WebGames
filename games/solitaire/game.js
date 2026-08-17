/* 纸牌接龙 Solitaire - Klondike */
'use strict';

initGameFrame({
  title: '纸牌接龙',
  emoji: '🃏',
  onRestart: () => newGame()
});

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = ['♥', '♦'];

let stock = [], waste = [], foundations = [[],[],[],[]], tableau = [[],[],[],[],[],[],[]];
let score = 0, moves = 0, timerInterval = null, seconds = 0;
let dragCard = null, dragFrom = null, dragOffset = {x:0, y:0};

function newGame() {
  hideModal();
  score = 0; moves = 0; seconds = 0;
  updateStatus();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => { seconds++; updateStatus(); }, 1000);

  // Build deck
  let deck = [];
  for (let s = 0; s < 4; s++)
    for (let r = 0; r < 13; r++)
      deck.push({ suit: SUITS[s], rank: RANKS[r], val: r + 1, red: RED_SUITS.includes(SUITS[s]) });
  deck = shuffle(deck);

  stock = []; waste = [];
  foundations = [[],[],[],[]];
  tableau = [[],[],[],[],[],[],[]];

  // Deal
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j <= i; j++) {
      tableau[j].push(deck.pop());
    }
  }
  stock = deck;

  renderAll();
}

function updateStatus() {
  $('#score').textContent = score;
  $('#moves').textContent = moves;
  const m = Math.floor(seconds / 60), s = seconds % 60;
  $('#timer').textContent = m + ':' + String(s).padStart(2, '0');
}

function renderAll() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  updateStatus();
}

function makeCardEl(card, faceUp) {
  const el = document.createElement('div');
  el.className = 'card';
  if (faceUp) {
    const face = document.createElement('div');
    face.className = 'card-face ' + (card.red ? 'red' : 'black');
    face.innerHTML = '<span class="card-rank">' + card.rank + '</span><span class="card-suit">' + card.suit + '</span>';
    el.appendChild(face);
  } else {
    const back = document.createElement('div');
    back.className = 'card-back';
    el.appendChild(back);
  }
  return el;
}

function renderStock() {
  const el = $('#stock');
  el.innerHTML = '';
  if (stock.length > 0) {
    const c = makeCardEl(stock[stock.length - 1], false);
    c.addEventListener('click', () => drawFromStock());
    el.appendChild(c);
  }
}

function renderWaste() {
  const el = $('#waste');
  el.innerHTML = '';
  if (waste.length > 0) {
    const c = makeCardEl(waste[waste.length - 1], true);
    c.addEventListener('mousedown', (e) => startDrag(e, 'waste', waste.length - 1));
    el.appendChild(c);
  }
}

function renderFoundations() {
  for (let i = 0; i < 4; i++) {
    const el = $('#found-' + i);
    el.innerHTML = '';
    if (foundations[i].length > 0) {
      const c = makeCardEl(foundations[i][foundations[i].length - 1], true);
      el.appendChild(c);
    }
  }
}

function renderTableau() {
  const container = $('#tableau');
  container.innerHTML = '';
  for (let col = 0; col < 7; col++) {
    const colEl = document.createElement('div');
    colEl.className = 'tableau-col';
    tableau[col].forEach((card, row) => {
      const faceUp = row === tableau[col].length - 1 || card.faceUp;
      const c = makeCardEl(card, faceUp);
      c.style.top = (row * 24) + 'px';
      c.style.zIndex = row + 1;
      if (faceUp) {
        c.addEventListener('mousedown', (e) => startDrag(e, 'tableau', col, row));
      }
      colEl.appendChild(c);
    });
    container.appendChild(colEl);
  }
}

function drawFromStock() {
  if (stock.length > 0) {
    const card = stock.pop();
    card.faceUp = true;
    waste.push(card);
    score += 0;
    moves++;
    renderAll();
  } else if (waste.length > 0) {
    while (waste.length > 0) {
      const card = waste.pop();
      card.faceUp = false;
      stock.push(card);
    }
    moves++;
    renderAll();
  }
}

function canPlaceOnTableau(card, col) {
  const pile = tableau[col];
  if (pile.length === 0) return card.rank === 'K';
  const top = pile[pile.length - 1];
  if (!top.faceUp) return false;
  return top.val === card.val + 1 && top.red !== card.red;
}

function canPlaceOnFoundation(card, fi) {
  const pile = foundations[fi];
  if (pile.length === 0) return card.rank === 'A';
  const top = pile[pile.length - 1];
  return top.suit === card.suit && card.val === top.val + 1;
}

function startDrag(e, source, col, row) {
  e.preventDefault();
  const cards = [];
  if (source === 'waste') {
    cards.push(waste[waste.length - 1]);
    dragFrom = { type: 'waste' };
  } else {
    for (let i = row; i < tableau[col].length; i++) cards.push(tableau[col][i]);
    dragFrom = { type: 'tableau', col, row };
  }
  dragCard = cards;

  const el = e.target.closest('.card');
  const rect = el.getBoundingClientRect();
  dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  // Create drag ghost
  const ghost = document.createElement('div');
  ghost.className = 'card dragging';
  ghost.style.position = 'fixed';
  ghost.style.left = (e.clientX - dragOffset.x) + 'px';
  ghost.style.top = (e.clientY - dragOffset.y) + 'px';
  ghost.style.zIndex = 9999;
  ghost.style.pointerEvents = 'none';
  cards.forEach((c, i) => {
    const ce = makeCardEl(c, true);
    ce.style.position = 'absolute';
    ce.style.top = (i * 24) + 'px';
    ce.style.left = '0';
    ghost.appendChild(ce);
  });
  ghost.style.width = '64px';
  ghost.style.height = (90 + (cards.length - 1) * 24) + 'px';
  document.body.appendChild(ghost);
  el.classList.add('dragging');

  function onMove(ev) {
    ghost.style.left = (ev.clientX - dragOffset.x) + 'px';
    ghost.style.top = (ev.clientY - dragOffset.y) + 'px';
  }

  function onUp(ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    ghost.remove();
    el.classList.remove('dragging');

    // Determine drop target
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!target) return;

    let dropped = false;
    const pileEl = target.closest('.pile');
    const colEl = target.closest('.tableau-col');

    if (pileEl && pileEl.classList.contains('foundation')) {
      const fi = parseInt(pileEl.id.split('-')[1]);
      if (cards.length === 1 && canPlaceOnFoundation(cards[0], fi)) {
        removeCardsFromSource();
        foundations[fi].push(cards[0]);
        score += 10;
        dropped = true;
      }
    } else if (colEl) {
      const tcol = Array.from($('#tableau').children).indexOf(colEl);
      if (tcol >= 0 && canPlaceOnTableau(cards[0], tcol)) {
        removeCardsFromSource();
        tableau[tcol].push(...cards);
        score += 5;
        dropped = true;
      }
    }

    if (dropped) {
      moves++;
      // Flip newly exposed card
      if (dragFrom.type === 'tableau') {
        const pile = tableau[dragFrom.col];
        if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
          pile[pile.length - 1].faceUp = true;
          score += 5;
        }
      }
      checkWin();
      renderAll();
    }
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function removeCardsFromSource() {
  if (dragFrom.type === 'waste') {
    waste.pop();
  } else {
    tableau[dragFrom.col].splice(dragFrom.row);
  }
}

function checkWin() {
  const total = foundations.reduce((s, f) => s + f.length, 0);
  if (total === 52) {
    clearInterval(timerInterval);
    showModal('🎉 恭喜通关！', '用时 ' + Math.floor(seconds/60) + '分' + (seconds%60) + '秒，步数 ' + moves + '，分数 ' + score, '再来一局', newGame);
  }
}

newGame();
