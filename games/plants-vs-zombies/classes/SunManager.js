export function spawnSun(game, x, startY, value) {
    const sun = document.createElement('div');
    sun.classList.add('sun');
    sun.innerText = '☀️';
    sun.style.left = `${x}px`;
    sun.style.top = `${startY}px`;
    sun.dataset.value = value;
    sun.dataset.tip = '阳光 — 点击收集（仅展示用）';

    game.board.appendChild(sun);

    const targetY = Math.random() * (game.board.offsetHeight - 100) + 50;
    setTimeout(() => { sun.style.top = `${targetY}px`; }, 100);
    setTimeout(() => { if (sun.parentNode) collectSun(game, sun); }, 1000);
}

export function collectSun(game, sunEl) {
    const value = parseInt(sunEl.dataset.value);
    game.suns += value;
    updateSunDisplay(game);
    game.sound.playCollectSun();

    sunEl.style.transition = 'all 0.5s ease-in';
    sunEl.style.top = '0px';
    sunEl.style.left = '0px';
    sunEl.style.opacity = '0';

    setTimeout(() => { sunEl.remove(); }, 500);
}

export function updateSunDisplay(game) {
    game.sunCounter.innerText = game.suns === Infinity ? '∞' : Math.floor(game.suns);
}
