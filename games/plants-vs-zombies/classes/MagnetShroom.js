// 磁力菇：两段式磁场 —— 先斥后吸。
//
// 普通攻击：每 PULSE_MS 打出一次斥力脉冲，把场上所有僵尸（含游荡者）
//           往右轰回去，然后持续把它们纵向吸到自己所在的这一行。
// 绿叶素大招：一次超远距离击退，把全场僵尸推到右边，再吸成一条直线，
//           最后引爆磁场 —— 金属护甲（路障 / 铁桶 / 铁门 / 报纸）先被扒掉，
//           每个僵尸吃满 17000 点伤害，正好是本作僵尸的满血值。

const PULL_PER_MS = 0.25;      // 吸附速度（px/ms），约 0.4 秒吸过一行
const SNAP_PX = 4;             // 差距小于这个值直接吸附到位
const WANDER_PULL = 0.12;      // 游荡者每帧向目标行收拢的比例
const PULSE_MS = 1500;         // 普通攻击的斥力脉冲间隔
const KNOCKBACK_PX = 80;       // 每次脉冲把僵尸往右轰多远
const ULT_KNOCKBACK_PX = 280;  // 大招的击退距离
const ULT_GATHER_MS = 500;     // 大招吸成一线的蓄力时间
const ULT_DAMAGE = 17000;

// 磁力菇所在行的顶边 y
function magnetRowY(game, plant) {
    return Math.floor(plant.y / game.cellHeight) * game.cellHeight;
}

// 游荡者按 (py + 30) 判定所在行，py 落在行首 +20 时正好居中
function wandererTargetY(rowY) {
    return rowY + 20;
}

// ---------- 第一段：击退 ----------

// 把所有僵尸往右轰。瞬移式击退，和原始豌豆 / 撑杆跳用的是同一套写法。
// 这里刻意不给每只僵尸加 class + setTimeout：一波几百只的时候，
// 每 1.5 秒几百次 DOM class 改写是白给的开销，冲击波环已经把动静表达出来了。
function knockback(game, plant, dist) {
    let hit = 0;

    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        z.x = Math.min(game.boardWidth - z.width, z.x + dist);
        z.eating = false;
        if (z.element) z.element.classList.remove('eating');
        z.draw();
        hit++;
    }

    const ws = game.wandererSystem;
    if (ws) {
        for (let i = 0; i < ws.count; i++) {
            ws.px[i] = Math.min(ws.W - 40, ws.px[i] + dist);
            hit++;
        }
    }

    if (hit > 0) {
        shockwave(game, plant);
        game.sound.playIceShoot();
    }
    return hit;
}

// ---------- 第二段：吸到本行 ----------

function gather(game, rowY, step) {
    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        const dy = rowY - z.y;
        if (Math.abs(dy) <= SNAP_PX) {
            // 精确对齐行首：割草机判定用的是 z.y === row * cellHeight
            if (z.y !== rowY) { z.y = rowY; z.draw(); }
            z.element?.classList.remove('magnetized');
            continue;
        }
        z.y += Math.sign(dy) * Math.min(step, Math.abs(dy));
        z.draw();
        z.element?.classList.add('magnetized');
    }

    const ws = game.wandererSystem;
    if (!ws) return;
    const target = wandererTargetY(rowY);
    for (let i = 0; i < ws.count; i++) {
        // 阻尼掉纵向弹跳再往目标行收拢。磁力菇没了以后，
        // WandererSystem 的随机换向计时会在几秒内把 vy 重新甩起来。
        ws.vy[i] *= 0.8;
        ws.py[i] += (target - ws.py[i]) * WANDER_PULL;
    }
}

// ---------- 普通攻击：脉冲击退 + 持续吸附 ----------

export function magnetPull(game, plant) {
    const rowY = magnetRowY(game, plant);

    // plant.timer 已经带上了融合 / 叠种 / 加速倍率，和其他植物同一套节奏口径
    if (plant.timer >= PULSE_MS) {
        plant.timer = 0;
        knockback(game, plant, KNOCKBACK_PX);
    }

    gather(game, rowY, (game.deltaTime || 16) * PULL_PER_MS);
}

// ---------- 绿叶素大招：远距离击退 → 吸成一线 → 引爆 ----------

export function magnetUltimate(game, plant) {
    const rowY = magnetRowY(game, plant);
    const targets = game.zombies.filter(z => !z.markedForDeletion);
    const ws = game.wandererSystem;
    const wCount = ws ? ws.count : 0;

    const boss = game.boss && !game.boss.markedForDeletion ? game.boss : null;
    if (targets.length === 0 && wCount === 0 && !boss) {
        flash(game, '🧲 场上没有目标!');
        return;
    }

    // 第一段：一口气全部轰回右边
    knockback(game, plant, ULT_KNOCKBACK_PX);

    const field = document.createElement('div');
    field.className = 'magnet-field';
    field.style.top = `${rowY}px`;
    game.board.appendChild(field);

    // 第二段：吸成一条直线。起点在击退之后取，插值才不会把僵尸拽回去。
    const startAt = performance.now();
    const fromY = targets.map(z => z.y);
    const wFromY = [];
    for (let i = 0; i < wCount; i++) wFromY.push(ws.py[i]);
    const wTarget = wandererTargetY(rowY);

    const step = (now) => {
        const p = Math.min(1, (now - startAt) / ULT_GATHER_MS);

        targets.forEach((z, i) => {
            if (z.markedForDeletion) return;
            z.y = fromY[i] + (rowY - fromY[i]) * p;
            z.draw();
            z.element?.classList.add('magnetized');
        });
        for (let i = 0; i < wCount; i++) {
            ws.vy[i] = 0;
            ws.py[i] = wFromY[i] + (wTarget - wFromY[i]) * p;
        }

        if (p < 1) { requestAnimationFrame(step); return; }
        field.remove();
        detonate(game, rowY, targets);
    };
    requestAnimationFrame(step);
}

// 第三段：引爆
function detonate(game, rowY, targets) {
    game.sound.playExplosion();

    // 报纸将王本人吸不动，但磁场引爆照样罩得到他。走 takeDamage，
    // 所以他没低头 / 没被冻住时依旧无敌。
    const boss = game.boss;
    if (boss && !boss.markedForDeletion) {
        boss.takeDamage(ULT_DAMAGE);
        blastAt(game, boss.x + boss.width / 2, boss.y + boss.height / 2);
    }

    const band = document.createElement('div');
    band.className = 'magnet-blast-band';
    band.style.top = `${rowY}px`;
    game.board.appendChild(band);
    setTimeout(() => band.remove(), 600);

    let hits = 0;

    for (const z of targets) {
        if (z.markedForDeletion) continue;
        stripMetal(z);
        z.takeDamage(ULT_DAMAGE);
        blastAt(game, z.x + z.width / 2, rowY + 50);
        if (z.health <= 0) {
            z.remove();
            game.sound.playZombieDie();
        } else {
            z.element?.classList.remove('magnetized');
        }
        hits++;
    }

    const ws = game.wandererSystem;
    if (ws) {
        for (let i = 0; i < ws.count; i++) {
            blastAt(game, ws.px[i] + 20, rowY + 50);
            // 游荡者血量是 Infinity，炸不死，直接把它轰回右侧重新爬
            ws.px[i] = ws.W;
            ws.vy[i] = Math.random() < 0.5 ? 2 : -2;
            hits++;
        }
    }

    flash(game, `🧲 ${hits} 只僵尸吃满 ${ULT_DAMAGE} 点伤害!`);
}

// 磁力先把金属护甲扒掉，护甲就挡不住后面的 17000 了
function stripMetal(z) {
    if (z.newspaperHealth > 0) z.newspaperHealth = 0;
    if (z.doorHealth > 0) z.doorHealth = 0;
}

// 从磁力菇向外扩散的斥力环
function shockwave(game, plant) {
    const el = document.createElement('div');
    el.className = 'magnet-shockwave';
    el.style.left = `${plant.x + 40}px`;
    el.style.top = `${plant.y + 50}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 520);
}

function blastAt(game, x, y) {
    const el = document.createElement('div');
    el.className = 'magnet-blast';
    el.style.left = `${x - 45}px`;
    el.style.top = `${y - 45}px`;
    game.board.appendChild(el);
    setTimeout(() => el.remove(), 500);
}

function flash(game, text) {
    const el = document.createElement('div');
    el.className = 'flash-message';
    el.style.background = 'rgba(150, 60, 200, 0.9)';
    el.textContent = text;
    document.getElementById('game-container').appendChild(el);
    setTimeout(() => el.remove(), 1500);
}
