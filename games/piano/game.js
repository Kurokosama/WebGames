'use strict';

const NOTES = [
  { name: 'C', key: 'a', freq: 261.63 },
  { name: 'D', key: 's', freq: 293.66 },
  { name: 'E', key: 'd', freq: 329.63 },
  { name: 'F', key: 'f', freq: 349.23 },
  { name: 'G', key: 'g', freq: 392.00 },
  { name: 'A', key: 'h', freq: 440.00 },
  { name: 'B', key: 'j', freq: 493.88 },
  { name: 'C5', key: 'k', freq: 523.25 }
];

// Twinkle Twinkle Little Star: C C G G A A G | F F E E D D C
const MELODY = [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 0, 0];
const BEST_KEY = 'best-piano';

let mode = 'free';
let notesPlayed = 0;
let progress = 0;
let wrong = 0;
let best = 0;
let finished = false;
let audioCtx = null;

const pianoEl = $('#piano');
const trackEl = $('#melody-track');

// ---------- Audio ----------
function getAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq) {
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.32, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.7);
}

// ---------- Build keyboard ----------
function buildPiano() {
  pianoEl.innerHTML = '';
  NOTES.forEach((note, i) => {
    const btn = document.createElement('button');
    btn.className = 'key';
    btn.dataset.i = i;
    btn.setAttribute('aria-label', 'Play note ' + note.name);

    const label = document.createElement('span');
    label.className = 'note';
    label.textContent = note.name;
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = note.key.toUpperCase();

    btn.appendChild(label);
    btn.appendChild(hint);
    btn.addEventListener('click', () => press(i));
    pianoEl.appendChild(btn);
  });
}

function buildTrack() {
  trackEl.innerHTML = '';
  MELODY.forEach(() => {
    const dot = document.createElement('span');
    dot.className = 'dot';
    trackEl.appendChild(dot);
  });
}

// ---------- Status bar ----------
function updateStats() {
  $('#notes').textContent = notesPlayed;
  $('#progress').textContent = mode === 'free' ? 'Free Play' : progress + '/' + MELODY.length;
  $('#best').textContent = best;

  const dots = $$('.dot', trackEl);
  dots.forEach((dot, i) => {
    dot.classList.toggle('done', i < progress);
    dot.classList.toggle('next', i === progress && !finished);
  });

  $$('.key', pianoEl).forEach((key, i) => {
    key.classList.toggle('glow', mode === 'lights' && !finished && i === MELODY[progress]);
  });
}

function flashKey(index, cls) {
  const key = pianoEl.querySelector('.key[data-i="' + index + '"]');
  if (!key) return;
  key.classList.add(cls);
  setTimeout(() => key.classList.remove(cls), cls === 'pressed' ? 220 : 400);
}

// ---------- Gameplay ----------
function press(index) {
  const note = NOTES[index];
  if (!note) return;

  getAudio(); // resume on first user gesture
  playTone(note.freq);
  flashKey(index, 'pressed');
  notesPlayed++;

  if (mode === 'lights' && !finished) {
    if (index === MELODY[progress]) {
      progress++;
      if (progress >= MELODY.length) {
        finished = true;
        best = Math.max(best, progress);
        saveBest();
        updateStats();
        burstConfetti();
        showModal(
          '🎉 You Win!',
          'You played Twinkle Twinkle Little Star perfectly with ' + wrong + ' wrong note' + (wrong === 1 ? '' : 's') + '. Amazing!',
          'Play Again',
          () => start(mode)
        );
        return;
      }
    } else {
      wrong++;
      progress = 0;
      flashKey(index, 'wrong');
    }
  }

  updateStats();
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch (err) {
    /* localStorage may be unavailable */
  }
}

function start(nextMode) {
  mode = nextMode;
  notesPlayed = 0;
  progress = 0;
  wrong = 0;
  finished = false;

  try {
    best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (err) {
    best = 0;
  }

  trackEl.classList.toggle('hidden', mode !== 'lights');
  hideModal();
  updateStats();
}

// ---------- Computer keyboard ----------
const KEY_MAP = {};
NOTES.forEach((note, i) => { KEY_MAP[note.key] = i; });

document.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey) return;
  const index = KEY_MAP[e.key.toLowerCase()];
  if (index === undefined) return;
  e.preventDefault();
  press(index);
});

// ---------- Frame ----------
buildPiano();
buildTrack();

initGameFrame({
  title: 'Piano',
  emoji: '🎹',
  difficulties: [
    { value: 'free', label: 'Free Play' },
    { value: 'lights', label: 'Follow the Lights' }
  ],
  defaultDifficulty: 'free',
  onDifficulty: (d) => start(d),
  onRestart: () => start(mode)
});

start('free');
