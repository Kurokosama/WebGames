// 倭瓜 🍈 —— 长得像个哈密瓜，蹲在地上一动不动，直到前面来了僵尸。
//
// 它的流程是固定的四步：
//   1. 盯着看：**前后**三格之内出现僵尸，它就转过去盯着最近那只看，看满 3 秒
//   2. 朝那只的方向跳一格 —— 前面来的往前跳，背后绕过去的就往后跳
//   3. 飞起来：整个瓜腾空升高
//   4. 砸下来：落点那一格（连同左右各半格）的僵尸全被压扁
//   5. 跳回原来那一格接着蹲着 —— 它不会碎，可以一遍遍来
//
// 落点伤害直接扣血，不走护盾判定 —— 一整个瓜砸下来，报纸和铁门挡不住。
//
// 绿叶素大招：满场乱跳，随机挑 5 只僵尸挨个砸死（跨行也跳），砸完跳回原位
// 接着蹲。场上不够 5 只就有几只砸几只。

const RANGE_CELLS = 3;       // 前后三格之内都会被惊动
const STARE_MS = 3000;       // 盯着看多久
const RISE_MS = 600;         // 腾空的时间
const REST_MS = 500;         // 砸完在落点喘口气，然后跳回原位
const SLAM_DAMAGE = 10000;   // 落点伤害，压扁一切
const ULT_KILLS = 5;         // 大招砸几只
const ULT_HOP_MS = 260;      // 大招里每跳一下的间隔

// 同行、前后三格之内离得最近的那只僵尸。前后都看 —— 有僵尸绕到背后
// （撑杆跳跳过去，或被磁力菇 / 原始豌豆推过去）时，倭瓜也能回头砸它。
function targetInRange(game, plant) {
    const row = Math.floor(plant.y / game.cellHeight);
    const reach = RANGE_CELLS * game.cellWidth;
    const cx = plant.x + plant.width / 2;
    let best = null, bestD = Infinity;
    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        if (Math.floor(z.y / game.cellHeight) !== row) continue;
        const d = Math.abs((z.x + z.width / 2) - cx);
        if (d > reach) continue;
        if (d < bestD) { bestD = d; best = z; }
    }
    if (best) return best;

    // 没有僵尸就看看报纸将王够不够得着 —— 他纵向占满整片草坪，哪一行都算数，
    // 只在他低头 / 被冻住（也就是打得到）的时候才扑上去，免得白跳一趟
    return bossInRange(game, plant) ? 'boss' : null;
}

// 将王的左半边落在前方三格之内，而且这会儿打得到
function bossInRange(game, plant) {
    const b = game.boss;
    if (!b || b.markedForDeletion || !b.vulnerable) return false;
    const reach = plant.x + RANGE_CELLS * game.cellWidth;
    return b.x <= reach && b.x + b.width > plant.x;
}

// 目标在倭瓜的左边还是右边。'boss' 是哨兵，他永远在棋盘最右侧，算向前。
function dirTo(plant, t) {
    if (!t || t === 'boss') return 1;
    return (t.x + t.width / 2) < (plant.x + plant.width / 2) ? -1 : 1;
}

export function squashTick(plant, game) {
    const dt = game.deltaTime || 16;
    // 记住老家在哪儿，砸完要跳回来（大招会跨行乱跳，所以 x y 都得记）
    if (plant._sqHome === undefined) { plant._sqHome = plant.x; plant._sqHomeY = plant.y; }
    const state = plant._sqState || 'idle';

    // 一次绿叶素只发一趟；大招结束后要等这次绿叶素过期才允许下一趟
    if (!(plant.ultimateMs > 0)) plant._sqUlt = false;

    if (state === 'ult') { ultTick(plant, game, dt); return; }

    if (state === 'idle') {
        // 兜底：闲着的时候一定站在老家。不管上一趟是往前砸还是往后砸（大招会
        // 跨行跨列乱跳），只要回到 idle 还没归位，就立刻挪回去 —— 免得漏掉哪条
        // 路径没调 goHome，瓜就留在外面了
        if (plant.x !== plant._sqHome || plant.y !== plant._sqHomeY) {
            goHome(plant);
            return;
        }

        // 绿叶素：满场乱跳砸 5 只
        if (plant.ultimateMs > 0 && !plant._sqUlt) { startUltimate(plant, game); return; }
        const t = targetInRange(game, plant);
        if (!t) return;
        plant._sqState = 'stare';
        plant._sqT = 0;
        plant._sqDir = dirTo(plant, t);
        plant.element?.classList.add('squash-stare');
        plant.element?.classList.toggle('squash-backward', plant._sqDir < 0);
        return;
    }

    if (state === 'stare') {
        // 盯人盯到一半吃了绿叶素，也立刻转成大招
        if (plant.ultimateMs > 0 && !plant._sqUlt) { startUltimate(plant, game); return; }
        plant._sqT += dt;
        if (plant._sqT >= STARE_MS) startLeap(plant, game);
        return;
    }

    if (state === 'leap') {
        plant._sqT += dt;
        if (plant._sqT >= RISE_MS) slam(plant, game);
        return;
    }

    if (state === 'rest') {
        plant._sqT += dt;
        if (plant._sqT >= REST_MS) goHome(plant);
    }
}

// ---------- 绿叶素大招：随机砸死 5 只再回原位 ----------

function startUltimate(plant, game) {
    plant._sqUlt = true;

    // 场上随机挑 5 只（洗牌后取前 5 个），不够就有几只砸几只
    const pool = game.zombies.filter(z => !z.markedForDeletion);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    plant._sqQueue = pool.slice(0, ULT_KILLS);

    if (plant._sqQueue.length === 0) {
        game.showNotEnoughFeedback('🍈 场上没有僵尸可砸!');
        return;
    }

    plant._sqState = 'ult';
    plant._sqT = ULT_HOP_MS;      // 立刻砸第一只，不空等
    plant._sqKills = 0;
    game.showNotEnoughFeedback(`🍈 满场乱砸! 盯上了 ${plant._sqQueue.length} 只`);
}

function ultTick(plant, game, dt) {
    plant._sqT += dt;
    if (plant._sqT < ULT_HOP_MS) return;
    plant._sqT = 0;

    // 队列里可能有已经被别的植物打死的，跳过它们
    let z = null;
    while (plant._sqQueue.length && !z) {
        const c = plant._sqQueue.shift();
        if (c && !c.markedForDeletion) z = c;
    }

    if (!z) {
        game.showNotEnoughFeedback(`🍈 砸完了 ${plant._sqKills} 只，回家`);
        goHome(plant);
        return;
    }

    // 跳到它头上（大招会跨行，所以 y 也跟着走）
    plant.x = z.x;
    plant.y = z.y;
    plant.draw();
    plant.element?.classList.remove('squash-leap');
    plant.element?.classList.add('squash-leap');

    z.health -= SLAM_DAMAGE;     // 直接扣血，绕过护盾
    if (z.health <= 0) {
        z.remove();
        game.sound?.playZombieDie();
    } else {
        z.draw();
    }
    plant._sqKills++;
    smashFx(game, plant.x, plant.y);
}

// 跳回原来那一格，重新蹲好，等下一只
function goHome(plant) {
    plant.x = plant._sqHome;
    if (plant._sqHomeY !== undefined) plant.y = plant._sqHomeY;
    plant.draw();
    plant._sqState = 'idle';
    plant._sqT = 0;
    plant.element?.classList.remove('squash-leap', 'squash-stare', 'squash-backward');
    plant.element?.classList.add('squash-back');
    setTimeout(() => plant.element?.classList.remove('squash-back'), 400);
}

// 朝盯上的那只的方向跳一格，然后腾空
function startLeap(plant, game) {
    plant._sqState = 'leap';
    plant._sqT = 0;
    plant.element?.classList.remove('squash-stare');

    // 起跳前再确认一次方向：盯人那 3 秒里目标可能已经绕到另一边了
    const t = targetInRange(game, plant);
    if (t) plant._sqDir = dirTo(plant, t);
    const dir = plant._sqDir || 1;
    plant.element?.classList.toggle('squash-backward', dir < 0);

    const maxX = (game.width - 1) * game.cellWidth;
    plant.x = Math.max(0, Math.min(maxX, plant.x + dir * game.cellWidth));
    plant.draw();

    plant.element?.classList.add('squash-leap');
    game.sound?.playShoot();
}

// 砸下来：落点那一格的僵尸全压扁。瓜不会碎，歇一下就跳回原位
function slam(plant, game) {
    plant._sqState = 'rest';
    plant._sqT = 0;
    plant.element?.classList.remove('squash-leap');

    const row = Math.floor(plant.y / game.cellHeight);
    const left = plant.x - game.cellWidth * 0.5;
    const right = plant.x + game.cellWidth * 1.5;
    let hit = 0;

    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        if (Math.floor(z.y / game.cellHeight) !== row) continue;
        const zx = z.x + z.width / 2;
        if (zx < left || zx > right) continue;
        z.health -= SLAM_DAMAGE;      // 直接扣血，绕过报纸 / 铁门护盾
        if (z.health <= 0) {
            z.remove();
            game.sound?.playZombieDie();
        } else {
            z.draw();
        }
        hit++;
    }

    // 落点压到将王身上也算一下：走他自己的 takeDamage，没低头 / 没被冻住时
    // 这一下会被他吞掉（跟子弹一个规矩）
    const b = game.boss;
    if (b && !b.markedForDeletion && b.x < right && b.x + b.width > left) {
        if (b.takeDamage(SLAM_DAMAGE)) {
            game.showNotEnoughFeedback(`🍈 砸了报纸将王 ${SLAM_DAMAGE} 点!`);
            hit++;
        }
    }

    smashFx(game, plant.x, plant.y);
    game.sound?.playExplosion();
    if (hit) game.showNotEnoughFeedback(`🍈 压扁了 ${hit} 只!`);
}

// 砸下去那一下的冲击圈
function smashFx(game, x, y) {
    const boom = document.createElement('div');
    boom.className = 'squash-smash';
    boom.style.left = `${x + 40}px`;
    boom.style.top = `${y + 50}px`;
    game.board.appendChild(boom);
    setTimeout(() => boom.remove(), 500);
}
