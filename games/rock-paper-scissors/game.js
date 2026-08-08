'use strict';

const MOVES = {
  rock: { emoji: '✊', beats: 'scissors' },
  paper: { emoji: '✋', beats: 'rock' },
  scissors: { emoji: '✌️', beats: 'paper' }
};

const FIRST_TO = 5;
let score = { you: 0, computer: 0, ties: 0 };

function play(player) {
  const keys = Object.keys(MOVES);
  const comp = pick(keys);
  $('#your-choice').textContent = MOVES[player].emoji;
  $('#comp-choice').textContent = MOVES[comp].emoji;

  let msg;
  if (player === comp) {
    score.ties++;
    msg = 'It’s a tie! 🤝';
  } else if (MOVES[player].beats === comp) {
    score.you++;
    msg = 'You win! 🎉';
  } else {
    score.computer++;
    msg = 'Computer wins! 😅';
  }

  $('#you').textContent = score.you;
  $('#computer').textContent = score.computer;
  $('#ties').textContent = score.ties;
  $('#result').textContent = msg;

  if (score.you >= FIRST_TO) {
    setTimeout(() => {
      burstConfetti();
      showModal('🎉 You Win the Match!', `You reached ${FIRST_TO} wins first. Awesome!`, 'Play Again', reset);
    }, 350);
  } else if (score.computer >= FIRST_TO) {
    setTimeout(() => {
      showModal('😅 Computer Wins the Match!', `The computer reached ${FIRST_TO} wins first. Try again!`, 'Play Again', reset);
    }, 350);
  }
}

function reset() {
  score = { you: 0, computer: 0, ties: 0 };
  $('#you').textContent = 0;
  $('#computer').textContent = 0;
  $('#ties').textContent = 0;
  $('#your-choice').textContent = '🤚';
  $('#comp-choice').textContent = '🤖';
  $('#result').textContent = 'Pick your move to start!';
}

initGameFrame({
  title: 'Rock Paper Scissors',
  emoji: '✊',
  difficulties: [],
  onRestart: reset
});
