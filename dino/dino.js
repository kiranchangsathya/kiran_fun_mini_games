// ─────────────────────────────────────────────────────────────────────────────
// dino.js  –  Dino Run game
// Controls: Space / ArrowUp / JUMP button → jump
// Sections: 1.Constants  2.DOM  3.State  4.Init  5.Input
//           6.GameLoop   7.Physics  8.Cacti  9.Collision
//           10.Render   11.Score  12.Overlay  13.Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Constants & configuration ─────────────────────────────────────────────
const CANVAS_W  = 900;
const CANVAS_H  = 260;
const GROUND_Y  = 200;
const DINO_W    = 44;
const DINO_H    = 52;
const DINO_X    = 80;
const GRAVITY        = 0.6;
const JUMP_VELOCITY  = -13;
const SPEEDS           = [5, 7, 9.5, 12.5, 16];
const POINTS_PER_LEVEL = 200;
const SPAWN_GAP_MIN = 350;
const SPAWN_GAP_MAX = 700;
const CACTUS_W      = 28;
const CACTUS_H_MIN  = 40;
const CACTUS_H_MAX  = 70;
const CLR_SKY        = "#0f172a";
const CLR_GROUND     = "#334155";
const CLR_GROUND_TOP = "#4ade80";
const CLR_DINO_BODY  = "#4ade80";
const CLR_DINO_EYE   = "#0f172a";
const CLR_CACTUS     = "#22c55e";
const CLR_CACTUS_DRK = "#15803d";

// ── 2. DOM references ─────────────────────────────────────────────────────────
const canvas       = document.getElementById("gameCanvas");
const ctx          = canvas.getContext("2d");
const scoreEl      = document.getElementById("scoreEl");
const hiScoreEl    = document.getElementById("hiScoreEl");
const speedBadge   = document.getElementById("speedBadge");
const overlay      = document.getElementById("overlay");
const overlayEmoji = document.getElementById("overlayEmoji");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySubt  = document.getElementById("overlaySubtitle");
const overlayFinal = document.getElementById("overlayFinal");
const btnStart     = document.getElementById("btnStart");
const btnJump      = document.getElementById("btnJump");

// ── 3. Game state ─────────────────────────────────────────────────────────────
let dinoY, velY, onGround, legFrame, legTimer;
let cacti, distToNextSpawn, scrolledPx;
let score, level, speed;
let hiScore     = 0;
let gameRunning = false;
let rafHandle;

// ── 4. Initialisation & reset ─────────────────────────────────────────────────
function initGame() {
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;

  dinoY    = GROUND_Y - DINO_H;
  velY     = 0;
  onGround = true;
  legFrame = 0;
  legTimer = 0;

  cacti           = [];
  scrolledPx      = 0;
  distToNextSpawn = randomSpawnGap();

  score       = 0;
  level       = 0;
  speed       = SPEEDS[0];
  gameRunning = true;

  updateScoreEl();
  updateSpeedBadge();
  hideOverlay();

  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(gameLoop);
}

// ── 5. Input handling ─────────────────────────────────────────────────────────
function tryJump() {
  if (!gameRunning || !onGround) return;
  velY     = JUMP_VELOCITY;
  onGround = false;
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.key === " " || e.key === "ArrowUp") {
    e.preventDefault();
    tryJump();
  }
});

btnJump.addEventListener("click", tryJump);
btnJump.addEventListener("touchstart", (e) => { e.preventDefault(); tryJump(); }, { passive: false });

// ── 6. Game loop ──────────────────────────────────────────────────────────────
function gameLoop() {
  if (!gameRunning) return;
  updatePhysics();
  updateCacti();
  updateScore();
  if (checkCollision()) { endGame(); return; }
  render();
  rafHandle = requestAnimationFrame(gameLoop);
}

// ── 7. Physics helpers ────────────────────────────────────────────────────────
function updatePhysics() {
  velY  += GRAVITY;
  dinoY += velY;
  const groundTop = GROUND_Y - DINO_H;
  if (dinoY >= groundTop) {
    dinoY    = groundTop;
    velY     = 0;
    onGround = true;
  }
  if (onGround) {
    legTimer++;
    if (legTimer >= 8) { legFrame = 1 - legFrame; legTimer = 0; }
  }
}

// ── 8. Cactus helpers ─────────────────────────────────────────────────────────
function updateCacti() {
  for (const c of cacti) c.x -= speed;
  cacti = cacti.filter((c) => c.x + c.w > 0);
  scrolledPx      += speed;
  distToNextSpawn -= speed;
  if (distToNextSpawn <= 0) {
    spawnCactus();
    distToNextSpawn = randomSpawnGap();
  }
}

function spawnCactus() {
  const h = CACTUS_H_MIN + Math.random() * (CACTUS_H_MAX - CACTUS_H_MIN);
  cacti.push({ x: CANVAS_W + 20, w: CACTUS_W, h });
}

function randomSpawnGap() {
  const factor = 1 - (level / (SPEEDS.length - 1)) * 0.35;
  return (SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN)) * factor;
}

// ── 9. Collision detection ────────────────────────────────────────────────────
const FORGIVE = 8;
function checkCollision() {
  const dLeft  = DINO_X + FORGIVE;
  const dRight = DINO_X + DINO_W - FORGIVE;
  const dTop   = dinoY  + FORGIVE;
  const dBot   = dinoY  + DINO_H - FORGIVE;
  for (const c of cacti) {
    const cLeft  = c.x + FORGIVE;
    const cRight = c.x + c.w - FORGIVE;
    const cTop   = GROUND_Y - c.h;
    if (dRight > cLeft && dLeft < cRight && dBot > cTop) return true;
  }
  return false;
}

// ── 10. Rendering ─────────────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = CLR_SKY;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawGround();
  cacti.forEach(drawCactus);
  drawDino();
}

function drawGround() {
  ctx.fillStyle = CLR_GROUND;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
  ctx.fillStyle = CLR_GROUND_TOP;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 3);
}

function drawDino() {
  const x = DINO_X, y = dinoY, w = DINO_W, h = DINO_H;
  ctx.fillStyle = CLR_DINO_BODY;
  // Body
  ctx.beginPath(); ctx.roundRect(x, y + 10, w, h - 18, 8); ctx.fill();
  // Head
  ctx.beginPath(); ctx.roundRect(x + w - 16, y, 22, 20, 6); ctx.fill();
  // Eye
  ctx.fillStyle = CLR_DINO_EYE;
  ctx.beginPath(); ctx.arc(x + w + 2, y + 6, 4, 0, Math.PI * 2); ctx.fill();
  // Legs
  ctx.fillStyle = CLR_DINO_BODY;
  if (onGround) {
    const fY = legFrame === 0 ? h - 6  : h - 12;
    const bY = legFrame === 0 ? h - 12 : h - 6;
    ctx.fillRect(x + w - 14, y + fY, 10, legFrame === 0 ? 12 : 18);
    ctx.fillRect(x + 4,      y + bY, 10, legFrame === 0 ? 18 : 12);
  } else {
    ctx.fillRect(x + w - 14, y + h - 10, 10, 10);
    ctx.fillRect(x + 4,      y + h - 10, 10, 10);
  }
  // Tail
  ctx.beginPath();
  ctx.moveTo(x, y + 16); ctx.lineTo(x - 14, y + 22); ctx.lineTo(x, y + 28);
  ctx.closePath(); ctx.fill();
}

function drawCactus(c) {
  const { x, w: stem, h } = c;
  const armH = Math.floor(h * 0.45);
  const armW = 10;
  ctx.fillStyle = CLR_CACTUS;
  // Stem
  ctx.beginPath(); ctx.roundRect(x + stem / 2 - 5, GROUND_Y - h, 10, h, 4); ctx.fill();
  // Left arm
  ctx.beginPath(); ctx.roundRect(x, GROUND_Y - h + 14, armW, armH, 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x, GROUND_Y - h + 14, armW + stem / 2 - 5, 10, 3); ctx.fill();
  // Right arm
  ctx.beginPath(); ctx.roundRect(x + stem - armW, GROUND_Y - h + 22, armW, armH - 8, 4); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x + stem / 2 + 5, GROUND_Y - h + 22, stem - armW, 10, 3); ctx.fill();
  // Dark stripe
  ctx.fillStyle = CLR_CACTUS_DRK;
  ctx.fillRect(x + stem / 2 - 2, GROUND_Y - h + 4, 4, h - 4);
}

// ── 11. Score & level helpers ─────────────────────────────────────────────────
function updateScore() {
  score = Math.floor(scrolledPx / 10);
  const newLevel = Math.min(Math.floor(score / POINTS_PER_LEVEL), SPEEDS.length - 1);
  if (newLevel !== level) {
    level = newLevel;
    speed = SPEEDS[level];
    updateSpeedBadge();
  }
  updateScoreEl();
}
function updateScoreEl()   { scoreEl.textContent = score; }
function updateSpeedBadge() {
  const lv = level + 1;
  speedBadge.textContent = `Lv. ${lv}`;
  speedBadge.className   = `speed-badge${lv > 1 ? ` lv${lv}` : ""}`;
}

// ── 12. Overlay / UI helpers ──────────────────────────────────────────────────
function hideOverlay() { overlay.classList.add("hidden"); }
function showOverlay() { overlay.classList.remove("hidden"); }

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(rafHandle);
  if (score > hiScore) { hiScore = score; hiScoreEl.textContent = hiScore; }
  render();
  overlayEmoji.textContent = "💀";
  overlayTitle.textContent = "Game Over";
  overlaySubt.textContent  = "You hit a cactus!";
  overlayFinal.textContent = `Score: ${score}  ·  Best: ${hiScore}`;
  overlayFinal.classList.remove("hidden");
  btnStart.textContent = "Play Again";
  showOverlay();
}

// ── 13. Bootstrap ─────────────────────────────────────────────────────────────
btnStart.addEventListener("click", initGame);
overlayEmoji.textContent = "🦕";
overlayTitle.textContent = "Dino Run";
overlaySubt.textContent  = "Jump over the cacti!";
overlayFinal.classList.add("hidden");
btnStart.textContent     = "Start Game";
