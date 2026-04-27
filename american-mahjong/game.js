import { GameBase, STATE } from '../shared/GameBase.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS      = 9;   // columns per grid (1–9)
const ROWS      = 4;   // tiles deep per column
const CENTER_W  = 90;  // px reserved for centre strip
const MARGIN    = 20;  // px reserved at top for player name banners

// Suit ownership
const SUIT = { p1: 'dots', p2: 'bamboos' };

// ── Tile factories ────────────────────────────────────────────────────────────
function makeSuitTiles(suit) {
  // 4 copies of each number 1–9 = 36 tiles
  const tiles = [];
  for (let n = 1; n <= 9; n++)
    for (let c = 0; c < 4; c++)
      tiles.push({ number: n, suit, faceUp: false });
  return tiles;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// All 72 tiles (36 Dots + 36 Bamboos) shuffled randomly across both grids.
// Each grid gets 36 tiles but a random mix of both suits.
function makeSharedGrids() {
  const all = shuffle([...makeSuitTiles('dots'), ...makeSuitTiles('bamboos')]);
  const makeGrid = (tiles) => {
    const grid = [];
    for (let c = 0; c < COLS; c++)
      grid.push(tiles.slice(c * ROWS, c * ROWS + ROWS));
    return grid;
  };
  return { p1: makeGrid(all.slice(0, 36)), p2: makeGrid(all.slice(36)) };
}

// ── DOM helper ────────────────────────────────────────────────────────────────
function _getEls() {
  return {
    canvas:          document.getElementById('gameCanvas'),
    overlay:         document.getElementById('overlay'),
    overlayEmoji:    document.getElementById('overlayEmoji'),
    overlayTitle:    document.getElementById('overlayTitle'),
    overlaySubtitle: document.getElementById('overlaySubtitle'),
    overlayFinal:    document.getElementById('overlayFinal'),
    btnStart:        document.getElementById('btnStart'),
    speedBadge:      document.getElementById('speedBadge'),
    scoreEl:         null,
    nameP1:          document.getElementById('nameP1'),
    nameP2:          document.getElementById('nameP2'),
    scoreP1:         document.getElementById('scoreP1'),
    scoreP2:         document.getElementById('scoreP2'),
    statusText:      document.getElementById('statusText'),
    nameInputP1:     document.getElementById('nameInputP1'),
    nameInputP2:     document.getElementById('nameInputP2'),
    modeComputer:    document.getElementById('modeComputer'),
    modeFriend:      document.getElementById('modeFriend'),
    p2LabelText:     document.getElementById('p2LabelText'),
    spinModal:       document.getElementById('spinModal'),
    spinCanvas:      document.getElementById('spinCanvas'),
    spinResult:      document.getElementById('spinResult'),
    btnSpin:         document.getElementById('btnSpin'),
    btnPlay:         document.getElementById('btnPlay'),
  };
}

// ── Main Game Class ───────────────────────────────────────────────────────────
class AmericanMahjongGame extends GameBase {
  constructor() {
    const els = _getEls();
    super({ canvas: els.canvas, els });
    this._r = els;

    this._mode        = 'computer';
    this._playerNames = { p1: 'Player 1', p2: 'Computer' };
    this._firstPlayer = 'p1';

    // Per-round state
    this._grids             = { p1: null, p2: null };
    this._handTile          = null;   // tile currently in hand
    this._poppedTile        = null;   // tile just popped out, waiting to be revealed
    this._winnerAfterReveal = null;   // set when win detected, announced after last reveal
    this._currentTurn       = 'p1';
    this._locked            = false;  // prevents input during AI/animations
    this._phase             = 'idle'; // 'idle' | 'take-middle' | 'playing' | 'revealing'
    this._middleTile        = null;

    this._setupModeToggle();
    this._setupCanvasClick();
    this._setupSpinModal();

    this.showOverlay({
      emoji: '🀄', title: 'American Mahjong',
      subtitle: 'Push tiles through your 4×9 grid. Chain your suit · pass the opponent\'s · Dragon is wild!',
      finalScore: null, buttonLabel: 'Start Game',
    });
  }

  // ── Mode toggle ──────────────────────────────────────────────────────────────
  _setupModeToggle() {
    const { modeComputer, modeFriend, nameInputP2, p2LabelText } = this._r;
    modeComputer.addEventListener('click', () => {
      this._mode = 'computer';
      modeComputer.classList.add('active'); modeFriend.classList.remove('active');
      nameInputP2.classList.add('hidden'); p2LabelText.textContent = 'Computer';
    });
    modeFriend.addEventListener('click', () => {
      this._mode = 'friend';
      modeFriend.classList.add('active'); modeComputer.classList.remove('active');
      nameInputP2.classList.remove('hidden'); p2LabelText.textContent = 'Player';
    });
  }

  // ── Override start → show spin wheel first ───────────────────────────────────
  start() {
    this._playerNames.p1 = this._r.nameInputP1.value.trim() || 'Player 1';
    this._playerNames.p2 = this._mode === 'computer'
      ? 'Computer'
      : (this._r.nameInputP2.value.trim() || 'Player 2');
    this._r.overlay.classList.add('hidden');
    this._showSpinModal();
  }

  // ── Spin wheel ───────────────────────────────────────────────────────────────
  _setupSpinModal() {
    this._r.btnSpin.addEventListener('click', () => this._spinWheel());
    this._r.btnPlay.addEventListener('click', () => this._launchGame());
  }

  _showSpinModal() {
    const { spinModal, spinResult, btnSpin, btnPlay } = this._r;
    spinResult.textContent = '\u00a0';
    btnPlay.classList.add('hidden');
    btnSpin.disabled = false;
    spinModal.classList.remove('hidden');
    this._drawSpinWheel(0);
  }

  _drawSpinWheel(angle) {
    const canvas = this._r.spinCanvas;
    const ctx    = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 4;
    const names  = [this._playerNames.p1, this._playerNames.p2];
    const colors = ['#3b82f6', '#22c55e'];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 2; i++) {
      const start = angle + i * Math.PI, end = start + Math.PI;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, end); ctx.closePath();
      ctx.fillStyle = colors[i]; ctx.fill();
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3; ctx.stroke();
      const mid = start + Math.PI / 2;
      ctx.save(); ctx.translate(cx + Math.cos(mid) * r * 0.58, cy + Math.sin(mid) * r * 0.58);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Segoe UI",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lbl = names[i].length > 9 ? names[i].slice(0, 8) + '…' : names[i];
      ctx.fillText(lbl, 0, 0); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b'; ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.stroke();
  }

  _spinWheel() {
    const { btnSpin, spinResult, btnPlay } = this._r;
    btnSpin.disabled = true; spinResult.textContent = 'Spinning…';
    const totalRot = Math.PI * 2 * (5 + Math.random() * 5);
    const duration = 3500, t0 = performance.now();
    const base = -Math.PI / 2;
    const animate = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const angle = base + totalRot * eased;
      this._drawSpinWheel(angle);
      if (p < 1) { requestAnimationFrame(animate); return; }
      const norm = ((angle % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2);
      const ptr  = (3 * Math.PI / 2 - (angle % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2);
      this._firstPlayer = ptr < Math.PI ? 'p1' : 'p2';
      const wName = this._playerNames[this._firstPlayer];
      spinResult.textContent = `🐉 ${wName} takes the Dragon!`;
      btnPlay.classList.remove('hidden');
    };
    requestAnimationFrame(animate);
  }

  _launchGame() {
    this._r.spinModal.classList.add('hidden');
    this._currentTurn = this._firstPlayer;
    super.start(); // calls onInit then _loop
  }

  // ── GameBase hooks ───────────────────────────────────────────────────────────
  onInit() {
    const container = document.getElementById('canvasContainer');
    const W = container.clientWidth  || 800;
    const H = container.clientHeight || 320;
    this._r.canvas.width  = W;
    this._r.canvas.height = H;

    this._grids             = makeSharedGrids(); // all 72 tiles mixed randomly
    this._middleTile        = { number: 0, suit: 'dragon', faceUp: false };
    this._handTile          = null;
    this._poppedTile        = null;
    this._winnerAfterReveal = null;
    this._locked            = false;
    this._phase             = 'take-middle';

    this._r.nameP1.textContent = this._playerNames.p1;
    this._r.nameP2.textContent = this._playerNames.p2;
    this._updateScoreboard();

    const name = this._playerNames[this._currentTurn];
    this._setStatus(`${name}: click the 🐉 Dragon in the centre to take it!`);

    // Computer goes first → auto-take the dragon after a short delay
    if (this._mode === 'computer' && this._currentTurn === 'p2') {
      this._locked = true;
      setTimeout(() => this._takeMiddle(), 1000);
    }
  }

  onTick()   { /* turn-based */ }
  onRender() { this._drawBoard(); }

  // ── Canvas click handler ─────────────────────────────────────────────────────
  _setupCanvasClick() {
    this._r.canvas.addEventListener('click', (e) => {
      if (this._state !== STATE.RUNNING || this._locked) return;
      if (this._mode === 'computer' && this._currentTurn === 'p2') return;

      const { x: cx, y: cy } = this._canvasXY(e);
      const { p1x, p2x, gridW } = this._layout();

      // Centre strip x boundaries — click ANYWHERE in the strip for take/reveal
      const centreLeft  = p1x + gridW;
      const centreRight = p2x;

      if (this._phase === 'take-middle') {
        if (cx >= centreLeft && cx <= centreRight) {
          this._takeMiddle();
        }
        return;
      }

      if (this._phase === 'revealing' && this._poppedTile) {
        if (cx >= centreLeft && cx <= centreRight) {
          this._revealPopped();
        }
        return;
      }

      if (this._phase === 'playing' && this._handTile) {
        // Use permissive hit test (includes column-label row at top)
        const col = this._hitTestGridPermissive(cx, cy, this._currentTurn);
        if (col !== null && this._isValidColumn(col)) {
          this._executePush(col);
        }
      }
    });
  }

  _canvasXY(e) {
    const rect = this._r.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this._r.canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (this._r.canvas.height / rect.height),
    };
  }

  // ── Layout geometry (computed fresh each frame) ──────────────────────────────
  _layout() {
    const W = this._r.canvas.width, H = this._r.canvas.height;
    const gridW  = (W - CENTER_W - 2 * MARGIN) / 2;
    const tw     = Math.floor((gridW - (COLS - 1) * 3) / COLS);  // tile width
    const th     = Math.floor((H - 2 * MARGIN - 22) / ROWS);     // tile height (22px for col labels)
    const gap    = 3;
    const labelH = 22;
    const p1x    = MARGIN;
    const p2x    = MARGIN + gridW + CENTER_W;
    const mx     = MARGIN + gridW + CENTER_W / 2;  // centre x
    const gy     = MARGIN + labelH;                // grid top y
    const my     = gy + (ROWS * (th + gap)) / 2;  // middle tile centre y
    return { W, H, gridW, tw, th, gap, labelH, p1x, p2x, mx, my, gy };
  }

  _gridColX(player, col) {
    const { tw, gap, p1x, p2x } = this._layout();
    const baseX = player === 'p1' ? p1x : p2x;
    return baseX + col * (tw + gap);
  }

  _hitTestGrid(cx, cy, player) {
    const { tw, th, gap, p1x, p2x, gy } = this._layout();
    const baseX = player === 'p1' ? p1x : p2x;
    for (let c = 0; c < COLS; c++) {
      const x = baseX + c * (tw + gap);
      if (cx >= x && cx <= x + tw && cy >= gy && cy <= gy + ROWS * (th + gap)) return c;
    }
    return null;
  }

  // Like _hitTestGrid but also accepts clicks on the column-label row above the grid
  _hitTestGridPermissive(cx, cy, player) {
    const { tw, th, gap, p1x, p2x, gy } = this._layout();
    const baseX   = player === 'p1' ? p1x : p2x;
    const topY    = MARGIN;                       // top of label row (module-level const)
    const bottomY = gy + ROWS * (th + gap);       // bottom of tile area
    if (cy < topY || cy > bottomY) return null;
    for (let c = 0; c < COLS; c++) {
      const x = baseX + c * (tw + gap);
      if (cx >= x && cx <= x + tw) return c;
    }
    return null;
  }

  _isValidColumn(col) {
    if (!this._handTile) return false;
    if (this._handTile.suit === 'dragon') return true;   // wild — any column
    return col === this._handTile.number - 1;            // numbered — must match
  }

  // ── Take the middle Dragon tile ──────────────────────────────────────────────
  _takeMiddle() {
    this._middleTile.faceUp = true;
    this._handTile  = { ...this._middleTile };
    this._phase     = 'playing';
    this._locked    = false;
    const name = this._playerNames[this._currentTurn];
    this._setStatus(`${name} drew 🐉 Dragon (wild) — click any column to push!`);

    if (this._mode === 'computer' && this._currentTurn === 'p2') {
      this._locked = true;
      setTimeout(() => this._aiPickColumn(), 800);
    }
  }

  // ── Push mechanic ────────────────────────────────────────────────────────────
  _executePush(col) {
    const grid   = this._grids[this._currentTurn];
    const column = grid[col];
    const pushed = { ...this._handTile, faceUp: true };    // tile going IN (already revealed)
    const popped = { ...column[column.length - 1], faceUp: false }; // tile coming OUT — face-down!

    // Push: new tile enters top, bottom tile exits
    column.pop();
    column.unshift(pushed);

    this._handTile  = null;
    this._poppedTile = popped;  // show face-down in centre, waiting for reveal click
    this._updateScoreboard();

    // Detect win NOW (all grid tiles face-up) — announce AFTER the last reveal for drama
    if (this._checkWin(this._currentTurn)) {
      this._winnerAfterReveal = this._currentTurn;
    }

    // Enter 'revealing' phase — human clicks, computer auto-reveals after delay
    this._phase  = 'revealing';
    this._locked = false;
    this._setStatus('Click the 🃏 popped tile to reveal its symbol!');

    if (this._mode === 'computer' && this._currentTurn === 'p2') {
      this._locked = true;
      setTimeout(() => this._revealPopped(), 900);
    }
  }

  // ── Reveal popped tile ────────────────────────────────────────────────────────
  _revealPopped() {
    if (!this._poppedTile) return;

    // Flip face-up — canvas will immediately show the symbol for a moment
    this._poppedTile.faceUp = true;
    this._locked = true;

    // Brief pause to let the player see the revealed symbol, then route
    setTimeout(() => {
      const popped = this._poppedTile;
      this._poppedTile = null;
      this._phase      = 'playing';
      this._locked     = false;

      // If this was the last tile (win detected at push time) → end game
      if (this._winnerAfterReveal) {
        const winner = this._winnerAfterReveal;
        this._winnerAfterReveal = null;
        this._locked = true;
        setTimeout(() => this._endGame(winner), 400);
        return;
      }

      const name = this._playerNames[this._currentTurn];

      if (popped.suit === 'dragon' || popped.suit === SUIT[this._currentTurn]) {
        // Own suit or wild → continue turn with this tile in hand
        this._handTile = popped;
        const colInfo = popped.suit === 'dragon'
          ? 'any column (it\'s wild!)'
          : `column ${popped.number}`;
        this._setStatus(`${name}: ${this._tileLabel(popped)} is yours → push into ${colInfo}!`);

        if (this._mode === 'computer' && this._currentTurn === 'p2') {
          this._locked = true;
          setTimeout(() => this._aiPickColumn(), 700);
        }
      } else {
        // Opponent's suit → pass to them
        const opponent = this._currentTurn === 'p1' ? 'p2' : 'p1';
        this._setStatus(
          `${name} revealed ${this._tileLabel(popped)} → passes to ${this._playerNames[opponent]}!`
        );
        this._locked = true;
        setTimeout(() => this._switchTurn(popped), 800);
      }
    }, 700); // 700 ms to admire the reveal
  }

  _switchTurn(tileForOpponent) {
    this._currentTurn = this._currentTurn === 'p1' ? 'p2' : 'p1';
    this._handTile    = tileForOpponent;
    this._locked      = false;
    const name = this._playerNames[this._currentTurn];
    const colInfo = tileForOpponent.suit === 'dragon' ? 'any column' : `column ${tileForOpponent.number}`;
    this._setStatus(`${name}'s turn — push ${this._tileLabel(tileForOpponent)} into ${colInfo}!`);

    if (this._mode === 'computer' && this._currentTurn === 'p2') {
      this._locked = true;
      setTimeout(() => this._aiPickColumn(), 800);
    }
  }

  // ── Computer AI ──────────────────────────────────────────────────────────────
  _aiPickColumn() {
    if (!this._handTile) return;
    let col;
    if (this._handTile.suit === 'dragon') {
      // Pick the column with the most face-down tiles (most benefit)
      const grid = this._grids[this._currentTurn];
      let best = -1;
      grid.forEach((column, i) => {
        const faceDownCount = column.filter(t => !t.faceUp).length;
        if (faceDownCount > best) { best = faceDownCount; col = i; }
      });
    } else {
      col = this._handTile.number - 1; // numbered tile → matching column
    }
    this._locked = false;
    this._executePush(col);
  }

  // ── Win check ────────────────────────────────────────────────────────────────
  _checkWin(player) {
    return this._grids[player].every(col => col.every(t => t.faceUp));
  }

  _updateScoreboard() {
    const faceDown = (player) =>
      this._grids[player]?.reduce((s, col) => s + col.filter(t => !t.faceUp).length, 0) ?? 36;
    this._r.scoreP1.textContent = faceDown('p1');
    this._r.scoreP2.textContent = faceDown('p2');
  }

  _endGame(winner) {
    const wName = this._playerNames[winner];
    const lName = this._playerNames[winner === 'p1' ? 'p2' : 'p1'];
    this.end({
      emoji: '🏆', title: `${wName} Wins!`,
      subtitle: `All tiles flipped — ${lName} still has face-down tiles.`,
      finalScore: `🔵 ${this._playerNames.p1}  vs  🎋 ${this._playerNames.p2}`,
      buttonLabel: 'Play Again',
    });
  }

  _tileLabel(tile) {
    if (tile.suit === 'dragon') return '🐉';
    const icon = tile.suit === 'dots' ? '🔵' : '🎋';
    return `${icon}${tile.number}`;
  }

  _setStatus(msg) { this._r.statusText.textContent = msg; }

  // ── Rendering ────────────────────────────────────────────────────────────────
  _drawBoard() {
    const ctx = this.ctx;
    const { W, H, tw, th, gap, labelH, p1x, p2x, gridW, mx, my, gy } = this._layout();
    const centreX = p1x + gridW;

    // ── Rich felt gradient background ────────────────────────────────
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, W * 0.75);
    bgGrad.addColorStop(0,   '#1a5c30');
    bgGrad.addColorStop(0.6, '#103d1f');
    bgGrad.addColorStop(1,   '#071810');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle felt crosshatch texture
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    for (let xi = 0; xi < W; xi += 8) {
      ctx.beginPath(); ctx.moveTo(xi, 0); ctx.lineTo(xi, H); ctx.stroke();
    }
    for (let yi = 0; yi < H; yi += 8) {
      ctx.beginPath(); ctx.moveTo(0, yi); ctx.lineTo(W, yi); ctx.stroke();
    }
    ctx.restore();

    // ── Centre strip darker panel ─────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(centreX, 0, CENTER_W, H);

    // Gold accent lines on each side of centre strip
    ctx.strokeStyle = 'rgba(245,158,11,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(centreX, 0); ctx.lineTo(centreX, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(centreX + CENTER_W, 0); ctx.lineTo(centreX + CENTER_W, H); ctx.stroke();

    // ── Active grid glow ─────────────────────────────────────────────
    this._drawGridGlow(ctx, 'p1', p1x, gridW, gy, ROWS * (th + gap));
    this._drawGridGlow(ctx, 'p2', p2x, gridW, gy, ROWS * (th + gap));

    // ── Player banners ───────────────────────────────────────────────
    this._drawPlayerBanner(ctx, 'p1', p1x, gridW);
    this._drawPlayerBanner(ctx, 'p2', p2x, gridW);

    // ── Grids ────────────────────────────────────────────────────────
    if (this._grids.p1) this._drawGrid(ctx, 'p1', p1x, MARGIN, tw, th, gap, labelH);
    if (this._grids.p2) this._drawGrid(ctx, 'p2', p2x, MARGIN, tw, th, gap, labelH);

    // ── Centre strip content ─────────────────────────────────────────
    this._drawCentre(ctx, mx, my, tw, th);
  }

  _drawGridGlow(ctx, player, bx, gridW, gy, gridH) {
    const isHuman = !(this._mode === 'computer' && player === 'p2');
    const isActive = this._currentTurn === player && this._phase === 'playing' && this._handTile && isHuman;
    if (!isActive) return;
    const rgb = player === 'p1' ? '59,130,246' : '34,197,94';
    const pulse = 0.55 + 0.35 * Math.sin(Date.now() / 550);
    ctx.save();
    ctx.shadowColor = `rgba(${rgb},${pulse})`;
    ctx.shadowBlur  = 22;
    ctx.strokeStyle = `rgba(${rgb},${pulse * 0.85})`;
    ctx.lineWidth   = 2;
    ctx.strokeRect(bx - 2, gy - 2, gridW + 4, gridH + 4);
    ctx.restore();
  }

  _drawPlayerBanner(ctx, player, bx, gridW) {
    const isActive = this._currentTurn === player && this._phase === 'playing' && this._handTile;
    const name = this._playerNames?.[player] ?? (player === 'p1' ? 'Player 1' : 'Player 2');
    const suitRgb = player === 'p1' ? '59,130,246' : '34,197,94';
    const suitHex = player === 'p1' ? '#3b82f6'    : '#22c55e';
    const suit    = player === 'p1' ? '🔵 Dots'    : '🎋 Bamboo';

    // Background gradient
    const grad = ctx.createLinearGradient(bx, 0, bx + gridW, 0);
    if (isActive) {
      grad.addColorStop(0,   `rgba(${suitRgb},0.25)`);
      grad.addColorStop(0.5, `rgba(${suitRgb},0.12)`);
      grad.addColorStop(1,   `rgba(${suitRgb},0.25)`);
    } else {
      grad.addColorStop(0,   'rgba(0,0,0,0.20)');
      grad.addColorStop(1,   'rgba(0,0,0,0.20)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(bx, 0, gridW, MARGIN - 2);

    // Bottom accent line
    ctx.fillStyle = isActive ? suitHex : 'rgba(255,255,255,0.08)';
    ctx.fillRect(bx, MARGIN - 2, gridW, 2);

    // Player name + suit label
    const fontSize = Math.min(11, MARGIN - 6);
    ctx.font = `700 ${fontSize}px "Segoe UI",system-ui,sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const cy = (MARGIN - 2) / 2;
    if (isActive) {
      ctx.fillStyle = suitHex;
      ctx.fillText(`▶ ${name.toUpperCase()} (${suit}) — YOUR TURN ◀`, bx + gridW / 2, cy);
    } else {
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`${name.toUpperCase()}  (${suit})`, bx + gridW / 2, cy);
    }
  }

  _drawGrid(ctx, player, bx, by, tw, th, gap, labelH) {
    const grid     = this._grids[player];
    const isMyTurn = this._currentTurn === player && this._phase === 'playing' && this._handTile;
    const isHuman  = !(this._mode === 'computer' && player === 'p2');
    const validCol = isMyTurn && this._handTile && this._handTile.suit !== 'dragon'
      ? this._handTile.number - 1 : null;

    for (let c = 0; c < COLS; c++) {
      const x = bx + c * (tw + gap);
      const isHighlighted = isMyTurn && isHuman && (validCol === null || validCol === c);

      // Column label — pill background when highlighted
      if (isHighlighted) {
        const pillR = (labelH - 4) / 2;
        ctx.fillStyle = 'rgba(245,158,11,0.22)';
        ctx.beginPath();
        ctx.roundRect(x + 2, by + 2, tw - 4, labelH - 4, pillR);
        ctx.fill();
      }
      ctx.fillStyle    = isHighlighted ? '#fbbf24' : '#4b5563';
      ctx.font         = `bold ${Math.max(9, tw * 0.28)}px "Segoe UI",system-ui,sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(c + 1), x + tw / 2, by + labelH / 2);

      // Dashed outline on valid columns
      if (isHighlighted) {
        ctx.strokeStyle = 'rgba(245,158,11,0.5)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 3]);
        const gy = by + labelH;
        ctx.strokeRect(x - 1, gy - 1, tw + 2, ROWS * (th + gap) + 1);
        ctx.setLineDash([]);
      }

      // Tiles (top = index 0)
      for (let r = 0; r < ROWS; r++) {
        const tile = grid[c][r];
        const ty   = by + labelH + r * (th + gap);
        this._drawTile(ctx, tile, x, ty, tw, th);
      }
    }
  }

  _drawTile(ctx, tile, x, y, w, h) {
    const r = 6;
    this._roundRect(ctx, x, y, w, h, r);

    if (!tile.faceUp) {
      // ── Face-down: rich navy gradient ──────────────────────────────
      const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
      bgGrad.addColorStop(0, '#1e3a5f');
      bgGrad.addColorStop(1, '#0d1f3a');
      ctx.fillStyle = bgGrad; ctx.fill();
      ctx.strokeStyle = '#2d5a8e'; ctx.lineWidth = 1.5; ctx.stroke();

      // Inner decorative border
      ctx.strokeStyle = 'rgba(59,130,246,0.22)'; ctx.lineWidth = 1;
      this._roundRect(ctx, x + 3, y + 3, w - 6, h - 6, r - 1); ctx.stroke();

      // Mahjong symbol
      ctx.fillStyle = 'rgba(80,140,210,0.65)';
      ctx.font = `${w * 0.46}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🀄', x + w / 2, y + h / 2);

      // Gold corner dots
      const dotR = Math.max(2, w * 0.055);
      const dm   = dotR * 2.2;
      ctx.fillStyle = 'rgba(245,158,11,0.55)';
      for (const [dx, dy] of [[dm, dm], [w - dm, dm], [dm, h - dm], [w - dm, h - dm]]) {
        ctx.beginPath(); ctx.arc(x + dx, y + dy, dotR, 0, Math.PI * 2); ctx.fill();
      }

    } else if (tile.suit === 'dragon') {
      // ── Dragon / Wild: amber gradient + gold glow ─────────────────
      const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
      bgGrad.addColorStop(0, '#92400e');
      bgGrad.addColorStop(0.55, '#78350f');
      bgGrad.addColorStop(1, '#3d1a05');
      ctx.fillStyle = bgGrad; ctx.fill();

      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.65)'; ctx.shadowBlur = 8;
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();

      ctx.font = `${w * 0.52}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐉', x + w / 2, y + h * 0.42);

      ctx.fillStyle = '#fde68a';
      ctx.font = `800 ${Math.max(7, w * 0.21)}px "Segoe UI",sans-serif`;
      ctx.fillText('WILD', x + w / 2, y + h * 0.82);

    } else {
      // ── Face-up Dots / Bamboos: cream + coloured header bar ────────
      const isDots    = tile.suit === 'dots';
      const suitColor = isDots ? '#3b82f6' : '#22c55e';
      const suitDark  = isDots ? '#1d4ed8' : '#15803d';
      const emoji     = isDots ? '🔵' : '🎋';
      const headerH   = h * 0.46;

      // Cream body
      const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
      bodyGrad.addColorStop(0, '#fefce8');
      bodyGrad.addColorStop(1, '#f0ead8');
      ctx.fillStyle = bodyGrad; ctx.fill();

      // Coloured header section (clipped to top rounded corners)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + headerH); ctx.lineTo(x, y + headerH);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      const headerGrad = ctx.createLinearGradient(x, y, x, y + headerH);
      headerGrad.addColorStop(0, suitColor);
      headerGrad.addColorStop(1, suitDark);
      ctx.fillStyle = headerGrad; ctx.fill();
      ctx.restore();

      // Suit emoji in header
      ctx.font = `${w * 0.38}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, x + w / 2, y + headerH * 0.52);

      // Number below header
      ctx.fillStyle = suitDark;
      ctx.font = `800 ${Math.max(9, w * 0.30)}px "Segoe UI",sans-serif`;
      ctx.fillText(String(tile.number), x + w / 2, y + headerH + (h - headerH) * 0.55);

      // Suit-coloured border
      ctx.strokeStyle = suitColor; ctx.lineWidth = 1.5;
      this._roundRect(ctx, x, y, w, h, r); ctx.stroke();
    }
  }

  _drawCentre(ctx, mx, my, tw, th) {
    const hw = tw * 1.6, hh = th * 1.6;
    const tx = mx - hw / 2, ty = my - hh / 2;

    // Helper: draw pulsing gold glow border around the centre tile
    const _glowBorder = (pulse) => {
      ctx.save();
      ctx.shadowColor = `rgba(245,158,11,${pulse})`;
      ctx.shadowBlur  = 18;
      ctx.strokeStyle = `rgba(245,158,11,${pulse})`;
      ctx.lineWidth   = 2.5;
      this._roundRect(ctx, tx, ty, hw, hh, 7);
      ctx.stroke();
      ctx.restore();
    };

    // Helper: small label below the tile
    const _label = (text, color = '#f59e0b', size = 11) => {
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px "Segoe UI",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(text, mx, ty + hh + 6);
    };

    if (this._phase === 'take-middle' && this._middleTile) {
      // Gold glow behind the dragon tile
      ctx.save();
      ctx.shadowColor = 'rgba(245,158,11,0.5)'; ctx.shadowBlur = 20;
      this._drawTile(ctx, this._middleTile, tx, ty, hw, hh);
      ctx.restore();
      const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 500);
      _glowBorder(pulse);
      _label('✦ TAP TO TAKE ✦', `rgba(245,158,11,${pulse})`, 10);

    } else if (this._phase === 'revealing' && this._poppedTile) {
      this._drawTile(ctx, this._poppedTile, tx, ty, hw, hh);
      if (!this._poppedTile.faceUp) {
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 280);
        _glowBorder(pulse);
        _label('🃏 CLICK TO REVEAL', `rgba(245,158,11,${pulse})`, 11);
      }

    } else if (this._phase === 'playing' && this._handTile) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.18)'; ctx.shadowBlur = 12;
      this._drawTile(ctx, this._handTile, tx, ty, hw, hh);
      ctx.restore();
      _label('IN HAND', '#64748b', 10);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

new AmericanMahjongGame();
