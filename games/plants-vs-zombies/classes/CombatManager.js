import { Projectile } from './Projectile.js';

// 报纸将王低头（或被冻住）的时候就是个能打的靶子。他不在 game.zombies 里，
// 不单独算的话，场上没僵尸时植物会以为「没敌人」而集体停火 —— 他低着头也没人打他。
// 他个头很高，纵向压着好几行，所以要看行区间有没有重叠。
export function bossTargetInRow(game, row, minX) {
    const b = game.boss;
    if (!b || b.markedForDeletion || !b.vulnerable) return false;
    if (b.x + b.width <= minX) return false;
    const top = Math.floor(b.y / game.cellHeight);
    const bottom = Math.floor((b.y + b.height - 1) / game.cellHeight);
    return row >= top && row <= bottom;
}

export function hasEnemyInRow(game, row, minX) {
    if (game.zombies.some(z => Math.floor(z.y / game.cellHeight) === row && z.x > minX)) return true;
    if (bossTargetInRow(game, row, minX)) return true;
    if (!game.wandererSystem) return false;
    const ws = game.wandererSystem;
    for (let i = 0; i < ws.count; i++) {
        if (Math.floor(ws.py[i] / game.cellHeight) === row && ws.px[i] > minX) return true;
    }
    return false;
}

export function hasAnyEnemy(game, minX) {
    if (game.zombies.some(z => z.x > minX)) return true;
    const b = game.boss;
    if (b && !b.markedForDeletion && b.vulnerable && b.x + b.width > minX) return true;
    if (!game.wandererSystem) return false;
    const ws = game.wandererSystem;
    for (let i = 0; i < ws.count; i++) {
        if (ws.px[i] > minX) return true;
    }
    return false;
}

// 同时存活的子弹上限。每颗子弹是一个 DOM 元素，上千个一起动的时候浏览器
// 光合成就来不及，帧率掉下去 → 子弹每帧只走固定像素、于是活得更久 → 攒得更多，
// 越卡越多。封顶就是把这个正反馈掐断。
// 正常玩法离这个数很远，只有满屏叠种 + 超级机枪散射连喷才顶得到。
const MAX_PROJECTILES = 700;

// 子弹伤害递增：现在只有超级电能机枪豌豆 ⚡ 吃这一套 —— 它打出的每一颗电能弹
// 都比上一颗高 15%，复利叠加，封顶 18000。别的植物一律用弹种自己的固定伤害，
// 打多久都不会涨。
// 计数存在植物身上，所以每株各涨各的，铲掉重种就从头来。
// 电能弹对僵尸是 Infinity（乘多少还是 Infinity），倍率实际作用在它打将王的
// 那 1800 基数上，见 Projectile 的 boss 结算。
export const DAMAGE_GROWTH = 1.15;
export const DAMAGE_CAP = 18_000;

// 只有这些植物的子弹会越打越狠
const GROWS = new Set(['elecmg']);

// 这一发的倍率 = 1.15^(已打发数)，第一发是 ×1
function nextDamageMult(plant) {
    const n = plant._shots || 0;
    plant._shots = n + 1;
    return Math.pow(DAMAGE_GROWTH, n);
}

// 满员时不再生成新子弹，而不是顶掉场上已有的那颗 —— 已经在飞的子弹只能被
// 僵尸吃掉，绝不能凭空消失（顶掉最老的会让子弹在半空中平白不见）。
// 代价是穿透弹（打到僵尸也不消失）会一直占着槽位，攒满之后新子弹就发不出来了。
// 只有 GROWS 里的植物吃伤害递增，其余（含全屏随机子弹）一律用弹种的固定伤害。
// force=true 无视上限硬发（豌豆炸弹的 100 颗必须一颗不少地射出去）。
export function spawnProjectile(game, x, y, type = 'normal', plant = null, force = false) {
    if (!force && game.projectiles.length >= MAX_PROJECTILES) return null;
    // 红叶素期间，这株植物打什么都变成小红樱桃（5 秒后自己恢复）
    if (plant && plant.redMs > 0) type = 'redcherry';
    const proj = new Projectile(x, y, type);
    if (plant && GROWS.has(plant.type)) {
        const mult = nextDamageMult(plant);
        proj.damageMult = mult;
        // 秒杀弹（Infinity）乘多少还是 Infinity，这里跳过；
        // 它打将王的折算值在 Projectile 里单独乘 damageMult
        if (proj.damage !== Infinity) {
            proj.damage = Math.min(proj.damage * mult, DAMAGE_CAP);
        }
    }
    game.projectiles.push(proj);
    return proj;
}

export function cherryBomb(game, plantX, plantY) {
    const centerRow = Math.floor(plantY / game.cellHeight);
    const centerCol = Math.floor(plantX / game.cellWidth);
    for (const zombie of game.zombies) {
        const zRow = Math.floor(zombie.y / game.cellHeight);
        const zCol = Math.floor((zombie.x + 40) / game.cellWidth);
        if (Math.abs(zRow - centerRow) <= 1 && Math.abs(zCol - centerCol) <= 1) {
            zombie.health = 0;
            zombie.remove();
        }
    }
    game.sound.playExplosion();
    const el = document.createElement('div');
    el.className = 'flash-message';
    el.style.background = 'rgba(255, 100, 0, 0.9)';
    el.textContent = '💥 BOOM!';
    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

