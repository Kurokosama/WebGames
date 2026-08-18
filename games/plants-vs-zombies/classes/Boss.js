// 报纸将王 🤖 —— 普通模式唯一的敌人来源。
//
// 循环两个阶段：
//   放僵尸（10 秒，无敌）—— 每 0.5 秒从报纸里抖出一只，一波 20 只，全是报纸僵尸
//   低头（8 秒，可攻击）—— 放完一波就低头，把脑袋送到植物打得到的高度
// 也就是说：没低头的时候、以及低头结束后的 10 秒里，植物都够不着他，
// 他会一直往外放僵尸。想打他只有低头那一段窗口。
//
// 他体型非常高大，站在棋盘最右侧，纵向几乎占满整片草坪，手里举着一张大报纸。

import { Zombie } from './Zombie.js';
import { spitBall, updateBossBalls } from './BossBall.js';

export const BOSS_HP = 64000000;   // 6400 万（第 1 关；每过一关 ×关卡数）
export const ZOMBIES_PER_WAVE = 20;

// 水滴 / 黑曜石 / 超级投手这类子弹的伤害是 Infinity（对僵尸是「秒杀哨兵」）。
// 直接照搬会让血条形同虚设 —— 一颗就打光。打将王时按一只僵尸的满血折算，
// 再乘上这颗子弹的递增倍率（见 CombatManager 的 DAMAGE_GROWTH）。
export const BOSS_SENTINEL_DAMAGE = 800;

const SPAWN_PHASE_MS = 10000;                                  // 放僵尸阶段总时长
const SPAWN_INTERVAL = SPAWN_PHASE_MS / ZOMBIES_PER_WAVE;      // 每 500ms 一只
const BOW_MS = 8000;           // 低头（可攻击）时长
// 低头期间每隔多久吐一个球。原来是「整个低头只吐一颗」，太温吞了 ——
// 现在按这个间隔连着吐，一次低头能喷出 BOW_MS / SPIT_MS ≈ 20 颗。
const SPIT_MS = 400;
const FIRST_SPIT_MS = 300;     // 一低头就开吐，不用先等半天

// 机甲非常大：碰撞盒 480×640，实际画面还要再乘 .boss-scale 的放大倍数，
// 上下略微探出棋盘（被画布裁掉一点），显得他把整个右半边塞满
const BOSS_W = 480;
const BOSS_H = 640;

// 他手里就一摞报纸，放出来的自然全是报纸僵尸 —— 不再按从弱到强轮换别的类型。
const SPAWN_TYPE = 'newspaper';

// 一波 n 只，全是报纸僵尸
export function waveLineup(n) {
    return Array(n).fill(SPAWN_TYPE);
}

export class Boss {
    constructor(game) {
        this.game = game;
        // 血量随关卡线性上涨：第 1 关 6400 万、第 2 关 1.28 亿、第 3 关 1.92 亿…
        this.maxHealth = BOSS_HP * (game.level || 1);
        this.health = this.maxHealth;
        this.width = BOSS_W;
        this.height = BOSS_H;
        this.markedForDeletion = false;

        const boardH = game.height * game.cellHeight;
        this.x = game.boardWidth - BOSS_W + 70;   // 略微探出右边界，显得他挤满整个屏幕
        // 机甲很高：往上挪一截，保证底下的报纸和脚完整落在画布里
        this.y = (boardH - BOSS_H) / 2 - 60;

        this.phase = 'spawn';          // 'spawn' | 'bow'
        this.phaseTimer = 0;
        this.spawnTimer = 0;
        this.spawnedInWave = 0;
        this.wave = 1;
        this.frozenMs = 0;             // 被寒冰冻住还剩多久
        this.eyes = 'green';           // 没低头是绿眼；低头随机红 / 蓝
        this.spitTimer = 0;
        this.spatThisBow = false;   // 这一次低头吐出第一颗了没有（第一颗来得更快）
        this.lineup = waveLineup(this.waveSize());

        this._buildDOM();
        this._render();
    }

    // 僵尸数量设置仍然生效：一波 20 只 × 倍率
    waveSize() {
        const m = this.game.zombieCountMultiplier || 1;
        return Math.max(1, Math.round(ZOMBIES_PER_WAVE * m));
    }

    // 低头的时候能打到他；被冻住的时候他整个人停在原地，也照样能打
    get vulnerable() {
        return this.phase === 'bow' || this.frozenMs > 0;
    }

    // 寒冰菇的爆炸、寒冰射手的子弹都会把他冻住：冻住期间相位和放僵尸计时全停
    // （既不放僵尸也不换阶段），而且他停在那儿不动，打得到。
    freeze(ms) {
        if (this.markedForDeletion) return;
        this.frozenMs = Math.max(this.frozenMs, ms);
        this.element?.classList.add('boss-frozen');
    }

    _buildDOM() {
        const el = document.createElement('div');
        el.className = 'boss';
        el.style.left = `${this.x}px`;
        el.style.top = `${this.y}px`;
        el.style.width = `${BOSS_W}px`;
        el.style.height = `${BOSS_H}px`;
        el.dataset.tip = '报纸将王 — 只有低头时才打得到';
        el.innerHTML = `
            <div class="boss-hp">
                <div class="boss-hp-fill"></div>
                <span class="boss-hp-text"></span>
            </div>
            <div class="boss-rig">
              <div class="boss-scale">
                <div class="boss-head">
                    <i class="bh-skull"></i>
                    <i class="bh-rivets"></i>
                    <i class="bh-eye l"></i>
                    <i class="bh-eye r"></i>
                    <i class="bh-mouth"></i>
                    <i class="bh-antenna"></i>
                    <span class="bh-pilot">🧟</span>
                    <span class="bh-flag">🏳️</span>
                </div>
                <i class="boss-neck"></i>
                <div class="boss-body">
                    <i class="bb-shoulder l"></i>
                    <i class="bb-shoulder r"></i>
                    <i class="bb-torso"></i>
                    <i class="bb-core"></i>
                    <i class="bb-arm l"></i>
                    <i class="bb-arm r"></i>
                    <i class="bb-hip"></i>
                    <i class="bb-leg l"><i class="bb-boot"></i></i>
                    <i class="bb-leg r"><i class="bb-boot"></i></i>
                    <div class="boss-paper">📰</div>
                </div>
              </div>
            </div>
            <div class="boss-state"></div>`;
        this.game.board.appendChild(el);

        this.element = el;
        this.hpFill = el.querySelector('.boss-hp-fill');
        this.hpText = el.querySelector('.boss-hp-text');
        this.stateLabel = el.querySelector('.boss-state');
    }

    _render() {
        const ratio = Math.max(0, this.health / this.maxHealth);
        this.hpFill.style.width = `${ratio * 100}%`;
        this.hpText.textContent = `${Math.max(0, Math.round(this.health))} / ${this.maxHealth}`;
        this.element.classList.toggle('bowing', this.vulnerable);
        this.element.classList.toggle('eyes-green', this.eyes === 'green');
        this.element.classList.toggle('eyes-red', this.eyes === 'red');
        this.element.classList.toggle('eyes-blue', this.eyes === 'blue');
        this.stateLabel.textContent = this.frozenMs > 0
            ? '❄️ 冻住了 — 快打他!'
            : (this.vulnerable ? '低头中 — 快打他!' : '无敌 · 放僵尸中');
    }

    update(game) {
        if (this.markedForDeletion) return;
        const dt = game.deltaTime || 16;

        // 冻住：什么都不推进，站在原地挨打
        if (this.frozenMs > 0) {
            this.frozenMs -= dt;
            if (this.frozenMs <= 0) {
                this.frozenMs = 0;
                this.element?.classList.remove('boss-frozen');
            }
            this._render();
            return;
        }

        // J / H 只调低头的节奏：低头来得更快 / 更慢。
        // 放僵尸的间隔和吐出去的球都不跟着变。
        const rate = game.bossSpawnRate || 1;
        this.phaseTimer += dt * rate;

        if (this.phase === 'spawn') {
            this.spawnTimer += dt;
            while (this.spawnTimer >= SPAWN_INTERVAL && this.spawnedInWave < this.lineup.length) {
                this.spawnTimer -= SPAWN_INTERVAL;
                this._releaseZombie(game);
            }
            if (this.spawnedInWave >= this.lineup.length) this._startBow();
        } else {
            // 低头：张嘴吐球。红眼吐熔岩球，蓝眼吐寒冰球。
            // 连发 —— 低头这段时间里一直按 SPIT_MS 的间隔往外喷
            this.spitTimer += dt;
            let gap = this.spatThisBow ? SPIT_MS : FIRST_SPIT_MS;
            while (this.spitTimer >= gap) {
                this.spitTimer -= gap;
                this.spatThisBow = true;
                gap = SPIT_MS;      // 第一颗之后就都按正常间隔
                spitBall(game, this, this.eyes === 'blue' ? 'ice' : 'lava');
            }
            if (this.phaseTimer >= BOW_MS) this._startSpawn();
        }

        // 吐出去的球一直在滚（不管他现在低不低头）
        updateBossBalls(game, dt);

        this._render();
    }

    _releaseZombie(game) {
        const type = this.lineup[this.spawnedInWave++];
        const row = Math.floor(Math.random() * game.height);
        const y = row * game.cellHeight;
        game.zombies.push(new Zombie(game.boardWidth, y, type, game.zombieSpeedMultiplier));

        // 舱门开合的抖动，示意「又吐出来一只」
        this.element.classList.remove('boss-release');
        this.element.classList.add('boss-release');
        setTimeout(() => this.element?.classList.remove('boss-release'), 260);
    }

    _startBow() {
        // 低头：眼睛随机变红或变蓝 —— 红的吐熔岩球，蓝的吐寒冰球
        this.eyes = Math.random() < 0.5 ? 'red' : 'blue';
        this.spitTimer = 0;
        this.spatThisBow = false;   // 这一次低头还没吐过
        this.phase = 'bow';
        this.phaseTimer = 0;
        this.game.sound?.playExplosion();
    }

    _startSpawn() {
        this.eyes = 'green';   // 抬起头，眼睛变回绿色
        this.spatThisBow = false;
        this.phase = 'spawn';
        this.phaseTimer = 0;
        this.spawnTimer = 0;
        this.spawnedInWave = 0;
        this.wave++;
        this.lineup = waveLineup(this.waveSize());
    }

    // 只有低头时才吃伤害。没低头就是够不着，伤害直接吞掉。
    takeDamage(amount) {
        if (!this.vulnerable || this.markedForDeletion) return false;
        this.health -= amount;
        this.element.classList.remove('boss-hit');
        this.element.classList.add('boss-hit');
        setTimeout(() => this.element?.classList.remove('boss-hit'), 200);
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        this._render();
        return true;
    }

    die() {
        this.markedForDeletion = true;
        // 散架：头和两只脚各自掉下去，驾驶舱那只僵尸举白旗
        this.element?.classList.add('boss-dead');
        setTimeout(() => this.element?.remove(), 2400);
    }

    remove() {
        this.markedForDeletion = true;
        this.element?.remove();
    }
}
