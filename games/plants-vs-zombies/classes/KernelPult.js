// 玉米投手 🌽 —— 抛出一块黄油（黄色方块），越过一路上的所有障碍物砸到僵尸头上。
//
// 普通：每 1.2 秒朝同行最靠前的那只僵尸抛一块黄油，落地 50 点伤害，并且黄油会
//       黏在僵尸头上，把它**定住 5 秒**（头顶顶着一块黄方块，走不动也啃不动）。
// 绿叶素大招：场上有几只僵尸就抛几块**巨型黄油**，一块 100 点，同样定住 5 秒。
// 红叶素大招：改抛红樱桃，几只僵尸几颗，落地 1500 点。
//
// 抛物线飞行、落点绕过护盾这些公共逻辑在 Lob.js 里。

import { collectTargets, frontTarget, lob, lobFlash, STAGGER_MS, MAX_STAGGER } from './Lob.js';

export const KERNEL_INTERVAL = 1200;   // 普通攻击间隔
export const BUTTER_DAMAGE = 50;       // 普通黄油
export const BIG_BUTTER_DAMAGE = 100;  // 大招的巨型黄油
export const KERNEL_CHERRY_DAMAGE = 1500;
export const BUTTER_STUN_MS = 5000;    // 黄油定住多久

// 黄油黏头上：复用僵尸自己的 stunTimer（它在 update 里会把速度压成 0），
// 外加一个 .buttered —— 头顶顶一块黄方块，并盖掉眩晕那套金光抖动
function butterUp(z) {
    z.stunTimer = Math.max(z.stunTimer || 0, BUTTER_STUN_MS);
    z.eating = false;
    if (z.element) {
        z.element.classList.remove('eating');
        z.element.classList.add('buttered');
    }
    setTimeout(() => z.element?.classList.remove('buttered'), BUTTER_STUN_MS);
}

export function kernelLob(game, plant) {
    const t = frontTarget(game, plant);
    if (!t) return;
    lob(game, plant, t, 0, {
        cls: 'lob-butter', size: 26,
        damage: BUTTER_DAMAGE, splashCls: 'butter-splash', onHit: butterUp,
    });
    game.sound.playShoot();
}

// 绿叶素：巨型黄油齐射
export function kernelButterVolley(game, plant) {
    volley(game, plant, {
        cls: 'lob-butter big', size: 66,
        damage: BIG_BUTTER_DAMAGE, splashCls: 'butter-splash', onHit: butterUp,
    }, (n) => `🌽 ${n} 块巨型黄油 × ${BIG_BUTTER_DAMAGE}，全定住 5 秒!`, 'rgba(230, 170, 20, 0.92)');
}

// 红叶素：红樱桃齐射
export function kernelCherryVolley(game, plant) {
    volley(game, plant, {
        cls: 'lob-melon big cherry', emoji: '🍒', size: 70,
        damage: KERNEL_CHERRY_DAMAGE, splashCls: 'melon-splash cherry',
    }, (n) => `❤️ ${n} 颗红樱桃 × ${KERNEL_CHERRY_DAMAGE}!`, 'rgba(200, 40, 60, 0.92)');
}

function volley(game, plant, cfg, text, bg) {
    const targets = collectTargets(game);
    if (targets.length === 0) {
        lobFlash(game, '🌽 场上没有僵尸!', bg);
        return;
    }
    plant.element?.classList.add('kernel-cannon');
    setTimeout(() => plant.element?.classList.remove('kernel-cannon'), 2200);

    targets.forEach((t, i) => lob(game, plant, t, Math.min(i * STAGGER_MS, MAX_STAGGER), cfg));

    game.sound.playExplosion();
    lobFlash(game, text(targets.length), bg);
}
