# QA Report — Kids Game Land (36 games)

**Date:** 2026-08-07
**Environment:** macOS · Chrome/Playwright hands-on runs (Rounds 1–2) · Node 22 regression harness and local HTTP route scan (Round 3)
**Scope:** Lobby + all 36 games — UI/layout, load/runtime errors, core interactions, difficulty, restart safety, navigation, and targeted rule invariants.

## Summary

| Check | Result |
|-------|--------|
| Lobby renders 36 game cards | ✅ Pass (36/36 links, correct names/descriptions/difficulty tags) |
| Lobby metadata reports the correct 36-game catalog | ✅ Pass |
| Lobby, shared assets, and every game route return HTTP 200 | ✅ Pass (40/40 routes/assets) |
| All game pages load with **zero console/page errors** | ✅ Pass (36/36) |
| All 36 real game scripts initialize in the regression harness | ✅ Pass (36/36) |
| Game title, modal, restart button present on every page | ✅ Pass (36/36) |
| Difficulty selector works (memory-match Easy→Hard: 4×4 → 6×6) | ✅ Pass |
| Restart/difficulty changes cancel pending AI and feedback timers | ✅ Pass |
| Back-to-home link returns to lobby (36 cards) | ✅ Pass |
| 36/36 games playable end-to-end | ✅ Pass (see per-game table) |
| Targeted gameplay regression suite | ✅ Pass (11/11, including every Sokoban level solvable) |

## Per-game functional tests

| # | Game | Test performed | Result |
|---|------|----------------|--------|
| 1 | Memory Match | Flipped 2 cards → moves=2, 2 cards open; restart cancels pending flip | ✅ |
| 2 | Tic-Tac-Toe | Placed mark → ✕ shown; input locks while AI thinks | ✅ |
| 3 | Rock Paper Scissors | Played rock → result & score updated; terminal score locks the round | ✅ |
| 4 | Guess the Number | Guessed 5 → attempts=1, "Higher!" hint | ✅ |
| 5 | Math Quiz | Answered → score=1, question 2/10; restart cancels delayed advance | ✅ |
| 6 | Word Scramble | Placed a letter tile → appears in answer; Round 1/10 and reset-safe advance | ✅ |
| 7 | Hangman | Guessed a letter → key marked used | ✅ |
| 8 | Reaction Test | Early click → "Too soon!" correct feedback; one restart-safe timer chain | ✅ |
| 9 | Snake | Arrow key moves snake, canvas 440×440 | ✅ |
| 10 | Tetris | ArrowDown soft-drop adds +1 score; move/rotate OK | ✅ |
| 11 | 2048 | ArrowLeft merges/moves tiles | ✅ |
| 12 | Pair Link | Matched adjacent pair → cleared; every generated/reshuffled board has a move | ✅ |
| 13 | Whack-a-Mole | Whacked a mole → score=1 | ✅ |
| 14 | Tower of Hanoi | Moved peg0→peg2 → moves=1 | ✅ |
| 15 | Sliding Puzzle | Empty tile tracks the visible blank; adjacent slide and standard solved order verified | ✅ |
| 16 | Fruit Catch | Fruits spawn, mouse moves basket | ✅ |
| 17 | Simon Says | Sequence plays, pad click no error; restart cancels old sequence callbacks | ✅ |
| 18 | Balloon Pop | Clicked balloon → score 0→1 | ✅ |
| 19 | Color Match | Correct/wrong feedback highlights the actual answer; Round shows 1/10 | ✅ |
| 20 | Maze | Arrow keys move player (moves=1) | ✅ |
| 21 | Gomoku | Place stone → AI responds; player cannot double-move during AI delay | ✅ |
| 22 | Breakout | Canvas runs, paddle follows mouse, lives tracked | ✅ |
| 23 | Pong | Ball bounces, paddles move with mouse | ✅ |
| 24 | Minesweeper | Flood reveal (37 cells) + right-click flag, zero errors | ✅ |
| 25 | Connect Four | Drop disc → player + AI discs; player cannot double-drop during AI delay | ✅ |
| 26 | Sokoban | Level 1 solved in 2 pushes; BFS confirms all 3 levels are solvable | ✅ |
| 27 | Flappy Bird | Click flaps, canvas runs | ✅ |
| 28 | Dots & Boxes | Draw edge → AI turn takes over; restart cancels old AI move; claimed edges stay visible on hover | ✅ |
| 29 | Typing Race | Typed falling word → score=1 | ✅ |
| 30 | Match Three | Select/swap tiles; every new and reshuffled board has a legal move | ✅ |
| 31 | Bubble Shooter | 8 shots fired → no game-over, matches clear & score up to 230 (fixed fake-row snap) | ✅ |
| 32 | Doodle Jump | Player bounces reliably on platforms (crossing detection) | ✅ |
| 33 | Pac-Man | Turns with arrow keys, stops at walls, ghosts chase; 3s without death (fixed progress===0 bug) | ✅ |
| 34 | Space Invaders | Bullet collision confirmed (invader destroyed, +30); hit cooldown prevents multi-life loss in one frame | ✅ |
| 35 | Wordle | Submit → colored feedback + keyboard; input locks during row evaluation | ✅ |
| 36 | Chess | e2-e4 + AI reply; 20 legal opening moves, pawn attacks and rook/castling rights verified | ✅ |

## Bugs found & fixed in this round

### Round 3 — 2026-08-07 (full source audit + deterministic regression suite)

1. **Sliding Puzzle — visible blank and movable blank were different tiles**: the board put value `0` in the first cell but tracked the last cell as empty. Fixed to standard `1…n²−1, 0` order, shuffled only through legal moves, and corrected the win condition.
2. **Tic-Tac-Toe, Gomoku, Connect Four — player could move repeatedly during the AI delay**: the rendered boards stayed interactive for 350–450ms. Added explicit computer-turn locks and disabled interaction until the AI finishes.
3. **Chess — pawn attacks were checked backwards**: check detection, king safety, and castling-through-check were wrong for pawn threats. Corrected the target-to-attacker row direction.
4. **Chess — castling rights changed for the wrong side/square**: any move to the a/h file could clear the mover’s right, while capturing an unmoved enemy rook did not clear its owner’s right. Rights now change only when a home rook moves or is captured.
5. **Match Three / Pair Link — random boards could start or reshuffle with no legal move**: generation now repeats until at least one valid move exists; Pair Link also checks the initial board.
6. **Color Match — wrong-answer feedback could not find the correct circle**: inline colors are browser-normalized to `rgb(...)`, so comparing them with a hex string failed. Stored and compared the canonical hex in `data-hex`.
7. **Wordle — multiple rows could be submitted during the reveal animation**: added an evaluation lock and restart-safe animation timers.
8. **Restart/difficulty timer races**: Memory Match, Math Quiz, Word Scramble, Color Match, Reaction Test, Simon Says, Dots & Boxes, Tic-Tac-Toe, Rock Paper Scissors, Pair Link, Tower of Hanoi, Wordle, and Chess now cancel delayed work before initializing a new game.
9. **Space Invaders — simultaneous bullets could remove multiple lives in one frame**: added a visible 1.2-second hit cooldown.
10. **Responsive layout — fixed-width canvases and the three-column header overflowed narrow screens**: canvases now scale to their container, pointer coordinates account for scaling, and the header reflows into two rows on small screens.
11. **Dots & Boxes — completed edges disappeared on hover**: removed a late hover rule that replaced the player color with a transparent inherited background.
12. **Catalog metadata — homepage still advertised 30 games**: title and description now match the 36-game catalog, and the verifier enforces it.
13. **Regression coverage — no CI workflow existed despite the verifier claiming CI use**: added GitHub Actions plus an 11-test gameplay regression harness that initializes all 36 real scripts and exercises the high-risk rules above.

### Round 2 — 2026-08-07 (Bubble Shooter & Pac-Man deep-dive + full re-scan)

1. **Bubble Shooter — every shot instantly game-overs**: `snapCell`'s 3×3 search only checked `inGrid` (columns), so a shot landing at the bottom edge would snap to a fake row below the board (`r >= state.rows`), and `land()` immediately called `gameOver()`. The widened-search fix from Round 1 didn't cover this. Fixed by excluding `rr >= state.rows` in both the 3×3 and widened searches.
2. **Pac-Man — direction control completely broken (walls ignored)**: `updatePac` / `updateGhost` only re-checked direction when `progress === 0`, but float accumulation means `progress` is never exactly 0 after the first frame. Result: Pac-Man walked straight through walls and off the maze, arrow keys did nothing, and ghosts never chased. Replaced the `=== 0` check with a `justLanded` flag (set after each completed step and at spawn). Also, when fully blocked, `progress` is reset and `justLanded` stays set so Pac-Man keeps re-checking and can respond to the player. The Round-1 ghost cooldown alone did not fix this — Pac-Man still walked into the stationary ghosts.
3. **Word Scramble — "Round: 1/undefined", game can never end**: `init` never set `state.total`, but `loadRound` and `endRound` both read it. Fixed by adding `total: words.length` to `state`.
4. **Color Match — "Round: 1/undefined", game can never end**: same missing `state.total` bug as Word Scramble. Fixed by adding `total: TOTAL` to `state`.
5. **Pair Link — no pair can ever be matched**: `isFreePad` checked `pr === a.pr` / `pc === a.pc`, but those fields never exist (padded coordinates are stored in `r`/`c` by `canConnect`). Every connect path was therefore blocked and `hasMove()` always returned `false`. Fixed by checking `a.r`/`a.c` and `b.r`/`b.c`.

### Round 1 (earlier)

1. **Chess — crash on move**: `selectPiece` generated legal moves without the `from` field, so `doMove` crashed with `Cannot read properties of undefined (reading 'r')`. Fixed by including `from` in each legal move.
2. **Wordle — crash on load**: `$$` was called with swapped arguments (`$$(root, selector)` instead of `$$(selector, root)`). Fixed both call sites.
3. **Wordle — colors erased**: `render()` reset `cell.className` for every row, wiping the green/yellow/grey feedback that `submit()` had applied via delayed timers. Fixed by skipping evaluated rows in `render()`.
4. **Pac-Man — instant death**: ghosts spawned next to the player with no delay, causing a collision before the game began. Added a spawn/revive cooldown to ghosts. *(Note: the root cause was the `progress === 0` bug — see Round 2 #2.)*
5. **Bubble Shooter — unfair game over**: shooting into a crowded cluster returned no snap cell and ended the game. `snapCell` now widens its search before giving up. *(Note: the real "every shot game-overs" bug was the fake-row snap — see Round 2 #1.)*
6. **Doodle Jump — falling through platforms**: the landing check tested only the current frame's position, so large frame steps skipped the 12px landing window. Replaced with crossing detection (previous vs current feet).
7. **Doodle Jump — unwinnable start**: platforms were random, so the player's column could have no reachable platform. Added a guaranteed platform directly under the player at start.

## Notes / Known behaviors

- All game pages use **absolute asset paths** (`/css/...`, `/js/common.js`), so the site must be served over HTTP (local `python3 -m http.server` or CF Pages). Opening `index.html` directly via `file://` will not load shared assets — this is expected and resolved by deployment.
- Web Audio (Simon Says) requires a user gesture on some browsers; game works without sound if audio is blocked.
- Gomoku AI on Medium/Hard blocks wins and takes winning moves; Easy plays with center preference.
- Dots & Boxes AI on Hard avoids giving away easy two-edge boxes.
- Confetti, modal pop-in, and floating lobby decorations are pure CSS/JS animations — no external assets required.
- Visual/hands-on results above come from the recorded Round 1–2 Chrome/Playwright runs. Round 3 independently added source review, HTTP route checks, syntax checks, and deterministic gameplay regressions.

## Deployment readiness

- Zero build step, no package.json needed. Files are at repo root.
- GitHub Actions runs catalog/page verification, all gameplay regressions, and JavaScript syntax checks on every push and pull request.
- CF Pages: Framework preset `None`, empty build command, empty output directory.
- Verified static assets referenced correctly for root-relative hosting.
