# Augment Rules — Kiran's Fun Mini Games Arcade

## Project Overview
A collection of browser-based arcade games built with **vanilla HTML5, CSS, and ES modules**.
No frameworks, no build tools, no package manager. Target audience: **young children** — UI must stay large, colourful, and touch-friendly at all times.

---

## 1. Tech Stack Constraints
- **Vanilla JS only** — no React, Vue, TypeScript, or any npm packages.
- **ES modules** (`import`/`export`) everywhere. Never use `<script>` without `type="module"`.
- **No global scope pollution** — every symbol lives inside a module or class.
- A local HTTP server is required to run the project (`python3 -m http.server 8080`). Never open HTML files directly as `file://` URLs.

---

## 2. Adding a New Game — Mandatory Checklist
Every new game **must** follow all of these steps, in order:

1. Create a folder `<gamename>/` containing exactly three files:
   - `index.html` — page structure
   - `game.js` — game logic (ES module)
   - `style.css` — game-specific layout overrides
2. Register the game in `games.config.js` with all required fields (`id`, `name`, `emoji`, `accentColor`, `description`, `href`, `controls`). The home page card appears automatically — no other file needs editing.
3. Update `README.md`: add a row to the Games table, a Controls section, and the folder to the Project Structure tree.

---

## 3. Game Architecture — GameBase

Every game class **must** extend `GameBase` from `shared/GameBase.js`.

### Required hooks (must be implemented — they throw if missing)
| Hook | Purpose |
|---|---|
| `onInit()` | Reset **all** game-specific state. Called on every new game / play-again. |
| `onTick()` | One logic step — physics, collisions, spawning. Called each RAF frame. |
| `onRender()` | Draw the current frame to the canvas. Called after every `onTick()`. |

### Optional hooks (override when needed)
| Hook | Default |
|---|---|
| `onStart()` | no-op — called once after `onInit()`, before the loop begins |
| `onPause()` | no-op |
| `onResume()` | no-op |
| `onEnd(result)` | calls `showOverlay()` with the result object |

### State machine — never touch `_state` directly
Use the public API only:
- `this.start()` — IDLE → RUNNING
- `this.togglePause()` — RUNNING ↔ PAUSED
- `this.end(result)` — any → GAME_OVER

### Game loop
- The default loop is **requestAnimationFrame** via `GameBase._loop()`.
- If a game needs `setInterval` instead (e.g. Snake's fixed tick rate), override `_loop()` as a no-op and manage the interval in `onStart()`, `onPause()`, and `onResume()`.

---

## 4. Input — InputManager

Always use `InputManager` from `shared/InputManager.js`. Never attach raw `keydown` listeners for game actions.

- `input.register({ action: ['Key1', 'Key2'] })` — map keys to named actions.
- `input.on('action', callback)` — respond to an action.
- `input.bindButton(el, 'action')` — bind a DOM button (click + touchstart).
- For **held** keys (e.g. paddle movement), track press/release state manually with `keydown`/`keyup` and mirror it on D-pad buttons with `mousedown`/`touchstart` → `mouseup`/`touchend`/`mouseleave`.
- Every game must support **both keyboard and on-screen D-pad / button controls**.

---

## 5. DOM References
- Collect **all** `getElementById` calls in a single `getRefs()` helper function at the top of `game.js`.
- Pass the result object to `super({ canvas, els })` and store it as `this._r` for game-specific use.
- Never scatter `getElementById` calls throughout the class body.

---

## 6. Required HTML IDs
Every `index.html` must include elements with these exact IDs so `GameBase` can wire them up:

| ID | Element | Purpose |
|---|---|---|
| `gameCanvas` | `<canvas>` | Rendering surface |
| `overlay` | `<div class="overlay">` | Start / game-over screen |
| `overlayEmoji` | `<p>` | Large emoji in overlay |
| `overlayTitle` | `<h2>` | Title in overlay |
| `overlaySubtitle` | `<p>` | Subtitle / hint in overlay |
| `overlayFinal` | `<p class="hidden">` | Final score (hidden until game over) |
| `btnStart` | `<button class="btn-primary">` | Start / Play Again |
| `speedBadge` | `<span class="speed-badge">` | Live difficulty level indicator |

Optional but follow the same naming convention if present: `btnPause`, `pauseOverlay`.

---

## 7. CSS Rules

### Load order — always this sequence in `<head>`
```html
<link rel="stylesheet" href="../shared/theme.css" />
<link rel="stylesheet" href="style.css" />
```

### Use design tokens, never hardcode shared values
All colours, radii, and font stacks are in `shared/theme.css` as CSS custom properties.  
Use them (`var(--clr-bg)`, `var(--radius-md)`, etc.) — do not repeat raw hex values that already exist in the theme.

### Game accent colour
- Each game has one accent colour defined in `games.config.js` (`accentColor`).
- Override `.btn-primary` in the game's `style.css` to use that accent colour.
- The home-page card glow uses the same value via the `--accent` CSS variable — no extra work needed.

### Responsive canvas sizing
Use CSS custom properties inside `.wrapper` to compute a responsive canvas size:
```css
.wrapper {
  --game-w: min(NNNpx, calc(100vw - 32px));
  --game-h: min(NNNpx, calc(100vh - 230px));
}
```
Set `width: var(--game-w); height: var(--game-h)` on `.canvas-container`.  
Then set `canvas.width` / `canvas.height` in `onInit()` to match the logical resolution constants.

---

## 8. Progressive Difficulty
- Define a `SPEED_TABLE` (or equivalent) array of level configs at the top of `game.js`.
- Increase difficulty every N score points — always call `this.updateSpeedBadge(level)` when the level changes so the badge updates.
- All speed and size constants go at the top of the file — never hard-code magic numbers inline.

---

## 9. Kid-Friendly UI Requirements
- **Touch targets** — all interactive buttons must be at least **44 × 44 px**.
- **D-pad / on-screen controls** — every directional input must have a corresponding on-screen button, labelled with an arrow glyph (↑ ↓ ← →).
- **Overlay** — always show the start overlay (`showOverlay(...)`) in the constructor so the game never starts without the player choosing to.
- **Footer** — every page must have a `<footer class="footer">` that summarises the controls in plain language.
- **Pause** — every game must support pause via `P` or `Esc` and a ⏸ button in the header.
- **Colour pickers** — where a game has customisable element colours (snake body, ball, paddle…), always present them as swatch buttons in the start overlay so players can personalise before playing.

---

## 10. File Hygiene
- Delete or ignore legacy standalone files (e.g. `snake/snake.js`, `dino/dino.js`) — the canonical entry point is always `game.js`.
- `shared/GameBase.js` and `shared/InputManager.js` are the only shared JS files. Do not add utilities to `shared/` without a clear reason that benefits multiple games.
- Do not create additional documentation files beyond `README.md` unless explicitly requested.
