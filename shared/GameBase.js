/**
 * shared/GameBase.js
 *
 * Base class for every game in the arcade.
 *
 * Provides:
 *  • A 4-state state machine: IDLE → RUNNING ↔ PAUSED → GAME_OVER
 *  • Shared UI helpers: overlay, speed badge, score display
 *  • A requestAnimationFrame game loop with tick/render hooks
 *  • Pause toggle wired to the ⏸ button and P/Escape keys
 *
 * Subclasses MUST implement:
 *  onInit()    – reset all game-specific state variables
 *  onTick()    – one logic step (physics, collisions, spawning)
 *  onRender()  – draw the current frame to the canvas
 *
 * Subclasses MAY override:
 *  onStart()   – called once just before the loop begins (default: no-op)
 *  onPause()   – called when game pauses  (default: no-op)
 *  onResume()  – called when game resumes (default: no-op)
 *  onEnd(result) – called after the loop stops (default: shows overlay)
 */

export const STATE = Object.freeze({
  IDLE:      'IDLE',
  RUNNING:   'RUNNING',
  PAUSED:    'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

export class GameBase {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {object}  opts.els           – DOM element references
   * @param {HTMLElement} opts.els.overlay
   * @param {HTMLElement} opts.els.overlayEmoji
   * @param {HTMLElement} opts.els.overlayTitle
   * @param {HTMLElement} opts.els.overlaySubtitle
   * @param {HTMLElement} opts.els.overlayFinal
   * @param {HTMLElement} opts.els.btnStart
   * @param {HTMLElement} opts.els.speedBadge
   * @param {HTMLElement} opts.els.scoreEl
   * @param {HTMLElement} [opts.els.btnPause]
   * @param {HTMLElement} [opts.els.pauseOverlay]
   */
  constructor({ canvas, els }) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.els    = els;
    this._state = STATE.IDLE;
    this._raf   = null;

    // Wire Start / Play-Again button
    els.btnStart.addEventListener('click', () => this.start());

    // Wire optional pause button
    if (els.btnPause) {
      els.btnPause.addEventListener('click', () => this.togglePause());
    }

    // Wire P / Escape to toggle pause
    document.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (this._state === STATE.RUNNING || this._state === STATE.PAUSED) {
          e.preventDefault();
          this.togglePause();
        }
      }
    });

    // Wire pause overlay click-to-resume
    if (els.pauseOverlay) {
      els.pauseOverlay.addEventListener('click', () => {
        if (this._state === STATE.PAUSED) this.togglePause();
      });
    }
  }

  // ── State machine ────────────────────────────────────────────────

  get state() { return this._state; }
  get isRunning() { return this._state === STATE.RUNNING; }

  start() {
    cancelAnimationFrame(this._raf);
    this._state = STATE.RUNNING;
    this.hideOverlay();
    if (this.els.btnPause) {
      this.els.btnPause.disabled    = false;
      this.els.btnPause.textContent = '⏸';
    }
    if (this.els.pauseOverlay) this.els.pauseOverlay.classList.add('hidden');
    this.onInit();
    this.onStart();
    this._loop();
  }

  togglePause() {
    if (this._state === STATE.RUNNING) {
      this._state = STATE.PAUSED;
      cancelAnimationFrame(this._raf);
      if (this.els.btnPause)    this.els.btnPause.textContent = '▶';
      if (this.els.pauseOverlay) this.els.pauseOverlay.classList.remove('hidden');
      this.onPause();
    } else if (this._state === STATE.PAUSED) {
      this._state = STATE.RUNNING;
      if (this.els.btnPause)    this.els.btnPause.textContent = '⏸';
      if (this.els.pauseOverlay) this.els.pauseOverlay.classList.add('hidden');
      this.onResume();
      this._loop();
    }
  }

  end(result = {}) {
    cancelAnimationFrame(this._raf);
    this._state = STATE.GAME_OVER;
    if (this.els.btnPause) {
      this.els.btnPause.disabled    = true;
      this.els.btnPause.textContent = '⏸';
    }
    this.onEnd(result);
  }

  // ── Internal RAF loop ────────────────────────────────────────────

  _loop() {
    if (this._state !== STATE.RUNNING) return;
    this.onTick();
    if (this._state !== STATE.RUNNING) return; // onTick may call end()
    this.onRender();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // ── Shared UI helpers ────────────────────────────────────────────

  showOverlay({ emoji, title, subtitle, finalScore = null, buttonLabel }) {
    const { overlayEmoji, overlayTitle, overlaySubtitle, overlayFinal, btnStart } = this.els;
    overlayEmoji.textContent    = emoji;
    overlayTitle.textContent    = title;
    overlaySubtitle.textContent = subtitle;
    btnStart.textContent        = buttonLabel;
    if (overlayFinal) {
      overlayFinal.textContent = finalScore ?? '';
      overlayFinal.classList.toggle('hidden', finalScore === null);
    }
    this.els.overlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.els.overlay.classList.add('hidden');
  }

  updateSpeedBadge(level) {
    const lv = level + 1;
    const el = this.els.speedBadge;
    el.textContent = `Lv. ${lv}`;
    el.className   = `speed-badge${lv > 1 ? ` lv${lv}` : ''}`;
  }

  updateScore(score, el = this.els.scoreEl) {
    if (el) el.textContent = score;
  }

  // ── Hooks (subclasses implement / override) ──────────────────────

  onInit()    { throw new Error(`${this.constructor.name} must implement onInit()`);   }
  onTick()    { throw new Error(`${this.constructor.name} must implement onTick()`);   }
  onRender()  { throw new Error(`${this.constructor.name} must implement onRender()`); }
  onStart()   {}
  onPause()   {}
  onResume()  {}
  onEnd(result) {
    this.showOverlay({
      emoji:       result.emoji       ?? '🏁',
      title:       result.title       ?? 'Game Over',
      subtitle:    result.subtitle    ?? '',
      finalScore:  result.finalScore  ?? null,
      buttonLabel: result.buttonLabel ?? 'Play Again',
    });
  }
}
