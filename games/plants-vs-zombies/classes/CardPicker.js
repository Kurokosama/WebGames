// 每一关开打之前的选卡界面。
//
// 场上有多少张种子卡，这里就列多少张，点一下选中 / 取消。想全选就全选，
// 一张都不选也能开打（那一关就只能靠割草机和铲子了）。
// 选完的结果记在 game.chosenCards 上，下一关默认沿用上一关的选择。

import { PLANT_TIPS } from './Tooltip.js';

// 卡面上的名字：从 tooltip 里取破折号前面那截
function cardName(key) {
    const tip = PLANT_TIPS[key];
    if (!tip) return key;
    return tip.split(' — ')[0].trim();
}

function allCards() {
    return [...document.querySelectorAll('#seed-bank .seed-packet[data-plant]')];
}

// 把选择结果落到种子栏上：没选的卡直接不显示
export function applyChosenCards(game) {
    const chosen = game.chosenCards;
    for (const packet of allCards()) {
        const on = !chosen || chosen.has(packet.dataset.plant);
        packet.style.display = on ? '' : 'none';
        if (!on) packet.classList.remove('selected');
    }
    // 手上拿着的卡要是被撤下了，顺手清掉
    if (chosen && game.selectedPlant && !chosen.has(game.selectedPlant)) {
        game.selectedPlant = null;
    }
}

export function showCardPicker(game, onStart) {
    document.getElementById('card-picker')?.remove();

    const packets = allCards();
    // 默认沿用上一关的选择；第一次进来是全选
    const chosen = new Set(
        game.chosenCards && game.chosenCards.size ? [...game.chosenCards] : packets.map(p => p.dataset.plant)
    );

    const overlay = document.createElement('div');
    overlay.id = 'card-picker';
    overlay.className = 'overlay';
    overlay.innerHTML = `
        <h2>第 ${game.level} 关 — 选择你的卡片</h2>
        <p class="cp-hint">点一下选中 / 取消 · 可以全选，也可以一张都不选</p>
        <div class="cp-grid"></div>
        <div class="cp-actions">
            <button class="cp-btn" data-act="all">全选</button>
            <button class="cp-btn" data-act="none">全不选</button>
            <button class="cp-btn cp-go" data-act="go">开始</button>
        </div>`;
    document.getElementById('game-container').appendChild(overlay);

    const grid = overlay.querySelector('.cp-grid');
    const go = overlay.querySelector('.cp-go');

    for (const packet of packets) {
        const key = packet.dataset.plant;
        const card = document.createElement('div');
        card.className = 'cp-card';
        card.dataset.plant = key;
        card.innerHTML = `<div class="cp-icon">${packet.querySelector('.seed-icon').innerHTML}</div>
                          <div class="cp-name">${cardName(key)}</div>`;
        card.dataset.tip = PLANT_TIPS[key] || '';
        card.addEventListener('click', () => {
            if (chosen.has(key)) chosen.delete(key); else chosen.add(key);
            paint();
        });
        grid.appendChild(card);
    }

    function paint() {
        for (const card of grid.querySelectorAll('.cp-card')) {
            card.classList.toggle('picked', chosen.has(card.dataset.plant));
        }
        go.textContent = `开始（已选 ${chosen.size} 张）`;
    }

    overlay.querySelector('[data-act="all"]').addEventListener('click', () => {
        packets.forEach(p => chosen.add(p.dataset.plant));
        paint();
    });
    overlay.querySelector('[data-act="none"]').addEventListener('click', () => {
        chosen.clear();
        paint();
    });
    go.addEventListener('click', () => {
        game.chosenCards = chosen;
        applyChosenCards(game);
        overlay.remove();
        onStart();
    });

    paint();
}
