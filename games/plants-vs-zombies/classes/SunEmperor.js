// 阳光帝果 👑🌰 —— 黄色的坚果，头上再顶一颗小一号的坚果，两颗的左右都长着
// 向日葵的花瓣。血量无限，杵在那儿谁也啃不动。
//
// 点它一下（每点一下消耗 500 阳光）：
//   · 自己回满血
//   · 在它**前面那一格**攒出一颗坚果保龄球，3 秒后顺着这一行滚出去碾人
//   · 球同时只攒一颗：滚出去之前继续点，是把这一颗越点越大
//   · 滚出去之后清零 —— 下一颗从最小的重新开始长
//
// 绿叶素大招：一口气滚出一大片保龄球，全是最小号的，五行一起铺过去。
//
// 保龄球本身也是阳光帝果那一套长相：黄色的球，两边各一片向日葵花瓣。

import { spawnProjectile } from './CombatManager.js';
import { updateSunDisplay } from './SunManager.js';

const SUN_COST = 500;          // 每点一下扣多少阳光
const ROLL_DELAY = 3000;       // 攒球到滚出去的时间
const BALL_STEP = 0.35;        // 每多点一次，球大一圈
const BALL_BASE = 56;          // 最小号保龄球的直径（px）
const ULT_PER_ROW = 8;         // 大招每行滚几颗
const ULT_GAP = 46;            // 大招里相邻两颗的横向间距

export function ballScale(plant) {
    return plant._seBall || 1;
}

function ballSize(plant) {
    return BALL_BASE * ballScale(plant);
}

// 球摆在阳光帝果前面那一格的正中
function ballCenterX(game, plant) {
    return Math.min(game.boardWidth - 20, plant.x + game.cellWidth + 40);
}

// 点了一下阳光帝果。不是这株就返回 false，让点击继续往下走。
export function sunEmperorClick(game, row, col) {
    const stack = game.grid[row] && game.grid[row][col];
    if (!stack || stack.length === 0) return false;
    const top = stack[stack.length - 1];
    if (top.type !== 'sunemperor' || top.markedForDeletion) return false;

    if (!(game.suns >= SUN_COST)) {
        game.showNotEnoughFeedback(`👑 阳光不够 ${SUN_COST}`);
        return true;
    }
    if (game.suns !== Infinity) {
        game.suns -= SUN_COST;
        updateSunDisplay(game);
    }

    // 回血 + 一圈金色的回血光
    top.health = top.maxHealth;
    if (top.element) {
        top.element.classList.remove('se-heal');
        void top.element.offsetWidth;
        top.element.classList.add('se-heal');
        setTimeout(() => top.element?.classList.remove('se-heal'), 700);
    }

    // 正在攒的那颗撑大一圈；没在攒就从最小号重新起一颗
    if (top._sePending) {
        top._seBall = ballScale(top) + BALL_STEP;
    } else {
        top._seBall = 1;
        top._sePending = { left: ROLL_DELAY, el: heldBall(game) };
    }
    sizeHeld(game, top);

    game.sound.playPlant();
    game.showNotEnoughFeedback(`👑 −${SUN_COST} 阳光 · 保龄球 ${Math.round(ballSize(top))}px`);
    return true;
}

// 每帧推进倒计时，到点把攒着的那颗放出去
export function sunEmperorTick(plant, game) {
    // 绿叶素大招：一片最小号的保龄球铺满全场
    if (plant.ultimateMs > 0) {
        if (!plant._seUlt) {
            plant._seUlt = true;
            ultimate(game, plant);
        }
        return;
    }
    plant._seUlt = false;

    const pending = plant._sePending;
    if (!pending) return;

    pending.left -= game.deltaTime || 16;
    if (pending.left > 0) return;

    pending.el?.remove();
    plant._sePending = null;
    rollBall(game, plant, ballScale(plant), plant.y);

    // 滚完清零：下一颗从最小的重新开始长
    plant._seBall = 1;
}

function ultimate(game, plant) {
    let n = 0;
    for (let r = 0; r < game.height; r++) {
        for (let i = 0; i < ULT_PER_ROW; i++) {
            // 全是最小号的，横向排开一串滚出去
            const x = ballCenterX(game, plant) - i * ULT_GAP;
            if (rollBall(game, plant, 1, r * game.cellHeight, x)) n++;
        }
    }
    game.showNotEnoughFeedback(`👑 保龄球洪流! ${n} 颗滚出去了`);
}

// 攒球期间摆在前面那一格的球
function heldBall(game) {
    const el = document.createElement('div');
    el.className = 'se-held-ball se-ball';
    el.innerHTML = '<i class="se-ball-petal l"></i><i class="se-ball-petal r"></i>';
    game.board.appendChild(el);
    return el;
}

function sizeHeld(game, plant) {
    const p = plant._sePending;
    if (!p || !p.el) return;
    const size = ballSize(plant);
    p.el.style.width = `${size}px`;
    p.el.style.height = `${size}px`;
    p.el.style.left = `${ballCenterX(game, plant) - size / 2}px`;
    p.el.style.top = `${plant.y + 50 - size / 2}px`;
}

// 放出去一颗：从阳光帝果前面那一格开始滚，一路滚出屏幕都不会缩
function rollBall(game, plant, scale, rowY, x = null) {
    const size = BALL_BASE * scale;
    const cx = x === null ? ballCenterX(game, plant) : x;
    const ball = spawnProjectile(game, cx - size / 2, rowY + 50 - size / 2, 'bowling', plant);
    if (!ball) return false;   // 撞到子弹上限了

    // 撑大碰撞盒和 DOM，越点越大的那颗就是这么来的
    ball.width = size;
    ball.height = size;
    if (ball.element) {
        ball.element.style.width = `${size}px`;
        ball.element.style.height = `${size}px`;
        // 黄色球 + 两边花瓣，和阳光帝果一套长相
        ball.element.classList.add('se-ball');
        ball.element.innerHTML = '<i class="se-ball-petal l"></i><i class="se-ball-petal r"></i>';
    }
    game.sound.playExplosion();
    return true;
}
