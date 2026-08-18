import { setEmojiCursor } from './Constants.js';

const DMG = 1800;

export function fireCannon(game, plant, targetX, targetY, targetZombie, wandererIdx) {
    const INTERVAL = 5;
    const SHOW_EVERY = 20;
    let tick = 0;

    game.sound.playExplosion();

    const id = setInterval(() => {
        if (tick % SHOW_EVERY === 0) {
            const ox = (Math.random() - 0.5) * 10, oy = (Math.random() - 0.5) * 10;
            const ball = document.createElement('div');
            ball.style.cssText = `position:absolute;left:${plant.x+20}px;top:${plant.y+30}px;font-size:18px;z-index:25;pointer-events:none;transition:left 0.2s linear,top 0.2s linear;`;
            ball.textContent = '🌽';
            game.board.appendChild(ball);
            requestAnimationFrame(() => { ball.style.left = `${targetX-9+ox}px`; ball.style.top = `${targetY-9+oy}px`; });
            setTimeout(() => {
                ball.remove();
                const flash = document.createElement('div');
                flash.style.cssText = `position:absolute;left:${targetX-20+ox}px;top:${targetY-20+oy}px;width:40px;height:40px;border-radius:50%;background:rgba(255,220,0,0.8);z-index:24;pointer-events:none;`;
                game.board.appendChild(flash);
                setTimeout(() => flash.remove(), 150);
            }, 200);
        }

        cannonExplosion(game, targetZombie, wandererIdx);
        tick++;
    }, INTERVAL);

    game.cannonIntervals.push(id);
}

export function cannonExplosion(game, targetZombie, wandererIdx) {
    if (targetZombie && !targetZombie.markedForDeletion) {
        targetZombie.takeDamage(DMG);
        if (targetZombie.health <= 0) targetZombie.remove();
    } else if (wandererIdx >= 0 && game.wandererSystem) {
        const ws = game.wandererSystem;
        ws.hp[wandererIdx] -= DMG;
        if (ws.hp[wandererIdx] <= 0) {
            ws.hp[wandererIdx] = ws.maxHp;
            ws.vx[wandererIdx] = 0.8 + Math.random() * 0.8;
            ws.px[wandererIdx] = ws.W;
        }
    }
}

export function cannonAutoFire(game, plantX, plantY) {
    for (const z of game.zombies) {
        if (!z.markedForDeletion) {
            z.takeDamage(DMG);
            if (z.health <= 0) z.remove();
        }
    }
    const ws = game.wandererSystem;
    if (ws) {
        for (let i = 0; i < ws.count; i++) {
            ws.hp[i] -= DMG;
            if (ws.hp[i] <= 0) {
                ws.hp[i] = ws.maxHp;
                ws.vx[i] = 0.8 + Math.random() * 0.8;
                ws.px[i] = ws.W;
            }
        }
    }
}

// 处理棋盘点击中所有玉米炮相关的分支：瞄准命中 / 选中已就绪炮台。
// 返回 true 表示本次点击已被消费，调用方应直接 return。
export function handleCornCannonClick(game, e, row, col) {
    if (game.cannonTarget) {
        const rect = game.board.getBoundingClientRect();
        const tx = e.clientX - rect.left;
        const ty = e.clientY - rect.top;

        let hitX = null, hitY = null, hitZombie = null, hitWandererIdx = -1;
        for (const z of game.zombies) {
            if (tx >= z.x && tx <= z.x + z.width && ty >= z.y && ty <= z.y + z.height) {
                hitX = z.x + z.width / 2;
                hitY = z.y + z.height / 2;
                hitZombie = z;
                break;
            }
        }
        if (hitX === null && game.wandererSystem) {
            const ws = game.wandererSystem;
            for (let i = 0; i < ws.count; i++) {
                if (tx >= ws.px[i] && tx <= ws.px[i] + 40 && ty >= ws.py[i] && ty <= ws.py[i] + 60) {
                    hitX = ws.px[i] + 20;
                    hitY = ws.py[i] + 30;
                    hitWandererIdx = i;
                    break;
                }
            }
        }
        if (hitX === null) return true;

        if (game.paused) {
            game.pendingCannon = { plant: game.cannonTarget, x: hitX, y: hitY, zombie: hitZombie, wandererIdx: hitWandererIdx };
        } else {
            fireCannon(game, game.cannonTarget, hitX, hitY, hitZombie, hitWandererIdx);
        }
        return true;
    }

    const stack = game.grid[row] && game.grid[row][col];
    if (stack && stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.type === 'corncannon' && top.cannonReady) {
            game.cannonTarget = top;
            setEmojiCursor('🎯');
            return true;
        }
    }
    return false;
}
