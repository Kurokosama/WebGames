import { Zombie } from './Zombie.js';

export function generateWaves(zombieCountMultiplier = 1, waveCountSetting = 6) {
    const m = zombieCountMultiplier;
    const sc = (v) => Math.max(1, Math.round(v * m));
    // 普通模式全场只刷报纸僵尸 📰 —— 每只挡一次伤害，报纸被打掉后
    // 立刻 ×2.5 狂暴加速冲过来。每波的总数和出怪间隔沿用原来混合波的配置。
    // （游荡者模式走 WandererSystem，不受这里影响。）
    const allWaves = [
        { zombies: [{ type: 'newspaper', count: sc(500) }],  interval: 50 },
        { zombies: [{ type: 'newspaper', count: sc(1100) }], interval: 45 },
        { zombies: [{ type: 'newspaper', count: sc(1500) }], interval: 40 },
        { zombies: [{ type: 'newspaper', count: sc(2000) }], interval: 38 },
        { zombies: [{ type: 'newspaper', count: sc(2100) }], interval: 33 },
        { zombies: [{ type: 'newspaper', count: sc(3300) }], interval: 25 },
        { zombies: [{ type: 'newspaper', count: sc(3900) }], interval: 22 },
        { zombies: [{ type: 'newspaper', count: sc(4700) }], interval: 20 },
        { zombies: [{ type: 'newspaper', count: sc(7800) }], interval: 18 },
    ];
    return allWaves.slice(0, waveCountSetting);
}

export function getTotalZombiesInWave(wave) {
    return wave.zombies.reduce((sum, g) => sum + g.count, 0);
}

export function spawnZombie(game, row, type = 'normal') {
    const y = row * game.cellHeight;
    const zombie = new Zombie(game.boardWidth, y, type, game.zombieSpeedMultiplier);
    game.zombies.push(zombie);
}

export function updateWaves(game, deltaTime) {
    // 普通 / 融合模式的僵尸现在全部由报纸将王放出（见 Boss.js），
    // 这里只剩游荡者模式和「没有 boss」时的兜底路径。
    if (game.boss) return;
    if (game.waveIndex >= game.waves.length) return;

    game.waveTimer -= deltaTime;
    if (game.waveTimer > 0) return;

    const wave = game.waves[game.waveIndex];
    const totalZombies = getTotalZombiesInWave(wave);

    game.waveSpawnTimer -= deltaTime;
    if (game.waveSpawnTimer <= 0 && game.zombiesSpawnedInWave < totalZombies) {
        const totalWeight = wave.zombies.reduce((s, g) => s + g.count, 0);
        let r = Math.random() * totalWeight;
        let type = 'normal';
        for (const group of wave.zombies) {
            if (r < group.count) { type = group.type; break; }
            r -= group.count;
        }
        const row = Math.floor(Math.random() * game.height);
        spawnZombie(game, row, type);
        game.zombiesSpawnedInWave++;
        game.waveSpawnTimer = wave.interval;
    }

    if (game.zombiesSpawnedInWave >= totalZombies && game.zombies.length === 0) {
        game.waveIndex++;
        game.zombiesSpawnedInWave = 0;
        game.waveTimer = 80;
        game.updateProgressBar();
    }
}
