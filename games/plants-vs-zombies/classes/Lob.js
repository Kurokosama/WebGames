// 抛射的公共部分 —— 西瓜投手、玉米投手都用这一套。
//
// 抛出来的东西走抛物线从高空飞过去，越过一路上的所有障碍物（坚果墙、其他僵尸、
// 路障 / 铁桶 / 铁门 / 报纸护甲），直接砸在目标头上。落点伤害不走
// Zombie.takeDamage 的护盾判定 —— 天上砸下来的东西，护甲挡不住。

const LOB_MS = 700;         // 单发的飞行时间
const ARC_HEIGHT = 190;     // 抛物线弧顶高度（px）
export const STAGGER_MS = 45;      // 齐射时每发之间的错开
export const MAX_STAGGER = 500;

// 场上所有能打的目标：僵尸 + 游荡者 + 报纸将王。
// 将王也算一个 —— 不然场上只剩他的时候，大招会以为「没有目标」直接哑掉。
// 砸到他身上仍然走 boss.takeDamage，所以他没低头 / 没被冻住时照样是无敌的。
export function collectTargets(game) {
    const targets = [];
    for (const z of game.zombies) {
        if (!z.markedForDeletion) targets.push({ zombie: z });
    }
    const ws = game.wandererSystem;
    if (ws) {
        for (let i = 0; i < ws.count; i++) targets.push({ wandererIdx: i });
    }
    if (game.boss && !game.boss.markedForDeletion) targets.push({ boss: game.boss });
    return targets;
}

// 同行最靠前（最靠左但还在植物右边）的那个目标，返回 lob 用的目标描述符。
// 同行没有僵尸时，低头（或被冻住）的报纸将王也算一个 —— 他不在 game.zombies 里，
// 不单独算的话，场上没僵尸时抛射植物会一直不开火。
export function frontTarget(game, plant) {
    const row = Math.floor(plant.y / game.cellHeight);
    let best = null;
    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        if (Math.floor(z.y / game.cellHeight) !== row) continue;
        if (z.x <= plant.x) continue;
        if (!best || z.x < best.x) best = z;
    }
    if (best) return { zombie: best };

    const b = game.boss;
    if (b && !b.markedForDeletion && b.vulnerable && b.x + b.width > plant.x) {
        const top = Math.floor(b.y / game.cellHeight);
        const bottom = Math.floor((b.y + b.height - 1) / game.cellHeight);
        if (row >= top && row <= bottom) return { boss: b };
    }
    return null;
}

// 目标当前位置（僵尸一直在走，飞行途中要跟着更新）。目标没了返回 null。
function targetCenter(game, t) {
    if (t.boss) {
        const b = t.boss;
        if (b.markedForDeletion) return null;
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
    if (t.zombie) {
        const z = t.zombie;
        if (z.markedForDeletion) return null;
        return { x: z.x + z.width / 2, y: z.y + z.height / 2 };
    }
    const ws = game.wandererSystem;
    if (!ws || t.wandererIdx >= ws.count) return null;
    return { x: ws.px[t.wandererIdx] + 20, y: ws.py[t.wandererIdx] + 30 };
}

// cfg: { cls, emoji?, html?, size, damage, splashCls, from?, onHit?(zombie), after?(game,t,c) }
//   from  —— 起抛点，不给就从植物身上起（超级投手的弹射要从上一个落点接着抛）
//   html  —— 抛射物内部结构，给复合造型用（超级投手那颗三合一）
//   after —— 砸中之后回调，拿到落点坐标，用来接着弹下一跳
export function lob(game, plant, t, delay, cfg) {
    const el = document.createElement('div');
    el.className = cfg.cls;
    if (cfg.emoji) el.textContent = cfg.emoji;
    if (cfg.html) el.innerHTML = cfg.html;
    el.style.fontSize = `${cfg.size}px`;
    el.style.width = `${cfg.size}px`;
    el.style.height = `${cfg.size}px`;
    const sx = cfg.from ? cfg.from.x : plant.x + 20;
    const sy = cfg.from ? cfg.from.y : plant.y + 10;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    game.board.appendChild(el);
    const startAt = performance.now() + delay;

    const step = (now) => {
        const p = (now - startAt) / LOB_MS;
        if (p < 0) { requestAnimationFrame(step); return; }

        const c = targetCenter(game, t);
        if (!c) { el.remove(); return; }

        if (p >= 1) {
            el.remove();
            smash(game, t, c, cfg);
            return;
        }

        el.style.left = `${sx + (c.x - sx) * p}px`;
        el.style.top = `${sy + (c.y - sy) * p - Math.sin(Math.PI * p) * ARC_HEIGHT}px`;
        el.style.transform = `rotate(${p * 420}deg)`;
        requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function smash(game, t, c, cfg) {
    if (t.boss) {
        // 走 takeDamage：他没低头也没被冻住的时候本来就打不动
        t.boss.takeDamage(cfg.damage);
    } else if (t.zombie) {
        const z = t.zombie;
        if (z.markedForDeletion) return;
        // 直接扣血，绕过报纸 / 铁门那套护盾判定
        z.health -= cfg.damage;
        if (z.health <= 0) {
            z.remove();
            game.sound?.playZombieDie();
        } else {
            cfg.onHit?.(z);
            z.draw();
        }
    } else {
        const ws = game.wandererSystem;
        if (!ws || t.wandererIdx >= ws.count) return;
        // 游荡者打不死，轰回右边重新爬
        ws.hp[t.wandererIdx] = ws.maxHp;
        ws.vx[t.wandererIdx] = 0.8 + Math.random() * 0.8;
        ws.px[t.wandererIdx] = ws.W;
    }

    cfg.after?.(game, t, c);

    const splash = document.createElement('div');
    splash.className = cfg.splashCls;
    const r = cfg.size >= 60 ? 60 : 34;
    splash.style.left = `${c.x - r}px`;
    splash.style.top = `${c.y - r}px`;
    splash.style.width = `${r * 2}px`;
    splash.style.height = `${r * 2}px`;
    game.board.appendChild(splash);
    setTimeout(() => splash.remove(), 450);
}

export function lobFlash(game, text, bg) {
    const el = document.createElement('div');
    el.className = 'flash-message';
    el.style.background = bg;
    el.textContent = text;
    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 1500);
}
