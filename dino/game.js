/**
 * dino/game.js
 * Extends GameBase + uses InputManager.
 */
import { GameBase, STATE } from '../shared/GameBase.js';
import { InputManager }    from '../shared/InputManager.js';

// ── 1. Constants ──────────────────────────────────────────────────────────────
const CANVAS_W  = 900, CANVAS_H = 260, GROUND_Y = 200;
const DINO_W = 44, DINO_H = 52, DINO_X = 80;
const GRAVITY = 0.6, JUMP_VELOCITY = -13;
const SPEEDS = [5, 7, 9.5, 12.5, 16];
const POINTS_PER_LEVEL = 200;
const SPAWN_GAP_MIN = 350, SPAWN_GAP_MAX = 700;
const CACTUS_W = 28, CACTUS_H_MIN = 40, CACTUS_H_MAX = 70;
const FORGIVE = 8;
const CLR_SKY = '#0f172a', CLR_GROUND = '#334155', CLR_GROUND_TOP = '#4ade80';
const CLR_DINO = '#4ade80', CLR_EYE = '#0f172a';
const CLR_CACTUS = '#22c55e', CLR_CACTUS_DRK = '#15803d';

// ── 2. DinoGame class ─────────────────────────────────────────────────────────
class DinoGame extends GameBase {
  constructor() {
    const g = id => document.getElementById(id);
    const canvas = g('gameCanvas');
    super({
      canvas,
      els: {
        overlay:         g('overlay'),
        overlayEmoji:    g('overlayEmoji'),
        overlayTitle:    g('overlayTitle'),
        overlaySubtitle: g('overlaySubtitle'),
        overlayFinal:    g('overlayFinal'),
        btnStart:        g('btnStart'),
        speedBadge:      g('speedBadge'),
        scoreEl:         g('scoreEl'),
      },
    });

    this._dinoY = 0; this._velY = 0; this._onGround = true;
    this._legFrame = 0; this._legTimer = 0;
    this._cacti = []; this._distToNext = 0; this._scrolled = 0;
    this._score = 0; this._level = 0; this._speed = SPEEDS[0];
    this._hiScore = 0;

    this._input = new InputManager();
    this._input.register({ jump: ['Space', 'ArrowUp'] });
    this._input.on('jump', () => this._tryJump());
    this._input.bindButton(g('btnJump'), 'jump');

    // Tap the canvas to jump — natural mobile control
    canvas.addEventListener('touchstart', () => this._tryJump(), { passive: true });

    this.showOverlay({ emoji: '🦕', title: 'Dino Run',
      subtitle: 'Jump over the cacti!', finalScore: null, buttonLabel: 'Start Game' });
  }

  // ── GameBase hooks ────────────────────────────────────────────────────────
  onInit() {
    this.canvas.width  = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this._score  = 0; this._level = 0; this._speed = SPEEDS[0];
    this._dinoY  = GROUND_Y - DINO_H;
    this._velY   = 0; this._onGround = true;
    this._legFrame = 0; this._legTimer = 0;
    this._cacti  = []; this._scrolled = 0;
    this._distToNext = this._randomGap();
    this.updateSpeedBadge(0);
    this.updateScore(0);
  }

  onTick() {
    this._updatePhysics();
    this._updateCacti();
    this._updateScore();
    if (this._checkCollision()) {
      this._hiScore = Math.max(this._hiScore, this._score);
      this.els.hiScoreEl && (this.els.hiScoreEl.textContent = this._hiScore);
      this.end({
        emoji: '💀', title: 'Game Over', subtitle: 'You hit a cactus!',
        finalScore: `Score: ${this._score}  ·  Best: ${this._hiScore}`,
        buttonLabel: 'Play Again',
      });
    }
  }

  onRender() {
    const ctx = this.ctx;
    ctx.fillStyle = CLR_SKY;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this._drawGround();
    this._cacti.forEach(c => this._drawCactus(c));
    this._drawDino();
  }

  onEnd(result) {
    this.onRender(); // freeze last frame
    // Persist hi-score element update before overlay
    const hiEl = document.getElementById('hiScoreEl');
    if (hiEl) hiEl.textContent = this._hiScore;
    super.onEnd(result);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _tryJump() {
    if (this._state !== STATE.RUNNING || !this._onGround) return;
    this._velY = JUMP_VELOCITY;
    this._onGround = false;
  }

  // ── Physics ───────────────────────────────────────────────────────────────
  _updatePhysics() {
    this._velY  += GRAVITY;
    this._dinoY += this._velY;
    const groundTop = GROUND_Y - DINO_H;
    if (this._dinoY >= groundTop) {
      this._dinoY = groundTop; this._velY = 0; this._onGround = true;
    }
    if (this._onGround && ++this._legTimer >= 8) {
      this._legFrame = 1 - this._legFrame; this._legTimer = 0;
    }
  }

  // ── Cacti ─────────────────────────────────────────────────────────────────
  _updateCacti() {
    for (const c of this._cacti) c.x -= this._speed;
    this._cacti = this._cacti.filter(c => c.x + c.w > 0);
    this._scrolled      += this._speed;
    this._distToNext    -= this._speed;
    if (this._distToNext <= 0) {
      const h = CACTUS_H_MIN + Math.random() * (CACTUS_H_MAX - CACTUS_H_MIN);
      this._cacti.push({ x: CANVAS_W + 20, w: CACTUS_W, h });
      this._distToNext = this._randomGap();
    }
  }

  _randomGap() {
    const factor = 1 - (this._level / (SPEEDS.length - 1)) * 0.35;
    return (SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN)) * factor;
  }

  // ── Collision ─────────────────────────────────────────────────────────────
  _checkCollision() {
    const dL = DINO_X + FORGIVE, dR = DINO_X + DINO_W - FORGIVE;
    const dT = this._dinoY + FORGIVE, dB = this._dinoY + DINO_H - FORGIVE;
    return this._cacti.some(c => {
      const cT = GROUND_Y - c.h;
      return dR > c.x + FORGIVE && dL < c.x + c.w - FORGIVE && dB > cT;
    });
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  _updateScore() {
    this._score = Math.floor(this._scrolled / 10);
    const newLv = Math.min(Math.floor(this._score / POINTS_PER_LEVEL), SPEEDS.length - 1);
    if (newLv !== this._level) {
      this._level = newLv; this._speed = SPEEDS[newLv];
      this.updateSpeedBadge(newLv);
    }
    this.updateScore(this._score);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  _drawGround() {
    const ctx = this.ctx;
    ctx.fillStyle = CLR_GROUND;
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
    ctx.fillStyle = CLR_GROUND_TOP;
    ctx.fillRect(0, GROUND_Y, CANVAS_W, 3);
  }

  _drawDino() {
    const ctx = this.ctx, x = DINO_X, y = this._dinoY, w = DINO_W, h = DINO_H;
    ctx.fillStyle = CLR_DINO;
    ctx.beginPath(); ctx.roundRect(x, y + 10, w, h - 18, 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + w - 16, y, 22, 20, 6); ctx.fill();
    ctx.fillStyle = CLR_EYE;
    ctx.beginPath(); ctx.arc(x + w + 2, y + 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CLR_DINO;
    if (this._onGround) {
      const fY = this._legFrame === 0 ? h - 6 : h - 12;
      const bY = this._legFrame === 0 ? h - 12 : h - 6;
      ctx.fillRect(x + w - 14, y + fY, 10, this._legFrame === 0 ? 12 : 18);
      ctx.fillRect(x + 4,      y + bY, 10, this._legFrame === 0 ? 18 : 12);
    } else {
      ctx.fillRect(x + w - 14, y + h - 10, 10, 10);
      ctx.fillRect(x + 4,      y + h - 10, 10, 10);
    }
    ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x - 14, y + 22); ctx.lineTo(x, y + 28);
    ctx.closePath(); ctx.fill();
  }

  _drawCactus(c) {
    const ctx = this.ctx, { x, w: stem, h } = c;
    const armH = Math.floor(h * 0.45), armW = 10;
    ctx.fillStyle = CLR_CACTUS;
    ctx.beginPath(); ctx.roundRect(x + stem/2 - 5, GROUND_Y - h, 10, h, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, GROUND_Y - h + 14, armW, armH, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, GROUND_Y - h + 14, armW + stem/2 - 5, 10, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + stem - armW, GROUND_Y - h + 22, armW, armH - 8, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + stem/2 + 5, GROUND_Y - h + 22, stem - armW, 10, 3); ctx.fill();
    ctx.fillStyle = CLR_CACTUS_DRK;
    ctx.fillRect(x + stem/2 - 2, GROUND_Y - h + 4, 4, h - 4);
  }
}

new DinoGame();
