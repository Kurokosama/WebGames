/**
 * SoundManager —— 用 Web Audio 现场合成的音效。
 *
 * 除了失败时那一声「No—！」用的是预先烘好的 sounds/no.wav（由
 * tools/make-no-wav.py 生成，配方和 playNoSynth 一致），其余全部程序化生成，
 * 不依赖任何外部素材。
 */
export class SoundManager {
    constructor() {
        this.ctx = null;
        this.bgmGain = null;
        this.sfxGain = null;
        this.masterGain = null;
        this.bgmPlaying = false;
        this.bgmNodes = [];
        this.muted = localStorage.getItem('pvz-muted') === '1';
    }

    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.masterGain.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.3;
        this.bgmGain.connect(this.masterGain);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.5;
        this.sfxGain.connect(this.masterGain);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 1;
        }
        try { localStorage.setItem('pvz-muted', this.muted ? '1' : '0'); } catch (_) {}
    }

    ensure() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        // 顺手把失败音效预热了：等真死的时候再去 fetch 就赶不上这一嗓子
        this.loadNo();
    }

    // --- Sound Effects ---

    playShoot() {
        this.ensure();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playIceShoot() {
        this.ensure();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playExplosion() {
        this.ensure();
        // Noise burst for explosion
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        source.start();
    }

    playCollectSun() {
        this.ensure();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, this.ctx.currentTime);
        osc.frequency.setValueAtTime(659, this.ctx.currentTime + 0.06);
        osc.frequency.setValueAtTime(784, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playPlant() {
        this.ensure();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playZombieDie() {
        this.ensure();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playLawnmower() {
        this.ensure();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }

    // 失败时喊的那声「No—！」。
    //
    // 优先播预先烘好的 sounds/no.wav（tools/make-no-wav.py 生成的，来路清楚、
    // 每次都一样）；文件加载不出来就回落到 playNoSynth 现场合成。
    // 两条路都接在 sfxGain 上，所以静音开关都管得住。
    //
    // 一开始试过浏览器语音合成 speechSynthesis，实测被直接拒掉
    // （error: not-allowed —— 它要求可信的用户手势，各浏览器策略还不一样），
    // 所以那条路已经弃用。
    playNo() {
        this.ensure();
        if (this._noBuf) { this._playBuf(this._noBuf); return; }
        if (this._noFailed) { this.playNoSynth(); return; }

        // 还没加载完：这一次先用合成的顶上，别让它哑掉
        this.playNoSynth();
        this.loadNo();
    }

    loadNo() {
        if (this._noLoading || this._noBuf || this._noFailed) return;
        this._noLoading = true;
        fetch('sounds/no.wav')
            .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
            .then(b => this.ctx.decodeAudioData(b))
            .then(buf => { this._noBuf = buf; })
            .catch(() => { this._noFailed = true; })
            .finally(() => { this._noLoading = false; });
    }

    _playBuf(buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.sfxGain);
        src.start();
    }

    // 合成版的那一声，作为 wav 的兜底。
    //
    // 本来用的是浏览器语音合成（speechSynthesis），实测被浏览器直接拒掉
    // （error: not-allowed —— 它要求可信的用户手势，各浏览器策略还不一样），
    // 所以改成和游戏里其它音效同一套 Web Audio 现场合成：
    //   声带  —— 一条锯齿波当基频，从 150Hz 慢慢滑到 100Hz，喊到最后垮下去
    //   共振峰 —— 三个带通滤波器并联，模拟「n → o」这两个音的口型：
    //             起手鼻音 n（低频闷住），随即张嘴成 o（F1 500 / F2 900）
    // 走 sfxGain，所以静音开关天然管得住它。
    playNoSynth(when = 0) {
        this.ensure();
        const t0 = this.ctx.currentTime + when;
        const dur = 1.25;

        // 声带基频：起手一顿，然后一路垮下去
        const glottis = this.ctx.createOscillator();
        glottis.type = 'sawtooth';
        glottis.frequency.setValueAtTime(150, t0);
        glottis.frequency.setValueAtTime(150, t0 + 0.35);
        glottis.frequency.linearRampToValueAtTime(100, t0 + dur);

        // 总音量包络：喊出来是「先冲一下，再拖长」
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(0.85, t0 + 0.08);
        env.gain.setValueAtTime(0.85, t0 + 0.75);
        env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

        // 三个共振峰。F1/F2 从鼻音 n 的位置滑到元音 o 的位置，
        // 听感上就是「呢——哦——」，也就是一声 No。
        const formants = [
            { from: 320, to: 500, q: 9,  gain: 1.0 },   // F1
            { from: 900, to: 900, q: 11, gain: 0.7 },   // F2
            { from: 2400, to: 2500, q: 8, gain: 0.25 }, // F3，添点人声的亮度
        ];
        for (const f of formants) {
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = f.q;
            bp.frequency.setValueAtTime(f.from, t0);
            bp.frequency.linearRampToValueAtTime(f.to, t0 + 0.22);   // 张嘴
            const g = this.ctx.createGain();
            g.gain.value = f.gain;
            glottis.connect(bp);
            bp.connect(g);
            g.connect(env);
        }

        env.connect(this.sfxGain);
        glottis.start(t0);
        glottis.stop(t0 + dur + 0.05);
    }

    playGameOver() {
        this.ensure();
        this.stopBGM();
        this.playNo();
        // 音阶往后挪 0.9 秒：和那一嗓子同时响会把它糊住
        const NO_LEN = 0.9;
        const notes = [392, 349, 330, 262];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime + NO_LEN + i * 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + NO_LEN + i * 0.3 + 0.3);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(this.ctx.currentTime + NO_LEN + i * 0.3);
            osc.stop(this.ctx.currentTime + NO_LEN + i * 0.3 + 0.35);
        });
    }

    playVictory() {
        this.ensure();
        this.stopBGM();
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime + i * 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.2 + 0.3);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(this.ctx.currentTime + i * 0.2);
            osc.stop(this.ctx.currentTime + i * 0.2 + 0.35);
        });
    }

    // --- Background Music (simple looping melody) ---

    startBGM() {
        this.ensure();
        if (this.bgmPlaying) return;
        this.bgmPlaying = true;
        this._playBGMLoop();
    }

    _playBGMLoop() {
        if (!this.bgmPlaying) return;

        // Grasswalk-inspired melody (PvZ day theme approximation)
        // Key of F major, upbeat and cheerful
        const bpm = 140;
        const beat = 60 / bpm;
        const eighth = beat / 2;

        // Melody notes: [frequency, duration in eighths]
        // Approximation of Grasswalk main riff
        const melody = [
            [349, 1], [440, 1], [523, 1], [440, 1],  // F A C A
            [349, 1], [523, 1], [440, 2],              // F C A-
            [349, 1], [440, 1], [523, 1], [587, 1],    // F A C D
            [523, 1], [440, 1], [349, 2],              // C A F-
            [294, 1], [349, 1], [440, 1], [349, 1],    // D F A F
            [294, 1], [440, 1], [349, 2],              // D A F-
            [262, 1], [294, 1], [349, 1], [440, 1],    // C D F A
            [349, 1], [294, 1], [262, 2],              // F D C-
        ];

        // Bass line
        const bassLine = [
            [175, 4], [175, 4],  // F bass
            [175, 4], [175, 4],  // F bass
            [147, 4], [147, 4],  // D bass
            [131, 4], [131, 4],  // C bass
        ];

        let melodyTime = 0;
        melody.forEach(([freq, dur]) => {
            const startTime = this.ctx.currentTime + melodyTime * eighth;
            const noteLen = dur * eighth;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.setValueAtTime(0.08, startTime + noteLen * 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteLen * 0.95);
            osc.connect(gain);
            gain.connect(this.bgmGain);
            osc.start(startTime);
            osc.stop(startTime + noteLen);
            this.bgmNodes.push(osc);
            melodyTime += dur;
        });

        let bassTime = 0;
        bassLine.forEach(([freq, dur]) => {
            const startTime = this.ctx.currentTime + bassTime * eighth;
            const noteLen = dur * eighth;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.07, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteLen * 0.9);
            osc.connect(gain);
            gain.connect(this.bgmGain);
            osc.start(startTime);
            osc.stop(startTime + noteLen);
            this.bgmNodes.push(osc);
            bassTime += dur;
        });

        const loopLen = melodyTime * eighth * 1000;

        // Schedule next loop
        this._bgmTimeout = setTimeout(() => {
            this.bgmNodes = [];
            this._playBGMLoop();
        }, loopLen);
    }

    stopBGM() {
        this.bgmPlaying = false;
        clearTimeout(this._bgmTimeout);
        this.bgmNodes.forEach(n => {
            try { n.stop(); } catch (e) { /* already stopped */ }
        });
        this.bgmNodes = [];
    }
}
