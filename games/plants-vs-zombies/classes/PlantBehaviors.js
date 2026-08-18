import { hasEnemyInRow, hasAnyEnemy, spawnProjectile, cherryBomb } from './CombatManager.js';
import { spawnSun } from './SunManager.js';
import { spawnPlant } from './PlantManager.js';
import { cannonAutoFire } from './CornCannon.js';
import { cabbageBarrage, cabbageLob, CABBAGE_INTERVAL } from './CabbagePult.js';
import { magnetPull, magnetUltimate } from './MagnetShroom.js';
import { mgVolley, mgScatter, mgUpgrade } from './SuperMG.js';
import { elecVolley, elecScatter } from './ElectricMG.js';
import { iceBlast, iceStorm, iceInterval } from './IceShroom.js';
import { doomBlast, doomUpgrade, doomGrow, DOOM_INTERVAL } from './DoomShroom.js';
import { sunEmperorTick } from './SunEmperor.js';
import { peaBombTick } from './PeaBomb.js';
import { torchwoodTick } from './TorchWood.js';
import { melonLob, melonSniper, melonCherryVolley, MELON_INTERVAL } from './MelonPult.js';
import { superLob, superVolley, SUPER_INTERVAL } from './SuperPult.js';
import { kernelLob, kernelButterVolley, kernelCherryVolley, KERNEL_INTERVAL } from './KernelPult.js';
import { squashTick } from './Squash.js';
import { shooterVolley, giantPea } from './ShooterUlt.js';
import { nukeCherryTick } from './NukeCherry.js';
import { trophyPultTick } from './TrophyPult.js';
import { fumeAttack, fumeUltimate, FUME_INTERVAL } from './FumeShroom.js';
import { houseTick } from './House.js';

// 植物行为表：声明式描述每种植物每个 tick 该做什么。
//
// 简单射手用 { interval, kind, shots } 表达；非常规行为（樱桃 / 土豆 / 坚果保龄球
// 等带状态或一次性的）用 tick / fire 函数。
//
// shots 元素为 [projectileType, dy]，dy 是相对植物 y 的纵向偏移。
// kind:
//   row         —— 同行有敌人（或大招中）则按 shots 发射
//   tri         —— 上中下三行各检查一次（敌人含 wanderer，大招中视作有敌）
//   tri-zombies —— 同 tri，但只看 game.zombies、不响应 ultimate（黑曜石历史行为）

function fireRow(plant, game, shots) {
    const r = Math.floor(plant.y / game.cellHeight);
    if (!(plant.ultimateMs > 0) && !hasEnemyInRow(game,r, plant.x)) return;
    for (const [proj, dy] of shots) {
        spawnProjectile(game, plant.x + 40, plant.y + dy, proj, plant);
    }
}

function fireTri(plant, game, shots) {
    const dy0 = game.cellHeight;
    const maxY = game.height * game.cellHeight;
    const rows = [plant.y - dy0, plant.y, plant.y + dy0];
    for (const rowY of rows) {
        if (rowY < 0 || rowY >= maxY) continue;
        const r = Math.floor(rowY / game.cellHeight);
        if (!(plant.ultimateMs > 0) && !hasEnemyInRow(game,r, plant.x)) continue;
        for (const [proj, dy] of shots) {
            spawnProjectile(game, plant.x + 40, rowY + dy, proj, plant);
        }
    }
}

function fireTriZombies(plant, game, shots) {
    const dy0 = game.cellHeight;
    const maxY = game.height * game.cellHeight;
    const rows = [plant.y - dy0, plant.y, plant.y + dy0];
    for (const rowY of rows) {
        if (rowY < 0 || rowY >= maxY) continue;
        const target = Math.floor(rowY / game.cellHeight);
        const has = game.zombies.some(z =>
            Math.floor(z.y / game.cellHeight) === target && z.x > plant.x
        );
        if (!has) continue;
        for (const [proj, dy] of shots) {
            spawnProjectile(game, plant.x + 40, rowY + dy, proj, plant);
        }
    }
}

function gatlingBurst(plant, game) {
    if (!(plant.ultimateMs > 0) && !hasAnyEnemy(game, plant.x)) return;
    const maxY = game.height * game.cellHeight;
    for (let i = 0; i < 4; i++) {
        const py = plant.y + 20 + (Math.random() - 0.5) * 200;
        if (py >= 0 && py < maxY) spawnProjectile(game, plant.x + 40, py, 'gatling', plant);
    }
}

function sunflowerProduce(plant, game) {
    spawnSun(game, plant.x, plant.y, 25);
}

function corncannonAuto(plant, game) {
    cannonAutoFire(game, plant.x, plant.y);
}

function cherryTick(plant, game) {
    if (plant.ultimateMs > 0 && !plant._cherryUlt) {
        plant._cherryUlt = true;
        const types = ['peashooter', 'sunflower', 'wallnut', 'iceshooter', 'doubleshooter',
                       'pitcher', 'glue', 'obsidian', 'gatling', 'waterdrop', 'corncannon',
                       'primitivepea', 'triplepea', 'cabbagepult', 'supermg', 'elecmg', 'iceshroom', 'doomshroom', 'sunemperor', 'melonpult', 'kernelpult', 'squash'];
        for (let r = 0; r < game.height; r++) {
            for (let c = 0; c < game.width; c++) {
                spawnPlant(game,r, c, types[Math.floor(Math.random() * types.length)]);
            }
        }
        plant.remove();
        return;
    }
    if (plant.timer >= 800) {
        cherryBomb(game, plant.x, plant.y);
        plant.remove();
    }
}

function potatoTick(plant, game) {
    if (plant.ultimateMs > 0 && !plant._potatoUlt) {
        plant._potatoUlt = true;
        for (let r = 0; r < game.height; r++) {
            for (let c = 0; c < game.width; c++) spawnPlant(game,r, c, 'cherry');
        }
        plant.remove();
        return;
    }
    if (!plant.armed) {
        plant.armTimer += game.deltaTime;
        if (plant.armTimer >= 3000) {
            plant.armed = true;
            // 装好了：给 .potato-mine 加 armed，土豆升起来、探出红引信（见 style.css）
            if (plant.element) plant.element.querySelector('.potato-mine')?.classList.add('armed');
        }
        return;
    }
    const myRow = Math.floor(plant.y / game.cellHeight);
    const myCol = Math.floor(plant.x / game.cellWidth);

    // 出土之后，只要有僵尸踩到这一格就引爆
    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        const zCol = Math.floor((z.x + 40) / game.cellWidth);
        const zRow = Math.floor(z.y / game.cellHeight);
        if (zRow === myRow && zCol === myCol) {
            potatoBoom(game, plant, myRow, myCol);
            return;
        }
    }
}

// 炸 3×3 —— 以自己那一格为中心，周围八格连同自己，每只僵尸 1800 点。
// 直接扣血，绕过报纸 / 铁门那套护盾判定。
function potatoBoom(game, plant, row, col) {
    const POTATO_DAMAGE = 1800;
    let hit = 0;

    for (const z of game.zombies) {
        if (z.markedForDeletion) continue;
        const zRow = Math.floor(z.y / game.cellHeight);
        const zCol = Math.floor((z.x + 40) / game.cellWidth);
        if (Math.abs(zRow - row) > 1 || Math.abs(zCol - col) > 1) continue;
        z.health -= POTATO_DAMAGE;
        if (z.health <= 0) {
            z.remove();
            game.sound?.playZombieDie();
        } else {
            z.draw();
        }
        hit++;
    }

    // 3×3 那片火光
    const boom = document.createElement('div');
    boom.className = 'potato-blast';
    boom.style.left = `${(col - 1) * game.cellWidth}px`;
    boom.style.top = `${(row - 1) * game.cellHeight}px`;
    boom.style.width = `${3 * game.cellWidth}px`;
    boom.style.height = `${3 * game.cellHeight}px`;
    game.board.appendChild(boom);
    setTimeout(() => boom.remove(), 520);

    game.sound?.playExplosion();
    if (hit) game.showNotEnoughFeedback(`🥔 3×3 爆炸! ${hit} 只吃了 ${POTATO_DAMAGE} 点`);
    plant.remove();
}

function cabbagepultTick(plant, game) {
    if (plant.ultimateMs > 0) {
        if (!plant._cabbageUlt) {
            plant._cabbageUlt = true;
            cabbageBarrage(game, plant);
        }
        return;
    }
    plant._cabbageUlt = false;
    if (plant.timer < CABBAGE_INTERVAL) return;
    plant.timer = 0;
    cabbageLob(game, plant);
}

// 超级机枪：0.5 秒一轮 6 连发，每打满 5 轮自动喷一次 150 颗散射豌豆
function supermgTick(plant, game) {
    // 绿叶素：连发数永久 +1。一次绿叶素只加一次，所以用标志位卡住，
    // 大招结束（ultimateMs 归零）后才允许下一次。
    if (plant.ultimateMs > 0) {
        if (!plant._mgUlt) {
            plant._mgUlt = true;
            mgUpgrade(game, plant);
        }
    } else {
        plant._mgUlt = false;
    }

    if (plant.timer < 500) return;
    plant.timer = 0;

    const row = Math.floor(plant.y / game.cellHeight);
    if (!(plant.ultimateMs > 0) && !hasEnemyInRow(game, row, plant.x)) return;

    mgVolley(game, plant);

    plant._mgVolleys = (plant._mgVolleys || 0) + 1;
    if (plant._mgVolleys >= 5) {
        plant._mgVolleys = 0;
        mgScatter(game, plant);
    }
}

// 超级电能机枪豌豆：0.5 秒一轮 6 连发无限贯穿电能弹，每打满 5 轮自动喷一次
// 150 颗电能散射弹
function elecmgTick(plant, game) {
    if (plant.timer < 500) return;
    plant.timer = 0;

    const row = Math.floor(plant.y / game.cellHeight);
    if (!(plant.ultimateMs > 0) && !hasEnemyInRow(game, row, plant.x)) return;

    elecVolley(game, plant);

    plant._elecVolleys = (plant._elecVolleys || 0) + 1;
    if (plant._elecVolleys >= 5) {
        plant._elecVolleys = 0;
        elecScatter(game, plant);
    }
}

// 寒冰菇：每 5 秒全场寒冰爆炸（2 点伤害 + 冻住全场）；
// 绿叶素大招是冰暴，每放一次这株的间隔就永久缩短 1 秒
function iceshroomTick(plant, game) {
    if (plant.ultimateMs > 0) {
        if (!plant._iceUlt) {
            plant._iceUlt = true;
            iceStorm(game, plant);
        }
        return;
    }
    plant._iceUlt = false;

    if (plant.timer < iceInterval(plant)) return;
    plant.timer = 0;
    iceBlast(game, plant);
}

// 毁灭菇：每 5 秒紫色蘑菇云爆炸一次，全场 1800 点伤害；
// 绿叶素大招每放一次，这株的爆炸伤害永久 +1800，云也跟着长大
function doomshroomTick(plant, game) {
    // 每帧都长一点，肉眼可见地越长越大，不封顶
    doomGrow(plant, game);

    if (plant.ultimateMs > 0) {
        if (!plant._doomUlt) {
            plant._doomUlt = true;
            doomUpgrade(game, plant);
        }
        return;
    }
    plant._doomUlt = false;

    if (plant.timer < DOOM_INTERVAL) return;
    plant.timer = 0;
    doomBlast(game, plant);
}

// 西瓜投手：每 1.2 秒朝同行最前面那只僵尸抛一颗西瓜（100 伤，越过障碍物）；
// 绿叶素变成西瓜狙击炮，场上几只僵尸就打几发巨型西瓜（700 伤）；
// 红叶素改打巨型红樱桃（一万伤）
function melonpultTick(plant, game) {
    if (plant.redMs > 0) {
        if (!plant._melonRed) {
            plant._melonRed = true;
            melonCherryVolley(game, plant);
        }
        return;
    }
    plant._melonRed = false;

    if (plant.ultimateMs > 0) {
        if (!plant._melonUlt) {
            plant._melonUlt = true;
            melonSniper(game, plant);
        }
        return;
    }
    plant._melonUlt = false;

    if (plant.timer < MELON_INTERVAL) return;
    plant.timer = 0;
    melonLob(game, plant);
}

// 玉米投手：每 1.2 秒抛一块越过障碍物的黄油（50 伤 + 定住 5 秒）；
// 绿叶素几只僵尸就几块巨型黄油（100 伤）；红叶素改抛红樱桃（1500 伤）
function kernelpultTick(plant, game) {
    if (plant.redMs > 0) {
        if (!plant._kernelRed) {
            plant._kernelRed = true;
            kernelCherryVolley(game, plant);
        }
        return;
    }
    plant._kernelRed = false;

    if (plant.ultimateMs > 0) {
        if (!plant._kernelUlt) {
            plant._kernelUlt = true;
            kernelButterVolley(game, plant);
        }
        return;
    }
    plant._kernelUlt = false;

    if (plant.timer < KERNEL_INTERVAL) return;
    plant.timer = 0;
    kernelLob(game, plant);
}

// 超级投手：三合一抛射，砸中后在同排里一路弹下去；绿叶素对全场各来一发巨大的
function superpultTick(plant, game) {
    if (plant.ultimateMs > 0) {
        if (!plant._superUlt) {
            plant._superUlt = true;
            superVolley(game, plant);
        }
        return;
    }
    plant._superUlt = false;

    if (plant.timer < SUPER_INTERVAL) return;
    plant.timer = 0;
    superLob(game, plant);
}

// 大喷菇：前方三排有僵尸就朝前喷一股紫雾（70 点）；
// 绿叶素连喷 3 秒，每 0.3 秒熏一次、每次 100 点
function fumeshroomTick(plant, game) {
    if (plant.ultimateMs > 0) {
        if (!plant._fumeUlt) {
            plant._fumeUlt = true;
            fumeUltimate(game, plant);
        }
        return;
    }
    plant._fumeUlt = false;

    if (plant.timer < FUME_INTERVAL) return;
    plant.timer = 0;
    fumeAttack(game, plant);
}

function magnetshroomTick(plant, game) {
    if (plant.ultimateMs > 0) {
        if (!plant._magnetUlt) {
            plant._magnetUlt = true;
            magnetUltimate(game, plant);
        }
        return;
    }
    plant._magnetUlt = false;
    magnetPull(game, plant);
}

function nutbowlingTick(plant, game) {
    if (plant.timer < 2000) return;
    const wasUlt = plant.ultimateMs > 0;
    // 用返回值拿保龄球本体。撞到子弹上限时 spawnProjectile 返回 null，
    // 按下标取「最后一颗」会误标到别的子弹上。
    const ball = spawnProjectile(game, plant.x + 40, plant.y + 22, 'bowling', plant);
    if (wasUlt && ball) ball.ultimate = true;
    plant.remove();
}

export const PLANT_BEHAVIORS = {
    peashooter:    { interval: 100,  kind: 'row',         shots: [['normal', 20]],
                     ult: (p, g) => g.showNotEnoughFeedback(`🌱 ${shooterVolley(g, p, 'normal')} 颗豌豆齐发!`) },
    glue:          { interval: 500,  kind: 'row',         shots: [['glue', 20]] },
    iceshooter:    { interval: 100,  kind: 'row',         shots: [['ice', 20]],
                     ult: (p, g) => g.showNotEnoughFeedback(`❄️ ${shooterVolley(g, p, 'ice')} 颗寒冰弹齐发!`) },
    doubleshooter: { interval: 100,  kind: 'row',         shots: [['normal', 15], ['normal', 35]],
                     ult: (p, g) => { const n = shooterVolley(g, p, 'normal'); giantPea(g, p);
                         g.showNotEnoughFeedback(`🌿 ${n} 颗豌豆 + 一枚巨型豌豆（贯穿 200/只）!`); } },
    waterdrop:     { interval: 1000, kind: 'row',         shots: [['waterdrop', 20]] },
    primitivepea:  { interval: 100,  kind: 'row',         shots: [['primitivepea', 20]] },
    triplepea:     { interval: 100,  kind: 'tri',         shots: [['normal', 20]] },
    obsidian:      { interval: 300,  kind: 'tri-zombies', shots: [['obsidian', 20]] },

    gatling:       { interval: 30, fire: gatlingBurst },
    sunflower:     { interval: 10, fire: sunflowerProduce },
    corncannon:    { interval: 5,  fire: corncannonAuto },

    cherry:        { tick: cherryTick },
    potato:        { tick: potatoTick },
    nutbowling:    { tick: nutbowlingTick },
    cabbagepult:   { tick: cabbagepultTick },
    magnetshroom:  { tick: magnetshroomTick },
    supermg:       { tick: supermgTick },
    elecmg:        { tick: elecmgTick },
    iceshroom:     { tick: iceshroomTick },
    doomshroom:    { tick: doomshroomTick },
    sunemperor:    { tick: sunEmperorTick },
    peabomb:       { tick: peaBombTick },
    torchwood:     { tick: torchwoodTick },
    melonpult:     { tick: melonpultTick },
    pitcher:       { tick: superpultTick },
    kernelpult:    { tick: kernelpultTick },
    squash:        { tick: squashTick },
    nukecherry:    { tick: nukeCherryTick },
    trophypult:    { tick: trophyPultTick },
    fumeshroom:    { tick: fumeshroomTick },
    house:         { tick: houseTick },
    // 礼物盒自己什么也不干，等着被点开
};

export function runPlantBehavior(plant, game) {
    const b = PLANT_BEHAVIORS[plant.type];
    if (!b) return;

    // 声明式植物的绿叶素大招：写在行为表的 ult 里，一次绿叶素只放一次
    if (b.ult) {
        if (plant.ultimateMs > 0) {
            if (!plant._ultFired) { plant._ultFired = true; b.ult(plant, game); }
        } else {
            plant._ultFired = false;
        }
    }

    if (b.tick) { b.tick(plant, game); return; }
    if (plant.timer < b.interval) return;
    plant.timer = 0;
    if (b.fire) { b.fire(plant, game); return; }
    if (b.kind === 'row')         fireRow(plant, game, b.shots);
    else if (b.kind === 'tri')    fireTri(plant, game, b.shots);
    else if (b.kind === 'tri-zombies') fireTriZombies(plant, game, b.shots);
}
