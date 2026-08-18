// 超级机枪 🪖 —— 戴钢盔的豌豆。
//
// 常规：每 0.5 秒泼出一梭子豌豆，起步 6 颗，每颗 20 点伤害。
// 升级：喂一次绿叶素，连发数永久 +1（6 → 7 → 8 …）；而且在大招那 2 秒里
//       每点这株一下再 +1，点几下加几连。升级存在植物身上，铲掉就没了；
//       同格叠种的每株各算各的。
// 散射：每打满 5 轮（约 2.5 秒）自动触发一次，向前扇形喷出 150 颗散射豌豆，
//       每颗同样 20 伤，纵向速度从 -SPREAD 均匀铺到 +SPREAD，扫掉整个屏幕。

import { spawnProjectile } from './CombatManager.js';

const PEAS_PER_VOLLEY = 6;
const SCATTER_COUNT = 150;
const SCATTER_SPREAD = 3.2;   // 散射豌豆的最大纵向速度（px/帧）
const LANE_SIZE = 8;          // 一条弹链最多几颗，超了另起一条
const LANE_DY = 9;            // 相邻弹链的纵向间距
const MAX_DY = 34;            // 弹链最多偏离行中心多少，别喷到隔壁行去

export function mgPeaCount(plant) {
    return plant._mgPeas || PEAS_PER_VOLLEY;
}

// 连发数永久 +1（喂绿叶素、大招期间点击都走这里）
export function mgUpgrade(game, plant) {
    plant._mgPeas = mgPeaCount(plant) + 1;
    game.showNotEnoughFeedback(`🪖 连发 +1 → ${plant._mgPeas} 连`);

    if (plant.element) {
        let badge = plant.element.querySelector('.mg-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'mg-badge';
            plant.element.appendChild(badge);
        }
        badge.textContent = `${plant._mgPeas}连`;
    }
}

// 绿叶素大招期间（那 2 秒里），每点这株一下就再 +1 连 —— 手速有多快就加多少。
// 大招没开的时候点它没有任何反应。点中了返回 true，让点击事件到此为止。
// 只作用于这一格的栈顶那株（叠种时跑的也是栈顶那株）。
export function mgClickUpgrade(game, row, col) {
    const stack = game.grid[row] && game.grid[row][col];
    if (!stack || stack.length === 0) return false;
    const top = stack[stack.length - 1];
    if (top.type !== 'supermg' || top.markedForDeletion) return false;
    if (!(top.ultimateMs > 0)) return false;
    mgUpgrade(game, top);
    return true;
}

export function mgVolley(game, plant) {
    const x0 = plant.x + 40;
    const y0 = plant.y + 20;
    const n = mgPeaCount(plant);

    for (let i = 0; i < n; i++) {
        // x 上错开成一条弹链、y 上小幅交错，看起来像一梭子连发。
        // 涨到 8 颗以上就另起一条弹链往上下铺，不然会一路排到屏幕右边去。
        const lane = Math.floor(i / LANE_SIZE);
        const laneDy = Math.min(MAX_DY, lane * LANE_DY) * (lane % 2 ? -1 : 1);
        const dx = (i % LANE_SIZE) * 13;
        const dy = (i % 2 ? 6 : -6) + laneDy;
        spawnProjectile(game, x0 + dx, y0 + dy, 'mgpea', plant);
    }
    game.sound.playShoot();
}

export function mgScatter(game, plant) {
    const x0 = plant.x + 40;
    const y0 = plant.y + 20;

    for (let i = 0; i < SCATTER_COUNT; i++) {
        // t 从 -1 均匀铺到 +1，得到一个正对前方的扇面
        const t = (i / (SCATTER_COUNT - 1)) * 2 - 1;
        const p = spawnProjectile(game, x0 + (i % 10) * 4, y0, 'scatterpea', plant);
        if (!p) break;   // 撞到子弹上限了，这一轮就喷到这儿
        p.vy = t * SCATTER_SPREAD;
    }

    game.sound.playExplosion();
    muzzle(game, plant);
    if (plant.element) {
        plant.element.classList.remove('mg-recoil');
        void plant.element.offsetWidth;
        plant.element.classList.add('mg-recoil');
        setTimeout(() => plant.element?.classList.remove('mg-recoil'), 400);
    }
}

function muzzle(game, plant) {
    const el = document.createElement('div');
    el.className = 'mg-muzzle';
    el.style.left = `${plant.x + 52}px`;
    el.style.top = `${plant.y + 24}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 320);
}
