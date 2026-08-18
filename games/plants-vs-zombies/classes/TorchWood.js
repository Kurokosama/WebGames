// 火炬树桩 🔥🪵 —— 一截树桩，上面顶着一团火焰。
//
// 豌豆类的子弹从它这一格飞过去时会被点着：子弹变成红色，伤害 ×2。
// 绿叶素大招：火焰每喂一次换一种颜色，倍率跟着翻一倍。
// 一共走完彩虹的七种颜色：红 ×2 → 蓝 ×4 → 紫 ×8 → 橙 ×16 → 黄 ×32 →
// 绿 ×64 → 青 ×128。青火就是顶了，再喂绿叶素也不会更强。
//
// 每颗子弹在同一根树桩上只点一次，但连着穿过几根树桩会一根一根叠上去。

// 会被点着的「豌豆类」子弹
const PEA_TYPES = new Set(['normal', 'ice', 'gatling', 'primitivepea', 'mgpea', 'scatterpea']);

// 火焰的七段颜色，把彩虹七色用满，每换一种颜色倍率翻一倍
const LEVELS = [
    { name: '红', cls: 'torch-red',    bullet: 'torched-red',    mult: 2 },
    { name: '蓝', cls: 'torch-blue',   bullet: 'torched-blue',   mult: 4 },
    { name: '紫', cls: 'torch-purple', bullet: 'torched-purple', mult: 8 },
    { name: '橙', cls: 'torch-orange', bullet: 'torched-orange', mult: 16 },
    { name: '黄', cls: 'torch-yellow', bullet: 'torched-yellow', mult: 32 },
    { name: '绿', cls: 'torch-green',  bullet: 'torched-green',  mult: 64 },
    { name: '青', cls: 'torch-cyan',   bullet: 'torched-cyan',   mult: 128 },
];

let torchSeq = 0;

export function torchLevel(plant) {
    return plant._torchLv || 0;
}

export function torchMult(plant) {
    return LEVELS[torchLevel(plant)].mult;
}

// 绿叶素：火焰升一档，红 → 蓝 → 紫，紫就到顶了
export function torchUpgrade(game, plant) {
    const lv = torchLevel(plant);
    if (lv >= LEVELS.length - 1) {
        game.showNotEnoughFeedback(`🔥 已经是青火了，七色走完到顶（×${torchMult(plant)}）`);
        return;
    }
    plant._torchLv = lv + 1;
    paint(plant);
    const now = LEVELS[plant._torchLv];
    game.showNotEnoughFeedback(`🔥 火焰变${now.name}了! 伤害 ×${now.mult}`);
}

// 把当前档位画到植物身上：火焰颜色 + 右上角的倍率徽章
function paint(plant) {
    if (!plant.element) return;
    const cfg = LEVELS[torchLevel(plant)];
    for (const l of LEVELS) plant.element.classList.remove(l.cls);
    plant.element.classList.add(cfg.cls);

    let badge = plant.element.querySelector('.torch-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'torch-badge';
        plant.element.appendChild(badge);
    }
    badge.textContent = `×${cfg.mult}`;
}

export function torchwoodTick(plant, game) {
    if (plant._torchId === undefined) {
        plant._torchId = ++torchSeq;
        paint(plant);
    }

    // 绿叶素：升一档。一次绿叶素只升一次
    if (plant.ultimateMs > 0) {
        if (!plant._torchUlt) {
            plant._torchUlt = true;
            torchUpgrade(game, plant);
        }
    } else {
        plant._torchUlt = false;
    }

    ignite(game, plant);
}

// 把这一格里的豌豆类子弹点着
function ignite(game, plant) {
    const cfg = LEVELS[torchLevel(plant)];
    const left = plant.x;
    const right = plant.x + game.cellWidth;
    const top = plant.y;
    const bottom = plant.y + game.cellHeight;

    for (const p of game.projectiles) {
        if (p.markedForDeletion || !PEA_TYPES.has(p.type)) continue;
        if (p.x + p.width < left || p.x > right) continue;
        if (p.y + p.height < top || p.y > bottom) continue;

        // 同一根树桩只点一次，换一根还能再点
        if (!p._torchIds) p._torchIds = [];
        if (p._torchIds.includes(plant._torchId)) continue;
        p._torchIds.push(plant._torchId);

        if (p.damage !== Infinity) p.damage *= cfg.mult;
        if (p.bossDamage) p.bossDamage *= cfg.mult;

        if (p.element) {
            for (const l of LEVELS) p.element.classList.remove(l.bullet);
            p.element.classList.add('torched', cfg.bullet);
        }
    }
}
