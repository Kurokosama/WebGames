// 核爆樱桃 ☢️ —— 一颗红樱桃摞在一朵红色的毁灭菇上。
//
// 种下 3 秒后自爆：先掀起一朵**红色的巨型蘑菇云**，云脚下甩出一圈红烟。
// 红烟会一圈圈往外扩散，扫到哪只僵尸，哪只僵尸头上就再炸一朵小一号的蘑菇云，
// 造成 1800 点伤害（直接扣血，绕过报纸 / 铁门护盾）。
//
// 绿叶素大招：满地召唤会爆炸的植物 —— 樱桃炸弹 / 土豆地雷 / 毁灭菇 / 豌豆炸弹，
// 唯独不召唤它自己。

const FUSE_MS = 3000;          // 种下到自爆
const BLAST_DAMAGE = 1800;     // 红烟扫到的伤害
const SMOKE_R0 = 70;           // 起始半径
const SMOKE_SPEED = 0.26;      // 扩散速度（px/ms）—— 一直往外扩，不会中途停下
const BOOM_PLANTS = ['cherry', 'potato', 'doomshroom', 'peabomb'];

// 僵尸的「体型」：越壮，被红烟点着时炸出来的烟越多、越大。
// 大家的碰撞盒都是 80×100，所以这里按种类给个块头系数。
// 甩出来的烟股数 = 四舍五入后的系数，所以档位拉开一点才看得出区别：
// 普通 1 股 · 报纸 / 撑杆 2 股 · 路障 2 股 · 铁桶 3 股 · 铁门 4 股 · 将王 6 股
const ZOMBIE_BULK = {
    normal: 1, newspaper: 1.5, polevault: 1.5,
    cone: 2, bucket: 3, door: 4,
};
const BOSS_BULK = 6;

// 同时最多这么多股烟，免得连锁反应把帧率拖死
const MAX_PUFFS = 28;
let livePuffs = 0;

function bulkOf(z) {
    return ZOMBIE_BULK[z.type] || 1;
}

export function nukeCherryTick(plant, game) {
    if (plant._nukeDone) return;

    // 绿叶素：满地召唤会爆炸的植物（不含自己）
    if (plant.ultimateMs > 0) {
        plant._nukeDone = true;
        summonBoomGarden(game, plant);
        return;
    }

    if (plant.timer >= FUSE_MS) {
        plant._nukeDone = true;
        detonate(game, plant);
    }
}

// ---------- 自爆 ----------

function detonate(game, plant) {
    const cx = plant.x + 40;
    const cy = plant.y + 50;

    bigCloud(game, cx, cy);
    spreadSmoke(game, cx, cy);

    game.sound?.playExplosion();
    game.showNotEnoughFeedback('☢️ 核爆樱桃! 红烟正在扩散…');
    plant.remove();
}

// 红色巨型蘑菇云：底下一根云柱 + 顶上又扁又宽的伞盖 + 全屏红闪
function bigCloud(game, cx, cy) {
    const size = 260;
    const stemH = size * 0.62;
    const stemW = size * 0.2;
    const capH = size * 0.55;

    const stem = document.createElement('div');
    stem.className = 'nuke-stem';
    stem.style.cssText = `width:${stemW}px;height:${stemH}px;left:${cx - stemW / 2}px;top:${cy - stemH}px`;
    game.board.appendChild(stem);
    setTimeout(() => stem.remove(), 1100);

    const cap = document.createElement('div');
    cap.className = 'nuke-cloud';
    cap.style.cssText =
        `width:${size}px;height:${capH}px;left:${cx - size / 2}px;top:${cy - stemH - capH * 0.72}px`;
    game.board.appendChild(cap);
    setTimeout(() => cap.remove(), 1100);

    const flash = document.createElement('div');
    flash.className = 'nuke-flash';
    game.board.appendChild(flash);
    setTimeout(() => flash.remove(), 700);
}

// 一圈红烟往外扩散：扫到谁，谁头上再炸一朵小蘑菇云。
// 它不会半路停下 —— 一直往外扩，直到把整片棋盘扫完才散。
function spreadSmoke(game, cx, cy, opts = {}) {
    const { chain = true, r0 = SMOKE_R0, speed = SMOKE_SPEED, cls = 'nuke-smoke' } = opts;

    const ring = document.createElement('div');
    ring.className = cls;
    game.board.appendChild(ring);
    livePuffs++;

    const hit = new Set();
    const t0 = performance.now();

    // 主爆的烟一直扩到盖住棋盘最远那个角；二次烟按块头给个上限
    const boardH = game.height * game.cellHeight;
    const maxR = opts.maxR ?? (Math.max(
        Math.hypot(cx, cy), Math.hypot(game.boardWidth - cx, cy),
        Math.hypot(cx, boardH - cy), Math.hypot(game.boardWidth - cx, boardH - cy)
    ) + 60);

    const step = (now) => {
        const r = r0 + speed * (now - t0);
        // 快扫完的时候才开始变淡，中途一直是实的
        const fade = Math.max(0, Math.min(1, (maxR - r) / 260));

        ring.style.cssText =
            `width:${r * 2}px;height:${r * 2}px;left:${cx - r}px;top:${cy - r}px;opacity:${0.25 + fade * 0.75}`;

        // 烟锋扫过的僵尸：一只只点名，每只只炸一次
        for (const z of game.zombies) {
            if (z.markedForDeletion || hit.has(z)) continue;
            const zx = z.x + z.width / 2;
            const zy = z.y + z.height / 2;
            if (Math.hypot(zx - cx, zy - cy) > r) continue;
            hit.add(z);
            const bulk = bulkOf(z);
            miniCloud(game, zx, zy, bulk);
            puffFrom(game, zx, zy, bulk, chain);
            z.health -= BLAST_DAMAGE;          // 直接扣血，绕过护盾
            if (z.health <= 0) {
                z.remove();
                game.sound?.playZombieDie();
            } else {
                z.draw();
            }
        }

        // 报纸将王也在红烟范围里的话，照他自己的规矩来
        const b = game.boss;
        if (b && !b.markedForDeletion && !hit.has(b)) {
            const bx = b.x + b.width / 2;
            const by = b.y + b.height / 2;
            if (Math.hypot(bx - cx, by - cy) <= r) {
                hit.add(b);
                if (b.takeDamage(BLAST_DAMAGE)) {
                    // 将王是全场最壮的，炸出来的烟也最多
                    miniCloud(game, bx, by, BOSS_BULK);
                    puffFrom(game, bx, by, BOSS_BULK, chain);
                }
            }
        }

        if (r >= maxR) { ring.remove(); livePuffs--; return; }
        requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// 一只僵尸被点着时甩出来的二次烟：块头越大，甩出来的股数越多、扩得越远。
// 这些烟只负责点火，不再往下连锁（chain=false），免得一路炸到天荒地老。
function puffFrom(game, cx, cy, bulk, chain) {
    if (!chain) return;
    const n = Math.max(1, Math.round(bulk));
    for (let i = 0; i < n; i++) {
        if (livePuffs >= MAX_PUFFS) return;
        const a = (i / n) * Math.PI * 2;
        const off = 16 * bulk;
        spreadSmoke(game, cx + Math.cos(a) * off, cy + Math.sin(a) * off, {
            chain: false,
            r0: 10,
            speed: 0.18,
            maxR: 70 + 60 * bulk,
            cls: 'nuke-smoke puff',
        });
    }
}

// 被点着的那只自己炸出来的蘑菇云：块头越大，云越大
function miniCloud(game, cx, cy, bulk = 1) {
    const size = 96 * (0.8 + bulk * 0.35);
    const stemH = size * 0.62;
    const capH = size * 0.55;

    const stem = document.createElement('div');
    stem.className = 'nuke-stem mini';
    stem.style.cssText =
        `width:${size * 0.2}px;height:${stemH}px;left:${cx - size * 0.1}px;top:${cy - stemH}px`;
    game.board.appendChild(stem);
    setTimeout(() => stem.remove(), 800);

    const cap = document.createElement('div');
    cap.className = 'nuke-cloud mini';
    cap.style.cssText =
        `width:${size}px;height:${capH}px;left:${cx - size / 2}px;top:${cy - stemH - capH * 0.72}px`;
    game.board.appendChild(cap);
    setTimeout(() => cap.remove(), 800);
}

// ---------- 绿叶素：满地会爆炸的植物 ----------

function summonBoomGarden(game, plant) {
    // 这里晚一点再 import，避免和 PlantManager 绕成循环依赖
    import('./PlantManager.js').then(({ spawnPlant }) => {
        let n = 0;
        for (let r = 0; r < game.height; r++) {
            for (let c = 0; c < game.width; c++) {
                const t = BOOM_PLANTS[Math.floor(Math.random() * BOOM_PLANTS.length)];
                if (spawnPlant(game, r, c, t)) n++;
            }
        }
        game.showNotEnoughFeedback(`☢️ 满地爆炸物! 召唤了 ${n} 株`);
    });

    bigCloud(game, plant.x + 40, plant.y + 50);
    game.sound?.playExplosion();
    plant.remove();
}
