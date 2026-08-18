// 报纸将王低头时吐出来的球 —— 熔岩球 🔴 和寒冰球 🔵。
//
// 低头那阵子他会张嘴，随机挑一行吐一个球出来。球贴着那一行往左滚，
// 把沿途的植物**压扁**（直接铲掉），只有坚果和血量无限的植物压不动。
// 寒冰菇每爆炸一次，会把场上所有的球一起消掉。
//
// 球速是固定的，不跟 J / H 的节奏倍率走。

const BALL_SPEED = 0.075;     // px/ms，慢慢滚（按 J 会跟着加速）
const CRUSH_RANGE = 46;       // 离植物中心多近算压到

// 压不动的：坚果，以及血量无限的（阳光帝果 / 倭瓜这种）。
// 这类植物不但压不扁，还会把球整个挡下来 —— 球撞上去就碎。
function isCrushProof(plant) {
    return plant.type === 'wallnut' || plant.maxHealth === Infinity;
}

export function spitBall(game, boss, kind) {
    const row = Math.floor(Math.random() * game.height);
    const y = row * game.cellHeight + 20;

    const el = document.createElement('div');
    el.className = `boss-ball ${kind}`;
    el.style.left = `${boss.x + 40}px`;
    el.style.top = `${y}px`;
    game.board.appendChild(el);

    game.bossBalls = game.bossBalls || [];
    game.bossBalls.push({ el, x: boss.x + 40, y, row, kind });

    // 张嘴吐球的动作。连发时后一颗要把前一颗的收嘴定时器顶掉，
    // 否则嘴会在还在喷的时候提前合上
    boss.element?.classList.add('boss-spit');
    clearTimeout(boss._spitFxT);
    boss._spitFxT = setTimeout(() => boss.element?.classList.remove('boss-spit'), 520);
    game.sound?.playExplosion();
}

// 每帧推进：往左滚，压扁沿途的植物，滚出棋盘就没了
export function updateBossBalls(game, dt) {
    const balls = game.bossBalls;
    if (!balls || balls.length === 0) return;

    for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (b.stopped) continue;      // 被挡住的寒冰球就停在原地
        b.x -= BALL_SPEED * dt;
        b.el.style.left = `${b.x}px`;

        // 撞到坚果 / 无敌植物：熔岩球和寒冰球一样，都只是被**挡住**，
        // 停在那儿不动，不会消失（要清掉它得靠寒冰菇）
        if (crushRow(game, b)) {
            b.stopped = true;
            b.el.classList.add('stopped');
        }

        if (b.x < -80) {
            b.el.remove();
            balls.splice(i, 1);
        }
    }
}

// 压扁这一行上被球碾到的植物。撞上挡得住的那种就返回 true（球该碎了）
function crushRow(game, b) {
    const row = b.row;
    let blocked = false;

    for (let c = 0; c < game.width; c++) {
        const stack = game.grid[row][c];
        if (!stack || stack.length === 0) continue;
        const cx = c * game.cellWidth + 40;
        if (Math.abs(cx - b.x) > CRUSH_RANGE) continue;

        // 一格里除了坚果和无敌植物，其余全压扁；有挡得住的就把球拦下来
        const keep = [];
        let smashed = 0;
        for (const p of stack) {
            if (isCrushProof(p)) { keep.push(p); blocked = true; guardFx(p); continue; }
            squashFx(game, p);
            p.remove();
            smashed++;
        }
        if (smashed) {
            game.grid[row][c] = keep;
            game.sound?.playZombieDie();
        }
    }
    return blocked;
}

// 挡下来的那株闪一下，表示「这一下我接住了」
// 球一多，这里就会被反复调用 —— 不能用 void offsetWidth 强制重排来重启动画
// （那玩意儿把整帧拖到过 500ms）。改成一个开关：正在闪就不重复挂类。
function guardFx(plant) {
    if (!plant.element || plant._guardFlashing) return;
    plant._guardFlashing = true;
    plant.element.classList.add('ball-guard');
    setTimeout(() => {
        plant._guardFlashing = false;
        plant.element?.classList.remove('ball-guard');
    }, 420);
}


// 被压扁时那一下的印子
function squashFx(game, plant) {
    const el = document.createElement('div');
    el.className = 'boss-ball-squash';
    el.style.left = `${plant.x + 40}px`;
    el.style.top = `${plant.y + 60}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 420);
}

// 寒冰菇一爆炸，场上的球全消掉
export function clearBossBalls(game) {
    const balls = game.bossBalls;
    if (!balls || balls.length === 0) return 0;
    const n = balls.length;
    for (const b of balls) {
        b.el.classList.add('popping');
        setTimeout(() => b.el.remove(), 320);
    }
    game.bossBalls = [];
    return n;
}
