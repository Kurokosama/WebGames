import { Entity } from './Entity.js';
import { ZOMBIE_TIPS } from './Tooltip.js';

// Pixel-art zombie body (15w × 22h grid). One inline SVG, no external assets.
// Replaces the 🧟 emoji used previously for the basic zombie silhouette.
// Accessory emoji (cone, bucket, newspaper, polevault, door) are kept as a
// separate prefix span — see ACCESSORY map below.
const Z = {
    H:'#262638', S:'#a8c39c', s:'#7c9b78', W:'#ffffff', B:'#0e0e0e',
    M:'#3a0d11', T:'#d4a83a', J:'#8b5a2b', j:'#5e3a16', R:'#cc2a22',
    w:'#f1f1f1', P:'#1f3d80', O:'#3a1f0e',
};
// Pre-flip layout (drawn facing right). The .zombie element applies
// transform: scaleX(-1) so the rendered zombie ends up facing LEFT toward
// the plants. Asymmetries below (near/far eye, mouth offset, tie position)
// give it a 3/4 turn instead of a flat front view.
const Z_RECTS = [
    // hair tufts on top
    [4,0,1,1,'H'], [7,0,2,1,'H'], [11,0,1,1,'H'],
    [3,1,3,1,'H'], [7,1,3,1,'H'], [11,1,2,1,'H'],
    // hair main
    [2,2,12,2,'H'],
    [1,3,1,3,'H'], [13,3,1,3,'H'],
    [0,4,1,2,'H'], [14,4,1,2,'H'],
    // face skin
    [3,4,9,8,'S'],
    [2,5,1,6,'S'], [12,5,1,6,'S'],
    // brow shadow under hair line
    [3,4,9,1,'s'],
    // near eye (right side pre-flip → left after flip, closer to viewer)
    [8,5,4,4,'W'],
    [10,7,1,1,'B'],
    // far eye (left side pre-flip → right after flip, smaller)
    [5,6,2,2,'W'],
    [5,7,1,1,'B'],
    // nose bridge shadow between the eyes
    [7,7,1,2,'s'],
    // mouth open, offset to right pre-flip
    [6,10,6,2,'M'],
    // teeth
    [6,11,1,1,'T'], [8,11,1,1,'T'], [10,11,1,1,'T'],
    // neck/jaw
    [5,12,5,1,'S'],
    // jacket body
    [2,13,11,5,'J'],
    [1,14,1,4,'J'], [13,14,1,4,'J'],
    // jacket lapels (shadow) — far lapel narrower for 3/4 effect
    [4,13,1,2,'j'], [10,13,1,2,'j'],
    // tie shifted slightly right pre-flip (sits on left after flip)
    [7,13,3,5,'R'],
    [7,14,3,1,'w'], [7,16,3,1,'w'],
    // hands hanging out the sleeves
    [0,16,1,2,'S'], [14,16,1,2,'S'],
    // pants (split between legs)
    [3,18,4,2,'P'], [8,18,4,2,'P'],
    // one bare leg, one shoe
    [8,20,3,2,'S'],
    [2,20,5,2,'O'],
    [7,21,5,1,'S'],
];
function zombieBodyHTML() {
    let s = '<svg class="zombie-body" viewBox="0 0 15 22" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">';
    for (const [x,y,w,h,c] of Z_RECTS) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${Z[c]}"/>`;
    return s + '</svg>';
}
function bodyWith(prefix) {
    if (!prefix) return zombieBodyHTML();
    return `<span class="zombie-acc">${prefix}</span>${zombieBodyHTML()}`;
}

// Accessory emoji per type. The body is the same pixel-art zombie for all.
const ACCESSORY = {
    normal:    '',
    cone:      '🔶',
    bucket:    '🪣',
    newspaper: '📰',
    polevault: '🎿',
    door:      '🚪',
};

// 每只僵尸 800 血，血量直接显示在头顶（见 _updateHpLabel）
export const ZOMBIE_HP = 800;

const ZOMBIE_CONFIG = {
    normal:    { health: ZOMBIE_HP, speed: 0.2  },
    cone:      { health: ZOMBIE_HP, speed: 0.2  },
    bucket:    { health: ZOMBIE_HP, speed: 0.15 },
    newspaper: { health: ZOMBIE_HP, speed: 0.2  },
    polevault: { health: ZOMBIE_HP, speed: 0.35 },
    door:      { health: ZOMBIE_HP, speed: 0.12 },
};

export class Zombie extends Entity {
    constructor(gameWidth, y, type = 'normal', speedMultiplier = 1, wanderer = false) {
        super(gameWidth, y, 80, 100);
        const cfg = ZOMBIE_CONFIG[type] || ZOMBIE_CONFIG.normal;
        this.type = type;
        this.gameWidth = gameWidth;
        this.wanderer = wanderer;
        this.baseSpeed = wanderer ? 1.2 : cfg.speed * speedMultiplier;
        this.speed = this.baseSpeed;
        this.health = wanderer ? 99999 : cfg.health;
        this.maxHealth = this.health;
        this.damage = wanderer ? 200 : 0.5;
        this.eating = false;
        this.stunTimer = 0;

        // 报纸僵尸：报纸护盾，破损后加速
        if (type === 'newspaper') {
            this.newspaperHealth = 1;
        }

        // 撑杆跳僵尸：首次遇到植物时跳过
        if (type === 'polevault') {
            this.vaulted = false;
        }

        // 铁门僵尸：铁门护盾，破损后变普通
        if (type === 'door') {
            this.doorHealth = 2;
        }

        if (wanderer) {
            this.verticalSpeed = 1.5 + Math.random() * 2;
            this.verticalDir = Math.random() < 0.5 ? 1 : -1;
            this.dirChangeTimer = 0;
            this.dirChangeInterval = 60 + Math.random() * 120;
            this.color = Zombie.randomColor();
        }

        const inner = wanderer ? '👾' : bodyWith(ACCESSORY[type] || '');
        this.createDOM(
            `entity zombie zombie-${type}${wanderer ? ' wanderer' : ''}`,
            `<div class="zombie-hp"><i></i><b></b></div><div class="zombie-inner">${inner}</div>`
        );
        this._hpFill = this.element.querySelector('.zombie-hp i');
        this._hpText = this.element.querySelector('.zombie-hp b');
        this._updateHpLabel();
        const tipKey = wanderer ? 'wanderer' : type;
        if (this.element && ZOMBIE_TIPS[tipKey]) this.element.dataset.tip = ZOMBIE_TIPS[tipKey];
        if (wanderer && this.element) {
            this.element.style.setProperty('--wcolor', this.color);
            this.element.style.filter = `drop-shadow(0 0 12px ${this.color}) drop-shadow(0 0 24px ${this.color})`;
        }
    }

    // 统一伤害入口，支持盾牌机制
    takeDamage(amount) {
        if (this.type === 'newspaper' && this.newspaperHealth > 0) {
            this.newspaperHealth -= 1;
            if (this.newspaperHealth <= 0) {
                this.baseSpeed *= 2.5;
                this.speed = this.eating ? 0 : this.baseSpeed;
                this._setBody(bodyWith('😡'));
            }
            return true;
        }

        if (this.type === 'door' && this.doorHealth > 0) {
            this.doorHealth -= 1;
            if (this.doorHealth <= 0) {
                this._setBody(bodyWith(''));
            }
            return true;
        }

        this.health -= amount;
        this._updateHpLabel();
        return false;
    }

    // 血量显示。只在掉血时刷新，不放进每帧的 update —— 几百只僵尸时
    // 每帧写几百次 DOM 是白给的开销。
    _updateHpLabel() {
        if (!this._hpText) return;
        const hp = Math.max(0, Math.round(this.health));
        this._hpText.textContent = this.wanderer ? '∞' : hp;
        this._hpFill.style.width = `${Math.max(0, Math.min(1, this.health / this.maxHealth)) * 100}%`;
    }

    _setBody(html) {
        if (this.element) {
            const inner = this.element.querySelector('.zombie-inner');
            if (inner) inner.innerHTML = html;
        }
    }

    update(game) {
        if (this.wanderer) {
            this._updateWanderer(game);
            return;
        }

        if (this.stunTimer > 0) {
            this.stunTimer -= game.deltaTime || 16;
            this.speed = 0;
            this.eating = false;
            if (this.element) {
                this.element.classList.add('stunned');
                this.element.classList.remove('eating');
            }
            this.draw();
            if (this.stunTimer <= 0) {
                this.stunTimer = 0;
                this.speed = this.baseSpeed;
                if (this.element) this.element.classList.remove('stunned');
            }
            return;
        }

        if (this.x < 0) {
            game.triggerLawnmower(Math.floor(this.y / 100));
            this.remove();
            return;
        }

        const col = Math.floor((this.x + 40) / 80);
        const row = Math.floor(this.y / 100);
        const stack = game.grid[row] && game.grid[row][col];
        const plant = stack && stack.length > 0 ? stack[stack.length - 1] : null;

        // 撑杆跳：首次遇到植物时跃过
        if (this.type === 'polevault' && !this.vaulted && plant && !plant.markedForDeletion) {
            this.vaulted = true;
            this.x -= 160; // 跳过这格，落到前一格
            this.baseSpeed = 0.25;
            this.speed = this.baseSpeed;
            this._setBody(bodyWith(''));
            this.eating = false;
            this.draw();
            return;
        }

        if (plant && !plant.markedForDeletion) {
            this.eating = true;
            this.speed = 0;
            plant.takeDamage(this.damage);
            if (this.element) this.element.classList.add('eating');
        } else {
            this.eating = false;
            this.speed = this.baseSpeed;
            if (this.element) this.element.classList.remove('eating');
        }

        this.x -= this.speed * (game.zombieSpeedBoost || 1);
        this.draw();

        if (this.element) {
            const ratio = this.health / this.maxHealth;
            if (ratio < 0.3) this.element.style.filter = 'hue-rotate(90deg)';
        }
    }

    _updateWanderer(game) {
        if (this.health <= 0) {
            this.remove();
            game.spawnWanderer();
            return;
        }

        if (this.stunTimer > 0) {
            this.stunTimer -= game.deltaTime || 16;
            this.eating = false;
            if (this.element) this.element.classList.add('stunned');
            this.draw();
            if (this.stunTimer <= 0) {
                this.stunTimer = 0;
                if (this.element) this.element.classList.remove('stunned');
            }
            return;
        }

        // 随机换向计时
        this.dirChangeTimer++;
        if (this.dirChangeTimer >= this.dirChangeInterval) {
            this.dirChangeTimer = 0;
            this.dirChangeInterval = 60 + Math.random() * 120;
            this.verticalDir = Math.random() < 0.5 ? 1 : -1;
            this.verticalSpeed = 1.5 + Math.random() * 2;
        }

        // 纵向弹跳
        this.y += this.verticalSpeed * this.verticalDir;
        const maxY = (game.height - 1) * game.cellHeight;
        if (this.y >= maxY) { this.y = maxY; this.verticalDir = -1; }
        if (this.y <= 0)    { this.y = 0;    this.verticalDir = 1; }

        const col = Math.floor((this.x + 40) / 80);
        const row = Math.floor((this.y + 50) / game.cellHeight);
        const stack = game.grid[row] && game.grid[row][col];
        const plant = stack && stack.length > 0 ? stack[stack.length - 1] : null;

        if (plant && !plant.markedForDeletion) {
            this.eating = true;
            plant.takeDamage(this.damage, true);
        } else {
            this.eating = false;
        }

        this.draw();

        if (this.element) {
            const ratio = this.health / this.maxHealth;
            this.element.style.opacity = 0.4 + ratio * 0.6;
        }
    }

    static randomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 90%, 60%)`;
    }
}
