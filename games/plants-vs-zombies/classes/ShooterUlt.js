// 射手类植物的绿叶素大招 —— 一口气泼 60 颗出去。
//
// 豌豆射手：60 颗豌豆
// 寒冰射手：60 颗寒冰子弹
// 双重射手：60 颗豌豆 + 一枚和它自己一样大的**巨型豌豆**，无限贯穿，
//           每穿过一只僵尸就打 200 点（同一只只算一次）。

import { spawnProjectile } from './CombatManager.js';

const VOLLEY_COUNT = 60;       // 一次泼多少颗
const SPREAD = 3.4;            // 散射的最大纵向速度（px/帧）
const LANE = 10;               // 每排几颗，排满另起一排

// 60 颗铺成一个正对前方的扇面
export function shooterVolley(game, plant, type, count = VOLLEY_COUNT) {
    const x0 = plant.x + 40;
    const y0 = plant.y + 20;
    let n = 0;

    for (let i = 0; i < count; i++) {
        // t 从 -1 均匀铺到 +1，得到一个扇形
        const t = (i / (count - 1)) * 2 - 1;
        const p = spawnProjectile(game, x0 + (i % LANE) * 5, y0, type, plant);
        if (!p) break;                       // 撞到子弹上限了
        p.vy = t * SPREAD;
        n++;
    }

    game.sound?.playShoot();
    return n;
}

// 一枚和植物一样大的巨型豌豆：无限贯穿，每只僵尸吃一次 200
export function giantPea(game, plant) {
    const size = 80;                          // 和一格植物一样大
    const p = spawnProjectile(game, plant.x + 30, plant.y + 50 - size / 2, 'giantpea', plant);
    if (!p) return;
    p.width = size;
    p.height = size;
    if (p.element) {
        p.element.style.width = `${size}px`;
        p.element.style.height = `${size}px`;
    }
    game.sound?.playExplosion();
}
