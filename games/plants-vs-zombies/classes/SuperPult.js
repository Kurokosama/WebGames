// 超级投手 —— 卷心菜投手 + 西瓜投手 + 玉米投手三个摞在一起的样子，
// 抛出来的也是三合一：一颗卷心菜、一颗西瓜、一块玉米叠成一坨飞出去。
//
// 普通：每 1.5 秒朝同行最靠前那只僵尸抛一发，落点 240 点伤害。砸中之后会**弹**
//       到同一排里的下一只僵尸接着砸，**一直弹下去**，弹到这一排一只不剩为止；
//       这时候没得弹了，才掉到地上。
//       优先弹给「刚砸过的那只之外」的僵尸；整排只剩一只时就在它身上反复砸。
//       每跳都实打实扣 240，所以这一排迟早被清空，弹射自然收敛。
// 绿叶素大招：对全场每一个目标（含报纸将王）各抛一发**巨大**的三合一，
//       穿越一切障碍物，落点 2400 点。
//
// 抛物线飞行、落点绕过护甲这些公共逻辑在 Lob.js 里。

import { collectTargets, frontTarget, lob, lobFlash, STAGGER_MS, MAX_STAGGER } from './Lob.js';

export const SUPER_INTERVAL = 1500;   // 普通攻击间隔
export const SUPER_DAMAGE = 240;      // 普通那一发
export const SUPER_ULT_DAMAGE = 2400; // 大招那一发
const SIZE = 40;
const BIG_SIZE = 76;
const FALL_MS = 420;                  // 没有下一只时掉到地上的时间

// 三合一的内部结构：上卷心菜、中西瓜、下玉米
const TRI_HTML = '<i class="tp-cabbage"></i><i class="tp-melon"></i><i class="tp-corn"></i>';

// 同一排里的下一个目标：从当前落点往右找最近的，右边没有再往左找。
// just 是刚砸过的那只 —— 只要还有别人就先弹给别人，整排只剩它自己时才弹回它身上。
function nextInRow(game, rowY, fromX, just) {
    const row = Math.floor(rowY / game.cellHeight);
    const pick = (skipJust) => {
        let right = null, left = null;
        for (const z of game.zombies) {
            if (z.markedForDeletion) continue;
            if (skipJust && z === just) continue;
            if (Math.floor(z.y / game.cellHeight) !== row) continue;
            const cx = z.x + z.width / 2;
            if (cx > fromX) { if (!right || cx < right.x + right.width / 2) right = z; }
            else            { if (!left  || cx > left.x  + left.width  / 2) left  = z; }
        }
        return right || left;
    };
    return pick(true) || pick(false);
}

export function superLob(game, plant) {
    const t = frontTarget(game, plant);
    if (!t) return;
    throwAt(game, plant, t);
    game.sound.playShoot();
}

// 抛一发到某个目标身上，砸中后接着弹下一跳，一直弹到这一排空了为止
function throwAt(game, plant, target, from = null) {
    lob(game, plant, target, 0, {
        cls: 'lob-tri', html: TRI_HTML, size: SIZE, from,
        damage: SUPER_DAMAGE, splashCls: 'tri-splash',
        after: (g, t, c) => {
            // 砸在将王身上就没得弹了 —— 他不在任何一「排」里，直接落地
            if (!t.zombie) { fallToGround(g, c); return; }
            const next = nextInRow(g, t.zombie.y, c.x, t.zombie);
            if (next) throwAt(g, plant, { zombie: next }, { x: c.x - SIZE / 2, y: c.y - SIZE / 2 });
            else fallToGround(g, c);   // 这一排一只不剩了，落地
        },
    });
}

// 同排没有下一只了：原地掉到这一行的地面上，摔一下就没了
function fallToGround(game, c) {
    const el = document.createElement('div');
    el.className = 'lob-tri falling';
    el.innerHTML = TRI_HTML;
    el.style.cssText = `left:${c.x - SIZE / 2}px;top:${c.y - SIZE / 2}px;width:${SIZE}px;height:${SIZE}px`;
    game.board.appendChild(el);

    // 落到所在行的行底
    const groundY = (Math.floor(c.y / game.cellHeight) + 1) * game.cellHeight - SIZE - 6;
    const startY = c.y - SIZE / 2;
    const startAt = performance.now();
    const step = (now) => {
        const p = Math.min(1, (now - startAt) / FALL_MS);
        el.style.top = `${startY + (groundY - startY) * p * p}px`;   // p² = 越掉越快
        if (p < 1) { requestAnimationFrame(step); return; }
        el.classList.add('landed');
        setTimeout(() => el.remove(), 260);
    };
    requestAnimationFrame(step);
}

// 绿叶素：全场每个目标各来一发巨大的三合一
export function superVolley(game, plant) {
    const targets = collectTargets(game);
    if (targets.length === 0) {
        lobFlash(game, '🎯 场上没有目标!', 'rgba(120, 90, 200, 0.92)');
        return;
    }

    plant.element?.classList.add('super-charged');
    setTimeout(() => plant.element?.classList.remove('super-charged'), 2200);

    targets.forEach((t, i) => lob(game, plant, t, Math.min(i * STAGGER_MS, MAX_STAGGER), {
        cls: 'lob-tri big', html: TRI_HTML, size: BIG_SIZE,
        damage: SUPER_ULT_DAMAGE, splashCls: 'tri-splash big',
    }));

    game.sound.playExplosion();
    lobFlash(game, `🎯 三合一齐射! ${targets.length} 发 × ${SUPER_ULT_DAMAGE}`, 'rgba(120, 90, 200, 0.92)');
}
