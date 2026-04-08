# 🎮 Kiran's Fun Mini Games

A collection of browser-based arcade games built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, no installs required.

---

## 🕹️ Games

| Game | Description |
|---|---|
| 🐍 **Snake** | Eat food, grow your snake, don't crash. Solo or 2-player mode. |
| 🦕 **Dino Run** | Jump over cacti and survive as long as you can. Speed increases as you level up. |

---

## 🚀 How to Run

### Option 1 — Python (recommended, built into macOS & Linux)

```bash
# Navigate to the project folder
cd /path/to/games

# Start a local server
python3 -m http.server 8080
```

Then open your browser and go to:
```
http://localhost:8080
```

### Option 2 — Node.js

```bash
# Install a one-time static server (if you don't have one)
npx serve .
```

Then open the URL shown in the terminal (usually `http://localhost:3000`).

### Option 3 — VS Code Live Server extension

1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` in the file explorer
3. Select **"Open with Live Server"**

> ⚠️ **Do not open `index.html` directly as a `file://` URL in your browser.**
> The game uses ES modules (`import`/`export`) which require a local HTTP server to work correctly.

---

## 🎮 Controls

### 🐍 Snake

| Action | Player 1 | Player 2 (duo mode) |
|---|---|---|
| Move Up | `↑` Arrow | `W` |
| Move Down | `↓` Arrow | `S` |
| Move Left | `←` Arrow | `A` |
| Move Right | `→` Arrow | `D` |
| Pause | `P` or `Esc` | `P` or `Esc` |
| Mouse / Touch | P1 green D-pad | P2 blue D-pad |

### 🦕 Dino Run

| Action | Input |
|---|---|
| Jump | `Space` or `↑` Arrow |
| Jump (mouse/touch) | **⬆ JUMP** button |

---

## 📁 Project Structure

```
games/
├── index.html          # Home page — pick a game
├── home.css            # Home page styles
├── games.config.js     # Game registry (add new games here)
│
├── shared/
│   ├── theme.css       # Design tokens shared across all games
│   ├── GameBase.js     # Base class: state machine + shared UI helpers
│   └── InputManager.js # Action-based keyboard/touch input abstraction
│
├── snake/
│   ├── index.html
│   ├── game.js         # SnakeGame extends GameBase
│   └── style.css
│
└── dino/
    ├── index.html
    ├── game.js         # DinoGame extends GameBase
    └── style.css
```

---

## ➕ Adding a New Game

1. Add one entry to `games.config.js` — the home page card appears automatically.
2. Create a `mygame/` folder with `index.html`, `game.js`, and `style.css`.
3. In `game.js`, extend `GameBase` and implement three hooks:
   - `onInit()` — reset all game state
   - `onTick()` — one logic step (physics, collision, etc.)
   - `onRender()` — draw the current frame to the canvas
4. Use `InputManager` to register keyboard/button controls.
