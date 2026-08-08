'use strict';

const TOTAL = 5;
let state = null;
let goTimer = null;
let roundStart = 0;

function init() {
  clearTimeout(goTimer);
  state = {
    round: 0,
    times: [],
    best: null,
    ready: false,
    locked: false
  };
  $('#round').textContent = '0/5';
  $('#best').textContent = '—';
  $('#avg').textContent = '—';
  setZone('waiting', 'Wait for green…');
}

function startRound() {
  if (state.round >= TOTAL) return;
  setZone('waiting', 'Wait for green…');
  state.locked = false;
  state.ready = false;
  const delay = randInt(1400, 4200);
  clearTimeout(goTimer);
  goTimer = setTimeout(() => {
    state.ready = true;
    state.locked = false;
    roundStart = performance.now();
    setZone('ready', 'CLICK NOW! ⚡');
  }, delay);
}

function clickZone() {
  if (state.locked) return;

  if (state.ready) {
    state.locked = true;
    const ms = Math.round(performance.now() - roundStart);
    state.times.push(ms);
    state.round++;
    if (state.best === null || ms < state.best) state.best = ms;
    $('#round').textContent = `${state.round}/${TOTAL}`;
    $('#best').textContent = state.best + 'ms';
    const avg = Math.round(state.times.reduce((a, b) => a + b, 0) / state.times.length);
    $('#avg').textContent = avg + 'ms';
    setZone('flashed', `⚡ ${ms}ms!`);
    if (state.round >= TOTAL) {
      setTimeout(finish, 900);
    } else {
      setTimeout(startRound, 900);
    }
  } else {
    // too soon
    state.locked = true;
    setZone('too-soon', 'Too soon! Wait for green… 😅');
    clearTimeout(goTimer);
    setTimeout(() => {
      state.locked = false;
      startRound();
    }, 1200);
  }
}

function finish() {
  const avg = Math.round(state.times.reduce((a, b) => a + b, 0) / state.times.length);
  burstConfetti();
  showModal('⚡ All Done!', `Your best reaction was ${state.best}ms, average ${avg}ms!`, 'Play Again', init);
}

function setZone(cls, text) {
  const zone = $('#zone');
  zone.className = 'reaction-zone ' + cls;
  zone.textContent = text;
}

$('#zone').addEventListener('click', clickZone);

initGameFrame({
  title: 'Reaction Test',
  emoji: '⚡',
  difficulties: [],
  onRestart: init
});

init();
