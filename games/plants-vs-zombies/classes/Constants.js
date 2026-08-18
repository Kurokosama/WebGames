export const PLANT_EMOJI = {
    peashooter: '🌱',
    sunflower: '🌻',
    wallnut: '🌰',
    iceshooter: '❄️',
    doubleshooter: '🌿',
    cherry: '🍒',
    potato: '🥔',
    pitcher: '🎯',
    glue: '🧿',
    obsidian: '🗿',
    gatling: '🔫',
    waterdrop: '💧',
    corncannon: '🌽',
    primitivepea: '🌟',
    triplepea: '🌳',
    nutbowling: '🥥',
    cabbagepult: '🥬',
    magnetshroom: '🧲',
    supermg: '🪖',
    elecmg: '⚡',
    iceshroom: '🍄',
    doomshroom: '☠️',
    sunemperor: '👑',
    peabomb: '💣',
    house: '🏠',
    melonpult: '🍉',
    kernelpult: '🌽',
    squash: '🍈',
    nukecherry: '☢️',
    trophypult: '🏆',
    fumeshroom: '💨',
    giftbox: '🎁',
    torchwood: '🔥',
    plantfood: '💚',
    redfood: '❤️',
    glove: '🧤',
    shovel: '🪏',
};

export const PLANT_COSTS = {
    peashooter: 0,
    sunflower: 0,
    wallnut: 0,
    iceshooter: 0,
    doubleshooter: 0,
    cherry: 0,
    potato: 0,
    pitcher: 0,
    glue: 0,
    obsidian: 0,
    gatling: 0,
    waterdrop: 0,
    corncannon: 0,
    primitivepea: 0,
    triplepea: 0,
    nutbowling: 0,
    cabbagepult: 0,
    magnetshroom: 0,
    supermg: 0,
    elecmg: 0,
    iceshroom: 0,
    doomshroom: 0,
    sunemperor: 0,
    peabomb: 0,
    house: 0,
    giftbox: 0,
    melonpult: 0,
    kernelpult: 0,
    squash: 0,
    nukecherry: 0,
    trophypult: 0,
    fumeshroom: 0,
    torchwood: 0,
    plantfood: 0,
    redfood: 0,
    glove: 0,
};

export const PLANT_COOLDOWNS = {
    peashooter: 0,
    sunflower: 0,
    wallnut: 0,
    iceshooter: 0,
    doubleshooter: 0,
    cherry: 0,
    potato: 0,
    pitcher: 0,
    glue: 0,
    obsidian: 0,
    gatling: 0,
    waterdrop: 0,
    corncannon: 0,
    primitivepea: 0,
    triplepea: 0,
    nutbowling: 0,
    cabbagepult: 0,
    magnetshroom: 0,
    supermg: 0,
    elecmg: 0,
    iceshroom: 0,
    doomshroom: 0,
    sunemperor: 0,
    peabomb: 0,
    house: 0,
    giftbox: 0,
    melonpult: 0,
    torchwood: 0,
    squash: 0,
    kernelpult: 0,
    nukecherry: 0,
    trophypult: 0,
    fumeshroom: 0,
    plantfood: 0,
    redfood: 0,
    glove: 0,
};

export function setEmojiCursor(emoji) {
    if (!emoji) {
        document.body.style.cursor = '';
        return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    // 手套单独画：系统的 🧤 是棕的，和种子卡上那只绿手套对不上，
    // 干脆按卡面的样子自己画一只绿的（绿掌 + 黄袖口）。
    if (emoji === PLANT_EMOJI.glove) {
        drawGlove(ctx);
    } else {
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 20, 22);
    }
    document.body.style.cursor = `url(${canvas.toDataURL()}) 20 20, auto`;
}

// 一只绿色连指手套：掌 + 大拇指 + 黄袖口，和 .glove-tool 那张卡一个配色
function drawGlove(ctx) {
    const round = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1b5e20';

    // 手掌
    const palm = ctx.createLinearGradient(10, 4, 30, 28);
    palm.addColorStop(0, '#a5d6a7');
    palm.addColorStop(0.55, '#43a047');
    palm.addColorStop(1, '#2e7d32');
    ctx.fillStyle = palm;
    round(11, 4, 20, 22, 8);
    ctx.fill();
    ctx.stroke();

    // 大拇指
    ctx.fillStyle = '#4caf50';
    round(4, 13, 10, 11, 5);
    ctx.fill();
    ctx.stroke();

    // 指缝
    ctx.strokeStyle = 'rgba(27, 94, 32, 0.7)';
    ctx.lineWidth = 1.5;
    for (const x of [17, 22, 27]) {
        ctx.beginPath();
        ctx.moveTo(x, 7);
        ctx.lineTo(x, 16);
        ctx.stroke();
    }

    // 黄袖口
    ctx.fillStyle = '#f9a825';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    round(9, 26, 24, 9, 3);
    ctx.fill();
    ctx.stroke();
}
