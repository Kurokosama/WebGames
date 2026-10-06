'use strict';

/* ---------- Picture library (kid-friendly SVG shapes) ---------- */
const PICTURES = [
  {
    name: 'Fish',
    regions: [
      { key: 'body', d: 'M40,110 Q90,50 150,110 Q90,170 40,110 Z' },
      { key: 'tail', d: 'M40,110 L10,80 L10,140 Z' },
      { key: 'fin', d: 'M95,60 L120,25 L125,68 Z' },
      { key: 'fin2', d: 'M95,160 L120,195 L125,152 Z' },
      { key: 'eye', d: 'M132,95 m-9,0 a9,9 0 1,0 18,0 a9,9 0 1,0 -18,0 Z' },
      { key: 'bubble1', d: 'M175,55 m-12,0 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 Z' },
      { key: 'bubble2', d: 'M190,95 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 Z' }
    ]
  },
  {
    name: 'House',
    regions: [
      { key: 'wall', d: 'M50,100 L150,100 L150,180 L50,180 Z' },
      { key: 'roof', d: 'M35,100 L100,40 L165,100 Z' },
      { key: 'door', d: 'M85,180 L85,130 L115,130 L115,180 Z' },
      { key: 'window1', d: 'M62,115 L82,115 L82,140 L62,140 Z' },
      { key: 'window2', d: 'M118,115 L138,115 L138,140 L118,140 Z' },
      { key: 'sun', d: 'M180,40 m-14,0 a14,14 0 1,0 28,0 a14,14 0 1,0 -28,0 Z' },
      { key: 'grass', d: 'M0,180 L200,180 L200,200 L0,200 Z' }
    ]
  },
  {
    name: 'Flower',
    regions: [
      { key: 'petal1', d: 'M100,50 m-26,0 a26,26 0 1,0 52,0 a26,26 0 1,0 -52,0 Z' },
      { key: 'petal2', d: 'M100,10 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0 Z' },
      { key: 'petal3', d: 'M100,95 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0 Z' },
      { key: 'petal4', d: 'M52,62 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0 Z' },
      { key: 'petal5', d: 'M148,62 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0 Z' },
      { key: 'center', d: 'M100,62 m-20,0 a20,20 0 1,0 40,0 a20,20 0 1,0 -40,0 Z' },
      { key: 'stem', d: 'M92,82 L108,82 L105,185 L95,185 Z' },
      { key: 'leaf', d: 'M100,140 Q140,120 148,148 Q120,162 100,140 Z' }
    ]
  },
  {
    name: 'Butterfly',
    regions: [
      { key: 'wl', d: 'M92,90 Q40,50 30,95 Q35,130 92,112 Z' },
      { key: 'wl2', d: 'M92,115 Q45,140 55,178 Q80,172 92,130 Z' },
      { key: 'wr', d: 'M108,90 Q160,50 170,95 Q165,130 108,112 Z' },
      { key: 'wr2', d: 'M108,115 Q155,140 145,178 Q120,172 108,130 Z' },
      { key: 'body', d: 'M100,55 m-7,0 a7,7 0 1,0 14,0 a7,7 0 1,0 -14,0 Z M93,70 L107,70 L107,175 L93,175 Z' },
      { key: 'antenna1', d: 'M95,55 Q85,35 70,30 L70,40 Q85,45 95,60 Z' },
      { key: 'antenna2', d: 'M105,55 Q115,35 130,30 L130,40 Q115,45 105,60 Z' }
    ]
  },
  {
    name: 'Cat',
    regions: [
      { key: 'head', d: 'M100,110 m-58,0 a58,58 0 1,0 116,0 a58,58 0 1,0 -116,0 Z' },
      { key: 'ear1', d: 'M50,70 L55,20 L88,48 Z' },
      { key: 'ear2', d: 'M150,70 L145,20 L112,48 Z' },
      { key: 'eye1', d: 'M78,100 m-11,0 a11,11 0 1,0 22,0 a11,11 0 1,0 -22,0 Z' },
      { key: 'eye2', d: 'M122,100 m-11,0 a11,11 0 1,0 22,0 a11,11 0 1,0 -22,0 Z' },
      { key: 'nose', d: 'M100,120 l-8,-8 h16 Z' },
      { key: 'body', d: 'M62,158 L138,158 L146,200 L54,200 Z' },
      { key: 'ball', d: 'M175,170 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0 Z' }
    ]
  }
];

const COLORS = [
  { name: 'Red', v: '#ff6b6b' }, { name: 'Orange', v: '#ffa94d' },
  { name: 'Yellow', v: '#ffd43b' }, { name: 'Green', v: '#69db7c' },
  { name: 'Blue', v: '#74c0fc' }, { name: 'Purple', v: '#b197fc' },
  { name: 'Pink', v: '#faa2c1' }, { name: 'Brown', v: '#d8a47f' }
];

const WHITE = '#fffdf6';
const svg = $('#picture');
const palette = $('#palette');
let current = null;
let history = [];
let pic = null;

function bestKey() { return 'best-coloring'; }

function showBest() {
  const pct = Number(localStorage.getItem(bestKey()) || 0);
  $('#best').textContent = pct + '%';
}

function saveBest(pct) {
  const old = Number(localStorage.getItem(bestKey()) || 0);
  if (pct > old) localStorage.setItem(bestKey(), String(pct));
  showBest();
}

function buildPalette() {
  palette.innerHTML = '';
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'crayon' + (i === 0 ? ' active' : '');
    b.style.background = c.v;
    b.title = c.name;
    b.setAttribute('aria-label', c.name);
    b.addEventListener('click', () => {
      current = c.v;
      $$('.crayon').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    palette.appendChild(b);
  });
  current = COLORS[0].v;
}

function newPicture() {
  pic = pick(PICTURES);
  history = [];
  svg.innerHTML = '';
  svg.setAttribute('aria-label', pic.name + ' coloring page');

  pic.regions.forEach((r) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', r.d);
    p.setAttribute('class', 'region');
    p.setAttribute('fill', WHITE);
    p.dataset.key = r.key;
    p.addEventListener('click', () => {
      if (p.getAttribute('fill') !== current) {
        history.push({ key: r.key, prev: p.getAttribute('fill') });
        p.setAttribute('fill', current);
        update();
      }
    });
    svg.appendChild(p);
  });

  $('#total').textContent = pic.regions.length;
  $('#filled').textContent = 0;
  svg.querySelector('.region').focus && null;
}

function update() {
  let n = 0;
  $$('.region', svg).forEach((p) => { if (p.getAttribute('fill') !== WHITE) n++; });
  $('#filled').textContent = n;
  const pct = Math.round((n / pic.regions.length) * 100);
  if (pct > Number(localStorage.getItem(bestKey()) || 0)) saveBest(pct);

  if (n === pic.regions.length) {
    burstConfetti();
    showModal('🎨 Beautiful!', `You colored the whole ${pic.name.toLowerCase()}!`, 'New picture', () => newPicture());
  }
}

function undo() {
  const last = history.pop();
  if (!last) return;
  const p = svg.querySelector('.region[data-key="' + last.key + '"]');
  if (p) p.setAttribute('fill', last.prev);
  update();
}

$('#undo-btn').addEventListener('click', undo);
$('#new-btn').addEventListener('click', () => {
  if ($('#modal').classList.contains('hidden')) newPicture();
});

buildPalette();
showBest();
newPicture();

initGameFrame({
  title: 'Coloring Book',
  emoji: '🖍️',
  onRestart: () => newPicture()
});