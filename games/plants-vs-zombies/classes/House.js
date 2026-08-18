// 房子 🏠 —— 哪块地都能种：绿草坪能种，蓝草坪也能种。
//
// 反过来不成立：棋盘最左边那 3 列是蓝草坪，那儿只种得下房子，别的植物一律
// 种不进去（规则在 PlantManager.canPlantAt）。
//
// 绿叶素大招：在草坪上随机挑一格，凭空变出一个红白相间的礼物盒子。
// 空手点礼物盒 → 打开，变成除房子以外的任意一种植物。

import { PLANT_EMOJI } from './Constants.js';
import { spawnPlant, removePlant } from './PlantManager.js';

// 礼物盒能变成的植物：除了房子和礼物盒自己，其余全在池子里
// （绿叶素 / 红叶素 / 铲子是道具，不是植物）
const NOT_PLANTS = new Set(['house', 'giftbox', 'plantfood', 'redfood', 'shovel']);

export function giftPool() {
    return Object.keys(PLANT_EMOJI).filter(t => !NOT_PLANTS.has(t));
}

// ---------- 房子 ----------

export function houseTick(plant, game) {
    // 绿叶素：随机一格变出礼物盒。一次绿叶素只送一个
    if (plant.ultimateMs > 0) {
        if (!plant._houseUlt) {
            plant._houseUlt = true;
            dropGift(game);
        }
        return;
    }
    plant._houseUlt = false;
}

// 在草坪上随机挑一格放礼物盒。优先挑空格，实在没有就随便挑一格盖上去。
function dropGift(game) {
    const empty = [];
    const all = [];
    for (let r = 0; r < game.height; r++) {
        for (let c = 0; c < game.width; c++) {
            all.push({ r, c });
            if (game.grid[r][c].length === 0) empty.push({ r, c });
        }
    }
    const pick = (empty.length ? empty : all)[
        Math.floor(Math.random() * (empty.length ? empty.length : all.length))
    ];

    spawnPlant(game, pick.r, pick.c, 'giftbox');
    game.sound.playPlant();
    game.showNotEnoughFeedback('🎁 房子送了个礼物盒! 点开看看');

    // 落点闪一下，不然一格礼物盒在满屏植物里根本找不着
    const cell = game.board.querySelector(`.grid-cell[data-row="${pick.r}"][data-col="${pick.c}"]`);
    if (cell) {
        cell.classList.add('gift-drop');
        setTimeout(() => cell.classList.remove('gift-drop'), 900);
    }
}

// ---------- 礼物盒 ----------

// 空手点礼物盒：打开，变成随机一种植物。不是礼物盒就返回 false 让点击继续往下走。
export function giftClick(game, row, col) {
    const stack = game.grid[row] && game.grid[row][col];
    if (!stack || stack.length === 0) return false;
    const top = stack[stack.length - 1];
    if (top.type !== 'giftbox' || top.markedForDeletion) return false;

    const pool = giftPool();
    const type = pool[Math.floor(Math.random() * pool.length)];

    // 整格清掉再种 —— 礼物盒本来就是盖在这一格上的
    removePlant(game, row, col);
    spawnPlant(game, row, col, type);

    game.sound.playPlant();
    game.showNotEnoughFeedback(`🎁 拆开了! 是 ${PLANT_EMOJI[type] || ''} ${type}`);
    return true;
}
