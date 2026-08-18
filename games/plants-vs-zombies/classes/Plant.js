import { Entity } from './Entity.js';
import { runPlantBehavior } from './PlantBehaviors.js';
import { PLANT_TIPS } from './Tooltip.js';

export class Plant extends Entity {
    constructor(x, y, type) {
        super(x, y, 80, 100);
        this.type = type;
        this.timer = 0;

        if (type === 'house') {
            // 房子：种在僵尸够不着的蓝色区域，血量给足，纯粹当个据点
            this.health = 9999999;
            this.maxHealth = 9999999;
        } else if (type === 'squash' || type === 'sunemperor') {
            // 倭瓜 / 阳光帝果：血量无限，谁也啃不动
            this.health = Infinity;
            this.maxHealth = Infinity;
        } else if (type === 'wallnut') {
            this.health = 9999999;
            this.maxHealth = 9999999;
        } else if (type === 'glue') {
            this.health = 600;
            this.maxHealth = 600;
        } else if (type === 'obsidian') {
            this.health = 800;
            this.maxHealth = 800;
        } else if (type === 'gatling') {
            this.health = 1000;
            this.maxHealth = 1000;
        } else if (type === 'waterdrop') {
            this.health = 300;
            this.maxHealth = 300;
        } else if (type === 'corncannon') {
            this.health = 1000;
            this.maxHealth = 1000;
            this.cannonReady = true;
            this.cannonTimer = 0;
        } else {
            this.health = 100;
            this.maxHealth = 100;
        }

        this.count = 1;
        this.fusionLevel = 1;

        // Potato mine: starts unarmed, arms after 3 seconds
        this.armed = type !== 'potato';
        this.armTimer = 0;

        // Visuals
        const icons = {
            sunflower: '🌻', wallnut: '🌰',
            // 双重射手：照着 reference/plants/r1c2-leaf-pea.png 画的叶子豌豆
            doubleshooter: '<span class="leaf-pea"><i class="lp-leaf a"></i><i class="lp-leaf b"></i><i class="lp-leaf c"></i><i class="lp-head"></i><i class="lp-barrel"></i><i class="lp-brow l"></i><i class="lp-brow r"></i><i class="lp-eye l"></i><i class="lp-eye r"></i><i class="lp-stem"></i><i class="lp-foot l"></i><i class="lp-foot r"></i></span>',
            // 豌豆射手：照着 reference/plants/r1c1-crown-pea.png 画的戴皇冠豌豆
            peashooter: '<span class="crown-pea"><i class="cw-leaf"></i><i class="cw-head"></i><i class="cw-barrel"></i><i class="cw-eye"></i><i class="cw-crown"></i><i class="cw-stem"></i><i class="cw-foot l"></i><i class="cw-foot r"></i></span>',
            iceshooter: '<span class="ice-pea"><i class="ip-crystal a"></i><i class="ip-crystal b"></i><i class="ip-crystal c"></i><i class="ip-head"></i><i class="ip-barrel"></i><i class="ip-eye l"></i><i class="ip-eye r"></i><i class="ip-stem"></i><i class="ip-foot l"></i><i class="ip-foot r"></i></span>',  cherry: '🍒',
            // 土豆地雷：埋在土堆里的土豆，装好后顶起引信杆和红球，见 .potato-mine
            potato: '<span class="potato-mine"><i class="pm-knob"></i><i class="pm-rod"></i><i class="pm-body"></i><i class="pm-eye l"></i><i class="pm-eye r"></i><i class="pm-mouth"></i><i class="pm-dirt"></i></span>',
 glue: '🧿', obsidian: '🗿', gatling: '🔫', waterdrop: '<span class="ice-pea drop"><i class="ip-head"></i><i class="ip-barrel"></i><i class="ip-eye l"></i><i class="ip-eye r"></i><i class="ip-drop"></i><i class="ip-dribble"></i><i class="ip-stem"></i><i class="ip-foot l"></i><i class="ip-foot r"></i></span>',
            corncannon: '🌽',
            // 三重豌豆：照着 reference/plants/r1c3-triple-pea.png 画的三个头
            triplepea: '<span class="triple-pea"><i class="tp-pea top"><i class="tp-leaf"></i><i class="tp-ball"></i><i class="tp-barrel"></i><i class="tp-eye"></i></i><i class="tp-pea mid"><i class="tp-leaf"></i><i class="tp-ball"></i><i class="tp-barrel"></i><i class="tp-eye"></i></i><i class="tp-pea bot"><i class="tp-leaf"></i><i class="tp-ball"></i><i class="tp-barrel"></i><i class="tp-eye"></i></i><i class="tp-stem"></i><i class="tp-foot l"></i><i class="tp-foot r"></i></span>',
            // 原始豌豆：照着 reference/plants/r1c5-skull-helmet-pea.png 画的兽骨盔豌豆
            primitivepea: '<span class="skull-pea"><i class="sk-head"></i><i class="sk-barrel"></i><i class="sk-eye"></i><i class="sk-skull"></i><i class="sk-frill"></i><i class="sk-horn top"></i><i class="sk-horn side"></i><i class="sk-socket"></i><i class="sk-collar"></i><i class="sk-foot l"></i><i class="sk-foot r"></i></span>',
            nutbowling: '🥥', magnetshroom: '🧲',
            // 卷心菜投手：圆卷心菜架在投石座上，和西瓜 / 玉米投手一套长相
            cabbagepult: '<span class="cabbage-pult"><i class="cp-cabbage"></i><i class="cp-base"></i></span>',
            // 超级机枪：豌豆本体上扣一顶钢盔，见 style.css 的 .helmet-pea
            supermg: '<span class="helmet-pea"><i class="hp-collar"></i><i class="hp-head"></i><i class="hp-barrel"></i><i class="hp-brow l"></i><i class="hp-brow r"></i><i class="hp-eye l"></i><i class="hp-eye r"></i><i class="hp-helmet"></i><i class="hp-badge"></i><i class="hp-strap"></i><i class="hp-stem"></i><i class="hp-foot l"></i><i class="hp-foot r"></i></span>',
            // 超级电能机枪豌豆：同一顶钢盔，豌豆本体染成青色（.elec-pea）
            elecmg: '<span class="helmet-pea elec-pea"><i class="hp-collar"></i><i class="hp-head"></i><i class="hp-barrel"></i><i class="hp-brow l"></i><i class="hp-brow r"></i><i class="hp-eye l"></i><i class="hp-eye r"></i><i class="hp-helmet"></i><i class="hp-badge"></i><i class="hp-strap"></i><i class="hp-stem"></i><i class="hp-foot l"></i><i class="hp-foot r"></i></span>',
            // 火炬树桩：一截树桩顶着一团火焰，都是 CSS 画的，见 .torch-wood
            torchwood: '<span class="torch-wood"><i class="tw-flame"></i><i class="tw-stump"></i></span>',
            // 大喷菇：紫色大烟壶 + 朝右的喷口，底下一张小绿脸
            fumeshroom: '<span class="fume-shroom"><i class="fs-bulb"></i><i class="fs-spout"></i><i class="fs-base"></i><i class="fs-eye l"></i><i class="fs-eye r"></i><i class="fs-mouth"></i></span>',
            // 奖杯投手：一块板子上摆着一个奖杯
            trophypult: '<span class="trophy-pult"><i class="tp-cup">🏆</i><i class="tp-board"></i></span>',
            // 核爆樱桃：红樱桃摞在一朵红色的毁灭菇上
            nukecherry: '<span class="nuke-cherry"><i class="nc-cap"></i><i class="nc-stem"></i><span class="nc-cherry">🍒</span></span>',
            // 倭瓜：一个带网纹的哈密瓜，睁着两只眼睛盯人
            squash: '<span class="squash-fruit"><i class="sq-body"></i><i class="sq-eye l"></i><i class="sq-eye r"></i><i class="sq-stem"></i></span>',
            // 玉米投手：玉米棒架在投石座上，大招时探出炮管
            kernelpult: '<span class="kernel-pult"><i class="kp-barrel"></i><i class="kp-corn"></i><i class="kp-base"></i></span>',
            // 西瓜投手：绿条纹西瓜架在投石座上，大招时探出炮管
            melonpult: '<span class="melon-pult"><i class="mp-barrel"></i><i class="mp-melon"></i><i class="mp-base"></i></span>',
            // 超级投手：卷心菜 / 西瓜 / 玉米三个投手摞成一摞（都是 CSS 画的）
            pitcher: '<span class="super-pult"><i class="sp-cabbage"></i><i class="sp-melon"></i><i class="sp-corn"></i><i class="sp-stump"></i></span>',
            // 房子：红瓦白墙 + 一扇窗一扇门，整栋 CSS 画的
            house: '<span class="house-plant"><i class="hp-roof"></i><i class="hp-wall"><i class="hp-win"></i><i class="hp-door"></i></i></span>',
            // 礼物盒：红白相间的盒子 + 一条竖丝带和一个蝴蝶结
            giftbox: '<span class="gift-box"><i class="gb-lid"></i><i class="gb-body"></i><i class="gb-ribbon"></i><i class="gb-bow"></i></span>',
            // 豌豆炸弹：左边双重射手的脸、右边豌豆的脸，中间一根樱桃梗
            peabomb: '<span class="pea-bomb"><i class="pb-stem"></i><span class="pb-face l">🌿</span><span class="pb-face r">🌱</span></span>',
            // 阳光帝果：黄坚果 + 头顶小坚果，两颗都带向日葵花瓣，见 .sun-emperor
            sunemperor: '<span class="sun-emperor"><span class="se-nut se-small"><i class="se-petal l"></i><i class="se-petal r"></i></span><span class="se-nut se-big"><i class="se-petal l"></i><i class="se-petal r"></i></span></span>',
            // 毁灭菇：灰柄黑伞，整株都是 CSS 画的，见 .doom-shroom
            doomshroom: '<span class="doom-shroom"><span class="ds-cap"></span><span class="ds-stem"></span></span>',
            // 寒冰菇：蓝色的蘑菇，头顶顶着一排冰锥（都是 CSS 画的，见 .ice-shroom）
            iceshroom: '<span class="ice-shroom"><span class="is-cap">🍄</span><span class="is-ice"></span></span>',
        };
        let icon = icons[type] || '';

        this.createDOM(`entity plant ${type}`, `<div class="plant-inner">${icon}</div>`);
        if (this.element && PLANT_TIPS[type]) this.element.dataset.tip = PLANT_TIPS[type];
    }

    levelUpFusion() {
        this.fusionLevel++;
        if (this.element) {
            let badge = this.element.querySelector('.fusion-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'fusion-badge';
                this.element.appendChild(badge);
            }
            badge.textContent = `⭐${this.fusionLevel}`;
            this.element.style.filter = `brightness(${1 + (this.fusionLevel - 1) * 0.3}) drop-shadow(0 0 ${this.fusionLevel * 4}px gold)`;
        }
    }

    update(game) {
        const stackMult = this._stackMult || 1;
        const ultimateMult = (this.ultimateMs && this.ultimateMs > 0) ? 20 : 1;
        this.timer += game.deltaTime * this.fusionLevel * stackMult * (game.plantSpeedMultiplier || 1) * ultimateMult;
        if (this.ultimateMs && this.ultimateMs > 0) {
            this.ultimateMs -= (game.deltaTime || 16);
            if (this.ultimateMs <= 0) {
                this.ultimateMs = 0;
                if (this.element) this.element.classList.remove('ultimate');
            }
        }

        // 红叶素：这 5 秒里打出来的都是小红樱桃，到点恢复原来的样子
        if (this.redMs && this.redMs > 0) {
            this.redMs -= (game.deltaTime || 16);
            if (this.redMs <= 0) {
                this.redMs = 0;
                if (this.element) this.element.classList.remove('redfood');
            }
        }

        runPlantBehavior(this, game);
    }

    takeDamage(amount, force = false) {
        if (this.type === 'wallnut' && !force) return;
        this.health -= amount;
        // 受击闪烁：已经在播就不重启。重启动画要靠 void offsetWidth 强制同步布局，
        // 而僵尸是「每帧啃一口」的 —— 上百只同时开啃时，每帧会触发上百次全页布局，
        // 帧时间直接飙到几百毫秒，整局看起来就是卡死。
        // 顺带一提，每 16ms 重启一次动画，plantHit 永远播不过 20%，本来也看不全。
        if (this.element && !this._hitFlashing) {
            this._hitFlashing = true;
            this.element.classList.add('hit');
            setTimeout(() => {
                this._hitFlashing = false;
                this.element?.classList.remove('hit');
            }, 350);
        }
        if (this.health <= 0) {
            this.count--;
            if (this.count <= 0) {
                this.remove();
            } else {
                this.health = this.maxHealth;
                this.element.style.opacity = 1;
                this._updateBadge();
            }
        } else {
            this.element.style.opacity = 0.3 + (this.health / this.maxHealth) * 0.7;
        }
    }

    _updateBadge() {
        if (!this.element) return;
        let badge = this.element.querySelector('.plant-count-badge');
        if (this.count > 1) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'plant-count-badge';
                this.element.appendChild(badge);
            }
            badge.textContent = `×${this.count}`;
        } else if (badge) {
            badge.remove();
        }
    }
}
