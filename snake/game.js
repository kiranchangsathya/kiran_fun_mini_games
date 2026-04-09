/**
 * snake/game.js
 * Extends GameBase + uses InputManager.
 * Pure game logic only — all shared UI handled by GameBase.
 */
import { GameBase, STATE } from '../shared/GameBase.js';
import { InputManager }    from '../shared/InputManager.js';

// ── 1. Constants ──────────────────────────────────────────────────────────────
const COLS = 20, ROWS = 20, CELL = 40, CANVAS_SIZE = COLS * CELL;
const SPEEDS = [220, 170, 130, 100, 75]; // ms per tick, lower = faster

const UP    = { x:  0, y: -1 };
const DOWN  = { x:  0, y:  1 };
const LEFT  = { x: -1, y:  0 };
const RIGHT = { x:  1, y:  0 };

const PALETTES = [
  { label: 'Red',    head: '#f87171', body: '#ef4444', border: '#b91c1c' },
  { label: 'Orange', head: '#fb923c', body: '#f97316', border: '#c2410c' },
  { label: 'Yellow', head: '#fde047', body: '#facc15', border: '#a16207' },
  { label: 'Green',  head: '#4ade80', body: '#22c55e', border: '#15803d' },
  { label: 'Cyan',   head: '#67e8f9', body: '#22d3ee', border: '#0e7490' },
  { label: 'Blue',   head: '#93c5fd', body: '#60a5fa', border: '#1d4ed8' },
  { label: 'Purple', head: '#c084fc', body: '#a855f7', border: '#7e22ce' },
  { label: 'Pink',   head: '#f9a8d4', body: '#f472b6', border: '#be185d' },
];

const COLOR_BOARD = '#1e293b';
const COLOR_GRID  = '#263548';

// ── 2. Helpers ────────────────────────────────────────────────────────────────
/** Collect all DOM element references into one plain object. */
function getRefs() {
  const g = (id) => document.getElementById(id);
  return {
    canvas:          g('gameCanvas'),
    overlay:         g('overlay'),
    overlayEmoji:    g('overlayEmoji'),
    overlayTitle:    g('overlayTitle'),
    overlaySubtitle: g('overlaySubtitle'),
    overlayFinal:    g('overlayFinal'),
    btnStart:        g('btnStart'),
    speedBadge:      g('speedBadge'),
    btnPause:        g('btnPause'),
    pauseOverlay:    g('pauseOverlay'),
    score1El:        g('score1'),
    score2El:        g('score2'),
    lives1El:        g('lives1'),
    lives2El:        g('lives2'),
    wins1El:         g('wins1'),
    wins2El:         g('wins2'),
    label1El:        g('label1'),
    label2El:        g('label2'),
    p2ScoreBox:      g('p2ScoreBox'),
    scoreDivider:    g('scoreDivider'),
    nameP1:          g('nameP1'),
    nameP2:          g('nameP2'),
    p2NameField:     g('p2NameField'),
    modeSoloBtn:     g('modeSolo'),
    modeDuoBtn:      g('modeDuo'),
    swatchesP1:      g('colorSwatchesP1'),
    swatchesP2:      g('colorSwatchesP2'),
    swatchesFood:    g('colorSwatchesFood'),
    p2ColorPicker:   g('p2ColorPicker'),
    dpadP2:          g('dpadP2'),
    p1DpadUp:        g('p1DpadUp'),
    p1DpadDown:      g('p1DpadDown'),
    p1DpadLeft:      g('p1DpadLeft'),
    p1DpadRight:     g('p1DpadRight'),
    p2DpadUp:        g('p2DpadUp'),
    p2DpadDown:      g('p2DpadDown'),
    p2DpadLeft:      g('p2DpadLeft'),
    p2DpadRight:     g('p2DpadRight'),
  };
}

// ── 3. SnakeGame class ────────────────────────────────────────────────────────
class SnakeGame extends GameBase {
  constructor() {
    const r = getRefs();
    super({ canvas: r.canvas, els: r });
    this._r = r;

    // Snake-specific state
    this._gameMode       = 'solo';
    this._players        = null;
    this._food           = null;
    this._loopTimer      = null;
    this._currentTickMs  = SPEEDS[0];
    this._totalFoodEaten = 0;
    this._leaderboard    = {};
    this._p1Palette      = 3;   // green
    this._p2Palette      = 5;   // blue
    this._foodPalette    = 0;   // red

    this._input = new InputManager();
    this._setupInput();
    this._initModeToggle();
    this._initColorPicker();

    this.showOverlay({ emoji: '🐍', title: 'Snake', subtitle: '',
                       finalScore: null, buttonLabel: 'Start Game' });
  }

  // Snake uses setInterval not RAF — disable the base RAF loop
  _loop() {}

  // ── GameBase hooks ─────────────────────────────────────────────────────────
  onInit() {
    const r = this._r;
    this.canvas.width = this.canvas.height = CANVAS_SIZE;
    this._totalFoodEaten = 0;
    this._currentTickMs  = SPEEDS[0];
    this.updateSpeedBadge(0);

    const name1 = r.nameP1.value.trim() || 'Player 1';
    const name2 = r.nameP2.value.trim() || 'Player 2';
    r.nameP1.value = name1;
    r.nameP2.value = name2;

    const midY = Math.floor(ROWS / 2);
    const p1Spawn = {
      snake: [{ x: 4, y: midY }, { x: 3, y: midY }, { x: 2, y: midY }],
      dir: RIGHT,
    };
    this._players = [{
      name: name1, score: 0, lives: 3, grace: 0,
      color: PALETTES[this._p1Palette],
      spawn: p1Spawn,
      snake: p1Spawn.snake.map(s => ({ ...s })),
      dir: p1Spawn.dir, nextDir: p1Spawn.dir,
    }];
    if (this._gameMode === 'duo') {
      const p2x = COLS - 5;
      const p2Spawn = {
        snake: [{ x: p2x, y: midY }, { x: p2x+1, y: midY }, { x: p2x+2, y: midY }],
        dir: LEFT,
      };
      this._players.push({
        name: name2, score: 0, lives: 3, grace: 0,
        color: PALETTES[this._p2Palette],
        spawn: p2Spawn,
        snake: p2Spawn.snake.map(s => ({ ...s })),
        dir: p2Spawn.dir, nextDir: p2Spawn.dir,
      });
    }

    r.label1El.textContent = name1;
    if (this._gameMode === 'duo') r.label2El.textContent = name2;
    this._updateScoreDisplay();
    this._updateLivesDisplay();
    this._spawnFood();
  }

  onStart()  { this._restartInterval(); }
  onPause()  { clearInterval(this._loopTimer); }
  onResume() { this._restartInterval(); }

  onTick() {
    const players = this._players;
    for (const p of players) p.dir = p.nextDir;

    // Wrap-around: head leaving one edge reappears on the opposite side
    const heads = players.map(p => ({
      x: (p.snake[0].x + p.dir.x + COLS) % COLS,
      y: (p.snake[0].y + p.dir.y + ROWS) % ROWS,
    }));
    const dead = players.map(() => false);

    // Tick down post-death grace counters
    for (const p of players) if (p.grace > 0) p.grace--;

    // Self-collision (exclude the tail — it vacates its cell this same tick)
    players.forEach((p, i) => {
      if (p.grace > 0) return;                       // still in grace period
      const body = p.snake.slice(0, -1);
      if (body.some(s => s.x === heads[i].x && s.y === heads[i].y)) dead[i] = true;
    });

    if (this._gameMode === 'duo') {
      // Head-on collision (only when neither player is in grace)
      if (!dead[0] && !dead[1] &&
          players[0].grace === 0 && players[1].grace === 0 &&
          heads[0].x === heads[1].x && heads[0].y === heads[1].y)
        dead[0] = dead[1] = true;
      // Hit other player's body (exclude their tail too — it vacates this tick)
      players.forEach((_, i) => {
        if (players[i].grace > 0) return;            // still in grace period
        const other = players[1 - i];
        const otherBody = other.snake.slice(0, -1);
        if (!dead[i] && otherBody.some(s => s.x === heads[i].x && s.y === heads[i].y)) dead[i] = true;
      });
    }

    if (dead.some(Boolean)) {
      this._handleDeath(dead);
      if (this._state !== STATE.RUNNING) return;  // game ended — don't advance
    }

    // Advance living snakes only; dead snakes were already respawned to a safe position
    players.forEach((p, i) => {
      if (dead[i]) return;
      p.snake.unshift(heads[i]);
      if (heads[i].x === this._food.x && heads[i].y === this._food.y) {
        p.score++;
        this._totalFoodEaten++;
        this._updateScoreDisplay();
        this._updateSpeed();
        this._spawnFood();
      } else { p.snake.pop(); }
    });
  }

  onRender() {
    this._drawBoard();
    this._drawFood();
    this._players.forEach(p => this._drawSnake(p));
  }

  onEnd(result) {
    clearInterval(this._loopTimer);
    this.onRender();
    super.onEnd(result);
  }

  // ── Input setup ────────────────────────────────────────────────────────────
  _setupInput() {
    const r = this._r;
    this._input.register({
      p1_up: ['ArrowUp'], p1_down: ['ArrowDown'],
      p1_left: ['ArrowLeft'], p1_right: ['ArrowRight'],
      p2_up: ['w', 'W'], p2_down: ['s', 'S'],
      p2_left: ['a', 'A'], p2_right: ['d', 'D'],
    });
    this._input.on('p1_up',    () => this._dir(0, UP));
    this._input.on('p1_down',  () => this._dir(0, DOWN));
    this._input.on('p1_left',  () => this._dir(0, LEFT));
    this._input.on('p1_right', () => this._dir(0, RIGHT));
    this._input.on('p2_up',    () => this._dir(1, UP));
    this._input.on('p2_down',  () => this._dir(1, DOWN));
    this._input.on('p2_left',  () => this._dir(1, LEFT));
    this._input.on('p2_right', () => this._dir(1, RIGHT));

    // D-pad buttons
    this._input.bindButton(r.p1DpadUp,    'p1_up');
    this._input.bindButton(r.p1DpadDown,  'p1_down');
    this._input.bindButton(r.p1DpadLeft,  'p1_left');
    this._input.bindButton(r.p1DpadRight, 'p1_right');
    this._input.bindButton(r.p2DpadUp,    'p2_up');
    this._input.bindButton(r.p2DpadDown,  'p2_down');
    this._input.bindButton(r.p2DpadLeft,  'p2_left');
    this._input.bindButton(r.p2DpadRight, 'p2_right');
  }

  _dir(playerIndex, direction) {
    if (this._state !== STATE.RUNNING) return;
    const p = this._players?.[playerIndex];
    if (!p) return;
    if (direction.x !== -p.dir.x || direction.y !== -p.dir.y) p.nextDir = direction;
  }

  // ── Game logic helpers ─────────────────────────────────────────────────────
  _restartInterval() {
    clearInterval(this._loopTimer);
    this._loopTimer = setInterval(() => {
      if (this._state !== STATE.RUNNING) return;
      this.onTick();
      if (this._state !== STATE.RUNNING) return;
      this.onRender();
    }, this._currentTickMs);
  }

  _hitsWall({ x, y }) { return x < 0 || x >= COLS || y < 0 || y >= ROWS; }

  _updateSpeed() {
    const level     = Math.min(Math.floor(this._totalFoodEaten / 10), SPEEDS.length - 1);
    const newTickMs = SPEEDS[level];
    this.updateSpeedBadge(level);
    if (newTickMs !== this._currentTickMs) {
      this._currentTickMs = newTickMs;
      this._restartInterval();
    }
  }

  _spawnFood() {
    let c;
    do { c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
    while (this._players.some(p => p.snake.some(s => s.x === c.x && s.y === c.y)));
    this._food = c;
  }

  _handleDeath(dead) {
    const players = this._players;

    // Deduct a life, respawn at safe position, grant brief grace period
    dead.forEach((isDead, i) => {
      if (!isDead) return;
      const p = players[i];
      p.lives   = Math.max(0, p.lives - 1);
      // Respawn at the safe starting position so the snake is never stuck in the collision zone
      p.snake   = p.spawn.snake.map(s => ({ ...s }));
      p.dir     = p.spawn.dir;
      p.nextDir = p.spawn.dir;
      p.grace   = 3;                    // 3 ticks of invisible collision immunity
    });

    this._updateLivesDisplay();

    // Check whether any player has run out of lives
    const out = dead.map((isDead, i) => isDead && players[i].lives <= 0);
    if (!out.some(Boolean)) return;     // everyone still has lives — game continues

    const [p1, p2] = players;
    let result;
    if (this._gameMode === 'solo') {
      result = { emoji: '💀', title: 'Game Over',
                 subtitle: `${p1.name} ran out of lives!`,
                 finalScore: `Score: ${p1.score}`, buttonLabel: 'Play Again' };
    } else {
      if (out[0] && out[1]) {
        result = { emoji: '🤝', title: "It's a Draw!",
                   subtitle: 'Both players ran out of lives',
                   finalScore: `${p1.name}: ${p1.score}  ·  ${p2.name}: ${p2.score}`,
                   buttonLabel: 'Play Again' };
      } else {
        const winnerIdx = out[0] ? 1 : 0;
        const winner = players[winnerIdx];
        const loser  = players[1 - winnerIdx];
        this._recordWin(winner.name);
        result = { emoji: '🏆', title: `${winner.name} Wins!`,
                   subtitle: `${loser.name} ran out of lives`,
                   finalScore: `${p1.name}: ${p1.score}  ·  ${p2.name}: ${p2.score}`,
                   buttonLabel: 'Play Again' };
      }
    }
    this.end(result);
  }

  _updateLivesDisplay() {
    const r = this._r;
    const hearts = n => '❤️'.repeat(Math.max(0, n)) + '🖤'.repeat(Math.max(0, 3 - n));
    if (r.lives1El) r.lives1El.textContent = hearts(this._players[0].lives);
    if (r.lives2El && this._players[1]) r.lives2El.textContent = hearts(this._players[1].lives);
  }

  _recordWin(name) {
    this._leaderboard[name] = (this._leaderboard[name] || 0) + 1;
    const { wins1El, wins2El } = this._r;
    const p1w = this._leaderboard[this._players[0].name] || 0;
    wins1El.textContent = `${p1w} ${p1w === 1 ? 'win' : 'wins'}`;
    if (this._players[1]) {
      const p2w = this._leaderboard[this._players[1].name] || 0;
      wins2El.textContent = `${p2w} ${p2w === 1 ? 'win' : 'wins'}`;
    }
  }

  _updateScoreDisplay() {
    const r = this._r;
    r.score1El.textContent = this._players[0].score;
    if (this._gameMode === 'duo') r.score2El.textContent = this._players[1].score;
  }

  // ── Mode toggle ─────────────────────────────────────────────────────────────
  _initModeToggle() {
    const r = this._r;
    r.modeSoloBtn.addEventListener('click', () => this._setMode('solo'));
    r.modeDuoBtn.addEventListener('click',  () => this._setMode('duo'));
    this._setMode('solo');
  }

  _setMode(mode) {
    const r = this._r;
    this._gameMode = mode;
    const isDuo = mode === 'duo';
    r.modeSoloBtn.classList.toggle('active', !isDuo);
    r.modeDuoBtn.classList.toggle('active',  isDuo);
    r.p2NameField.classList.toggle('hidden',   !isDuo);
    r.p2ScoreBox.classList.toggle('hidden',    !isDuo);
    r.scoreDivider.classList.toggle('hidden',  !isDuo);
    r.p2ColorPicker.classList.toggle('hidden', !isDuo);
    r.dpadP2.classList.toggle('hidden',        !isDuo);
    r.wins1El.classList.toggle('hidden', !isDuo);
    r.wins2El.classList.toggle('hidden', !isDuo);
  }

  // ── Color picker ────────────────────────────────────────────────────────────
  _initColorPicker() {
    const r = this._r;
    const buildRow = (container, defaultIdx, onSelect) => {
      PALETTES.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className        = `color-swatch${i === defaultIdx ? ' selected' : ''}`;
        btn.style.background = p.body;
        btn.title            = p.label;
        btn.addEventListener('click', () => {
          onSelect(i);
          container.querySelectorAll('.color-swatch').forEach((el, j) =>
            el.classList.toggle('selected', j === i));
        });
        container.appendChild(btn);
      });
    };
    buildRow(r.swatchesP1,   this._p1Palette,   i => { this._p1Palette   = i; });
    buildRow(r.swatchesP2,   this._p2Palette,   i => { this._p2Palette   = i; });
    buildRow(r.swatchesFood, this._foodPalette, i => { this._foodPalette = i; });
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  _drawBoard() {
    const ctx = this.ctx;
    ctx.fillStyle = COLOR_BOARD;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, CANVAS_SIZE); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(CANVAS_SIZE, r * CELL); ctx.stroke();
    }
  }

  _drawSnake(player) {
    const ctx = this.ctx;
    const { snake, color } = player;
    const half = CELL / 2, thickness = CELL - 2;

    ctx.save();
    ctx.lineWidth = thickness; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = color.body;

    // Draw body — break the path wherever a wall-wrap happened so we never
    // draw a line that crosses the whole canvas.
    ctx.beginPath();
    for (let i = snake.length - 1; i >= 0; i--) {
      const cx = snake[i].x * CELL + half, cy = snake[i].y * CELL + half;
      const isFirst = i === snake.length - 1;
      const wraps   = !isFirst &&
        (Math.abs(snake[i].x - snake[i + 1].x) > 1 ||
         Math.abs(snake[i].y - snake[i + 1].y) > 1);
      isFirst || wraps ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Draw a portal glow at both sides of every wall-crossing pair
    for (let i = 0; i < snake.length - 1; i++) {
      if (Math.abs(snake[i].x - snake[i + 1].x) > 1 ||
          Math.abs(snake[i].y - snake[i + 1].y) > 1) {
        this._drawPortalGlow(snake[i].x     * CELL + half, snake[i].y     * CELL + half, color);
        this._drawPortalGlow(snake[i + 1].x * CELL + half, snake[i + 1].y * CELL + half, color);
      }
    }

    // Head circle
    const { x: hx, y: hy } = snake[0];
    ctx.fillStyle = color.head;
    ctx.beginPath();
    ctx.arc(hx * CELL + half, hy * CELL + half, thickness / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this._drawEyes(snake[0], player.dir);
  }

  /** Radial glow drawn at a wall-crossing cell to sell the teleport illusion. */
  _drawPortalGlow(cx, cy, color) {
    const ctx = this.ctx;
    // Parse the hex head colour so we can build an rgba gradient
    const hex = color.head.replace('#', '');
    const r   = parseInt(hex.slice(0, 2), 16);
    const g   = parseInt(hex.slice(2, 4), 16);
    const b   = parseInt(hex.slice(4, 6), 16);

    ctx.save();
    const radius = CELL * 0.9;
    const grad   = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0,    `rgba(255,255,255,0.90)`);   // bright white core
    grad.addColorStop(0.30, `rgba(${r},${g},${b},0.70)`); // snake colour mid
    grad.addColorStop(1,    `rgba(${r},${g},${b},0.00)`); // fade to transparent
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawEyes(head, dir) {
    const ctx = this.ctx;
    const half = CELL / 2, cx = head.x * CELL + half, cy = head.y * CELL + half;
    const eyeR = CELL * 0.10, pupilR = CELL * 0.055, fwd = CELL * 0.18, lat = CELL * 0.20;
    const px = -dir.y, py = dir.x;
    const eyes = [
      { x: cx + dir.x * fwd + px * lat, y: cy + dir.y * fwd + py * lat },
      { x: cx + dir.x * fwd - px * lat, y: cy + dir.y * fwd - py * lat },
    ];
    ctx.save();
    for (const eye of eyes) {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(eye.x, eye.y, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a'; ctx.beginPath();
      ctx.arc(eye.x + dir.x * pupilR * 0.5, eye.y + dir.y * pupilR * 0.5, pupilR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawFood() {
    const ctx = this.ctx;
    const half = CELL / 2, cx = this._food.x * CELL + half, cy = this._food.y * CELL + half;
    const palette = PALETTES[this._foodPalette];
    ctx.save();
    ctx.fillStyle = palette.body; ctx.strokeStyle = palette.border; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, half - 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────
new SnakeGame();
