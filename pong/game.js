/**
 * pong/game.js  –  Extends GameBase + InputManager.
 * Modes: vs Computer (AI) | vs Player (1v1).
 * Speed increases every 20 total points; paddle shrinks at 100.
 */
import { GameBase, STATE } from '../shared/GameBase.js';
import { InputManager }    from '../shared/InputManager.js';

// ── 1. Constants ──────────────────────────────────────────────────────────────
const CANVAS_W = 860, CANVAS_H = 480;
const PADDLE_W = 12;
const PADDLE_H_NORMAL = 90;   // full-size paddle height
const PADDLE_H_SMALL  = 55;   // shrunken paddle at 100 total score
const PADDLE_X_OFFSET = 24;   // distance of paddle from left/right edge
const BALL_R  = 9;
const WIN_SCORE = 10;          // first to this score wins

// Speed table: [ballSpeed, paddleSpeed] per level (level = floor(total/20))
const SPEED_TABLE = [
  { ball: 5,    paddle: 5   },   // level 0  (0–19 pts)
  { ball: 6.5,  paddle: 6.5 },   // level 1  (20–39)
  { ball: 8,    paddle: 8   },   // level 2  (40–59)
  { ball: 10,   paddle: 10  },   // level 3  (60–79)
  { ball: 12.5, paddle: 12.5},   // level 4  (80–99)
  { ball: 15,   paddle: 14  },   // level 5  (100+)
];

const PALETTES = [
  { label: 'White',  color: '#f1f5f9' },
  { label: 'Red',    color: '#ef4444' },
  { label: 'Orange', color: '#f97316' },
  { label: 'Yellow', color: '#facc15' },
  { label: 'Green',  color: '#4ade80' },
  { label: 'Cyan',   color: '#22d3ee' },
  { label: 'Blue',   color: '#60a5fa' },
  { label: 'Purple', color: '#a855f7' },
  { label: 'Pink',   color: '#f472b6' },
];

const CLR_BG   = '#0f172a';
const CLR_NET  = '#1e293b';

// ── 2. Helpers ────────────────────────────────────────────────────────────────
function getRefs() {
  const g = id => document.getElementById(id);
  return {
    canvas:          g('gameCanvas'),
    overlay:         g('overlay'),
    overlayEmoji:    g('overlayEmoji'),
    overlayTitle:    g('overlayTitle'),
    overlaySubtitle: g('overlaySubtitle'),
    overlayFinal:    g('overlayFinal'),
    btnStart:        g('btnStart'),
    btnPause:        g('btnPause'),
    pauseOverlay:    g('pauseOverlay'),
    speedBadge:      g('speedBadge'),
    scoreEl:         null,          // not used; pong manages two scores itself
    scoreP1El:       g('scoreP1'),
    scoreP2El:       g('scoreP2'),
    labelP1El:       g('labelP1'),
    labelP2El:       g('labelP2'),
    modeComputerBtn: g('modeComputer'),
    modePlayerBtn:   g('modePlayer'),
    swatchesP1:      g('swatchesP1'),
    swatchesP2:      g('swatchesP2'),
    swatchesBall:    g('swatchesBall'),
    p2ColorPicker:   g('p2ColorPicker'),
    dpadP2:          g('dpadP2'),
    p1DpadUp:        g('p1DpadUp'),
    p1DpadDown:      g('p1DpadDown'),
    p2DpadUp:        g('p2DpadUp'),
    p2DpadDown:      g('p2DpadDown'),
  };
}

// ── 3. PongGame ───────────────────────────────────────────────────────────────
class PongGame extends GameBase {
  constructor() {
    const r = getRefs();
    super({ canvas: r.canvas, els: r });
    this._r = r;

    // Game state
    this._gameMode    = 'computer'; // 'computer' | 'player'
    this._scoreP1     = 0;
    this._scoreP2     = 0;
    this._level       = 0;
    this._paddleH     = PADDLE_H_NORMAL;
    this._ballSpeed   = SPEED_TABLE[0].ball;
    this._paddleSpeed = SPEED_TABLE[0].paddle;

    // Ball
    this._ball  = { x: 0, y: 0, vx: 0, vy: 0 };

    // Paddles  { y, dy (input), vy (AI smoothed) }
    this._p1    = { y: 0, dy: 0 };
    this._p2    = { y: 0, dy: 0, vy: 0 };

    // Color selection indices
    this._p1Color   = 4;  // green
    this._p2Color   = 6;  // blue
    this._ballColor = 0;  // white

    this._input = new InputManager();
    this._setupInput();
    this._initModeToggle();
    this._initColorPicker();

    this.showOverlay({
      emoji: '🏓', title: 'Ping Pong',
      subtitle: 'First to 10 wins!',
      finalScore: null, buttonLabel: 'Start Game',
    });
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _setupInput() {
    const r = this._r;
    this._input.register({
      p1_up:   ['w', 'W'],
      p1_down: ['s', 'S'],
      p2_up:   ['ArrowUp'],
      p2_down: ['ArrowDown'],
    });
    // Keyboard hold state – track pressed keys for smooth movement
    this._keys = { p1_up: false, p1_down: false, p2_up: false, p2_down: false };
    document.addEventListener('keydown', e => {
      if (e.key==='w'||e.key==='W')         this._keys.p1_up   = true;
      if (e.key==='s'||e.key==='S')         this._keys.p1_down = true;
      if (e.key==='ArrowUp')   { e.preventDefault(); this._keys.p2_up   = true; }
      if (e.key==='ArrowDown') { e.preventDefault(); this._keys.p2_down = true; }
    });
    document.addEventListener('keyup', e => {
      if (e.key==='w'||e.key==='W')    this._keys.p1_up   = false;
      if (e.key==='s'||e.key==='S')    this._keys.p1_down = false;
      if (e.key==='ArrowUp')           this._keys.p2_up   = false;
      if (e.key==='ArrowDown')         this._keys.p2_down = false;
    });

    // D-pad buttons (press = held, release = release)
    this._bindDpadHold(r.p1DpadUp,   'p1_up');
    this._bindDpadHold(r.p1DpadDown, 'p1_down');
    this._bindDpadHold(r.p2DpadUp,   'p2_up');
    this._bindDpadHold(r.p2DpadDown, 'p2_down');
  }

  _bindDpadHold(el, key) {
    const setOn  = () => { this._keys[key] = true;  };
    const setOff = () => { this._keys[key] = false; };
    el.addEventListener('mousedown',  setOn);
    el.addEventListener('touchstart', setOn,  { passive: true });
    el.addEventListener('mouseup',    setOff);
    el.addEventListener('mouseleave', setOff);
    el.addEventListener('touchend',   setOff);
    el.addEventListener('touchcancel',setOff);
  }

  // ── Mode toggle ────────────────────────────────────────────────────────────
  _initModeToggle() {
    const r = this._r;
    r.modeComputerBtn.addEventListener('click', () => this._setMode('computer'));
    r.modePlayerBtn.addEventListener('click',   () => this._setMode('player'));
    this._setMode('computer');
  }

  _setMode(mode) {
    const r = this._r;
    this._gameMode = mode;
    const isPlayer = mode === 'player';
    r.modeComputerBtn.classList.toggle('active', !isPlayer);
    r.modePlayerBtn.classList.toggle('active',    isPlayer);
    r.p2ColorPicker.classList.toggle('hidden',   !isPlayer);
    r.dpadP2.classList.toggle('hidden',          !isPlayer);
    r.labelP2El.textContent = isPlayer ? 'P2' : 'CPU';
  }

  // ── Color picker ───────────────────────────────────────────────────────────
  _initColorPicker() {
    const r = this._r;
    const buildRow = (container, defaultIdx, onSelect) => {
      PALETTES.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className        = `color-swatch${i === defaultIdx ? ' selected' : ''}`;
        btn.style.background = p.color;
        btn.title            = p.label;
        btn.addEventListener('click', () => {
          onSelect(i);
          container.querySelectorAll('.color-swatch').forEach((el, j) =>
            el.classList.toggle('selected', j === i));
        });
        container.appendChild(btn);
      });
    };
    buildRow(r.swatchesP1,   this._p1Color,   i => { this._p1Color   = i; });
    buildRow(r.swatchesP2,   this._p2Color,   i => { this._p2Color   = i; });
    buildRow(r.swatchesBall, this._ballColor, i => { this._ballColor = i; });
  }

  // ── GameBase hooks ─────────────────────────────────────────────────────────
  onInit() {
    const W = CANVAS_W, H = CANVAS_H;
    this.canvas.width  = W;
    this.canvas.height = H;

    this._scoreP1     = 0;
    this._scoreP2     = 0;
    this._level       = 0;
    this._paddleH     = PADDLE_H_NORMAL;
    this._ballSpeed   = SPEED_TABLE[0].ball;
    this._paddleSpeed = SPEED_TABLE[0].paddle;
    this.updateSpeedBadge(0);
    this._updateScoreDisplay();

    const midY = H / 2 - PADDLE_H_NORMAL / 2;
    this._p1 = { y: midY, dy: 0 };
    this._p2 = { y: midY, dy: 0, vy: 0 };
    this._aiTargetY    = CANVAS_H / 2 - PADDLE_H_NORMAL / 2;
    this._aiUpdateTimer = 0;
    this._launchBall();
  }

  _launchBall() {
    const angle = (Math.random() * 0.6 - 0.3);         // -0.3…+0.3 rad
    const dir   = Math.random() < 0.5 ? 1 : -1;        // left or right
    this._ball = {
      x:  CANVAS_W / 2,
      y:  CANVAS_H / 2,
      vx: Math.cos(angle) * this._ballSpeed * dir,
      vy: Math.sin(angle) * this._ballSpeed,
    };
  }

  onTick() {
    this._readInput();
    this._movePaddles();
    this._moveBall();
  }

  onRender() {
    this._drawBackground();
    this._drawNet();
    this._drawPaddle(PADDLE_X_OFFSET, this._p1.y, PALETTES[this._p1Color].color);
    this._drawPaddle(CANVAS_W - PADDLE_X_OFFSET - PADDLE_W, this._p2.y, PALETTES[this._p2Color].color);
    this._drawBall();
  }

  onEnd(result) {
    this.onRender();
    super.onEnd(result);
  }

  // ── Physics ────────────────────────────────────────────────────────────────
  _readInput() {
    const spd = this._paddleSpeed;
    this._p1.dy = (this._keys.p1_down ? spd : 0) - (this._keys.p1_up ? spd : 0);
    if (this._gameMode === 'player') {
      this._p2.dy = (this._keys.p2_down ? spd : 0) - (this._keys.p2_up ? spd : 0);
    }
  }

  _movePaddles() {
    const H = CANVAS_H, ph = this._paddleH;
    // P1
    this._p1.y = Math.max(0, Math.min(H - ph, this._p1.y + this._p1.dy));
    // P2 (AI or human)
    if (this._gameMode === 'computer') {
      this._aiMovePaddle();
    } else {
      this._p2.y = Math.max(0, Math.min(H - ph, this._p2.y + this._p2.dy));
    }
  }

  _aiMovePaddle() {
    if (this._ball.vx > 0) {
      // Ball heading toward AI — update target every 12 frames with aim error
      if (!this._aiUpdateTimer || --this._aiUpdateTimer <= 0) {
        const err = (Math.random() - 0.5) * 80;   // ±40 px aim error
        this._aiTargetY    = this._ball.y - this._paddleH / 2 + err;
        this._aiUpdateTimer = 12;
      }
    } else {
      // Ball heading away — drift back to centre so a sharp return catches it off-guard
      this._aiTargetY    = CANVAS_H / 2 - this._paddleH / 2;
      this._aiUpdateTimer = 0;   // re-sample immediately when ball turns
    }

    const diff    = this._aiTargetY - this._p2.y;
    const maxStep = this._paddleSpeed * 0.58;   // 58% — can't cover full canvas in time
    this._p2.y += Math.max(-maxStep, Math.min(maxStep, diff));
    this._p2.y  = Math.max(0, Math.min(CANVAS_H - this._paddleH, this._p2.y));
  }

  _moveBall() {
    const b  = this._ball;
    const ph = this._paddleH;

    b.x += b.vx;
    b.y += b.vy;

    // ── Top / bottom wall bounce
    if (b.y - BALL_R < 0) {
      b.y = BALL_R; b.vy = Math.abs(b.vy);
    } else if (b.y + BALL_R > CANVAS_H) {
      b.y = CANVAS_H - BALL_R; b.vy = -Math.abs(b.vy);
    }

    // ── P1 paddle (left)
    const p1x = PADDLE_X_OFFSET;
    if (b.vx < 0 && b.x - BALL_R <= p1x + PADDLE_W && b.x + BALL_R >= p1x) {
      if (b.y + BALL_R >= this._p1.y && b.y - BALL_R <= this._p1.y + ph) {
        b.x  = p1x + PADDLE_W + BALL_R;
        const hitPos = (b.y - (this._p1.y + ph / 2)) / (ph / 2);  // -1…+1
        const angle  = hitPos * Math.PI / 4;
        const spd    = this._ballSpeed;
        b.vx =  Math.cos(angle) * spd;
        b.vy =  Math.sin(angle) * spd;
      }
    }

    // ── P2 paddle (right)
    const p2x = CANVAS_W - PADDLE_X_OFFSET - PADDLE_W;
    if (b.vx > 0 && b.x + BALL_R >= p2x && b.x - BALL_R <= p2x + PADDLE_W) {
      if (b.y + BALL_R >= this._p2.y && b.y - BALL_R <= this._p2.y + ph) {
        b.x  = p2x - BALL_R;
        const hitPos = (b.y - (this._p2.y + ph / 2)) / (ph / 2);
        const angle  = hitPos * Math.PI / 4;
        const spd    = this._ballSpeed;
        b.vx = -Math.cos(angle) * spd;
        b.vy =  Math.sin(angle) * spd;
      }
    }

    // ── Scoring
    if (b.x + BALL_R < 0) {
      this._scoreP2++;
      this._onScore();
    } else if (b.x - BALL_R > CANVAS_W) {
      this._scoreP1++;
      this._onScore();
    }
  }

  _onScore() {
    this._updateScoreDisplay();
    this._updateDifficulty();

    const p1Won = this._scoreP1 >= WIN_SCORE;
    const p2Won = this._scoreP2 >= WIN_SCORE;
    const cpuLbl = this._gameMode === 'computer' ? '🤖 CPU' : 'P2';

    if (p1Won || p2Won) {
      const winner = p1Won ? 'P1 🏆' : `${cpuLbl} 🏆`;
      this.end({
        emoji: '🏆', title: `${winner} Wins!`,
        subtitle: p1Won ? 'Player 1 takes the match!' : (this._gameMode === 'computer' ? 'The computer wins!' : 'Player 2 takes the match!'),
        finalScore: `P1: ${this._scoreP1}  ·  ${cpuLbl}: ${this._scoreP2}`,
        buttonLabel: 'Play Again',
      });
    } else {
      // Brief 60-frame pause then relaunch
      setTimeout(() => {
        if (this._state === STATE.RUNNING) this._launchBall();
      }, 700);
      this._ball = { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: 0, vy: 0 };
    }
  }

  _updateDifficulty() {
    const total = this._scoreP1 + this._scoreP2;
    const lv    = Math.min(Math.floor(total / 20), SPEED_TABLE.length - 1);
    if (lv !== this._level) {
      this._level       = lv;
      this._ballSpeed   = SPEED_TABLE[lv].ball;
      this._paddleSpeed = SPEED_TABLE[lv].paddle;
      this.updateSpeedBadge(lv);
    }
    this._paddleH = total >= 100 ? PADDLE_H_SMALL : PADDLE_H_NORMAL;
  }

  _updateScoreDisplay() {
    const r = this._r;
    r.scoreP1El.textContent = this._scoreP1;
    r.scoreP2El.textContent = this._scoreP2;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  _drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = CLR_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  _drawNet() {
    const ctx = this.ctx;
    ctx.strokeStyle = CLR_NET;
    ctx.lineWidth   = 4;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawPaddle(x, y, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, PADDLE_W, this._paddleH, 4);
    ctx.fill();
  }

  _drawBall() {
    const ctx = this.ctx, b = this._ball;
    ctx.fillStyle = PALETTES[this._ballColor].color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────
new PongGame();
