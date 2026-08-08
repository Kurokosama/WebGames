'use strict';

const PADS = [
  { key: 'green', color: '#06d6a0', freq: 523 },
  { key: 'red', color: '#ff7e67', freq: 659 },
  { key: 'yellow', color: '#ffd166', freq: 784 },
  { key: 'blue', color: '#4cc9f0', freq: 1047 }
];

const SPEEDS = { easy: 950, medium: 700, hard: 480 };

let state = null;
let audioCtx = null;
let sessionBest = 0;

function init(diff) {
  state = {
    diff,
    seq: [],
    playerIdx: 0,
    playing: false,
    speed: SPEEDS[diff]
  };
  $('#round').textContent = '1';
  $('#best').textContent = sessionBest;
  buildPads();
  setFeedback('Watch the colors… 👀');
  setTimeout(() => nextRound(), 800);
}

function buildPads() {
  const grid = $('#pads');
  grid.innerHTML = '';
  PADS.forEach((pad, i) => {
    const el = document.createElement('button');
    el.className = 'pad ' + pad.key;
    el.addEventListener('click', () => padClick(i));
    grid.appendChild(el);
  });
}

function nextRound() {
  state.seq.push(randInt(0, 3));
  state.playerIdx = 0;
  $('#round').textContent = state.seq.length;
  playSequence();
}

function playSequence() {
  state.playing = true;
  setFeedback('Watch the colors… 👀');
  let i = 0;
  const step = () => {
    if (state.playing === false) return;
    if (i >= state.seq.length) {
      state.playing = false;
      setFeedback('Your turn! Repeat the pattern!');
      return;
    }
    flash(i, state.seq[i]);
    i++;
    setTimeout(step, state.speed);
  };
  setTimeout(step, 450);
}

function flash(i, idx) {
  const pads = $$('#pads .pad');
  const el = pads[idx];
  el.classList.add('active');
  beep(PADS[idx].freq);
  setTimeout(() => el.classList.remove('active'), state.speed * 0.62);
}

function padClick(idx) {
  if (state.playing) return;
  flash(0, idx);
  if (idx !== state.seq[state.playerIdx]) {
    gameOver();
    return;
  }
  state.playerIdx++;
  if (state.playerIdx >= state.seq.length) {
    sessionBest = Math.max(sessionBest, state.seq.length);
    $('#best').textContent = sessionBest;
    setFeedback('✅ Correct! Next round…');
    setTimeout(nextRound, 800);
  }
}

function gameOver() {
  const rounds = state.seq.length - 1;
  showModal('😅 Game Over', `You completed ${rounds} round${rounds === 1 ? '' : 's'}!`, 'Play Again', () => init(state.diff));
}

function setFeedback(text) {
  $('#feedback').textContent = text;
}

function beep(freq) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) { /* audio optional */ }
}

initGameFrame({
  title: 'Simon Says',
  emoji: '🎵',
  difficulties: [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
