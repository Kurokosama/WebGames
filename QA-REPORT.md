# QA Report — Kids Game Land (36 games)

**Date:** 2026-08-08
**Environment:** macOS · Chrome (via Playwright) · local server `python3 -m http.server 8000`
**Scope:** Lobby + all 36 games — load, console errors, core interactions, difficulty, navigation.

## Summary

| Check | Result |
|-------|--------|
| Lobby renders 36 game cards | ✅ Pass (36/36 links, correct names/descriptions/difficulty tags) |
| All game pages load with **zero console/page errors** | ✅ Pass (36/36) |
| Game title, modal, restart button present on every page | ✅ Pass (36/36) |
| Difficulty selector works (memory-match Easy→Hard: 4×4 → 6×6) | ✅ Pass |
| Restart button resets game state | ✅ Pass |
| Back-to-home link returns to lobby (36 cards) | ✅ Pass |
| 36/36 games playable end-to-end | ✅ Pass (see per-game table) |

## Per-game functional tests

| # | Game | Test performed | Result |
|---|------|----------------|--------|
| 1 | Memory Match | Flipped 2 cards → moves=2, 2 cards open | ✅ |
| 2 | Tic-Tac-Toe | Placed mark → ✕ shown | ✅ |
| 3 | Rock Paper Scissors | Played rock → result & score updated | ✅ |
| 4 | Guess the Number | Guessed 5 → attempts=1, "Higher!" hint | ✅ |
| 5 | Math Quiz | Answered → score=1, question 2/10 | ✅ |
| 6 | Word Scramble | Placed a letter tile → appears in answer | ✅ |
| 7 | Hangman | Guessed a letter → key marked used | ✅ |
| 8 | Reaction Test | Early click → "Too soon!" correct feedback | ✅ |
| 9 | Snake | Arrow key moves snake, canvas 440×440 | ✅ |
| 10 | Tetris | ArrowDown soft-drop adds +1 score; move/rotate OK | ✅ |
| 11 | 2048 | ArrowLeft merges/moves tiles | ✅ |
| 12 | Pair Link | Board renders 18 pairs, clicks safe | ✅ |
| 13 | Whack-a-Mole | Whacked a mole → score=1 | ✅ |
| 14 | Tower of Hanoi | Moved peg0→peg2 → moves=1 | ✅ |
| 15 | Sliding Puzzle | Adjacent tile slide → moves=1 | ✅ |
| 16 | Fruit Catch | Fruits spawn, mouse moves basket | ✅ |
| 17 | Simon Says | Sequence plays, pad click no error | ✅ |
| 18 | Balloon Pop | Clicked balloon → score 0→1 | ✅ |
| 19 | Color Match | Round advances after click | ✅ |
| 20 | Maze | Arrow keys move player (moves=1) | ✅ |
| 21 | Gomoku | Place stone → AI responds (2 stones), turn cycles back | ✅ |
| 22 | Breakout | Canvas runs, paddle follows mouse, lives tracked | ✅ |
| 23 | Pong | Ball bounces, paddles move with mouse | ✅ |
| 24 | Minesweeper | Flood reveal (37 cells) + right-click flag, zero errors | ✅ |
| 25 | Connect Four | Drop disc → player + AI discs on board | ✅ |
| 26 | Sokoban | Level 1 solved in 2 pushes → level complete modal | ✅ |
| 27 | Flappy Bird | Click flaps, canvas runs | ✅ |
| 28 | Dots & Boxes | Draw edge → AI turn takes over | ✅ |
| 29 | Typing Race | Typed falling word → score=1 | ✅ |
| 30 | Match Three | Select & swap tiles, no errors | ✅ |
| 31 | Bubble Shooter | Fire a shot → bubble snaps into grid, no errors | ✅ |
| 32 | Doodle Jump | Player bounces reliably on platforms (crossing detection) | ✅ |
| 33 | Pac-Man | Move & eat dots (score 10, dots 135→134), ghost cooldown works | ✅ |
| 34 | Space Invaders | Bullet collision confirmed (invader destroyed, +30) | ✅ |
| 35 | Wordle | Type → submit → colored feedback (green/yellow/grey) + keyboard | ✅ |
| 36 | Chess | Full move + AI response (e2-e4 → reply → back to White) | ✅ |

## Bugs found & fixed in this round

1. **Chess — crash on move**: `selectPiece` generated legal moves without the `from` field, so `doMove` crashed with `Cannot read properties of undefined (reading 'r')`. Fixed by including `from` in each legal move.
2. **Wordle — crash on load**: `$$` was called with swapped arguments (`$$(root, selector)` instead of `$$(selector, root)`). Fixed both call sites.
3. **Wordle — colors erased**: `render()` reset `cell.className` for every row, wiping the green/yellow/grey feedback that `submit()` had applied via delayed timers. Fixed by skipping evaluated rows in `render()`.
4. **Pac-Man — instant death**: ghosts spawned next to the player with no delay, causing a collision before the game began. Added a spawn/revive cooldown to ghosts.
5. **Bubble Shooter — unfair game over**: shooting into a crowded cluster returned no snap cell and ended the game. `snapCell` now widens its search before giving up.
6. **Doodle Jump — falling through platforms**: the landing check tested only the current frame's position, so large frame steps skipped the 12px landing window. Replaced with crossing detection (previous vs current feet).
7. **Doodle Jump — unwinnable start**: platforms were random, so the player's column could have no reachable platform. Added a guaranteed platform directly under the player at start.

## Notes / Known behaviors

- All game pages use **absolute asset paths** (`/css/...`, `/js/common.js`), so the site must be served over HTTP (local `python3 -m http.server` or CF Pages). Opening `index.html` directly via `file://` will not load shared assets — this is expected and resolved by deployment.
- Web Audio (Simon Says) requires a user gesture on some browsers; game works without sound if audio is blocked.
- Gomoku AI on Medium/Hard blocks wins and takes winning moves; Easy plays with center preference.
- Dots & Boxes AI on Hard avoids giving away easy two-edge boxes.
- Confetti, modal pop-in, and floating lobby decorations are pure CSS/JS animations — no external assets required.

## Deployment readiness

- Zero build step, no package.json needed. Files are at repo root.
- CF Pages: Framework preset `None`, empty build command, empty output directory.
- Verified static assets referenced correctly for root-relative hosting.
