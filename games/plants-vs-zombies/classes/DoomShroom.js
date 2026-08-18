// 毁灭菇 ☠️ —— 灰色的菌柄，黑色的伞盖。
//
// 普通攻击：每 5 秒爆炸一次，掀起一朵紫色蘑菇云，对全场僵尸造成 1800 点伤害。
//           报纸将王也在打击范围里（他没低头也没被冻住的时候照样够不着，
//           伤害会被他自己吞掉）。
// 绿叶素大招：每放一次，这一株的爆炸伤害永久 +1800（1800 → 3600 → 5400 …），
//           蘑菇云也跟着长大一圈，没有上限。喂几次涨几次。
// 长个儿：这株蘑菇本身还会肉眼可见地慢慢变大 —— 每秒 +4%，一直长不封顶，
//           每开一次大招再直接窜一截。

const BASE_DAMAGE = 1800;
const DAMAGE_STEP = 1800;      // 每次大招加多少
const INTERVAL = 5000;         // 5 秒炸一次
const CLOUD_BASE = 150;        // 蘑菇云基础直径（px）
const CLOUD_STEP = 40;         // 每升一级大多少
const BASE_FONT = 40;          // .plant 的基准字号，蘑菇整株按 em 跟着缩放
const GROW_PER_MS = 0.00004;   // 每毫秒长 0.004%，也就是每秒 +4%
const ULT_GROW = 0.5;          // 每开一次大招额外窜一截

export const DOOM_INTERVAL = INTERVAL;

export function doomDamage(plant) {
    return plant._doomDamage || BASE_DAMAGE;
}

// 一直长大：每帧按 deltaTime 往上加一点，不设上限。整株是按 em 画的，
// 所以改 .plant 的 font-size 就能整体放大（不能改 transform —— 那上面挂着
// 出场和漂浮两个动画，会把内联 transform 盖掉）。
export function doomGrow(plant, game) {
    const dt = game.deltaTime || 16;
    plant._doomScale = (plant._doomScale || 1) + dt * GROW_PER_MS;
    applyScale(plant);
}

function applyScale(plant) {
    if (plant.element) {
        plant.element.style.fontSize = `${BASE_FONT * (plant._doomScale || 1)}px`;
    }
}

// 升到第几级了（1 级 = 1800）
function doomLevel(plant) {
    return Math.round(doomDamage(plant) / DAMAGE_STEP);
}

// 一次爆炸：全场僵尸各吃一发，将王也挨一下
export function doomBlast(game, plant) {
    const dmg = doomDamage(plant);
    let hits = 0;

    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        z.takeDamage(dmg);
        if (z.health <= 0) {
            z.remove();
            game.sound.playZombieDie();
        }
        hits++;
    }

    // 将王：没低头 / 没被冻住的时候 takeDamage 会自己把伤害吞掉
    if (game.boss && !game.boss.markedForDeletion) game.boss.takeDamage(dmg);

    cloud(game, plant, doomLevel(plant));
    game.sound.playExplosion();
    return hits;
}

// 绿叶素大招：伤害永久 +1800，蘑菇云跟着长大
export function doomUpgrade(game, plant) {
    plant._doomDamage = doomDamage(plant) + DAMAGE_STEP;
    plant._doomScale = (plant._doomScale || 1) + ULT_GROW;
    applyScale(plant);
    plant.timer = 0;

    const hits = doomBlast(game, plant);

    if (plant.element) {
        let badge = plant.element.querySelector('.doom-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'doom-badge';
            plant.element.appendChild(badge);
        }
        badge.textContent = doomDamage(plant);
    }

    flash(game, `☠️ 毁灭菇长大了! 伤害 → ${doomDamage(plant)} · 个头 ×${(plant._doomScale).toFixed(1)} · 炸到 ${hits} 只`);
}

// 紫色蘑菇云：底下一根往上顶的柱子，顶上扣一朵又扁又宽的伞状云
function cloud(game, plant, level) {
    const size = CLOUD_BASE + (level - 1) * CLOUD_STEP;
    const cx = plant.x + 40;           // 植物中心
    const ground = plant.y + 55;       // 云柱从这儿往上顶
    const stemH = size * 0.62;
    const stemW = size * 0.2;
    const capH = size * 0.55;

    const stem = document.createElement('div');
    stem.className = 'doom-stem';
    stem.style.width = `${stemW}px`;
    stem.style.height = `${stemH}px`;
    stem.style.left = `${cx - stemW / 2}px`;
    stem.style.top = `${ground - stemH}px`;
    game.board.appendChild(stem);
    setTimeout(() => stem.remove(), 900);

    // 伞盖压在云柱顶端，稍微盖住一点，像一朵真正的蘑菇云
    const el = document.createElement('div');
    el.className = 'doom-cloud';
    el.style.width = `${size}px`;
    el.style.height = `${capH}px`;
    el.style.left = `${cx - size / 2}px`;
    el.style.top = `${ground - stemH - capH * 0.72}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 900);

    // 全屏紫闪，等级越高越亮
    const flashEl = document.createElement('div');
    flashEl.className = 'doom-flash';
    flashEl.style.opacity = `${Math.min(0.75, 0.28 + level * 0.06)}`;
    game.board.appendChild(flashEl);
    setTimeout(() => flashEl.remove(), 620);
}

function flash(game, text) {
    const el = document.createElement('div');
    el.className = 'flash-message';
    el.style.background = 'rgba(120, 40, 170, 0.92)';
    el.textContent = text;
    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 1500);
}
