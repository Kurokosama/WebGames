# 🎮 Kids Game Land

A little collection of **36 classic mini-games** for kids — all playable right in the browser.

**No ads. No sign-ups. No tracking. Just games.** 💚

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Games](https://img.shields.io/badge/Games-36-brightgreen)](#-the-games)

## What is this?

A hobby project — a clean, simple place for kids to play classics like Tetris, Snake, 2048, Minesweeper, and Gomoku (and 26 more!). It's plain HTML/CSS/JS that runs 100% in the browser, with no build tools, no frameworks, and nothing to install. Free to use, free to copy, free to change.

## For parents & teachers 👨‍👩‍👧‍👦

- 🚫 **No ads** — nothing interrupts the fun
- 🚫 **No tracking or analytics** — we don't collect anything
- 🚫 **No accounts, logins, or sign-ups**
- 🚫 **No data leaves the browser** — scores stay in the page until you close it
- 🌐 The only external request is the Google Fonts stylesheet, and the site works just fine without it

## 🎮 The Games

All games live under [`games/`](games/) — one folder per game.

| # | Game | Type | Folder | Description |
|---|------|------|--------|-------------|
| 1 | 🧠 Memory Match | Memory | `games/memory-match` | Flip cards and find matching pairs |
| 2 | ⭕ Tic-Tac-Toe | Strategy | `games/tic-tac-toe` | Get three in a row vs the computer |
| 3 | ✊ Rock Paper Scissors | Classic | `games/rock-paper-scissors` | Beat the computer, first to 5 wins |
| 4 | 🔢 Guess the Number | Logic | `games/guess-the-number` | Find the secret number with hints |
| 5 | ➕ Math Quiz | Education | `games/math-quiz` | Solve math problems, build a streak |
| 6 | 🔤 Word Scramble | Word | `games/word-scramble` | Unscramble the letters to spell words |
| 7 | 🙈 Hangman | Word | `games/hangman` | Guess the word before losing hearts |
| 8 | ⚡ Reaction Test | Reflex | `games/reaction-test` | Click fast when it turns green |
| 9 | 🐍 Snake | Arcade | `games/snake` | Eat food, grow, don't hit yourself |
| 10 | 🧩 Tetris | Puzzle | `games/tetris` | Stack blocks and clear full lines |
| 11 | 🎯 2048 | Puzzle | `games/2048` | Merge tiles to reach 2048 |
| 12 | 🍎 Pair Link | Puzzle | `games/pair-link` | Connect matching pairs with a path |
| 13 | 🔨 Whack-a-Mole | Action | `games/whack-a-mole` | Whack the moles before they hide |
| 14 | 🗼 Tower of Hanoi | Puzzle | `games/tower-of-hanoi` | Move all disks to the last peg |
| 15 | 🧊 Sliding Puzzle | Puzzle | `games/sliding-puzzle` | Put the numbers in order |
| 16 | 🍓 Fruit Catch | Arcade | `games/fruit-catch` | Catch the falling fruit |
| 17 | 🎵 Simon Says | Memory | `games/simon-says` | Repeat the color pattern |
| 18 | 🎈 Balloon Pop | Arcade | `games/balloon-pop` | Pop balloons before time runs out |
| 19 | 🌈 Color Match | Reflex | `games/color-match` | Click the matching color |
| 20 | 🌀 Maze | Puzzle | `games/maze` | Find your way to the flag |
| 21 | 🎱 Gomoku | Strategy | `games/gomoku` | Five in a row vs the computer |
| 22 | 🧱 Breakout | Arcade | `games/breakout` | Bounce the ball and smash bricks |
| 23 | 🏓 Pong | Arcade | `games/pong` | Classic ping-pong, first to 5 |
| 24 | 💣 Minesweeper | Logic | `games/minesweeper` | Find safe tiles, avoid the bombs |
| 25 | 🔴 Connect Four | Strategy | `games/connect-four` | Drop discs, get four in a row |
| 26 | 📦 Sokoban | Puzzle | `games/sokoban` | Push boxes onto the targets |
| 27 | 🐦 Flappy Bird | Arcade | `games/flappy-bird` | Flap through the pipe gaps |
| 28 | ✏️ Dots & Boxes | Strategy | `games/dots-and-boxes` | Draw lines, make more boxes |
| 29 | ⌨️ Typing Race | Word | `games/typing-race` | Type the falling words |
| 30 | 🍬 Match Three | Puzzle | `games/match-three` | Swap treats to match three |
| 31 | 🫧 Bubble Shooter | Arcade | `games/bubble-shooter` | Aim and pop 3+ matching bubbles |
| 32 | 🐸 Doodle Jump | Arcade | `games/doodle-jump` | Bounce up the platforms, climb high |
| 33 | 👻 Pac-Man | Arcade | `games/pac-man` | Eat all the dots, dodge the ghosts |
| 34 | 👾 Space Invaders | Arcade | `games/space-invaders` | Shoot down the invading aliens |
| 35 | 🟩 Wordle | Word | `games/wordle` | Guess the secret 5-letter word |
| 36 | ♟️ Chess | Strategy | `games/chess` | Full chess rules vs the computer |

## 🚀 Play it locally

The site uses root-relative asset paths (e.g. `/css/common.css`), so it must be served over HTTP — not opened directly via `file://`.

```bash
cd WebGames
python3 -m http.server 8000
# open http://localhost:8000 🎉
```

Then open **http://localhost:8000** in your browser and pick a game!

## 🗂️ Folder layout

```
WebGames/
├── index.html        # The lobby — lists all 36 games
├── css/              # Shared styles (common.css + games.css)
├── js/common.js      # Shared helpers (game frame, modal, confetti, utils)
├── games/<name>/     # One folder per game: index.html + style.css + game.js
└── scripts/          # A tiny check script for when you add a game (optional)
```

## 🛠️ How it's built

Plain HTML5 + CSS3 + vanilla JavaScript. That's it — no frameworks, no build step. Games use the DOM, a little Canvas for the arcade ones, and a shared `common.js` for the header/modal/confetti bits. Every game follows the same simple skeleton, so adding a new one is easy (see below).

## ☁️ Deploy

There's no build step, so the repo deploys anywhere. Quickest option — **Cloudflare Pages**:

1. Push to GitHub
2. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**
3. Framework preset: **None** · Build command: *(empty)* · Output directory: *(empty)*
4. **Save and Deploy** → done 🎉

Netlify, Vercel, GitHub Pages — same idea, just upload the folder.

## 🛠️ Want to add a game?

Would love that! It's pretty easy:

1. Create a folder `games/your-game/` with `index.html`, `style.css`, and `game.js` (copy any existing game as a starting point)
2. Add your game to the `GAMES` list at the top of `index.html`
3. Run `node scripts/verify-games.mjs` to double-check everything
4. Open a pull request 🎉

## 📄 License

MIT — take it, use it, change it. See [LICENSE](LICENSE).

---

<p align="center">Made with 💚 for curious kids everywhere</p>

