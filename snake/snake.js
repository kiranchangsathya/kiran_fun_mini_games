// ─────────────────────────────────────────────────────────────────────────────
// snake.js  –  Snake game  (solo or two-player)
//
// Player 1: Arrow keys  →  green snake  (starts left,  moves right)
// Player 2: W A S D     →  blue snake   (starts right, moves left)
//
// Rules:
//   • Snakes move simultaneously at an interval that starts slow and
//     speeds up by one level for every 10 food eaten (combined total).
//   • Only one food on the board at a time.
//   • You lose if you hit a wall, your own body, or the other snake.
//   • Head-on collision (both heads meet) → draw (duo mode only).
//
// Sections:
//   1. Constants & configuration
//   2. DOM references
//   3. Game state
//   4. Initialisation & reset
//   5. Input handling
//   6. Game loop
//   7. Collision helpers
//   8. Food helpers
//   9. Rendering
//  10. Overlay / UI helpers
//  11. Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Constants & configuration ─────────────────────────────────────────────

const COLS        = 20;           // grid columns
const ROWS        = 20;           // grid rows
const CELL        = 40;           // px per grid cell
const CANVAS_SIZE = COLS * CELL;  // canvas is square

// Speed levels — tick interval in ms, one entry per level.
// Level increases by 1 for every 10 food eaten (combined total).
// Lower number = faster snake.
const SPEEDS = [220, 170, 130, 100, 75];

// The four possible movement directions as {x, y} grid offsets
const UP    = { x:  0, y: -1 };
const DOWN  = { x:  0, y:  1 };
const LEFT  = { x: -1, y:  0 };
const RIGHT = { x:  1, y:  0 };

// Key-to-direction maps — one per player
const KEYS_P1 = {
  ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
};
const KEYS_P2 = {
  w: UP, W: UP,
  s: DOWN, S: DOWN,
  a: LEFT, A: LEFT,
  d: RIGHT, D: RIGHT,
};

// Shared rainbow palette — used by P1 picker, P2 picker, and food picker
const PALETTES = [
  { label: "Red",    head: "#f87171", body: "#ef4444", border: "#b91c1c" },
  { label: "Orange", head: "#fb923c", body: "#f97316", border: "#c2410c" },
  { label: "Yellow", head: "#fde047", body: "#facc15", border: "#a16207" },
  { label: "Green",  head: "#4ade80", body: "#22c55e", border: "#15803d" },
  { label: "Cyan",   head: "#67e8f9", body: "#22d3ee", border: "#0e7490" },
  { label: "Blue",   head: "#93c5fd", body: "#60a5fa", border: "#1d4ed8" },
  { label: "Purple", head: "#c084fc", body: "#a855f7", border: "#7e22ce" },
  { label: "Pink",   head: "#f9a8d4", body: "#f472b6", border: "#be185d" },
];

// Board / grid colours (static)
const COLOR_BOARD = "#1e293b";
const COLOR_GRID  = "#263548";

// ── 2. DOM references ─────────────────────────────────────────────────────────

const canvas           = document.getElementById("gameCanvas");
const ctx              = canvas.getContext("2d");
const score1El         = document.getElementById("score1");
const score2El         = document.getElementById("score2");
const wins1El          = document.getElementById("wins1");
const wins2El          = document.getElementById("wins2");
const label1El         = document.getElementById("label1");
const label2El         = document.getElementById("label2");
const p2ScoreBoxEl     = document.getElementById("p2ScoreBox");
const scoreDividerEl   = document.getElementById("scoreDivider");
const speedBadgeEl     = document.getElementById("speedBadge");
const nameP1El         = document.getElementById("nameP1");
const nameP2El         = document.getElementById("nameP2");
const p2NameFieldEl    = document.getElementById("p2NameField");
const modeSoloBtn      = document.getElementById("modeSolo");
const modeDuoBtn       = document.getElementById("modeDuo");
const colorSwatchesP1El  = document.getElementById("colorSwatchesP1");
const colorSwatchesP2El  = document.getElementById("colorSwatchesP2");
const colorSwatchesFoodEl = document.getElementById("colorSwatchesFood");
const p2ColorPickerEl    = document.getElementById("p2ColorPicker");
const overlay          = document.getElementById("overlay");
const overlayEmoji     = document.getElementById("overlayEmoji");
const overlayTitle     = document.getElementById("overlayTitle");
const overlaySubt      = document.getElementById("overlaySubtitle");
const overlayFinal     = document.getElementById("overlayFinalScore");
const btnRestart       = document.getElementById("btnRestart");
const pauseOverlayEl   = document.getElementById("pauseOverlay");
const btnPauseEl       = document.getElementById("btnPause");
const dpadP2El         = document.getElementById("dpadP2");

// D-pad buttons — P1 (arrow keys equivalent)
const p1DpadUp    = document.getElementById("p1DpadUp");
const p1DpadDown  = document.getElementById("p1DpadDown");
const p1DpadLeft  = document.getElementById("p1DpadLeft");
const p1DpadRight = document.getElementById("p1DpadRight");

// D-pad buttons — P2 (WASD equivalent)
const p2DpadUp    = document.getElementById("p2DpadUp");
const p2DpadDown  = document.getElementById("p2DpadDown");
const p2DpadLeft  = document.getElementById("p2DpadLeft");
const p2DpadRight = document.getElementById("p2DpadRight");

// ── 3. Game state ─────────────────────────────────────────────────────────────

// `players` is an array of 1 or 2 player objects. Each has:
//   name    — display name string
//   snake   — [{x, y}, …]  segments; index 0 is the head
//   dir     — current movement direction {x, y}
//   nextDir — direction buffered from keyboard (applied next tick)
//   score   — integer score
//   keyMap  — key string → direction object
//   color   — { head, body, border } colour strings
let players;

let food;           // {x, y} — shared food position
let loopTimer;      // setInterval handle
let gameMode;       // "solo" | "duo"  — set by the mode toggle
let totalFoodEaten; // combined food count this game — drives speed level
let currentTickMs;  // active tick interval in ms
let paused      = false; // true while the game is paused
let gameRunning = false; // true only during active play (not start/game-over)

// Leaderboard: { playerName → winCount }
// Persists across games for the lifetime of the page session.
const leaderboard = {};

// Selected palette indices — default: P1=green(3), P2=blue(5), food=red(0)
let p1PaletteIndex   = 3;
let p2PaletteIndex   = 5;
let foodPaletteIndex = 0;

// ── 4. Initialisation & reset ─────────────────────────────────────────────────

/** Set up players (1 or 2 depending on mode) and start a fresh game. */
function initGame() {
  canvas.width  = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  // Reset speed and pause state
  totalFoodEaten = 0;
  currentTickMs  = SPEEDS[0];
  paused         = false;
  gameRunning    = true;
  updateSpeedBadge();
  pauseOverlayEl.classList.add("hidden");
  btnPauseEl.disabled    = false;
  btnPauseEl.textContent = "⏸";

  // Vertical centre row; players start on opposite sides facing each other
  const midY = Math.floor(ROWS / 2);
  const p1x  = 4;        // P1 head column (left side)
  const p2x  = COLS - 5; // P2 head column (right side)

  // Read names from the overlay inputs; fall back to defaults if blank
  const name1 = nameP1El.value.trim() || "Player 1";
  const name2 = nameP2El.value.trim() || "Player 2";
  nameP1El.value = name1;
  nameP2El.value = name2;

  // P1 is always present; colour comes from the selected palette
  players = [
    {
      name:    name1,
      snake:   [{ x: p1x, y: midY }, { x: p1x - 1, y: midY }, { x: p1x - 2, y: midY }],
      dir:     RIGHT,
      nextDir: RIGHT,
      score:   0,
      keyMap:  KEYS_P1,
      color:   PALETTES[p1PaletteIndex],
    },
  ];

  // P2 is added only in duo mode; colour comes from P2's selected palette
  if (gameMode === "duo") {
    players.push({
      name:    name2,
      snake:   [{ x: p2x, y: midY }, { x: p2x + 1, y: midY }, { x: p2x + 2, y: midY }],
      dir:     LEFT,
      nextDir: LEFT,
      score:   0,
      keyMap:  KEYS_P2,
      color:   PALETTES[p2PaletteIndex],
    });
  }

  // Reflect names in the header score-board labels
  label1El.textContent = name1;
  if (gameMode === "duo") label2El.textContent = name2;

  updateScoreDisplay();
  spawnFood();
  clearInterval(loopTimer);
  loopTimer = setInterval(gameTick, currentTickMs);
}

// ── 5. Input handling ─────────────────────────────────────────────────────────

/**
 * A single keydown listener handles both players plus the pause key.
 *   P / Escape → toggle pause (only during active play)
 *   Arrow / WASD → buffer movement direction (ignored while paused)
 */
document.addEventListener("keydown", (e) => {
  // ── Pause toggle ─────────────────────────────────────────────────
  if (e.key === "p" || e.key === "P" || e.key === "Escape") {
    if (gameRunning) {
      e.preventDefault();
      togglePause();
    }
    return;
  }

  // ── Movement (ignored while paused or game not running) ──────────
  if (!gameRunning || paused) return;

  for (const player of players) {
    const requested = player.keyMap[e.key];
    if (!requested) continue;

    e.preventDefault(); // stop arrow keys scrolling the page

    // Block 180° reversal into own body
    const isReversal =
      requested.x === -player.dir.x && requested.y === -player.dir.y;

    if (!isReversal) player.nextDir = requested;
  }
});

/**
 * Apply a direction change for a player (used by on-screen D-pad buttons).
 * Mirrors the same 180° reversal guard as the keyboard handler.
 * @param {number}              playerIndex - 0 for P1, 1 for P2
 * @param {{x:number,y:number}} direction   - one of UP / DOWN / LEFT / RIGHT
 */
function requestDirection(playerIndex, direction) {
  if (!gameRunning || paused) return;
  const player = players[playerIndex];
  if (!player) return;
  const isReversal = direction.x === -player.dir.x && direction.y === -player.dir.y;
  if (!isReversal) player.nextDir = direction;
}

/** Attach both click and touchstart to a D-pad button (prevents 300 ms delay). */
function bindDpadBtn(btn, playerIndex, direction) {
  btn.addEventListener("click", () => requestDirection(playerIndex, direction));
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault(); // prevent ghost click & scrolling
    requestDirection(playerIndex, direction);
  }, { passive: false });
}

// Wire up all eight D-pad buttons
bindDpadBtn(p1DpadUp,    0, UP);
bindDpadBtn(p1DpadDown,  0, DOWN);
bindDpadBtn(p1DpadLeft,  0, LEFT);
bindDpadBtn(p1DpadRight, 0, RIGHT);
bindDpadBtn(p2DpadUp,    1, UP);
bindDpadBtn(p2DpadDown,  1, DOWN);
bindDpadBtn(p2DpadLeft,  1, LEFT);
bindDpadBtn(p2DpadRight, 1, RIGHT);

// ── 6. Game loop ──────────────────────────────────────────────────────────────

/** Called on every tick. Moves all active snakes simultaneously. */
function gameTick() {
  // 1. Commit each player's buffered direction
  for (const p of players) p.dir = p.nextDir;

  // 2. Calculate the next head position for each player
  const newHeads = players.map((p) => ({
    x: p.snake[0].x + p.dir.x,
    y: p.snake[0].y + p.dir.y,
  }));

  // 3. Detect which players have crashed this tick
  //    (array length matches players array — works for 1 or 2 players)
  const dead = players.map(() => false);

  // Wall collision
  players.forEach((_, i) => {
    if (hitsWall(newHeads[i])) dead[i] = true;
  });

  // Self collision (new head lands on own body)
  players.forEach((p, i) => {
    if (!dead[i] && p.snake.some((s) => s.x === newHeads[i].x && s.y === newHeads[i].y)) {
      dead[i] = true;
    }
  });

  // Duo-only checks — skip entirely in solo mode to avoid index errors
  if (gameMode === "duo") {
    // Head-on collision — both heads land on the same cell → both die
    if (!dead[0] && !dead[1] &&
        newHeads[0].x === newHeads[1].x && newHeads[0].y === newHeads[1].y) {
      dead[0] = dead[1] = true;
    }

    // Cross collision — head enters the OTHER player's body
    players.forEach((_, i) => {
      const other = players[1 - i];
      if (!dead[i] && other.snake.some((s) => s.x === newHeads[i].x && s.y === newHeads[i].y)) {
        dead[i] = true;
      }
    });
  }

  // 4. If anyone died, stop the game
  if (dead.some(Boolean)) {
    endGame(dead);
    return;
  }

  // 5. Move all snakes
  players.forEach((p, i) => {
    p.snake.unshift(newHeads[i]);

    if (newHeads[i].x === food.x && newHeads[i].y === food.y) {
      // Food eaten — grow snake, increment score, update speed, respawn food
      p.score++;
      totalFoodEaten++;
      updateScoreDisplay();
      updateSpeed();
      spawnFood();
    } else {
      p.snake.pop(); // no food eaten — remove tail to keep length constant
    }
  });

  render();
}

// ── 7. Collision helpers ──────────────────────────────────────────────────────

/** Returns true when position {x,y} is outside the grid boundaries. */
function hitsWall({ x, y }) {
  return x < 0 || x >= COLS || y < 0 || y >= ROWS;
}

// ── 7b. Speed helpers ─────────────────────────────────────────────────────────

/**
 * Recalculate the speed level from `totalFoodEaten` and, if the level has
 * changed, restart the game interval at the new (faster) rate.
 *
 * Speed table (SPEEDS constant):
 *   Level 1  (0–9  food) : 220 ms  — slow start
 *   Level 2  (10–19 food): 170 ms
 *   Level 3  (20–29 food): 130 ms
 *   Level 4  (30–39 food): 100 ms
 *   Level 5  (40+  food) :  75 ms  — max speed
 */
function updateSpeed() {
  const level    = Math.min(Math.floor(totalFoodEaten / 10), SPEEDS.length - 1);
  const newTickMs = SPEEDS[level];

  if (newTickMs !== currentTickMs) {
    currentTickMs = newTickMs;
    clearInterval(loopTimer);
    loopTimer = setInterval(gameTick, currentTickMs);
  }

  updateSpeedBadge();
}

/** Update the Lv. badge in the header to reflect the current speed level. */
function updateSpeedBadge() {
  const level = Math.min(Math.floor(totalFoodEaten / 10), SPEEDS.length - 1) + 1;
  speedBadgeEl.textContent = `Lv. ${level}`;

  // Swap colour class so the badge visually brightens at higher levels
  speedBadgeEl.className = `speed-badge${level > 1 ? ` lv${level}` : ""}`;
}

// ── 8. Food helpers ───────────────────────────────────────────────────────────

/** Spawn food on a random cell not occupied by either snake. */
function spawnFood() {
  let candidate;
  do {
    candidate = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
    // Reject if any snake segment sits on this cell
  } while (players.some((p) => p.snake.some((s) => s.x === candidate.x && s.y === candidate.y)));
  food = candidate;
}

// ── 9. Rendering ──────────────────────────────────────────────────────────────

/** Master render — clears the canvas and draws board, food, and both snakes. */
function render() {
  drawBoard();
  drawFood();
  players.forEach(drawSnake);  // draw P1 then P2
}

/** Draw the dark board background with a subtle grid overlay. */
function drawBoard() {
  ctx.fillStyle = COLOR_BOARD;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth   = 0.5;

  for (let col = 0; col <= COLS; col++) {
    ctx.beginPath();
    ctx.moveTo(col * CELL, 0);
    ctx.lineTo(col * CELL, CANVAS_SIZE);
    ctx.stroke();
  }
  for (let row = 0; row <= ROWS; row++) {
    ctx.beginPath();
    ctx.moveTo(0,           row * CELL);
    ctx.lineTo(CANVAS_SIZE, row * CELL);
    ctx.stroke();
  }
}

/**
 * Draw one player's snake as a smooth, continuous stroked path.
 *
 * Technique:
 *   • Trace a path through the centre of every segment, tail → head.
 *   • Stroke with lineWidth ≈ cell size + round joins + round caps.
 *   • Overlay a brighter filled circle for the head.
 *
 * @param {object} player - the player object (snake, color, …)
 */
function drawSnake(player) {
  const { snake, color } = player;
  const half      = CELL / 2;
  const thickness = CELL - 2;  // 1 px gap from cell edges

  ctx.save();
  ctx.lineWidth   = thickness;
  ctx.lineJoin    = "round";   // smooth bends when the snake turns
  ctx.lineCap     = "round";   // smooth rounded tail tip
  ctx.strokeStyle = color.body;

  ctx.beginPath();
  for (let i = snake.length - 1; i >= 0; i--) {
    const cx = snake[i].x * CELL + half;
    const cy = snake[i].y * CELL + half;
    i === snake.length - 1 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Head — brighter accent circle painted on top of the body path
  const { x: hx, y: hy } = snake[0];
  ctx.fillStyle = color.head;
  ctx.beginPath();
  ctx.arc(hx * CELL + half, hy * CELL + half, thickness / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Eyes — drawn last so they sit on top of everything
  drawEyes(snake[0], player.dir);
}

/**
 * Draw two directional eyes on a snake's head.
 * Eyes face the direction of movement and have a white sclera + dark pupil.
 *
 * @param {{x:number, y:number}} head - grid position of the head segment
 * @param {{x:number, y:number}} dir  - current movement direction unit vector
 */
function drawEyes(head, dir) {
  const half    = CELL / 2;
  const cx      = head.x * CELL + half;   // canvas-pixel centre of head
  const cy      = head.y * CELL + half;

  const eyeR    = CELL * 0.10;  // white-of-eye radius
  const pupilR  = CELL * 0.055; // pupil radius
  const fwd     = CELL * 0.18;  // eye offset along movement direction
  const lat     = CELL * 0.20;  // eye offset perpendicular to movement

  // Perpendicular direction (rotate dir 90°)
  const px = -dir.y;
  const py =  dir.x;

  // Two eye positions: one on each side of the movement axis
  const eyes = [
    { x: cx + dir.x * fwd + px * lat, y: cy + dir.y * fwd + py * lat },
    { x: cx + dir.x * fwd - px * lat, y: cy + dir.y * fwd - py * lat },
  ];

  ctx.save();
  for (const eye of eyes) {
    // White sclera
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupil — shifted slightly forward so it "looks" ahead
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(
      eye.x + dir.x * pupilR * 0.5,
      eye.y + dir.y * pupilR * 0.5,
      pupilR, 0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

/** Draw the shared food as a crisp filled circle using the chosen food palette. */
function drawFood() {
  const half    = CELL / 2;
  const cx      = food.x * CELL + half;
  const cy      = food.y * CELL + half;
  const r       = half - 3;
  const palette = PALETTES[foodPaletteIndex];

  ctx.save();
  ctx.fillStyle   = palette.body;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ── 10. Overlay / UI helpers ──────────────────────────────────────────────────

/** Refresh score counter(s) in the header. P2 is skipped in solo mode. */
function updateScoreDisplay() {
  score1El.textContent = players[0].score;
  if (gameMode === "duo") score2El.textContent = players[1].score;
}

/**
 * Show the semi-transparent overlay with customisable content.
 * @param {object} opts
 * @param {string}      opts.emoji       - large emoji icon
 * @param {string}      opts.title       - main heading
 * @param {string}      opts.subtitle    - secondary line
 * @param {string|null} opts.finalScore  - score summary, or null to hide it
 * @param {string}      opts.buttonLabel - label on the action button
 */
function showOverlay({ emoji, title, subtitle, finalScore, buttonLabel }) {
  overlayEmoji.textContent = emoji;
  overlayTitle.textContent = title;
  overlaySubt.textContent  = subtitle;
  btnRestart.textContent   = buttonLabel;

  if (finalScore !== null) {
    overlayFinal.textContent = finalScore;
    overlayFinal.classList.remove("hidden");
  } else {
    overlayFinal.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
}

/** Hide the overlay so the canvas is fully visible during play. */
function hideOverlay() {
  overlay.classList.add("hidden");
}

/**
 * Stop the game loop, render the final state, and show the result screen.
 * Handles both solo (1 player) and duo (2 player) outcomes.
 * @param {boolean[]} dead - which players crashed this tick
 */
function endGame(dead) {
  clearInterval(loopTimer);
  gameRunning            = false;
  paused                 = false;
  btnPauseEl.disabled    = true;
  btnPauseEl.textContent = "⏸";
  pauseOverlayEl.classList.add("hidden");
  render(); // freeze the board at the moment of the crash

  let emoji, title, subtitle, finalScore;
  const p1 = players[0];

  if (gameMode === "solo") {
    emoji      = "💀";
    title      = "Game Over";
    subtitle   = `${p1.name}'s snake crashed`;
    finalScore = `${p1.name}: ${p1.score}`;
  } else {
    const p2 = players[1];

    if (dead[0] && dead[1]) {
      emoji    = "🤝";
      title    = "It's a Draw!";
      subtitle = "Both snakes crashed simultaneously";
    } else if (dead[0]) {
      emoji    = "🏆";
      title    = `${p2.name} Wins!`;
      subtitle = `${p1.name}'s snake crashed`;
      recordWin(p2.name);
    } else {
      emoji    = "🏆";
      title    = `${p1.name} Wins!`;
      subtitle = `${p2.name}'s snake crashed`;
      recordWin(p1.name);
    }

    finalScore = `${p1.name}: ${p1.score}  ·  ${p2.name}: ${p2.score}`;
  }

  showOverlay({ emoji, title, subtitle, finalScore, buttonLabel: "Play Again" });
}

/**
 * Switch between "solo" and "duo" mode.
 * Updates button styles and shows/hides all P2-specific UI elements.
 * @param {"solo"|"duo"} mode
 */
function setMode(mode) {
  gameMode = mode;
  const isDuo = mode === "duo";

  // Segmented control — highlight the active button
  modeSoloBtn.classList.toggle("active", !isDuo);
  modeDuoBtn.classList.toggle("active",  isDuo);

  // Show or hide P2-specific elements
  p2NameFieldEl.classList.toggle("hidden",    !isDuo);
  p2ScoreBoxEl.classList.toggle("hidden",     !isDuo);
  scoreDividerEl.classList.toggle("hidden",   !isDuo);
  p2ColorPickerEl.classList.toggle("hidden",  !isDuo);
  dpadP2El.classList.toggle("hidden",         !isDuo);

  // Wins badges only make sense in duo mode
  wins1El.classList.toggle("hidden", !isDuo);
  wins2El.classList.toggle("hidden", !isDuo);
}

// ── 11. New feature helpers ───────────────────────────────────────────────────

/**
 * Toggle the pause state during active play.
 * Stops / restarts the game interval and shows / hides the pause overlay.
 */
function togglePause() {
  if (!gameRunning) return;
  paused = !paused;

  if (paused) {
    clearInterval(loopTimer);
    pauseOverlayEl.classList.remove("hidden");
    btnPauseEl.textContent = "▶";
  } else {
    loopTimer = setInterval(gameTick, currentTickMs);
    pauseOverlayEl.classList.add("hidden");
    btnPauseEl.textContent = "⏸";
  }
}

/**
 * Increment the leaderboard win count for the given player name
 * and refresh the on-screen badges.
 * @param {string} name - the winning player's name
 */
function recordWin(name) {
  leaderboard[name] = (leaderboard[name] || 0) + 1;
  updateLeaderboardDisplay();
}

/** Refresh wins badges in the header from the leaderboard object. */
function updateLeaderboardDisplay() {
  if (!players || players.length === 0) return;
  const p1Wins = leaderboard[players[0].name] || 0;
  wins1El.textContent = `${p1Wins} ${p1Wins === 1 ? "win" : "wins"}`;

  if (gameMode === "duo" && players[1]) {
    const p2Wins = leaderboard[players[1].name] || 0;
    wins2El.textContent = `${p2Wins} ${p2Wins === 1 ? "win" : "wins"}`;
  }
}

/** Update P1's palette choice and refresh the P1 swatch UI. */
function selectP1Color(index) {
  p1PaletteIndex = index;
  refreshSwatches(colorSwatchesP1El, index);
}

/** Update P2's palette choice and refresh the P2 swatch UI. */
function selectP2Color(index) {
  p2PaletteIndex = index;
  refreshSwatches(colorSwatchesP2El, index);
}

/** Update the food palette choice and refresh the food swatch UI. */
function selectFoodColor(index) {
  foodPaletteIndex = index;
  refreshSwatches(colorSwatchesFoodEl, index);
}

/**
 * Mark the swatch at `selectedIndex` as active inside a container element.
 * @param {HTMLElement} container - the `.color-swatches` div
 * @param {number}      selectedIndex
 */
function refreshSwatches(container, selectedIndex) {
  container.querySelectorAll(".color-swatch").forEach((el, i) => {
    el.classList.toggle("selected", i === selectedIndex);
  });
}

/**
 * Build all three colour-swatch rows (P1 snake, P2 snake, food)
 * and wire their click handlers.
 */
function initColorPicker() {
  /** Helper: append swatches to a container and bind a selection callback. */
  function buildRow(container, defaultIndex, onSelect) {
    PALETTES.forEach((palette, i) => {
      const btn = document.createElement("button");
      btn.className        = `color-swatch${i === defaultIndex ? " selected" : ""}`;
      btn.style.background = palette.body;
      btn.title            = palette.label;
      btn.addEventListener("click", () => onSelect(i));
      container.appendChild(btn);
    });
  }

  buildRow(colorSwatchesP1El,   p1PaletteIndex,   selectP1Color);
  buildRow(colorSwatchesP2El,   p2PaletteIndex,   selectP2Color);
  buildRow(colorSwatchesFoodEl, foodPaletteIndex, selectFoodColor);
}

// ── 12. Bootstrap ─────────────────────────────────────────────────────────────

// Mode toggle
modeSoloBtn.addEventListener("click", () => setMode("solo"));
modeDuoBtn.addEventListener("click",  () => setMode("duo"));

// Start / Play Again button
btnRestart.addEventListener("click", () => {
  hideOverlay();
  initGame();
});

// Pause button in header
btnPauseEl.addEventListener("click", togglePause);

// Clicking the pause overlay also resumes (intuitive for mouse users)
pauseOverlayEl.addEventListener("click", togglePause);

// Build colour swatches
initColorPicker();

// Start in solo mode and show the start screen
setMode("solo");
showOverlay({
  emoji:       "🐍",
  title:       "Snake",
  subtitle:    "",
  finalScore:  null,
  buttonLabel: "Start Game",
});
