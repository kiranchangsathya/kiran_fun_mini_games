/**
 * galaxy-shooter/game.js
 * Galaxy Shooter — extends GameBase
 */
import { GameBase, STATE } from '../shared/GameBase.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 900, H = 500;
const PLAYER_W = 36, PLAYER_H = 44, PLAYER_SPEED = 5;
const BULLET_W = 4,  BULLET_H = 14, BULLET_SPEED = 10;
const ENEMY_BULLET_W = 4, ENEMY_BULLET_H = 10, ENEMY_BULLET_SPEED = 4;
const LIVES_START = 3;
const FIRE_COOLDOWN = 220; // ms between shots

// Enemy grid
const ENEMY_COLS = 10, ENEMY_ROWS = 4;
const ENEMY_W = 36, ENEMY_H = 28, ENEMY_GAP_X = 14, ENEMY_GAP_Y = 14;
const ENEMY_TOP_Y = 55;
const ENEMY_GRID_W = ENEMY_COLS * (ENEMY_W + ENEMY_GAP_X) - ENEMY_GAP_X;

// Scoring
const SCORE_ENEMY  = 10;
const SCORE_BOSS   = 500;

// Colors
const CLR_BG    = '#03000f';
const CLR_SHIP  = '#818cf8';
const CLR_FLAME = '#f97316';
const CLR_BULLET = '#fde68a';
const CLR_ENEMY_A = '#e879f9'; // row 0
const CLR_ENEMY_B = '#22d3ee'; // rows 1-2
const CLR_ENEMY_C = '#4ade80'; // rows 3+
const CLR_ENEMY_BULLET = '#f87171';
const CLR_BOSS  = '#f59e0b';

// Stars
const STAR_COUNT = 120;

// ── GalaxyShooterGame ─────────────────────────────────────────────────────────
class GalaxyShooterGame extends GameBase {
  constructor() {
    const g = id => document.getElementById(id);
    const canvas = g('gameCanvas');
    canvas.width  = W;
    canvas.height = H;

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
        btnPause:        g('btnPause'),
        pauseOverlay:    g('pauseOverlay'),
      },
    });

    // Keyboard held-key tracking
    this._heldKeys = new Set();
    document.addEventListener('keydown', e => {
      this._heldKeys.add(e.code);
      if (['Space','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup',   e => this._heldKeys.delete(e.code));

    // Mobile buttons
    const btnLeft  = g('btnLeft');
    const btnRight = g('btnRight');
    const btnFire  = g('btnFire');
    if (btnLeft)  { btnLeft.addEventListener('pointerdown',  () => { this._mLeft  = true;  }); btnLeft.addEventListener('pointerup',    () => { this._mLeft  = false; }); }
    if (btnRight) { btnRight.addEventListener('pointerdown', () => { this._mRight = true;  }); btnRight.addEventListener('pointerup',   () => { this._mRight = false; }); }
    if (btnFire)  { btnFire.addEventListener('pointerdown',  () => { this._mFire  = true;  }); btnFire.addEventListener('pointerup',    () => { this._mFire  = false; }); }

    // Persistent state
    this._hiScore = 0;
    this._stars   = this._makeStars();

    this.showOverlay({
      emoji: '🚀', title: 'Galaxy Shooter',
      subtitle: 'Defend the galaxy from alien invaders!<br>Bosses appear every 3 levels.',
      finalScore: null, buttonLabel: 'Start Game',
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  onInit() {
    this._score     = 0;
    this._level     = 1;
    this._lives     = LIVES_START;
    this._phase     = 'playing'; // 'playing' | 'transition' | 'boss'
    this._transTimer = 0;

    // Player
    this._px        = W / 2 - PLAYER_W / 2;
    this._py        = H - PLAYER_H - 14;
    this._shield    = false;
    this._shieldTimer = 0;
    this._spreadShot  = false;
    this._spreadTimer = 0;
    this._invincible  = 0; // frames of invincibility after hit

    // Bullets
    this._bullets      = [];
    this._enemyBullets = [];
    this._lastFire     = 0;

    // Mobile input state
    this._mLeft = false; this._mRight = false; this._mFire = false;

    // Particles
    this._particles = [];

    // Power-ups
    this._powerups = [];

    // Enemies & boss
    this._enemies   = [];
    this._boss      = null;
    this._enemyDir  = 1;
    this._enemyMoveTimer = 0;
    this._enemyFireTimer = 0;
    this._spawnWave();

    this.updateSpeedBadge(this._level - 1);
    this.updateScore(0);
    this._updateLivesDisplay();
  }

  // ── Tick ──────────────────────────────────────────────────────────────────
  onTick() {
    if (this._phase === 'transition') {
      this._transTimer--;
      this._updateParticles();
      if (this._transTimer <= 0) this._startNextLevel();
      return;
    }
    this._movePlayer();
    this._handleFire();
    this._moveBullets();
    this._moveEnemies();
    this._moveEnemyBullets();
    this._movePowerups();
    this._updateParticles();
    this._checkBulletEnemyCollisions();
    this._checkEnemyBulletPlayerCollision();
    this._checkPowerupCollision();
    this._checkEnemiesReachedBottom();
    if (this._invincible > 0) this._invincible--;
    if (this._shield && --this._shieldTimer <= 0) this._shield = false;
    if (this._spreadShot && --this._spreadTimer <= 0) this._spreadShot = false;
    if (this._boss) {
      this._moveBoss();
      this._checkBulletBossCollision();
    }
    const allDead = this._enemies.length === 0 && !this._boss;
    if (allDead && this._phase === 'playing') this._startTransition();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  onRender() {
    const ctx = this.ctx;
    // Background
    ctx.fillStyle = CLR_BG;
    ctx.fillRect(0, 0, W, H);
    this._drawStars(ctx);

    if (this._phase === 'transition') {
      this._drawTransitionScreen(ctx);
      this._drawParticles(ctx);
      return;
    }

    this._drawBullets(ctx);
    this._drawEnemyBullets(ctx);
    this._drawEnemies(ctx);
    if (this._boss) this._drawBoss(ctx);
    this._drawPowerups(ctx);
    this._drawParticles(ctx);
    this._drawPlayer(ctx);
  }

  // ── Player movement ───────────────────────────────────────────────────────
  _movePlayer() {
    const goLeft  = this._heldKeys.has('ArrowLeft')  || this._heldKeys.has('KeyA') || this._mLeft;
    const goRight = this._heldKeys.has('ArrowRight') || this._heldKeys.has('KeyD') || this._mRight;
    if (goLeft)  this._px = Math.max(0, this._px - PLAYER_SPEED);
    if (goRight) this._px = Math.min(W - PLAYER_W, this._px + PLAYER_SPEED);
  }

  _handleFire() {
    const wantFire = true; // auto-fire always on
    if (!wantFire) return;
    const now = Date.now();
    if (now - this._lastFire < FIRE_COOLDOWN) return;
    this._lastFire = now;
    const cx = this._px + PLAYER_W / 2;
    this._bullets.push({ x: cx - BULLET_W / 2, y: this._py - BULLET_H });
    if (this._spreadShot) {
      this._bullets.push({ x: cx - BULLET_W / 2 - 14, y: this._py - BULLET_H + 6, angle: -0.18 });
      this._bullets.push({ x: cx - BULLET_W / 2 + 14, y: this._py - BULLET_H + 6, angle:  0.18 });
    }
  }

  _moveBullets() {
    for (const b of this._bullets) {
      b.y -= BULLET_SPEED;
      if (b.angle) b.x += Math.sin(b.angle) * BULLET_SPEED;
    }
    this._bullets = this._bullets.filter(b => b.y + BULLET_H > 0);
  }

  _moveEnemyBullets() {
    for (const b of this._enemyBullets) b.y += ENEMY_BULLET_SPEED + this._level * 0.3;
    this._enemyBullets = this._enemyBullets.filter(b => b.y < H);
  }

  _movePowerups() {
    for (const p of this._powerups) p.y += 1.8;
    this._powerups = this._powerups.filter(p => p.y < H + 20);
  }

  // ── Enemy spawning & movement ──────────────────────────────────────────────
  _spawnWave() {
    this._enemies  = [];
    this._boss     = null;
    this._enemyDir = 1;
    const isBossLevel = this._level % 3 === 0;
    if (isBossLevel) {
      this._spawnBoss();
      return;
    }
    const rows = Math.min(ENEMY_ROWS, 2 + Math.floor(this._level / 2));
    const startX = (W - ENEMY_GRID_W) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < ENEMY_COLS; c++) {
        this._enemies.push({
          x: startX + c * (ENEMY_W + ENEMY_GAP_X),
          y: ENEMY_TOP_Y + r * (ENEMY_H + ENEMY_GAP_Y),
          row: r, col: c, alive: true,
          hp: r === 0 ? 2 : 1,
        });
      }
    }
    this._enemyMoveTimer = 0;
    this._enemyFireTimer = 0;
  }

  _spawnBoss() {
    this._boss = {
      x: W / 2 - 55, y: 40,
      w: 110, h: 70,
      hp: 20 + this._level * 5,
      maxHp: 20 + this._level * 5,
      dir: 1,
      fireTimer: 0,
      phase: 0,
    };
  }

  _enemySpeed() { return 0.5 + this._level * 0.25; }

  _moveEnemies() {
    if (this._enemies.length === 0) return;
    this._enemyMoveTimer++;
    const tickEvery = Math.max(4, 22 - this._level * 2);
    if (this._enemyMoveTimer < tickEvery) return;
    this._enemyMoveTimer = 0;

    const speed = this._enemySpeed();
    const minX = Math.min(...this._enemies.map(e => e.x));
    const maxX = Math.max(...this._enemies.map(e => e.x + ENEMY_W));

    if (this._enemyDir === 1 && maxX + speed > W - 4) {
      this._enemies.forEach(e => e.y += 18);
      this._enemyDir = -1;
    } else if (this._enemyDir === -1 && minX - speed < 4) {
      this._enemies.forEach(e => e.y += 18);
      this._enemyDir = 1;
    } else {
      this._enemies.forEach(e => e.x += this._enemyDir * speed);
    }

    // Enemy fire
    this._enemyFireTimer++;
    const fireEvery = Math.max(30, 90 - this._level * 6);
    if (this._enemyFireTimer >= fireEvery && this._level >= 2) {
      this._enemyFireTimer = 0;
      const shooters = this._enemies.filter(e => e.alive);
      if (shooters.length) {
        const s = shooters[Math.floor(Math.random() * shooters.length)];
        this._enemyBullets.push({ x: s.x + ENEMY_W / 2 - ENEMY_BULLET_W / 2, y: s.y + ENEMY_H });
      }
    }
  }

  _moveBoss() {
    const b = this._boss;
    b.x += b.dir * (1.5 + this._level * 0.2);
    if (b.x + b.w > W - 10) b.dir = -1;
    if (b.x < 10)            b.dir =  1;
    // Boss fires
    b.fireTimer++;
    const fireEvery = Math.max(25, 60 - this._level * 3);
    if (b.fireTimer >= fireEvery) {
      b.fireTimer = 0;
      const cx = b.x + b.w / 2;
      this._enemyBullets.push({ x: cx - ENEMY_BULLET_W / 2, y: b.y + b.h });
      if (this._level >= 6) {
        this._enemyBullets.push({ x: cx - 20, y: b.y + b.h });
        this._enemyBullets.push({ x: cx + 20, y: b.y + b.h });
      }
    }
  }

  // ── Collision detection ────────────────────────────────────────────────────
  _rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  _checkBulletEnemyCollisions() {
    for (const b of this._bullets) {
      for (const e of this._enemies) {
        if (!e.alive) continue;
        if (this._rectHit(b.x, b.y, BULLET_W, BULLET_H, e.x, e.y, ENEMY_W, ENEMY_H)) {
          b.dead = true;
          e.hp--;
          if (e.hp <= 0) {
            e.alive = false;
            this._score += SCORE_ENEMY * this._level;
            this.updateScore(this._score);
            this._spawnParticles(e.x + ENEMY_W / 2, e.y + ENEMY_H / 2, 8, this._enemyColor(e.row));
            this._maybeDropPowerup(e.x + ENEMY_W / 2, e.y + ENEMY_H / 2);
          }
        }
      }
    }
    this._bullets  = this._bullets.filter(b => !b.dead);
    this._enemies  = this._enemies.filter(e => e.alive);
  }

  _checkBulletBossCollision() {
    const b = this._boss;
    for (const bullet of this._bullets) {
      if (this._rectHit(bullet.x, bullet.y, BULLET_W, BULLET_H, b.x, b.y, b.w, b.h)) {
        bullet.dead = true;
        b.hp--;
        this._spawnParticles(bullet.x, bullet.y, 3, CLR_BOSS);
        if (b.hp <= 0) {
          this._score += SCORE_BOSS;
          this.updateScore(this._score);
          this._spawnParticles(b.x + b.w / 2, b.y + b.h / 2, 30, CLR_BOSS);
          this._boss = null;
        }
      }
    }
    this._bullets = this._bullets.filter(bu => !bu.dead);
  }

  _checkEnemyBulletPlayerCollision() {
    if (this._invincible > 0) return;
    const px = this._px, py = this._py;
    for (const b of this._enemyBullets) {
      if (this._rectHit(b.x, b.y, ENEMY_BULLET_W, ENEMY_BULLET_H, px + 6, py + 6, PLAYER_W - 12, PLAYER_H - 10)) {
        if (this._shield) {
          this._shield = false; this._shieldTimer = 0;
          b.dead = true;
          this._spawnParticles(px + PLAYER_W / 2, py, 10, '#38bdf8');
        } else {
          b.dead = true;
          this._loseLife();
          return;
        }
      }
    }
    this._enemyBullets = this._enemyBullets.filter(b => !b.dead);
  }

  _checkEnemiesReachedBottom() {
    if (this._enemies.some(e => e.y + ENEMY_H >= this._py)) {
      this._loseLife();
      // Reset enemy positions to top
      this._spawnWave();
    }
  }

  _checkPowerupCollision() {
    const px = this._px, py = this._py;
    this._powerups = this._powerups.filter(p => {
      if (this._rectHit(px, py, PLAYER_W, PLAYER_H, p.x - 14, p.y - 14, 28, 28)) {
        this._applyPowerup(p.type);
        this._spawnParticles(p.x, p.y, 8, '#fde68a');
        return false;
      }
      return true;
    });
  }

  _loseLife() {
    this._lives--;
    this._invincible = 90; // ~1.5 s at 60fps
    this._spawnParticles(this._px + PLAYER_W / 2, this._py + PLAYER_H / 2, 16, CLR_SHIP);
    this._updateLivesDisplay();
    if (this._lives <= 0) {
      this._hiScore = Math.max(this._hiScore, this._score);
      const hiEl = document.getElementById('hiScoreEl');
      if (hiEl) hiEl.textContent = this._hiScore;
      this.end({
        emoji: '💀', title: 'Game Over',
        subtitle: `You reached Level ${this._level}!`,
        finalScore: `Score: ${this._score}  ·  Best: ${this._hiScore}`,
        buttonLabel: 'Play Again',
      });
    }
  }

  // ── Power-ups ──────────────────────────────────────────────────────────────
  _maybeDropPowerup(x, y) {
    if (Math.random() > 0.12) return; // 12% chance
    const types = ['shield', 'spread', 'speed'];
    const type  = types[Math.floor(Math.random() * types.length)];
    this._powerups.push({ x, y, type });
  }

  _applyPowerup(type) {
    if (type === 'shield')  { this._shield = true;     this._shieldTimer  = 300; }
    if (type === 'spread')  { this._spreadShot = true; this._spreadTimer  = 600; }
    if (type === 'speed')   { /* temporary speed boost handled inline */ }
  }

  // ── Level progression ──────────────────────────────────────────────────────
  _startTransition() {
    this._phase = 'transition';
    this._transTimer = 120; // 2 s at 60fps
    this._bullets = []; this._enemyBullets = []; this._powerups = [];
  }

  _startNextLevel() {
    this._level++;
    this._phase = 'playing';
    this.updateSpeedBadge(this._level - 1);
    this._spawnWave();
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  _spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this._particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.floor(Math.random() * 20),
        maxLife: 50,
        color,
        r: 2 + Math.random() * 2.5,
      });
    }
  }

  _updateParticles() {
    for (const p of this._particles) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.06; // gravity
      p.life--;
    }
    this._particles = this._particles.filter(p => p.life > 0);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  _makeStars() {
    return Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.5 + Math.random() * 1.5,
      alpha: 0.3 + Math.random() * 0.7,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  _updateLivesDisplay() {
    const el = document.getElementById('livesEl');
    if (el) el.textContent = '❤️'.repeat(Math.max(0, this._lives));
  }

  _enemyColor(row) {
    if (row === 0) return CLR_ENEMY_A;
    if (row <= 2)  return CLR_ENEMY_B;
    return CLR_ENEMY_C;
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  _drawStars(ctx) {
    const t = Date.now() / 1000;
    for (const s of this._stars) {
      const alpha = s.alpha * (0.7 + 0.3 * Math.sin(t * 1.5 + s.twinkle));
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawPlayer(ctx) {
    const x = this._px, y = this._py;
    const cx = x + PLAYER_W / 2;
    const blink = this._invincible > 0 && Math.floor(this._invincible / 6) % 2 === 0;
    if (blink) return;

    // Engine flame
    const flameH = 10 + 6 * Math.sin(Date.now() / 80);
    const flamGrad = ctx.createLinearGradient(cx, y + PLAYER_H, cx, y + PLAYER_H + flameH);
    flamGrad.addColorStop(0, '#f97316'); flamGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flamGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 7, y + PLAYER_H);
    ctx.lineTo(cx, y + PLAYER_H + flameH);
    ctx.lineTo(cx + 7, y + PLAYER_H);
    ctx.closePath(); ctx.fill();

    // Ship body
    const grad = ctx.createLinearGradient(x, y, x, y + PLAYER_H);
    grad.addColorStop(0, '#c4b5fd'); grad.addColorStop(1, '#4338ca');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x + PLAYER_W, y + PLAYER_H);
    ctx.lineTo(x + PLAYER_W - 6, y + PLAYER_H);
    ctx.lineTo(cx, y + PLAYER_H - 8);
    ctx.lineTo(x + 6, y + PLAYER_H);
    ctx.lineTo(x, y + PLAYER_H);
    ctx.closePath(); ctx.fill();

    // Wings
    ctx.fillStyle = '#818cf8';
    ctx.beginPath(); ctx.moveTo(cx - 8, y + 20); ctx.lineTo(x - 4, y + PLAYER_H); ctx.lineTo(cx - 4, y + PLAYER_H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 8, y + 20); ctx.lineTo(x + PLAYER_W + 4, y + PLAYER_H); ctx.lineTo(cx + 4, y + PLAYER_H); ctx.closePath(); ctx.fill();

    // Cockpit
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath(); ctx.ellipse(cx, y + 18, 6, 9, 0, 0, Math.PI * 2); ctx.fill();

    // Shield ring
    if (this._shield) {
      const pulse = 0.55 + 0.35 * Math.sin(Date.now() / 200);
      ctx.save();
      ctx.strokeStyle = `rgba(56,189,248,${pulse})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(cx, y + PLAYER_H / 2, PLAYER_W * 0.75, PLAYER_H * 0.65, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  _drawBullets(ctx) {
    ctx.save();
    ctx.shadowColor = CLR_BULLET; ctx.shadowBlur = 8;
    ctx.fillStyle = CLR_BULLET;
    for (const b of this._bullets) {
      ctx.beginPath(); ctx.roundRect(b.x, b.y, BULLET_W, BULLET_H, 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawEnemyBullets(ctx) {
    ctx.save();
    ctx.shadowColor = CLR_ENEMY_BULLET; ctx.shadowBlur = 8;
    ctx.fillStyle = CLR_ENEMY_BULLET;
    for (const b of this._enemyBullets) {
      ctx.beginPath(); ctx.roundRect(b.x, b.y, ENEMY_BULLET_W, ENEMY_BULLET_H, 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawEnemies(ctx) {
    for (const e of this._enemies) {
      const color = this._enemyColor(e.row);
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      // UFO body
      ctx.beginPath();
      ctx.ellipse(e.x + ENEMY_W / 2, e.y + ENEMY_H * 0.65, ENEMY_W / 2, ENEMY_H * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dome
      ctx.fillStyle = `rgba(255,255,255,0.25)`;
      ctx.beginPath();
      ctx.ellipse(e.x + ENEMY_W / 2, e.y + ENEMY_H * 0.55, ENEMY_W * 0.28, ENEMY_H * 0.3, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // HP pip for row 0 (2-hit)
      if (e.row === 0 && e.hp === 2) {
        ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', e.x + ENEMY_W / 2, e.y + ENEMY_H * 0.65);
      }
      ctx.restore();
    }
  }

  _drawBoss(ctx) {
    const b = this._boss;
    const cx = b.x + b.w / 2;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300);
    ctx.save();
    ctx.shadowColor = CLR_BOSS; ctx.shadowBlur = 20 * pulse;

    // Main body
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    grad.addColorStop(0, '#fde68a'); grad.addColorStop(1, '#92400e');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 12); ctx.fill();

    // Cannons
    ctx.fillStyle = '#78350f';
    ctx.fillRect(b.x + 8, b.y + b.h - 12, 14, 18);
    ctx.fillRect(b.x + b.w - 22, b.y + b.h - 12, 14, 18);

    // Eye
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.ellipse(cx, b.y + b.h * 0.4, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx, b.y + b.h * 0.4, 6, 7, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // HP bar
    const barW = b.w + 20, barH = 8;
    const bx = b.x - 10, by = b.y - 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(bx, by, barW, barH, 3); ctx.fill();
    const hpFrac = b.hp / b.maxHp;
    const hpColor = hpFrac > 0.5 ? '#4ade80' : hpFrac > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.beginPath(); ctx.roundRect(bx, by, barW * hpFrac, barH, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BOSS', bx + barW / 2, by + barH / 2);
  }

  _drawPowerups(ctx) {
    const icons = { shield: '🛡️', spread: '✨', speed: '⚡' };
    for (const p of this._powerups) {
      ctx.save();
      ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 12;
      ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons[p.type] ?? '★', p.x, p.y);
      ctx.restore();
    }
  }

  _drawParticles(ctx) {
    for (const p of this._particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2); ctx.fill();
    }
  }

  _drawTransitionScreen(ctx) {
    const isBossNext = this._level % 3 === 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 250);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(196,181,253,${pulse})`;
    ctx.font = 'bold 32px "Segoe UI",sans-serif';
    ctx.fillText(`✅ Wave Cleared!`, W / 2, H / 2 - 30);
    ctx.font = '18px "Segoe UI",sans-serif';
    ctx.fillStyle = `rgba(129,140,248,${pulse})`;
    const nextMsg = isBossNext ? `⚠️  BOSS incoming on Level ${this._level + 1}!` : `Level ${this._level + 1} starting…`;
    ctx.fillText(nextMsg, W / 2, H / 2 + 14);
    ctx.restore();
  }
}

new GalaxyShooterGame();
