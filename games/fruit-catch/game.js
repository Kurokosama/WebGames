'use strict';

const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🍉', '🍍', '🥝', '🍊', '🍋', '🍐'];

const DIFFS = {
  easy: { speed: 130, spawn: 850 },
  medium: { speed: 190, spawn: 620 },
  hard: { speed: 260, spawn: 440 }
};

let state = null;
let raf = null;
let spawnTimer = null;
let countdown = null;

function init(diff) {
  cancelAnimationFrame(raf);
  clearTimeout(spawnTimer);
  clearInterval(countdown);

  const cfg = DIFFS[diff];
  state = {
    diff, cfg,
    score: 0, lives: 3, time: 60, over: false,
    fruits: [], last: performance.now(), areaW: 0, areaH: 0, basketX: 0
  };

  const area = $('#area');
  $('#area').innerHTML = '<div class="basket" id="basket">🧺</div>';
  state.areaW = area.clientWidth;
  state.areaH = area.clientHeight;
  state.basketX = state.areaW / 2;
  const basket = $('#basket');
  basket.style.left = state.basketX + 'px';

  $('#score').textContent = '0';
  $('#lives').textContent = '❤️❤️❤️';
  $('#time').textContent = '60s';

  countdown = setInterval(() => {
    state.time--;
    $('#time').textContent = state.time + 's';
    if (state.time <= 0) endGame(false);
  }, 1000);

  spawnTimer = setInterval(spawn, cfg.spawn);
  state.last = performance.now();
  raf = requestAnimationFrame(loop);
}

function spawn() {
  if (state.over) return;
  const el = document.createElement('div');
  el.className = 'fruit';
  el.textContent = pick(FRUITS);
  el.style.left = randInt(15, Math.max(15, state.areaW - 40)) + 'px';
  $('#area').appendChild(el);
  state.fruits.push({ el, y: -50, speed: state.cfg.speed * (0.8 + Math.random() * 0.6) });
}

function loop(now) {
  const dt = Math.min(50, now - state.last);
  state.last = now;
  const area = $('#area');
  const basket = $('#basket');
  const basketRect = basket.getBoundingClientRect();
  const areaRect = area.getBoundingClientRect();

  state.fruits.forEach((f) => {
    f.y += (f.speed * dt) / 1000;
    f.el.style.top = f.y + 'px';

    const fr = f.el.getBoundingClientRect();
    const bx = basketRect.left - areaRect.left;
    const by = basketRect.top - areaRect.top;
    // collision with basket
    const frLeft = fr.left - areaRect.left;
    const frTop = fr.top - areaRect.top;
    if (frLeft + fr.width > bx && frLeft < bx + basketRect.width &&
        frTop + fr.height > by && frTop < by + basketRect.height) {
      catchFruit(f);
    } else if (f.y > state.areaH + 40) {
      missFruit(f);
    }
  });
  if (!state.over) raf = requestAnimationFrame(loop);
}

function catchFruit(f) {
  const idx = state.fruits.indexOf(f);
  if (idx === -1) return;
  state.fruits.splice(idx, 1);
  f.el.remove();
  state.score++;
  $('#score').textContent = state.score;
}

function missFruit(f) {
  const idx = state.fruits.indexOf(f);
  if (idx === -1) return;
  state.fruits.splice(idx, 1);
  f.el.remove();
  state.lives--;
  $('#lives').textContent = '❤️'.repeat(state.lives) + '🖤'.repeat(3 - state.lives);
  if (state.lives <= 0) endGame(true);
}

function endGame(lostLives) {
  state.over = true;
  cancelAnimationFrame(raf);
  clearTimeout(spawnTimer);
  clearInterval(countdown);
  if (lostLives) {
    showModal('😅 Out of Lives!', `You caught ${state.score} fruits!`, 'Play Again', () => init(state.diff));
  } else {
    showModal('⏰ Time’s Up!', `You caught ${state.score} fruits!`, 'Play Again', () => init(state.diff));
  }
}

$('#area').addEventListener('mousemove', (e) => {
  if (!state || state.over) return;
  const rect = $('#area').getBoundingClientRect();
  const x = e.clientX - rect.left;
  state.basketX = Math.max(40, Math.min(state.areaW - 40, x));
  $('#basket').style.left = state.basketX + 'px';
});

initGameFrame({
  title: 'Fruit Catch',
  emoji: '🍓',
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
