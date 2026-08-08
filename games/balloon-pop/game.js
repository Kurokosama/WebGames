'use strict';

const DIFFS = {
  easy: { speed: 55, spawn: 720, time: 60 },
  medium: { speed: 85, spawn: 520, time: 45 },
  hard: { speed: 125, spawn: 360, time: 30 }
};

const COLORS = ['#ff7e67', '#ffd166', '#4cc9f0', '#9b7edb', '#f47ba1', '#06d6a0'];

let state = null;
let raf = null;
let spawnTimer = null;
let countdown = null;

function init(diff) {
  cancelAnimationFrame(raf);
  clearTimeout(spawnTimer);
  clearInterval(countdown);
  const cfg = DIFFS[diff];
  state = { diff, cfg, score: 0, time: cfg.time, over: false, balloons: [], last: performance.now(), areaW: 0, areaH: 0 };

  const area = $('#area');
  area.innerHTML = '';
  state.areaW = area.clientWidth;
  state.areaH = area.clientHeight;

  $('#score').textContent = '0';
  $('#time').textContent = state.time + 's';

  countdown = setInterval(() => {
    state.time--;
    $('#time').textContent = state.time + 's';
    if (state.time <= 0) endGame();
  }, 1000);

  spawnTimer = setInterval(spawn, cfg.spawn);
  state.last = performance.now();
  raf = requestAnimationFrame(loop);
}

function spawn() {
  if (state.over) return;
  const area = $('#area');
  const size = randInt(44, 66);
  const el = document.createElement('div');
  el.className = 'balloon';
  el.style.width = size + 'px';
  el.style.height = Math.round(size * 1.25) + 'px';
  el.style.left = randInt(10, Math.max(10, state.areaW - size - 10)) + 'px';
  el.style.background = pick(COLORS);
  el.style.bottom = '0px';
  el.addEventListener('click', () => pop(el));
  area.appendChild(el);
  state.balloons.push({ el, y: state.areaH + 40, speed: state.cfg.speed * (0.8 + Math.random() * 0.7) });
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  state.balloons.forEach((b) => {
    b.y -= (b.speed * dt) / 1000;
    b.el.style.bottom = b.y + 'px';
  });
  // remove off-screen
  state.balloons = state.balloons.filter((b) => {
    if (b.y < -120) {
      b.el.remove();
      return false;
    }
    return true;
  });
  if (!state.over) raf = requestAnimationFrame(loop);
}

function pop(el) {
  if (state.over) return;
  const idx = state.balloons.findIndex((b) => b.el === el);
  if (idx === -1) return;
  const [b] = state.balloons.splice(idx, 1);
  el.remove();

  // burst effect
  const burst = document.createElement('div');
  burst.className = 'burst';
  burst.textContent = '💥';
  burst.style.left = el.style.left;
  burst.style.bottom = b.y + 'px';
  $('#area').appendChild(burst);
  setTimeout(() => burst.remove(), 450);

  state.score++;
  $('#score').textContent = state.score;
}

function endGame() {
  state.over = true;
  cancelAnimationFrame(raf);
  clearTimeout(spawnTimer);
  clearInterval(countdown);
  showModal('⏰ Time’s Up!', `You popped ${state.score} balloons!`, 'Play Again', () => init(state.diff));
}

initGameFrame({
  title: 'Balloon Pop',
  emoji: '🎈',
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
