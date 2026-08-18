// 大喷菇 🍄💨 —— 紫色的大烟壶，嘴上一根喷口朝右。
//
// 普通攻击：只要**自己这一行前方三格**里有僵尸，就朝前喷一股紫色烟雾，
//           把这三格里的僵尸全部熏一遍，每只 70 点。
// 绿叶素大招：连喷 3 秒，喷雾一直挂在前方那三格上，每 0.3 秒再熏一次，
//           每次 100 点 —— 站在雾里的僵尸会被持续磨掉血。
//
// 烟雾直接扣血，不走报纸 / 铁门那套护盾判定 —— 烟是钻进去的，挡不住。

const FUME_INTERVAL = 1500;    // 普通攻击间隔
const FUME_DAMAGE = 70;        // 普通一喷
const ULT_MS = 3000;           // 大招喷多久
const ULT_TICK_MS = 300;       // 大招每隔多久熏一次
const ULT_DAMAGE = 100;        // 大招每次 100
const RANGE_CELLS = 3;         // 只喷自己这一行前面三格

// 喷雾罩住的范围：本行、从植物往前三格
function fumeRange(game, plant) {
    return {
        row: Math.floor(plant.y / game.cellHeight),
        left: plant.x + 40,
        right: plant.x + 40 + RANGE_CELLS * game.cellWidth,
    };
}

// 这三格里的僵尸
function targets(game, plant) {
    const { row, left, right } = fumeRange(game, plant);
    return game.zombies.filter(z => {
        if (z.markedForDeletion) return false;
        if (Math.floor(z.y / game.cellHeight) !== row) return false;
        const zx = z.x + z.width / 2;
        return zx >= left && zx <= right;
    });
}

// 喷一股：本行前面三格铺一条紫雾
function puff(game, plant, ms, cls = 'fume-cloud') {
    const { row, left, right } = fumeRange(game, plant);

    const el = document.createElement('div');
    el.className = cls;
    el.style.left = `${left}px`;
    el.style.top = `${row * game.cellHeight + 6}px`;
    el.style.width = `${right - left}px`;
    game.board.appendChild(el);

    const els = [el];
    if (ms) setTimeout(() => els.forEach(e => e.remove()), ms);
    return els;
}

function fume(game, plant, damage) {
    const hit = targets(game, plant);
    for (const z of hit) {
        z.health -= damage;          // 直接扣血，护盾挡不住烟
        if (z.health <= 0) {
            z.remove();
            game.sound?.playZombieDie();
        } else {
            z.draw();
        }
    }
    return hit.length;
}

export function fumeAttack(game, plant) {
    if (targets(game, plant).length === 0) return;   // 前面三格没人就不喷
    puff(game, plant, 600);
    fume(game, plant, FUME_DAMAGE);
    game.sound?.playShoot();
}

// 绿叶素：连喷 3 秒，每 0.3 秒熏一次
export function fumeUltimate(game, plant) {
    const els = puff(game, plant, ULT_MS, 'fume-cloud big');
    plant.element?.classList.add('fume-blasting');

    let left = ULT_MS;
    const timer = setInterval(() => {
        if (plant.markedForDeletion) { clearInterval(timer); els.forEach(e => e.remove()); return; }
        fume(game, plant, ULT_DAMAGE);
        left -= ULT_TICK_MS;
        if (left <= 0) {
            clearInterval(timer);
            plant.element?.classList.remove('fume-blasting');
        }
    }, ULT_TICK_MS);

    game.sound?.playExplosion();
    game.showNotEnoughFeedback(`💨 大喷菇连喷 3 秒! 每次 ${ULT_DAMAGE} 点`);
}

export { FUME_INTERVAL };
