// 超级电能机枪豌豆 ⚡ —— 青色的豌豆，戴着和超级机枪一样的那顶钢盔。
//
// 常规：每 0.5 秒泼出一梭子电能弹，6 颗。对普通僵尸是无限点伤害，而且无限贯穿 ——
//       命中不消失，一路穿到屏幕右边，一梭子能把整行清空。
// 大招：每打满 5 轮自动触发，向前扇形喷出 150 颗电能散射弹，同样无限贯穿。
//       每开一次大招，这一株的常规连发数还会永久 +1（6 → 7 → 8 …），越打越密。
//       150 颗一次性把伤害递增计数推得很高，之后这一株基本发发顶格。
// 将王：电能弹打报纸将王时 1800 起步（Projectile 的 bossDamage），和别的子弹一样
//       吃逐发 +15% 的伤害递增，封顶 18000。

import { spawnProjectile } from './CombatManager.js';

const PEAS_PER_VOLLEY = 6;    // 起步 6 颗，每开一次大招 +1
const SCATTER_COUNT = 150;
const SCATTER_SPREAD = 3.2;   // 散射弹的最大纵向速度（px/帧）
const LANE_SIZE = 8;          // 一条弹链最多几颗，超了另起一条
const LANE_DY = 9;            // 相邻弹链的纵向间距
const MAX_DY = 34;            // 弹链最多偏离行中心多少，别喷到隔壁行去

export function elecPeaCount(plant) {
    return plant._elecPeas || PEAS_PER_VOLLEY;
}

export function elecVolley(game, plant) {
    const x0 = plant.x + 40;
    const y0 = plant.y + 20;
    const n = elecPeaCount(plant);

    for (let i = 0; i < n; i++) {
        // x 上错开成一条弹链、y 上小幅交错，看起来像一梭子连发。
        // 涨到 8 颗以上就另起一条弹链往上下铺，不然会一路排到屏幕右边去。
        const lane = Math.floor(i / LANE_SIZE);
        const laneDy = Math.min(MAX_DY, lane * LANE_DY) * (lane % 2 ? -1 : 1);
        const dx = (i % LANE_SIZE) * 13;
        const dy = (i % 2 ? 6 : -6) + laneDy;
        spawnProjectile(game, x0 + dx, y0 + dy, 'elecpea', plant);
    }
    game.sound.playShoot();
}

export function elecScatter(game, plant) {
    const x0 = plant.x + 40;
    const y0 = plant.y + 20;

    for (let i = 0; i < SCATTER_COUNT; i++) {
        // t 从 -1 均匀铺到 +1，得到一个正对前方的扇面
        const t = (i / (SCATTER_COUNT - 1)) * 2 - 1;
        const p = spawnProjectile(game, x0 + (i % 10) * 4, y0, 'elecscatter', plant);
        if (!p) break;   // 撞到子弹上限了，这一轮就喷到这儿
        p.vy = t * SCATTER_SPREAD;
    }

    // 每开一次大招，这一株的常规连发数就永久 +1（6 → 7 → 8 …）
    plant._elecPeas = elecPeaCount(plant) + 1;
    if (plant.element) {
        let badge = plant.element.querySelector('.elec-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'elec-badge';
            plant.element.appendChild(badge);
        }
        badge.textContent = `${plant._elecPeas}连`;
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

// 蓝白色的电弧枪口焰，和超级机枪的橙黄枪口焰区分开
function muzzle(game, plant) {
    const el = document.createElement('div');
    el.className = 'elec-muzzle';
    el.style.left = `${plant.x + 52}px`;
    el.style.top = `${plant.y + 24}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 320);
}
