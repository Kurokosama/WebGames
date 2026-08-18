// 西瓜投手 🍉 —— 把西瓜高高抛出去，越过一路上的所有障碍物，直接砸在目标头上。
//
// 普通：每 1.2 秒朝同行最靠前的那只僵尸抛一颗西瓜，落地 100 点伤害。
// 绿叶素大招：整株变成一台**西瓜狙击炮**，场上有几个目标就打几发大西瓜，
//             一发 700 点。大招的西瓜只比普通那颗大一圈（34 → 46px）。
// 红叶素大招：改打巨型红樱桃，场上几只僵尸就几颗，落地一万点伤害。
//
// 抛物线飞行、落点绕过护盾这些公共逻辑在 Lob.js 里。

import { collectTargets, frontTarget, lob, lobFlash, STAGGER_MS, MAX_STAGGER } from './Lob.js';

export const MELON_INTERVAL = 1200;   // 普通攻击间隔
export const MELON_DAMAGE = 100;      // 普通西瓜
export const SNIPER_DAMAGE = 700;     // 大招的巨型西瓜
export const CHERRY_DAMAGE = 10000;   // 红叶素的巨型红樱桃

export function melonLob(game, plant) {
    const t = frontTarget(game, plant);
    if (!t) return;
    lob(game, plant, t, 0, {
        cls: 'lob-melon round', size: 34,
        damage: MELON_DAMAGE, splashCls: 'melon-splash',
    });
    game.sound.playShoot();
}

// 绿叶素：西瓜狙击炮
export function melonSniper(game, plant) {
    volley(game, plant, {
        cls: 'lob-melon round big', size: 46,
        damage: SNIPER_DAMAGE, splashCls: 'melon-splash',
    }, (n) => `🍉 西瓜狙击炮! ${n} 发大西瓜 × ${SNIPER_DAMAGE}`, 'rgba(60, 160, 60, 0.92)');
}

// 红叶素：巨型红樱桃齐射
export function melonCherryVolley(game, plant) {
    volley(game, plant, {
        cls: 'lob-melon big cherry', emoji: '🍒', size: 74,
        damage: CHERRY_DAMAGE, splashCls: 'melon-splash cherry',
    }, (n) => `❤️ ${n} 颗巨型红樱桃 × ${CHERRY_DAMAGE}!`, 'rgba(200, 40, 60, 0.92)');
}

// 齐射：场上几个目标就打几发，植株期间摆出炮的样子
function volley(game, plant, cfg, text, bg) {
    const targets = collectTargets(game);
    if (targets.length === 0) {
        lobFlash(game, '🍉 场上没有目标!', bg);
        return;
    }
    plant.element?.classList.add('melon-cannon');
    setTimeout(() => plant.element?.classList.remove('melon-cannon'), 2200);

    targets.forEach((t, i) => lob(game, plant, t, Math.min(i * STAGGER_MS, MAX_STAGGER), cfg));

    game.sound.playExplosion();
    lobFlash(game, text(targets.length), bg);
}
