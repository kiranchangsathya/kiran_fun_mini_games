/**
 * tetris/game.js
 * Classic Tetris — extends GameBase, uses InputManager.
 * Gravity runs on setInterval; player input is immediate.
 */
import { GameBase, STATE } from '../shared/GameBase.js';
import { InputManager }    from '../shared/InputManager.js';

// ── Constants ────────────────────────────────────────────────────────────────
const COLS = 10, ROWS = 20, CELL = 30;
const CANVAS_W = COLS * CELL;   // 300 px logical
const CANVAS_H = ROWS * CELL;   // 600 px logical

// Gravity interval per level in ms (index 0 = lv1 … index 9 = lv10+)
const SPEEDS = [800, 650, 500, 380, 280, 200, 140, 100, 75, 55];

// Points for clearing 1 / 2 / 3 / 4 lines at once (× current level)
const LINE_PTS = [0, 100, 300, 500, 800];

// Tetromino definitions — shape (row-major, 1 = filled) + colour
const PIECES = [
  { shape: [[1,1,1,1]],       color: '#22d3ee' }, // I – cyan
  { shape: [[1,1],[1,1]],     color: '#facc15' }, // O – yellow
  { shape: [[0,1,0],[1,1,1]], color: '#c084fc' }, // T – purple
  { shape: [[0,1,1],[1,1,0]], color: '#4ade80' }, // S – green
  { shape: [[1,1,0],[0,1,1]], color: '#f87171' }, // Z – red
  { shape: [[1,0,0],[1,1,1]], color: '#60a5fa' }, // J – blue
  { shape: [[0,0,1],[1,1,1]], color: '#fb923c' }, // L – orange
];

const COLOR_BG   = '#0f172a';
const COLOR_GRID = '#1e293b';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getRefs() {
  const g = id => document.getElementById(id);
  return {
    canvas: g('gameCanvas'), overlay: g('overlay'),
    overlayEmoji: g('overlayEmoji'), overlayTitle: g('overlayTitle'),
    overlaySubtitle: g('overlaySubtitle'), overlayFinal: g('overlayFinal'),
    btnStart: g('btnStart'), speedBadge: g('speedBadge'),
    btnPause: g('btnPause'), pauseOverlay: g('pauseOverlay'),
    scoreEl: g('scoreEl'), linesEl: g('linesEl'), levelEl: g('levelEl'),
    nextCanvas: g('nextCanvas'),
    btnLeft: g('btnLeft'), btnRight: g('btnRight'), btnRotate: g('btnRotate'),
    btnDown: g('btnDown'), btnDrop: g('btnDrop'),
  };
}

/** Rotate a 2-D array 90° clockwise. */
function rotateMatrix(m) {
  return m[0].map((_, c) => m.map(row => row[c]).reverse());
}


// ── TetrisGame ────────────────────────────────────────────────────────────────
class TetrisGame extends GameBase {
  constructor() {
    const r = getRefs();
    super({ canvas: r.canvas, els: r });
    this._r = r;

    this._board     = null;   // ROWS×COLS — null | colour string
    this._piece     = null;   // { shape, x, y, color }
    this._next      = null;   // { shape, color }
    this._score     = 0;
    this._lines     = 0;
    this._level     = 0;
    this._loopTimer = null;

    this._input = new InputManager();
    this._setupInput();

    this.showOverlay({ emoji: '🟪', title: 'Tetris',
                       subtitle: 'Stack falling blocks and clear lines! Speed increases as you level up.',
                       finalScore: null, buttonLabel: 'Start Game' });
  }

  // Tetris drives itself with setInterval — disable the default RAF loop
  _loop() {}

  // ── GameBase hooks ───────────────────────────────────────────────────────
  onInit() {
    this.canvas.width  = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this._board  = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this._score  = 0;
    this._lines  = 0;
    this._level  = 0;
    this._next   = this._randomPiece();
    this._spawnPiece();
    this._updateHUD();
    this.updateSpeedBadge(0);
  }

  onStart()  { this._restartInterval(); }
  onPause()  { clearInterval(this._loopTimer); }
  onResume() { this._restartInterval(); }

  onTick() {
    // Gravity: drop one row; if blocked, lock + spawn next
    if (!this._shift(0, 1)) this._place();
  }

  onRender() {
    this._drawBoard();
    this._drawGhost();
    this._drawActivePiece();
    this._drawNextPreview();
  }

  onEnd(result) {
    clearInterval(this._loopTimer);
    this.onRender();
    super.onEnd(result);
  }

  // ── Input ────────────────────────────────────────────────────────────────
  _setupInput() {
    const r = this._r;
    this._input.register({
      left:   ['ArrowLeft'],
      right:  ['ArrowRight'],
      rotate: ['ArrowUp', 'x', 'X'],
      down:   ['ArrowDown'],
      drop:   [' ', 'Space'],
    });
    const run = fn => () => { if (this._state === STATE.RUNNING) fn(); };
    this._input.on('left',   run(() => { this._shift(-1, 0); this.onRender(); }));
    this._input.on('right',  run(() => { this._shift( 1, 0); this.onRender(); }));
    this._input.on('rotate', run(() => { this._rotate();      this.onRender(); }));
    this._input.on('down',   run(() => {
      if (this._shift(0, 1)) { this._score++; this._updateHUD(); }
      this.onRender();
    }));
    this._input.on('drop', run(() => this._hardDrop()));

    this._input.bindButton(r.btnLeft,   'left');
    this._input.bindButton(r.btnRight,  'right');
    this._input.bindButton(r.btnRotate, 'rotate');
    this._input.bindButton(r.btnDown,   'down');
    this._input.bindButton(r.btnDrop,   'drop');
  }


  // ── Logic helpers ────────────────────────────────────────────────────────
  _restartInterval() {
    clearInterval(this._loopTimer);
    this._loopTimer = setInterval(() => {
      if (this._state !== STATE.RUNNING) return;
      this.onTick();
      if (this._state !== STATE.RUNNING) return;
      this.onRender();
    }, SPEEDS[Math.min(this._level, SPEEDS.length - 1)]);
  }

  _randomPiece() {
    const t = PIECES[Math.floor(Math.random() * PIECES.length)];
    return { shape: t.shape.map(r => [...r]), color: t.color };
  }

  _spawnPiece() {
    const t      = this._next;
    this._next   = this._randomPiece();
    const startX = Math.floor((COLS - t.shape[0].length) / 2);
    this._piece  = { shape: t.shape, color: t.color, x: startX, y: 0 };
    // Collision at spawn = board is full = game over
    return !this._collides(this._piece.shape, this._piece.x, this._piece.y);
  }

  _collides(shape, px, py) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this._board[ny][nx]) return true;
      }
    return false;
  }

  /** Try to move the active piece by (dx, dy). Returns true if it moved. */
  _shift(dx, dy) {
    const nx = this._piece.x + dx, ny = this._piece.y + dy;
    if (this._collides(this._piece.shape, nx, ny)) return false;
    this._piece.x = nx; this._piece.y = ny;
    return true;
  }

  _rotate() {
    const rotated = rotateMatrix(this._piece.shape);
    // Wall-kick: try centre, then ±1, ±2 columns
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!this._collides(rotated, this._piece.x + kick, this._piece.y)) {
        this._piece.shape = rotated;
        this._piece.x    += kick;
        return;
      }
    }
  }

  _hardDrop() {
    let dropped = 0;
    while (this._shift(0, 1)) dropped++;
    this._score += dropped * 2;
    this._updateHUD();
    this._place();
  }

  /** Lock piece onto board, clear lines, update score, spawn next. */
  _place() {
    const { shape, x, y, color } = this._piece;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c] && y + r >= 0)
          this._board[y + r][x + c] = color;

    // Clear completed lines
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this._board[r].every(cell => cell !== null)) {
        this._board.splice(r, 1);
        this._board.unshift(Array(COLS).fill(null));
        cleared++; r++; // recheck same index
      }
    }

    if (cleared > 0) {
      this._score += LINE_PTS[cleared] * (this._level + 1);
      this._lines += cleared;
      const newLevel = Math.floor(this._lines / 10);
      if (newLevel !== this._level) {
        this._level = newLevel;
        this.updateSpeedBadge(Math.min(this._level, SPEEDS.length - 1));
        this._restartInterval();
      }
      this._updateHUD();
    }

    if (!this._spawnPiece()) {
      this.end({ emoji: '🟪', title: 'Game Over',
                 subtitle: `You cleared ${this._lines} line${this._lines === 1 ? '' : 's'}!`,
                 finalScore: `Score: ${this._score}`, buttonLabel: 'Play Again' });
    }
  }

  _updateHUD() {
    this._r.scoreEl.textContent = this._score;
    this._r.linesEl.textContent = this._lines;
    this._r.levelEl.textContent = this._level + 1;
  }


  // ── Rendering ────────────────────────────────────────────────────────────
  _drawBoard() {
    const ctx = this.ctx;
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, CANVAS_H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(CANVAS_W, r * CELL); ctx.stroke();
    }

    // Locked cells
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this._board[r][c]) this._drawCell(c, r, this._board[r][c]);
  }

  _drawCell(col, row, color, alpha = 1) {
    const ctx = this.ctx;
    const x = col * CELL + 1, y = row * CELL + 1, s = CELL - 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    // Top-left highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, s, 3); ctx.fillRect(x, y, 3, s);
    // Bottom-right shadow
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(x, y + s - 3, s, 3); ctx.fillRect(x + s - 3, y, 3, s);
    ctx.restore();
  }

  _ghostRow() {
    let gy = this._piece.y;
    while (!this._collides(this._piece.shape, this._piece.x, gy + 1)) gy++;
    return gy;
  }

  _drawGhost() {
    const gy = this._ghostRow();
    if (gy === this._piece.y) return;
    const { shape, x, color } = this._piece;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this._drawCell(x + c, gy + r, color, 0.22);
  }

  _drawActivePiece() {
    const { shape, x, y, color } = this._piece;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c] && y + r >= 0) this._drawCell(x + c, y + r, color);
  }

  _drawNextPreview() {
    const nc = this._r.nextCanvas;
    if (!nc) return;
    const ctx2 = nc.getContext('2d');
    const PCELL = 18;
    ctx2.fillStyle = COLOR_BG;
    ctx2.fillRect(0, 0, nc.width, nc.height);
    const { shape, color } = this._next;
    const offX = Math.floor((nc.width  / PCELL - shape[0].length) / 2);
    const offY = Math.floor((nc.height / PCELL - shape.length)    / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const x = (offX + c) * PCELL + 1, y = (offY + r) * PCELL + 1, s = PCELL - 2;
        ctx2.fillStyle = color; ctx2.fillRect(x, y, s, s);
        ctx2.fillStyle = 'rgba(255,255,255,0.35)';
        ctx2.fillRect(x, y, s, 3); ctx2.fillRect(x, y, 3, s);
        ctx2.fillStyle = 'rgba(0,0,0,0.30)';
        ctx2.fillRect(x, y + s - 3, s, 3); ctx2.fillRect(x + s - 3, y, 3, s);
      }
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
new TetrisGame();
