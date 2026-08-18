// 奖杯投手 🏆 —— 一块板子上摆着一个奖杯，每隔几秒往草坪上抛一个奖杯出去。
//
// 抛出来的奖杯有两种，落地就摆在那儿等你点：
//   · 80% 是**胜利奖杯**（金的）—— 点一下，这一关直接通关
//   · 20% 是**失败奖杯**（铜的）—— 点一下，直接输
//
// 也就是说：看清楚颜色再点。金的是好事，铜的点了就完。

const THROW_MS = 5000;      // 每隔多久抛一个
const FAIL_RATE = 0.2;      // 抛出铜杯（失败奖杯）的概率
const FLY_MS = 700;         // 飞过去的时间
const ARC = 150;            // 抛物线弧顶

export function trophyPultTick(plant, game) {
    if (plant.timer < THROW_MS) return;
    plant.timer = 0;
    throwTrophy(game, plant);
}

function throwTrophy(game, plant) {
    // 随便挑一格空地落下（实在没有空地就随便挑一格）
    const spots = [];
    for (let r = 0; r < game.height; r++) {
        for (let c = 0; c < game.width; c++) spots.push({ r, c });
    }
    const spot = spots[Math.floor(Math.random() * spots.length)];
    const tx = spot.c * game.cellWidth + 40;
    const ty = spot.r * game.cellHeight + 50;

    const win = Math.random() >= FAIL_RATE;

    const el = document.createElement('div');
    el.className = `pult-trophy ${win ? 'win' : 'fail'} flying`;
    el.innerHTML = '<span class="pt-cup">🏆</span>';
    el.dataset.tip = win ? '胜利奖杯（金）— 点一下直接通关' : '失败奖杯（铜）— 点一下直接输';
    el.style.left = `${plant.x + 20}px`;
    el.style.top = `${plant.y + 10}px`;
    game.board.appendChild(el);

    const sx = plant.x + 20;
    const sy = plant.y + 10;
    const t0 = performance.now();

    const step = (now) => {
        const p = Math.min(1, (now - t0) / FLY_MS);
        el.style.left = `${sx + (tx - 20 - sx) * p}px`;
        el.style.top = `${sy + (ty - 24 - sy) * p - Math.sin(Math.PI * p) * ARC}px`;
        el.style.transform = `rotate(${p * 360}deg)`;
        if (p < 1) { requestAnimationFrame(step); return; }
        el.style.transform = '';
        el.classList.remove('flying');
        el.classList.add('landed');
    };
    requestAnimationFrame(step);

    let taken = false;
    el.addEventListener('click', (e) => {
        // 别让棋盘的点击再接一手（不然会当成往这一格种东西）
        e.stopPropagation();
        if (taken) return;
        taken = true;
        el.remove();

        if (win) {
            game.showNotEnoughFeedback('🏆 胜利奖杯! 这一关过了');
            game.won = true;
            game.victory();
        } else {
            game.showNotEnoughFeedback('🥉 铜的…失败奖杯');
            game.gameOver();
        }
    });

    game.sound?.playShoot();
}

// 换关 / 重开时把场上没点的奖杯收掉
export function clearPultTrophies(game) {
    game.board.querySelectorAll('.pult-trophy').forEach(el => el.remove());
}
