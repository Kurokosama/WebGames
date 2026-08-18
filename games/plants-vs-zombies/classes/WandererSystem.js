function _hslToRgb(h, s, l) {
    const hue2 = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2(p, q, h + 1/3) * 255 | 0, hue2(p, q, h) * 255 | 0, hue2(p, q, h - 1/3) * 255 | 0];
}

export class WandererSystem {
    constructor(count, boardWidth, boardHeight, cellWidth, cellHeight) {
        this.count = count;
        this.W = boardWidth; this.H = boardHeight;
        this.cW = cellWidth; this.cH = cellHeight;
        this.dmgTimer = 0;

        this.px = new Float32Array(count);
        this.py = new Float32Array(count);
        this.vx = new Float32Array(count);
        this.vy = new Float32Array(count);
        this.hp = new Float32Array(count);
        this.stun = new Float32Array(count);
        this.maxHp = Infinity;
        this.cr = new Uint8Array(count);
        this.cg = new Uint8Array(count);
        this.cb = new Uint8Array(count);
        this.dt = new Uint16Array(count);
        this.di = new Uint16Array(count);

        for (let i = 0; i < count; i++) {
            this.px[i] = Math.random() * boardWidth;
            this.py[i] = Math.random() * boardHeight;
            this.vx[i] = 0.8 + Math.random() * 0.8;
            this.hp[i] = this.maxHp;
            const spd = 1.5 + Math.random() * 2;
            this.vy[i] = Math.random() < 0.5 ? spd : -spd;
            const [r, g, b] = _hslToRgb(Math.random(), 0.9, 0.6);
            this.cr[i] = r; this.cg[i] = g; this.cb[i] = b;
            this.dt[i] = Math.random() * 120 | 0;
            this.di[i] = 60 + Math.random() * 120 | 0;
        }

        const canvas = document.createElement('canvas');
        canvas.width = boardWidth; canvas.height = boardHeight;
        canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:18;pointer-events:none;';
        document.getElementById('game-board').appendChild(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    update(game) {
        const { W, H, count, ctx } = this;
        const { px, py, vx, vy, cr, cg, cb, dt, di, stun } = this;
        const dtMs = game.deltaTime || 16;

        ctx.clearRect(0, 0, W, H);

        for (let i = 0; i < count; i++) {
            if (stun[i] > 0) {
                stun[i] -= dtMs;
                if (stun[i] < 0) stun[i] = 0;
                const xi = px[i], yi = py[i];
                const color = `rgb(${cr[i]},${cg[i]},${cb[i]})`;
                ctx.shadowBlur = 28;
                ctx.shadowColor = '#ffd700';
                ctx.font = '36px serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = color;
                ctx.fillText('👾', xi + 20, yi + 46);
                ctx.shadowBlur = 0;
                ctx.font = '20px serif';
                ctx.fillText('💫', xi + 20, yi + 14);
                continue;
            }

            dt[i]++;
            if (dt[i] >= di[i]) {
                dt[i] = 0;
                di[i] = 60 + Math.random() * 120 | 0;
                const spd = 1.5 + Math.random() * 2;
                vy[i] = Math.random() < 0.5 ? spd : -spd;
            }
            px[i] -= vx[i] * (game.zombieSpeedBoost || 1);
            if (px[i] < -40) px[i] = W;

            // 碰到坚果停在右侧
            const wCol = Math.floor(px[i] / this.cW);
            const wRow = Math.floor((py[i] + 30) / this.cH);
            if (wRow >= 0 && wRow < game.height && wCol >= 0 && wCol < game.width) {
                const stack = game.grid[wRow][wCol];
                if (stack.length > 0 && stack[stack.length - 1].type === 'wallnut' && !stack[stack.length - 1].markedForDeletion) {
                    px[i] = (wCol + 1) * this.cW;
                }
            }

            py[i] += vy[i];
            if (py[i] >= H - 60) { py[i] = H - 60; vy[i] = -Math.abs(vy[i]); }
            if (py[i] <  0)      { py[i] = 0;       vy[i] =  Math.abs(vy[i]); }

            const xi = px[i], yi = py[i];
            const color = `rgb(${cr[i]},${cg[i]},${cb[i]})`;
            ctx.shadowBlur = 24;
            ctx.shadowColor = color;
            ctx.font = '36px serif';
            ctx.textAlign = 'center';
            ctx.fillText('👾', xi + 20, yi + 46);
            ctx.shadowBlur = 0;
        }

        // 每 30 帧批量伤害植物
        if (++this.dmgTimer < 30) return;
        this.dmgTimer = 0;
        const rows = game.height, cols = game.width;
        const cnt = new Int32Array(rows * cols);
        for (let i = 0; i < count; i++) {
            if (stun[i] > 0) continue;
            const c = px[i] / this.cW | 0, r = py[i] / this.cH | 0;
            if (r >= 0 && r < rows && c >= 0 && c < cols) cnt[r * cols + c]++;
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const n = cnt[r * cols + c];
                if (!n) continue;
                const stack = game.grid[r][c];
                if (!stack.length) continue;
                const plant = stack[stack.length - 1];
                if (!plant.markedForDeletion) plant.takeDamage(n, true);
            }
        }
    }

    destroy() { this.canvas.remove(); }
}
