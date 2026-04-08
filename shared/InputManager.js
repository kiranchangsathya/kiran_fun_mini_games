/**
 * shared/InputManager.js
 *
 * Action-based input abstraction.
 *
 * Instead of each game hard-coding key strings, games register named
 * actions and bind callbacks to them. The manager handles keyboard,
 * click, and touchstart uniformly — adding a new input device (e.g.
 * gamepad) means updating only this file.
 *
 * Usage:
 *   const input = new InputManager();
 *
 *   // Map action names → the keys that trigger them
 *   input.register({
 *     up:    ['ArrowUp', 'w', 'W'],
 *     down:  ['ArrowDown', 's', 'S'],
 *     left:  ['ArrowLeft', 'a', 'A'],
 *     right: ['ArrowRight', 'd', 'D'],
 *     jump:  ['Space', 'ArrowUp'],
 *   });
 *
 *   // Listen for an action
 *   input.on('jump', () => dino.tryJump());
 *
 *   // Bind a DOM button to an action (click + touchstart)
 *   input.bindButton(document.getElementById('btnJump'), 'jump');
 *
 *   // Remove all listeners (call when game is destroyed / navigated away)
 *   input.destroy();
 */

export class InputManager {
  constructor() {
    /** @type {Map<string, string>}  key/code → action name */
    this._keyMap = new Map();

    /** @type {Map<string, Set<Function>>}  action name → callbacks */
    this._listeners = new Map();

    this._onKeyDown = this._handleKey.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
  }

  // ── Registration ─────────────────────────────────────────────────

  /**
   * Register an action map.
   * @param {Record<string, string[]>} actionMap  { actionName: [key, ...] }
   */
  register(actionMap) {
    for (const [action, keys] of Object.entries(actionMap)) {
      for (const key of keys) {
        this._keyMap.set(key, action);
      }
    }
  }

  // ── Listening ────────────────────────────────────────────────────

  /**
   * Register a callback for a named action.
   * Multiple callbacks per action are supported.
   * @param {string}   action
   * @param {Function} callback
   */
  on(action, callback) {
    if (!this._listeners.has(action)) this._listeners.set(action, new Set());
    this._listeners.get(action).add(callback);
  }

  /**
   * Remove a specific callback from an action.
   * @param {string}   action
   * @param {Function} callback
   */
  off(action, callback) {
    this._listeners.get(action)?.delete(callback);
  }

  // ── Button binding ────────────────────────────────────────────────

  /**
   * Bind a DOM element's click and touchstart events to an action.
   * The bound handlers are stored on the element so destroy() can clean up.
   * @param {HTMLElement} el
   * @param {string}      action
   */
  bindButton(el, action) {
    const onClick = (e) => {
      e.preventDefault();
      this._fire(action);
    };
    const onTouch = (e) => {
      e.preventDefault();
      this._fire(action);
    };

    el.addEventListener('click',      onClick);
    el.addEventListener('touchstart', onTouch, { passive: false });

    // Store so destroy() can remove them
    if (!el._inputBindings) el._inputBindings = [];
    el._inputBindings.push({ onClick, onTouch });
  }

  /**
   * Unbind all InputManager-managed listeners from a button.
   * @param {HTMLElement} el
   */
  unbindButton(el) {
    for (const { onClick, onTouch } of (el._inputBindings ?? [])) {
      el.removeEventListener('click',      onClick);
      el.removeEventListener('touchstart', onTouch);
    }
    delete el._inputBindings;
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  /** Remove the global keydown listener. Call when leaving the game page. */
  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    this._listeners.clear();
    this._keyMap.clear();
  }

  // ── Internals ─────────────────────────────────────────────────────

  _handleKey(e) {
    // Match on both e.key (character) and e.code (physical key)
    const action = this._keyMap.get(e.key) ?? this._keyMap.get(e.code);
    if (!action) return;
    e.preventDefault();
    this._fire(action);
  }

  _fire(action) {
    for (const cb of (this._listeners.get(action) ?? [])) cb();
  }
}
