// 寒冰菇 🍄❄️ —— 头顶竖着一支冰锥的蘑菇。
//
// 普通攻击：种下之后每 5 秒寒冰爆炸一次，对全场僵尸（含游荡者）造成 2 点伤害，
//           并把它们全部冻住 5 秒 —— 冻结期间不动也不啃，脚下结一圈冰锥。
//           报纸将王也一起冻住：冻住时他既不放僵尸也不换阶段，站着挨打。
// 绿叶素大招：冰暴。全屏冰雾，冻结时间翻倍，而且这一株的爆炸间隔永久缩短 1 秒
//           （5 秒 → 4 秒 → 3 秒 …，最低 1 秒）。喂几次缩几次。

import { clearBossBalls } from './BossBall.js';

const BASE_INTERVAL = 5000;    // 起步 5 秒一次
const MIN_INTERVAL = 1000;     // 再快也不低于 1 秒
const SHORTEN_MS = 1000;       // 每次冰暴缩短 1 秒
const BLAST_DAMAGE = 2;        // 每次爆炸的伤害
const FREEZE_MS = 5000;         // 冻住多久
const STORM_FREEZE_MS = 10000;  // 冰暴冻得更久

export function iceInterval(plant) {
    return plant._iceInterval || BASE_INTERVAL;
}

// 冻住一只僵尸：复用僵尸自己的 stunTimer（它在 update 里会把速度压成 0），
// 外加一个 .iced —— 脚下长出一圈冰锥，而且盖掉眩晕那套抖动 / 金光特效
function freezeZombie(z, ms) {
    z.stunTimer = Math.max(z.stunTimer || 0, ms);
    z.eating = false;
    if (z.element) {
        z.element.classList.remove('eating');
        z.element.classList.add('iced');
    }
    setTimeout(() => z.element?.classList.remove('iced'), ms);
}

// 一次寒冰爆炸：全场 2 点伤害 + 全场冻结
export function iceBlast(game, plant, freezeMs = FREEZE_MS) {
    let hits = 0;

    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        z.takeDamage(BLAST_DAMAGE);
        if (z.health <= 0) {
            z.remove();
            game.sound.playZombieDie();
        } else {
            freezeZombie(z, freezeMs);
        }
        hits++;
    }

    // 游荡者血量是 Infinity，打不死，但可以冻住 —— 速度直接归零
    const ws = game.wandererSystem;
    if (ws) {
        for (let i = 0; i < ws.count; i++) {
            ws.vx[i] = 0;
            ws.vy[i] = 0;
            hits++;
        }
    }

    // 报纸将王也一起冻住：他停在原地，既不放僵尸也不换阶段
    if (game.boss && !game.boss.markedForDeletion) {
        game.boss.freeze(freezeMs);
        hits++;
    }

    // 顺手把将王吐出来的熔岩球 / 寒冰球全消掉
    const popped = clearBossBalls(game);
    if (popped) game.showNotEnoughFeedback(`❄️ 冻碎了 ${popped} 个球!`);

    ring(game, plant);
    game.sound.playIceShoot();
    return hits;
}

// 绿叶素大招：冰暴。冻得更久，并且把这一株的爆炸间隔永久缩短 1 秒。
export function iceStorm(game, plant) {
    const hits = iceBlast(game, plant, STORM_FREEZE_MS);

    plant._iceInterval = Math.max(MIN_INTERVAL, iceInterval(plant) - SHORTEN_MS);
    plant.timer = 0;

    // 全屏冰雾
    const fog = document.createElement('div');
    fog.className = 'ice-storm';
    game.board.appendChild(fog);
    setTimeout(() => fog.remove(), 900);

    // 植物右上角挂一个「N 秒」徽章，标明这株现在多久炸一次
    if (plant.element) {
        let badge = plant.element.querySelector('.ice-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'ice-badge';
            plant.element.appendChild(badge);
        }
        badge.textContent = `${(plant._iceInterval / 1000).toFixed(0)}秒`;
    }

    flash(game, `❄️ 冰暴! 冻住 ${hits} 只 · 间隔 → ${(plant._iceInterval / 1000).toFixed(0)} 秒`);
    game.sound.playExplosion();
}

// 从寒冰菇向外扩散的冰环
function ring(game, plant) {
    const el = document.createElement('div');
    el.className = 'ice-ring';
    el.style.left = `${plant.x + 40}px`;
    el.style.top = `${plant.y + 50}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 620);
}

function flash(game, text) {
    const el = document.createElement('div');
    el.className = 'flash-message';
    el.style.background = 'rgba(0, 160, 220, 0.9)';
    el.textContent = text;
    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 1500);
}
