'use strict';

const TOTAL_ROUNDS = 10;
const WIN_TARGET = 7;
const BEST_KEY = 'best-coin-flip';
const FLIP_MS = 1100;

let state = null;

function readBest() {
  try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
}
function saveBest(value) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch (e) { /* storage unavailable */ }
}
function cap(side) { return side === 'heads' ? 'Heads' : 'Tails'; }

function renderStats() {
  $('#player-wins').textContent = state.playerWins;
  $('#coin-wins').textContent = state.coinWins;
  $('#streak').textContent = state.streak;
  $('#best-streak').textContent = state.best;
  $('#round-label').textContent = 'Round ' + Math.min(state.round, TOTAL_ROUNDS) + ' / ' + TOTAL_ROUNDS;
}

function setMessage(text, kind) {
  const el = $('#message');
  el.textContent = text;
  el.classList.remove('good', 'bad');
  if (kind) el.classList.add(kind);
}

function setButtonsEnabled(on) {
  $('#call-heads').disabled = !on;
  $('#call-tails').disabled = !on;
}

function buildHistory() {
  const box = $('#history');
  box.innerHTML = '';
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    box.appendChild(chip);
  }
}

function init() {
  state = {
    round: 0,
    playerWins: 0,
    coinWins: 0,
    streak: 0,
    best: readBest(),
    rotation: 0,
    flipping: false,
    over: false
  };

  buildHistory();
  hideModal();
  $('.coin-stage').classList.remove('celebrate');
  $('#coin-wrap').classList.remove('tossing');

  const coin = $('#coin');
  coin.style.transition = 'none';
  coin.style.transform = 'rotateX(0deg)';
  coin.offsetHeight; // flush so the coin snaps back without animating
  coin.style.transition = '';

  setMessage('Call Heads or Tails, then flip the coin!');
  setButtonsEnabled(true);
  renderStats();
}

function flip(call) {
  if (!state || state.over || state.flipping) return;

  state.flipping = true;
  state.round++;
  setButtonsEnabled(false);

  const result = pick(['heads', 'tails']);
  const coin = $('#coin');
  const wrap = $('#coin-wrap');

  // Land on the right face: full spins plus the offset needed for heads (0deg) or tails (180deg).
  const targetMod = result === 'tails' ? 180 : 0;
  const offset = ((targetMod - (state.rotation % 360)) + 360) % 360;
  state.rotation += randInt(4, 6) * 360 + offset;
  coin.style.transform = 'rotateX(' + state.rotation + 'deg)';
  wrap.classList.add('tossing');

  setMessage('You called ' + cap(call) + '… the coin is spinning! 🌀');
  renderStats();

  setTimeout(() => {
    wrap.classList.remove('tossing');
    resolveRound(call, result);
  }, FLIP_MS);
}

function resolveRound(call, result) {
  state.flipping = false;
  const won = call === result;

  const chip = $$('#history .chip')[state.round - 1];
  if (chip) {
    chip.textContent = result === 'heads' ? 'H' : 'T';
    chip.classList.add(won ? 'win' : 'loss');
    chip.title = 'Round ' + state.round + ': you called ' + cap(call) +
      ', the coin landed ' + cap(result) + ' — ' + (won ? 'you win' : 'the coin wins');
  }

  if (won) {
    state.playerWins++;
    state.streak++;
    if (state.streak > state.best) {
      state.best = state.streak;
      saveBest(state.best);
    }
    setMessage(
      '🎉 ' + cap(result) + '! You win round ' + state.round +
      (state.streak >= 3 ? ' — streak of ' + state.streak + '!' : ''),
      'good'
    );
  } else {
    state.coinWins++;
    state.streak = 0;
    setMessage('😅 The coin landed on ' + cap(result) + '. The coin takes round ' + state.round + '.', 'bad');
  }

  renderStats();
  checkEnd();
}

function checkEnd() {
  if (state.playerWins >= WIN_TARGET) {
    state.over = true;
    $('.coin-stage').classList.add('celebrate');
    burstConfetti();
    showModal(
      '🏆 You Beat the Coin!',
      'You won ' + state.playerWins + ' rounds to ' + state.coinWins +
      '. Best streak: ' + state.best + '. Can you beat it?',
      'Play Again',
      () => init()
    );
    return;
  }
  if (state.coinWins >= WIN_TARGET) {
    state.over = true;
    showModal(
      '🪙 The Coin Wins!',
      'The coin won ' + state.coinWins + ' rounds to ' + state.playerWins +
      '. Your best streak this match: ' + state.best + '. Try again — luck is on your side!',
      'Play Again',
      () => init()
    );
    return;
  }
  if (state.round >= TOTAL_ROUNDS) {
    state.over = true;
    showModal(
      '🤝 It’s a Tie!',
      'You and the coin both won ' + state.playerWins + ' rounds. Best streak: ' + state.best +
      '. Flip again and try for 7 wins!',
      'Play Again',
      () => init()
    );
    return;
  }
  setButtonsEnabled(true);
}

$('#call-heads').addEventListener('click', () => flip('heads'));
$('#call-tails').addEventListener('click', () => flip('tails'));

initGameFrame({
  title: 'Coin Flip',
  emoji: '🪙',
  onRestart: () => init()
});

init();
