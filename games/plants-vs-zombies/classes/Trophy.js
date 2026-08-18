// 通关奖杯 🏆 —— 打死报纸将王之后掉下来的那个金杯子。
//
// 胜利时它从天上掉到棋盘正中，一直在那儿闪金光等你点。点一下：金光炸开、
// 杯子越变越大，涨到满屏之后进入下一关（关卡数 +1，将王的血跟着涨一倍）。
//
// 掉奖杯期间不再弹「胜利」遮罩 —— 遮罩会盖住棋盘，就点不到杯子了。

const GROW_MS = 1400;   // 从点下去到进下一关

export function dropTrophy(game, onNext) {
    // 上一关的杯子如果还挂着（比如连点太快），先收掉
    game.board.querySelector('.trophy')?.remove();

    const el = document.createElement('div');
    el.className = 'trophy dropping';
    el.dataset.tip = '点我进入下一关';
    el.innerHTML = '<span class="trophy-cup">🏆</span><span class="trophy-glow"></span>';

    const boardH = game.height * game.cellHeight;
    el.style.left = `${game.boardWidth / 2 - 60}px`;
    el.style.top = `${boardH / 2 - 60}px`;
    game.board.appendChild(el);

    const hint = document.createElement('div');
    hint.className = 'trophy-hint';
    hint.textContent = `🏆 第 ${game.level} 关通关! 点奖杯进入下一关`;
    hint.style.top = `${boardH / 2 + 70}px`;
    game.board.appendChild(hint);

    let taken = false;
    el.addEventListener('click', (e) => {
        // 别让棋盘的点击处理再接一手（否则会当成「往这一格种植物」）
        e.stopPropagation();
        if (taken) return;
        taken = true;

        el.classList.remove('dropping');
        el.classList.add('growing');
        hint.remove();
        game.sound?.playVictory();

        setTimeout(() => {
            el.remove();
            onNext();
        }, GROW_MS);
    });

    return el;
}

export function clearTrophy(game) {
    game.board.querySelector('.trophy')?.remove();
    game.board.querySelector('.trophy-hint')?.remove();
}
