import { Entity } from './Entity.js';
import { spawnPlant } from './PlantManager.js';
import { BOSS_SENTINEL_DAMAGE } from './Boss.js';
import { DAMAGE_CAP } from './CombatManager.js';

// 一颗寒冰子弹能把报纸将王停住多久
const ICE_BULLET_FREEZE_MS = 2000;

// 弹道类型表：speed/damage/cssClass 是必填，其他字段按需附加。
// piercing=true 表示命中后不消失（贯穿）。Infinity 用作「秒杀」哨兵伤害 ——
// 打将王时会折算成 BOSS_SENTINEL_DAMAGE，见下面的 boss 结算。
//
// 这里是每种弹的原始伤害（曾经统一改成过 17000，后来又改回来了）。
const PROJECTILE_TYPES = {
    normal:       { speed: 5,  damage: 20,       cssClass: 'projectile' },
    gatling:      { speed: 10, damage: Infinity, cssClass: 'projectile gatling' },
    ice:          { speed: 5,  damage: 20,       cssClass: 'projectile ice' },
    glue:         { speed: 7,  damage: Infinity, cssClass: 'projectile glue',         piercing: true },
    obsidian:     { speed: 8,  damage: Infinity, cssClass: 'projectile obsidian',     piercing: true },
    piercing:     { speed: 6,  damage: Infinity, cssClass: 'projectile piercing',     piercing: true },
    waterdrop:    { speed: 4,  damage: Infinity, cssClass: 'projectile waterdrop',    piercing: true },
    primitivepea: { speed: 6,  damage: 70,       cssClass: 'projectile primitivepea', stunMs: 2000 },
    bowling:      { speed: 12, damage: Infinity, cssClass: 'projectile bowling',      piercing: true, width: 56, height: 56 },
    mgpea:        { speed: 9,  damage: 20,       cssClass: 'projectile mgpea',        width: 14, height: 14 },
    scatterpea:   { speed: 7,  damage: 20,       cssClass: 'projectile scatterpea',   width: 12, height: 12 },

    // 超级电能机枪豌豆的两种电能弹：无限贯穿（命中不消失，一路打到屏幕右边），
    // 对普通僵尸是无限点伤害；打报纸将王时 1800 起步（bossDamage），
    // 和别的子弹一样吃逐发 +15% 的递增，封顶 18000。
    elecpea:      { speed: 9,  damage: Infinity, cssClass: 'projectile elecpea',
                    piercing: true, bossDamage: 1800, width: 14, height: 14 },
    elecscatter:  { speed: 7,  damage: Infinity, cssClass: 'projectile elecscatter',
                    piercing: true, bossDamage: 1800, width: 12, height: 12 },

    // 双重射手大招的巨型豌豆：和一格植物一样大，无限贯穿，
    // 每只僵尸只吃一次 200（hitOnce）
    giantpea:     { speed: 5,  damage: 200, cssClass: 'projectile giantpea',
                    piercing: true, hitOnce: true, width: 80, height: 80 },

    // 红叶素期间，植物打出来的一律换成小红樱桃，每颗 1000 点伤害。
    // 长相直接用樱桃炸弹那颗 🍒 —— 两颗连梗的樱桃，不是一颗光秃秃的红球。
    redcherry:    { speed: 7,  damage: 1000, cssClass: 'projectile redcherry',
                    content: '🍒', width: 20, height: 20 },
};

export class Projectile extends Entity {
    constructor(x, y, type = 'normal') {
        super(x, y, 20, 20);
        const cfg = PROJECTILE_TYPES[type] || PROJECTILE_TYPES.normal;
        this.type = type;
        this.speed = cfg.speed;
        this.damage = cfg.damage;
        this.piercing = !!cfg.piercing;
        if (cfg.bossDamage) this.bossDamage = cfg.bossDamage;
        if (cfg.hitOnce) { this.hitOnce = true; this._hitSet = new Set(); }
        if (cfg.stunMs) this.stunMs = cfg.stunMs;
        if (cfg.width) this.width = cfg.width;
        if (cfg.height) this.height = cfg.height;
        this.createDOM(cfg.cssClass, cfg.content || '');
    }

    // 撞到棋盘四条边就原样弹回来，一直弹下去。
    // 子弹唯一的消失方式是打到僵尸 —— 它不和植物做任何碰撞判定（碰撞只跑
    // game.zombies 和游荡者），所以从植物身上飞过去时什么也不会发生。
    bounce(game) {
        const maxX = game.boardWidth - this.width;
        const maxY = game.height * game.cellHeight - this.height;
        let hit = false;

        // 横向：所有子弹都在横着飞，撞左右两边一律弹回
        if (this.x < 0)         { this.x = 0;    this.speed = Math.abs(this.speed);  hit = true; }
        else if (this.x > maxX) { this.x = maxX; this.speed = -Math.abs(this.speed); hit = true; }

        // 纵向：只有真在上下移动的子弹才谈得上反弹。没有 vy 的（比如加特林
        // 出生点带随机偏移）可能一出生就贴着上下边，那只是夹回来。
        if (this.y < 0 || this.y > maxY) {
            const clamped = this.y < 0 ? 0 : maxY;
            if (this.vy) {
                this.y = clamped;
                this.vy = clamped === 0 ? Math.abs(this.vy) : -Math.abs(this.vy);
                hit = true;
            } else {
                this.y = clamped;
            }
        }

        // 每弹一次都能再打一遍将王：清掉「只打一次」的标记
        if (hit) {
            this._hitBoss = false;
            this._frozeBoss = false;
        }
    }

    update(game) {
        this.x += this.speed;
        // vy 由发射方按需设置（超级机枪的散射豌豆、豌豆炸弹的四散豌豆）
        if (this.vy) this.y += this.vy;

        this.bounce(game);
        this.draw();

        if (this.type === 'bowling' && this.ultimate) {
            const col = Math.floor(this.x / game.cellWidth);
            if (this._lastCol === undefined) this._lastCol = col - 1;
            if (col !== this._lastCol && col >= 0 && col < game.width) {
                this._lastCol = col;
                const row = Math.floor(this.y / 100);
                if (row >= 0 && row < game.height) {
                    const t = Math.random() < 0.5 ? 'potato' : 'cherry';
                    spawnPlant(game, row, col, t);
                }
            }
        }

        // 报纸将王：只有低头时才吃伤害，没低头就是够不着，子弹直接飞过去
        // 每颗子弹只能打将王一次。他有 190px 宽，穿透弹飞过去要几十帧，
        // 不卡这一下的话一颗水滴能连打 40 多次。
        const boss = game.boss;

        // 寒冰子弹只要碰到他就把他冻住 —— 不看他低没低头（没低头也照样停住不放僵尸）
        if (boss && !boss.markedForDeletion && this.type === 'ice' && !this._frozeBoss &&
            this.x + this.width > boss.x && this.x < boss.x + boss.width &&
            this.y + this.height > boss.y && this.y < boss.y + boss.height) {
            this._frozeBoss = true;
            boss.freeze(ICE_BULLET_FREEZE_MS);
        }

        if (boss && !boss.markedForDeletion && boss.vulnerable && !this._hitBoss &&
            this.x + this.width > boss.x && this.x < boss.x + boss.width &&
            this.y + this.height > boss.y && this.y < boss.y + boss.height) {
            this._hitBoss = true;
            // 打将王的基数：电能弹用自带的 bossDamage（1800 起步），必杀弹按一只
            // 僵尸的满血折算，其余就是子弹自己的伤害。基数同样吃这颗子弹的递增
            // 倍率，封顶 DAMAGE_CAP。
            const base = this.bossDamage
                ?? (this.damage === Infinity ? BOSS_SENTINEL_DAMAGE : null);
            const dmg = base === null
                ? this.damage
                : Math.min(base * (this.damageMult || 1), DAMAGE_CAP);
            boss.takeDamage(dmg);
            if (!this.piercing) { this.remove(); return; }
        }


        // Collision with Zombies
        for (const zombie of game.zombies) {
            // Simple bounding box
            if (
                this.x < zombie.x + zombie.width &&
                this.x + this.width > zombie.x &&
                this.y < zombie.y + zombie.height &&
                this.y + this.height > zombie.y
            ) {
                // 贯穿弹里有些是「一只只打一次」的（巨型豌豆），别每帧重复结算
                if (this.hitOnce) {
                    if (this._hitSet.has(zombie)) continue;
                    this._hitSet.add(zombie);
                }
                const absorbed = zombie.takeDamage(this.damage);
                // 元始豌豆：眩晕 + 击退，不论是否被护盾吸收都生效
                if (this.type === 'primitivepea') {
                    zombie.stunTimer = Math.max(zombie.stunTimer || 0, this.stunMs);
                    zombie.x += 80;
                    const maxX = game.boardWidth - zombie.width;
                    if (zombie.x > maxX) zombie.x = maxX;
                    zombie.eating = false;
                    if (zombie.element) zombie.element.classList.remove('eating');
                    zombie.draw();
                }
                // 寒冰减速无论护盾是否吸收都生效
                if (this.type === 'ice') {
                    zombie.baseSpeed = Math.max(0.02, zombie.baseSpeed * 0.7);
                    if (!zombie.eating) zombie.speed = zombie.baseSpeed;
                    if (zombie.verticalSpeed !== undefined)
                        zombie.verticalSpeed = Math.max(0.1, zombie.verticalSpeed * 0.7);
                    if (zombie.element) zombie.element.style.filter = 'brightness(0.8) hue-rotate(180deg)';
                }
                if (!absorbed) {
                    if (this.type === 'glue') {
                        zombie.baseSpeed = 0.01;
                        zombie.speed = 0.01;
                        if (zombie.element) zombie.element.style.filter = 'brightness(0.3) sepia(1) hue-rotate(220deg)';
                    }
                    if (zombie.health <= 0) {
                        zombie.remove();
                        if (game.sound) game.sound.playZombieDie();
                    }
                }
                if (!this.piercing) {
                    this.remove();
                    break;
                }
            }
        }

        if (this.markedForDeletion) return;

        // Collision with WandererSystem
        const ws = game.wandererSystem;
        if (!ws) return;
        const { px, py } = ws;
        for (let i = 0; i < ws.count; i++) {
            if (
                this.x < px[i] + 40 &&
                this.x + this.width > px[i] &&
                this.y < py[i] + 60 &&
                this.y + this.height > py[i]
            ) {
                ws.hp[i] -= this.damage;
                if (this.type === 'ice') {
                    ws.vx[i] = 0;
                    ws.vy[i] = 0;
                }
                if (this.type === 'primitivepea') {
                    ws.stun[i] = Math.max(ws.stun[i] || 0, this.stunMs);
                    px[i] = Math.min(ws.W - 40, px[i] + 80);
                }
                if (ws.hp[i] <= 0) {
                    ws.hp[i] = ws.maxHp;
                    ws.vx[i] = 0.8 + Math.random() * 0.8;
                    px[i] = ws.W;
                }
                if (!this.piercing) {
                    this.remove();
                    break;
                }
            }
        }
    }
}
