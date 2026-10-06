'use strict';

const PALETTE = [
  { name: 'Red', hex: '#e53935' },
  { name: 'Orange', hex: '#fb8c00' },
  { name: 'Yellow', hex: '#fdd835' },
  { name: 'Green', hex: '#43a047' },
  { name: 'Blue', hex: '#1e88e5' },
  { name: 'Purple', hex: '#8e24aa' },
  { name: 'Pink', hex: '#ec407a' },
  { name: 'Brown', hex: '#795548' },
  { name: 'Gray', hex: '#90a4ae' },
  { name: 'Black', hex: '#33505e' }
];

const SIZES = [
  { name: 'Fine', px: 6, dot: 8 },
  { name: 'Medium', px: 14, dot: 14 },
  { name: 'Chunky', px: 26, dot: 20 }
];

const BEST_KEY = 'best-drawing';
const CHEER_EVERY = 50;
const CHEERS = [
  '🎉 50 strokes! Keep drawing!',
  '🌟 100 strokes — you are an artist!',
  '🎨 150 strokes! What a colourful picture!',
  '🏆 200 strokes! Super drawing skills!',
  '✨ 250 strokes! The paper loves you!'
];

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

let strokes = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let color = PALETTE[0];
let size = SIZES[1];
let erasing = false;
let cheerTimer = null;
const activePointers = new Map();

function buildPalette() {
  const wrap = $('#palette');
  wrap.innerHTML = '';
  PALETTE.forEach((c, i) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch' + (i === 0 ? ' active' : '');
    swatch.style.background = c.hex;
    swatch.title = c.name;
    swatch.setAttribute('aria-label', 'Colour: ' + c.name);
    swatch.addEventListener('click', () => {
      color = c;
      erasing = false;
      $$('#palette .swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      $('#eraser-btn').classList.remove('active');
      updatePenName();
    });
    wrap.appendChild(swatch);
  });
}

function buildSizes() {
  const wrap = $('#sizes');
  wrap.innerHTML = '';
  SIZES.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-btn' + (i === 1 ? ' active' : '');
    btn.title = 'Brush size: ' + s.name;
    btn.setAttribute('aria-label', 'Brush size: ' + s.name);
    const dot = document.createElement('span');
    dot.className = 'size-dot';
    dot.style.width = s.dot + 'px';
    dot.style.height = s.dot + 'px';
    btn.appendChild(dot);
    btn.addEventListener('click', () => {
      size = s;
      $$('#sizes .size-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    wrap.appendChild(btn);
  });
}

function updatePenName() {
  $('#pen-name').textContent = erasing ? 'Eraser' : color.name;
}

function updateStats() {
  $('#strokes').textContent = strokes;
  if (strokes > best) {
    best = strokes;
    localStorage.setItem(BEST_KEY, String(best));
  }
  $('#best').textContent = best;
}

function showCheer(text) {
  const cheer = $('#cheer');
  cheer.textContent = text;
  cheer.classList.remove('hidden');
  burstConfetti();
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => cheer.classList.add('hidden'), 2600);
}

function pointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function paint(from, to) {
  ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
  ctx.strokeStyle = color.hex;
  ctx.lineWidth = size.px;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const p = pointFromEvent(e);
  if (!p) return;
  activePointers.set(e.pointerId, p);
  strokes++;
  updateStats();
  updatePenName();
  paint(p, p);
  if (strokes % CHEER_EVERY === 0) {
    showCheer(CHEERS[Math.min(Math.floor(strokes / CHEER_EVERY) - 1, CHEERS.length - 1)]);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!activePointers.has(e.pointerId)) return;
  e.preventDefault();
  const prev = activePointers.get(e.pointerId);
  const next = pointFromEvent(e);
  if (!next) return;
  paint(prev, next);
  activePointers.set(e.pointerId, next);
});

function endPointer(e) {
  activePointers.delete(e.pointerId);
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', endPointer);

$('#eraser-btn').addEventListener('click', () => {
  erasing = true;
  $('#eraser-btn').classList.add('active');
  $$('#palette .swatch').forEach((s) => s.classList.remove('active'));
  updatePenName();
});

function clearPaper() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes = 0;
  activePointers.clear();
  updateStats();
}

$('#clear-btn').addEventListener('click', clearPaper);

buildPalette();
buildSizes();
updatePenName();
updateStats();

initGameFrame({
  title: 'Drawing Pad',
  emoji: '🎨',
  onRestart: clearPaper
});
