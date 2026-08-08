'use strict';

const DIFFS = {
  easy: { disks: 3 },
  medium: { disks: 4 },
  hard: { disks: 5 }
};

let state = null;

function init(diff) {
  const n = DIFFS[diff].disks;
  state = {
    diff,
    n,
    pegs: [
      Array.from({ length: n }, (_, i) => n - 1 - i), // bottom disk = n-1 (biggest)
      [],
      []
    ],
    selected: null,
    moves: 0
  };
  $('#moves').textContent = '0';
  $('#best').textContent = Math.pow(2, n) - 1;
  $('#feedback').textContent = 'Click a peg to pick up its top disk, then click another peg to drop it!';
  render();
}

function pegClick(pegIndex) {
  const peg = state.pegs[pegIndex];
  if (state.selected === null) {
    if (peg.length === 0) {
      flashFeedback('That peg is empty — pick one with a disk!');
      return;
    }
    state.selected = pegIndex;
  } else {
    if (pegIndex === state.selected) {
      state.selected = null;
      render();
      return;
    }
    const top = peg[peg.length - 1];
    const moving = state.pegs[state.selected][state.pegs[state.selected].length - 1];
    if (top !== undefined && top < moving) {
      flashFeedback('Oops! A big disk cannot sit on a small one.');
      state.selected = null;
      render();
      return;
    }
    state.pegs[state.selected].pop();
    peg.push(moving);
    state.moves++;
    $('#moves').textContent = state.moves;
    state.selected = null;
    checkWin();
    render();
  }
}

function checkWin() {
  if (state.pegs[2].length === state.n) {
    const best = Math.pow(2, state.n) - 1;
    const isPerfect = state.moves === best;
    burstConfetti();
    showModal(
      '🎉 You Solved It!',
      `You moved all ${state.n} disks in ${state.moves} moves.${isPerfect ? ' A perfect solution!' : ` The best possible is ${best}.`}`,
      'Play Again',
      () => init(state.diff)
    );
  }
}

function flashFeedback(text) {
  const el = $('#feedback');
  el.textContent = text;
  setTimeout(() => {
    if (state) $('#feedback').textContent = 'Click a peg to pick up its top disk, then click another peg to drop it!';
  }, 1500);
}

function render() {
  const board = $('#board');
  board.innerHTML = '';
  state.pegs.forEach((peg, pi) => {
    const el = document.createElement('div');
    el.className = 'peg' + (state.selected === pi ? ' selected' : '') + (pi === 2 && peg.length === state.n ? ' peg-done' : '');
    const width = 100 / state.n; // disk widths shrink as count grows

    peg.slice().reverse().forEach((disk) => {
      const d = document.createElement('div');
      d.className = 'disk disk-' + disk;
      d.style.width = (width * (disk + 1) * 0.82) + '%';
      el.appendChild(d);
    });

    const base = document.createElement('div');
    base.className = 'peg-base';
    el.appendChild(base);
    el.addEventListener('click', () => pegClick(pi));
    board.appendChild(el);
  });
}

initGameFrame({
  title: 'Tower of Hanoi',
  emoji: '🗼',
  difficulties: [
    { value: 'easy', label: 'Easy (3 disks)' },
    { value: 'medium', label: 'Medium (4 disks)' },
    { value: 'hard', label: 'Hard (5 disks)' }
  ],
  defaultDifficulty: 'easy',
  onDifficulty: (d) => init(d),
  onRestart: () => init(state.diff)
});

init('easy');
