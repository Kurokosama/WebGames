/* ============================================================
   Kids Game Land — Shared helpers for all games
   ============================================================ */
'use strict';

// ---------- DOM helpers ----------
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

// ---------- Random helpers ----------
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------- Confetti ----------
function burstConfetti() {
  const colors = ['#ff7e67', '#ffd166', '#06d6a0', '#4cc9f0', '#9b7edb', '#f47ba1'];
  for (let i = 0; i < 45; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = pick(colors);
    piece.style.animationDuration = (1.2 + Math.random() * 1.3).toFixed(2) + 's';
    piece.style.animationDelay = (Math.random() * 0.4).toFixed(2) + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

// ---------- Game frame init ----------
/**
 * options = {
 *   title: string,
 *   emoji: string,
 *   difficulties: [{value, label}] (leave empty to hide the selector),
 *   defaultDifficulty: string,
 *   onDifficulty: fn(value),
 *   onRestart: fn()
 * }
 */
function initGameFrame(options = {}) {
  const { title, emoji = '', difficulties = [], defaultDifficulty = 'easy', onDifficulty, onRestart } = options;

  document.title = (emoji ? emoji + ' ' : '') + title + ' · Kids Game Land';
  const titleEl = $('#game-title');
  if (titleEl) titleEl.textContent = (emoji ? emoji + ' ' : '') + title;

  // Difficulty selector
  const wrap = $('#difficulty-wrap');
  if (wrap) {
    if (difficulties.length > 1) {
      const sel = document.createElement('select');
      sel.className = 'difficulty-select';
      difficulties.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.value;
        opt.textContent = d.label;
        sel.appendChild(opt);
      });
      sel.value = defaultDifficulty;
      sel.addEventListener('change', () => { if (onDifficulty) onDifficulty(sel.value); });
      wrap.appendChild(sel);
    } else {
      wrap.remove();
    }
  }

  // Restart button
  const restartBtn = $('#restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => { if (onRestart) onRestart(); });

  // Modal helpers
  window.showModal = (title, text = '', btnText = 'Play Again', onPlayAgain) => {
    $('#modal-title').textContent = title;
    $('#modal-text').textContent = text;
    const btn = $('#modal-btn');
    btn.textContent = btnText;
    btn.onclick = () => { hideModal(); if (onPlayAgain) onPlayAgain(); };
    $('#modal').classList.remove('hidden');
  };
  window.hideModal = () => $('#modal').classList.add('hidden');
}

// ---------- Expose globals ----------
window.$ = $;
window.$$ = $$;
window.randInt = randInt;
window.pick = pick;
window.shuffle = shuffle;
window.burstConfetti = burstConfetti;
window.initGameFrame = initGameFrame;
