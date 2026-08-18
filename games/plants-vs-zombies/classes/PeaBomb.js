// 豌豆炸弹 🌿🌱 —— 左边是双重射手的脸，右边是豌豆的脸，两颗头用樱桃那根梗连在一起。
//
// 普通：种下 3 秒后自爆。爆的时候先在身边围出两圈、共 100 颗豌豆，
//       然后这两圈一起朝四面八方射出去。场上有没有僵尸都照炸，100 颗一颗不少。
// 绿叶素大招：满地召唤会射豌豆的植物（豌豆 / 双重 / 三重 / 加特林 / 超级机枪 / 电能机枪）。
// 红叶素大招：立刻起爆，两圈射出去的全是红樱桃子弹（弹种由 spawnProjectile 按 redMs 换）。
//
// 三种情况都是一次性的：炸完 / 召唤完，这一株自己就没了。

import { spawnProjectile } from './CombatManager.js';
import { spawnPlant } from './PlantManager.js';

const FUSE_MS = 3000;          // 种下到自爆的引信时间
// 一共 100 颗，分两圈围着他：内圈 50 颗、外圈 50 颗
const RING1 = { count: 50, radius: 40, speed: 5 };   // 内圈
const RING2 = { count: 50, radius: 72, speed: 7 };   // 外圈
const PEA_PLANTS = ['peashooter', 'doubleshooter', 'triplepea', 'gatling', 'supermg', 'elecmg'];

// 围两圈，然后一起朝外射出去
export function peaBombExplode(game, plant) {
    const cx = plant.x + 40;
    const cy = plant.y + 50;
    let n = 0;

    for (const ring of [RING1, RING2]) {
        for (let i = 0; i < ring.count; i++) {
            const a = (i / ring.count) * Math.PI * 2;
            const px = cx + Math.cos(a) * ring.radius;
            const py = cy + Math.sin(a) * ring.radius;
            // 弹种交给 spawnProjectile：这株吃了红叶素就自动变成红樱桃。
            // force=true：不管场上多挤都硬发 —— 说好 100 颗就是 100 颗。
            // （子弹只有打到僵尸才消失，没僵尸时场上很容易一直顶着上限，
            //   不硬发的话这一炮会哑掉大半。）
            const p = spawnProjectile(game, px - 10, py - 10, 'normal', plant, true);
            // 沿着自己那条半径往外飞（speed 是横向、vy 是纵向）
            p.speed = Math.cos(a) * ring.speed;
            p.vy = Math.sin(a) * ring.speed;
            n++;
        }
    }

    boom(game, plant);
    game.sound.playExplosion();
    game.showNotEnoughFeedback(`🌿🌱 豌豆炸弹! 射出 ${n} 颗`);
    plant.remove();
}

// 绿叶素：满地召唤会射豌豆的植物
export function peaBombSummon(game, plant) {
    let n = 0;
    for (let r = 0; r < game.height; r++) {
        for (let c = 0; c < game.width; c++) {
            spawnPlant(game, r, c, PEA_PLANTS[Math.floor(Math.random() * PEA_PLANTS.length)]);
            n++;
        }
    }
    boom(game, plant);
    game.sound.playExplosion();
    game.showNotEnoughFeedback(`🌿🌱 满地豌豆! 召唤了 ${n} 株`);
    plant.remove();
}

// 爆炸的那一圈绿光
function boom(game, plant) {
    const el = document.createElement('div');
    el.className = 'peabomb-boom';
    el.style.left = `${plant.x + 40}px`;
    el.style.top = `${plant.y + 50}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 620);
}

export function peaBombTick(plant, game) {
    // 红叶素：立刻起爆，射出去的自动换成红樱桃
    if (plant.redMs > 0 && !plant._pbDone) {
        plant._pbDone = true;
        peaBombExplode(game, plant);
        return;
    }
    // 绿叶素：满地召唤射豌豆的植物
    if (plant.ultimateMs > 0 && !plant._pbDone) {
        plant._pbDone = true;
        peaBombSummon(game, plant);
        return;
    }
    // 引信烧完，自爆
    if (plant.timer >= FUSE_MS && !plant._pbDone) {
        plant._pbDone = true;
        peaBombExplode(game, plant);
    }
}
