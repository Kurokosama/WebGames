'use strict';

const DIFFS = {
  easy: { dur: 1200, spawn: 750 },
  medium: { dur: 900, spawn: 550 },
  hard: { dur: 650, spawn: 400 }
};

let state = null;
let timers = [];
let countdown = null;
let sessionBest = 0;

function init(diff) {
  clearTimers();
  state = {
    diff,
    score: 0,
    time: 30,
    holes: [],
    over: false
  };
  $('#score').textContent = '0';
  $('#time').textContent = '30s';
  $('#best').textContent = sessionBest;
  buildBoard();
  countdown = setInterval(() => {
    state.time--;
    $('#time').textContent = state.time + 's';
    if (state.time <= 0) endGame();
  }, 1000);
  scheduleSpawn(600);
}

function clearTimers() {
  clearInterval(countdown);
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

function buildBoard() {
  const board = $('#board');
  board.innerHTML = '';
  state.holes = [];
  for (let i = 0; i < 9; i++) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    const mole = document.createElement('div');
    mole.className = 'mole';
    mole.textContent = '🐹';
    hole.appendChild(mole);
    const h = { el: hole, mole, active: false };
    hole.addEventListener('click', () => whack(h));
    board.appendChild(hole);
    state.holes.push(h);
  }
}

function scheduleSpawn(delay) {
  timers.push(setTimeout(spawn, delay));
}

function spawn() {
  if (state.over) return;
  const free = state.holes.filter((h) => !h.active);
  if (free.length === 0) {
    scheduleSpawn(300);
    return;
  }
  const hole = pick(free);
  hole.active = true;
  hole.mole.textContent = '🐹';
  hole.mole.classList.add('show');
  hole.mole.classList.remove('whacked');

  const cfg = DIFFS[state.diff];
  timers.push(setTimeout(() => {
    hole.active = false;
    hole.mole.classList.remove('show');
  }, cfg.dur * (0.7 + Math.random() * 0.6)));

  scheduleSpawn(cfg.spawn * (0.6 + Math.random() * 0.8));
}

function whack(hole) {
  if (state.over) return;
  if (!hole.active) return;
  hole.active = false;
  state.score++;
  $('#score').textContent = state.score;
  if (state.score > sessionBest) {
    sessionBest = state.score;
    $('#best').textContent = sessionBest;
  }
  hole.mole.textContent = '🥊';
  hole.mole.classList.add('whacked');
  timers.push(setTimeout(() => hole.mole.classList.remove('show', 'whacked'), 250));
}

function endGame() {
  state.over = true;
  clearTimers();
  showModal('⏰ Time’s Up!', `You whacked ${state.score} moles!`, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Whack-a-Mole',
  emoji: '🔨',
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
