'use strict';

const BEST_KEY = 'best-connect-the-dots';
const SVG_NS = 'http://www.w3.org/2000/svg';
const DOT_R = 20;

const LINE_COLORS = ['#ff7e67', '#4caf9b', '#4a90c4', '#9b7edb', '#f47ba1', '#f6c453'];

// Hidden pictures: dots must be connected in order, then the outline closes.
const SETS = [
  {
    name: 'cat',
    emoji: '🐱',
    fill: '#ffe3dc',
    points: [
      [170, 105], [212, 172], [330, 172], [372, 105], [420, 205],
      [400, 275], [430, 355], [360, 420], [240, 425], [175, 380],
      [105, 405], [90, 320], [145, 300], [150, 220]
    ]
  },
  {
    name: 'star',
    emoji: '⭐',
    fill: '#fff3d6',
    points: [
      [300, 70], [336, 178], [447, 155], [372, 240], [447, 325], [336, 302],
      [300, 410], [264, 302], [153, 325], [228, 240], [153, 155], [264, 178]
    ]
  },
  {
    name: 'rocket',
    emoji: '🚀',
    fill: '#dceefb',
    points: [
      [300, 60], [352, 128], [358, 235], [425, 315], [358, 345], [340, 400],
      [312, 425], [300, 445], [288, 425], [260, 400], [242, 345], [175, 315],
      [242, 235], [248, 128]
    ]
  }
];

let state = null;

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? m + ':' + String(s).padStart(2, '0') : s + 's';
}

function getBest() {
  try {
    const raw = parseInt(localStorage.getItem(BEST_KEY), 10);
    return Number.isFinite(raw) ? raw : null;
  } catch (err) {
    return null;
  }
}

function saveBest(sec) {
  try {
    const best = getBest();
    if (best === null || sec < best) localStorage.setItem(BEST_KEY, String(sec));
  } catch (err) {
    /* private mode: best time just will not persist */
  }
}

function setMessage(text, kind) {
  const el = $('#message');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('bad', kind === 'bad');
  el.classList.toggle('good', kind === 'good');
}

function updateStats() {
  const total = state.points.length;
  $('#next-dot').textContent = state.done ? '✓' : String(state.next);
  $('#progress').textContent = Math.min(state.next - 1, total) + '/' + total;
  $('#mistakes').textContent = String(state.mistakes);
  const best = getBest();
  $('#best').textContent = best === null ? '—' : fmtTime(best);
}

function drawSegment(from, to) {
  const a = state.points[from];
  const b = state.points[to];
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', a[0]);
  line.setAttribute('y1', a[1]);
  line.setAttribute('x2', b[0]);
  line.setAttribute('y2', b[1]);
  line.setAttribute('pathLength', '1');
  line.setAttribute('stroke', pick(LINE_COLORS));
  line.classList.add('segment');
  $('#segments').appendChild(line);
}

function markNext() {
  $$('#dots .dot').forEach((g) => g.classList.remove('next'));
  if (state.done) return;
  const target = $('#dots .dot[data-index="' + (state.next - 1) + '"]');
  if (target) target.classList.add('next');
}

function renderBoard() {
  const shape = $('#reveal-shape');
  shape.setAttribute('points', state.points.map((p) => p.join(',')).join(' '));
  shape.setAttribute('fill', state.fill);
  shape.classList.remove('revealed');

  const segGroup = $('#segments');
  const dotGroup = $('#dots');
  segGroup.innerHTML = '';
  dotGroup.innerHTML = '';

  state.points.forEach((p, i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('dot');
    g.dataset.index = String(i);
    g.setAttribute('transform', 'translate(' + p[0] + ',' + p[1] + ')');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('r', String(DOT_R));

    const label = document.createElementNS(SVG_NS, 'text');
    label.textContent = String(i + 1);

    g.appendChild(circle);
    g.appendChild(label);
    g.addEventListener('click', () => tapDot(i, g));
    dotGroup.appendChild(g);
  });

  markNext();
}

function tapDot(index, group) {
  if (state.done) return;
  const wanted = state.next - 1;

  if (index !== wanted) {
    state.mistakes++;
    group.classList.add('wrong');
    setTimeout(() => group.classList.remove('wrong'), 500);
    setMessage("Oops! That's dot " + (index + 1) + '. You need dot ' + state.next + ' next. 😊', 'bad');
    updateStats();
    return;
  }

  if (state.startedAt === null) state.startedAt = Date.now();
  if (index > 0) drawSegment(index - 1, index);
  group.classList.add('done');
  state.next++;
  updateStats();

  if (state.next > state.points.length) {
    finish();
  } else {
    markNext();
    setMessage('Great! Dot ' + (index + 1) + ' is connected. Now find dot ' + state.next + '!', 'good');
  }
}

function finish() {
  state.done = true;
  drawSegment(state.points.length - 1, 0);
  $('#reveal-shape').classList.add('revealed');
  $$('#dots .dot').forEach((g) => g.classList.add('revealed-dot'));

  const secs = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const prevBest = getBest();
  const isRecord = prevBest === null || secs < prevBest;
  saveBest(secs);
  updateStats();

  const mistakesText = state.mistakes === 0 ? 'no mistakes' : state.mistakes + ' mistake' + (state.mistakes === 1 ? '' : 's');
  setMessage(state.emoji + ' It is a ' + state.name + '!', 'good');
  burstConfetti();
  showModal(
    isRecord ? '🏆 New Best Time!' : '🎉 You Win!',
    'You revealed a ' + state.name + ' in ' + fmtTime(secs) + ' with ' + mistakesText + '.',
    'Play Again',
    () => newGame()
  );
}

function newGame() {
  const set = pick(SETS);
  state = {
    name: set.name,
    emoji: set.emoji,
    fill: set.fill,
    points: set.points,
    next: 1,
    mistakes: 0,
    startedAt: null,
    done: false
  };
  renderBoard();
  updateStats();
  setMessage('A secret picture is hiding! Click dot 1 to start. ✏️');
}

initGameFrame({
  title: 'Connect the Dots',
  emoji: '✏️',
  onRestart: () => newGame()
});

newGame();
