import { GameBase, STATE } from '../shared/GameBase.js';

// ── Tile definitions ─────────────────────────────────────────────────────────
// 9 country flags + 9 Avenger heroes = 18 unique tile types × 2 copies = 36 tiles

const TILE_TYPES = [
  // Country flags
  { id: 'us',      emoji: '🇺🇸', label: 'USA',       color: '#3b82f6' },
  { id: 'gb',      emoji: '🇬🇧', label: 'UK',        color: '#ef4444' },
  { id: 'jp',      emoji: '🇯🇵', label: 'Japan',     color: '#dc2626' },
  { id: 'br',      emoji: '🇧🇷', label: 'Brazil',    color: '#16a34a' },
  { id: 'fr',      emoji: '🇫🇷', label: 'France',    color: '#2563eb' },
  { id: 'de',      emoji: '🇩🇪', label: 'Germany',   color: '#ca8a04' },
  { id: 'in',      emoji: '🇮🇳', label: 'India',     color: '#f97316' },
  { id: 'kr',      emoji: '🇰🇷', label: 'Korea',     color: '#dc2626' },
  { id: 'au',      emoji: '🇦🇺', label: 'Australia', color: '#7c3aed' },
  // Avenger heroes
  { id: 'ironman', emoji: '🦾', label: 'Iron Man',  color: '#ef4444' },
  { id: 'thor',    emoji: '⚡', label: 'Thor',      color: '#a855f7' },
  { id: 'cap',     emoji: '🛡️', label: 'Cap',       color: '#3b82f6' },
  { id: 'spider',  emoji: '🕷️', label: 'Spidey',   color: '#dc2626' },
  { id: 'hulk',    emoji: '💚', label: 'Hulk',      color: '#22c55e' },
  { id: 'widow',   emoji: '🕸️', label: 'Widow',    color: '#64748b' },
  { id: 'panther', emoji: '🐾', label: 'Panther',   color: '#8b5cf6' },
  { id: 'hawk',    emoji: '🎯', label: 'Hawkeye',   color: '#84cc16' },
  { id: 'wanda',   emoji: '🔮', label: 'Wanda',     color: '#e879f9' },
];

// ── Board constants ───────────────────────────────────────────────────────────
const COLS    = 6;
const ROWS    = 6;
const MARGIN  = 16;
const GAP     = 8;
// Tile size derived at render time from canvas dimensions

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck() {
  // 2 copies of each tile type → 36 tiles
  const deck = [];
  TILE_TYPES.forEach(t => { deck.push({ ...t }); deck.push({ ...t }); });
  return shuffle(deck);
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
    // Mahjong-specific
    nameP1:          document.getElementById('nameP1'),
    nameP2:          document.getElementById('nameP2'),
    scoreP1:         document.getElementById('scoreP1'),
    scoreP2:         document.getElementById('scoreP2'),
    pairsLeft:       document.getElementById('pairsLeft'),
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
class MahjongGame extends GameBase {
  constructor() {
    const els = _getEls();
    super({ canvas: els.canvas, els });
    this._r = els;

    // Persistent
    this._scores      = { p1: 0, p2: 0 };
    this._mode        = 'computer';   // 'computer' | 'friend'
    this._playerNames = { p1: 'Player 1', p2: 'Computer' };
    this._firstPlayer = 'p1';         // set by spin wheel

    // Per-round state (reset in onInit)
    this._tiles        = [];           // { ...tileType, flipped, matched, flipAnim }
    this._selected     = [];           // indices of face-up unmatched tiles (max 2)
    this._currentTurn  = 'p1';
    this._locked       = false;        // board locked while checking mismatch / AI thinking
    this._seenByAI     = new Map();    // index → tileId (AI memory)
    this._pairsLeft    = 18;

    this._setupModeToggle();
    this._setupCanvasClick();
    this._setupSpinModal();

    this.showOverlay({
      emoji: '🃏', title: 'Memory Match',
      subtitle: 'Flip tiles and find matching pairs of country flags & Avenger heroes!',
      finalScore: null, buttonLabel: 'Start Game',
    });
  }

  // ── Mode toggle ─────────────────────────────────────────────────────────────
  _setupModeToggle() {
    const { modeComputer, modeFriend, nameInputP2, p2LabelText } = this._r;
    modeComputer.addEventListener('click', () => {
      this._mode = 'computer';
      modeComputer.classList.add('active');
      modeFriend.classList.remove('active');
      nameInputP2.classList.add('hidden');
      p2LabelText.textContent = 'Computer';
    });
    modeFriend.addEventListener('click', () => {
      this._mode = 'friend';
      modeFriend.classList.add('active');
      modeComputer.classList.remove('active');
      nameInputP2.classList.remove('hidden');
      p2LabelText.textContent = 'Player';
    });
  }

  // ── Override start to show spin wheel first ──────────────────────────────────
  start() {
    // Read names & mode before showing spin wheel
    this._playerNames.p1 = this._r.nameInputP1.value.trim() || 'Player 1';
    this._playerNames.p2 = this._mode === 'computer'
      ? 'Computer'
      : (this._r.nameInputP2.value.trim() || 'Player 2');
    this._scores = { p1: 0, p2: 0 };
    this._hideOverlay_MJ();
    this._showSpinModal();
  }

  _hideOverlay_MJ() { this._r.overlay.classList.add('hidden'); }

  // ── Spin Wheel ───────────────────────────────────────────────────────────────
  _setupSpinModal() {
    const { btnSpin, btnPlay } = this._r;
    btnSpin.addEventListener('click', () => this._spinWheel());
    btnPlay.addEventListener('click', () => this._launchGame());
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
    const colors = ['#f87171', '#60a5fa'];
    const slice  = Math.PI; // 2 halves

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 2; i++) {
      const start = angle + i * slice;
      const end   = start + slice;

      // Slice fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();

      // Slice border
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Label
      const mid = start + slice / 2;
      const tx  = cx + Math.cos(mid) * r * 0.58;
      const ty  = cy + Math.sin(mid) * r * 0.58;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = names[i].length > 9 ? names[i].slice(0, 8) + '…' : names[i];
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  _spinWheel() {
    const { btnSpin, spinResult, btnPlay } = this._r;
    btnSpin.disabled = true;
    spinResult.textContent = 'Spinning…';

    const totalRotation = Math.PI * 2 * (5 + Math.random() * 5); // 5-10 full turns
    const duration      = 3500; // ms
    const start         = performance.now();
    let   baseAngle     = -Math.PI / 2; // start pointing up

    const animate = (now) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3);
      const angle    = baseAngle + totalRotation * eased;
      this._drawSpinWheel(angle);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Determine winner: pointer is at top (angle = -π/2 from center)
        // The segment covering 0..π (after normalisation) maps to player 0 (P1)
        const finalAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // Pointer at top → effectively checking which slice covers 3π/2 (270°)
        const pointerPos = (3 * Math.PI / 2 - angle % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
        const winner     = pointerPos < Math.PI ? 'p1' : 'p2';
        this._firstPlayer = winner;
        const wName = this._playerNames[winner];
        spinResult.textContent = `🎉 ${wName} goes first!`;
        btnPlay.classList.remove('hidden');
      }
    };
    requestAnimationFrame(animate);
  }

  _launchGame() {
    this._r.spinModal.classList.add('hidden');
    this._currentTurn = this._firstPlayer;
    // Now invoke the base-class start logic (skipping our override)
    super.start();
  }

  // ── GameBase hooks ───────────────────────────────────────────────────────────
  onInit() {
    const { canvas } = this._r;
    const size = Math.min(600, canvas.parentElement.clientWidth);
    canvas.width  = size;
    canvas.height = size;

    this._tiles    = makeDeck().map(t => ({ ...t, flipped: false, matched: false }));
    this._selected = [];
    this._locked   = false;
    this._seenByAI = new Map();
    this._pairsLeft = 18;

    this._r.nameP1.textContent  = this._playerNames.p1;
    this._r.nameP2.textContent  = this._playerNames.p2;
    this._r.scoreP1.textContent = this._scores.p1;
    this._r.scoreP2.textContent = this._scores.p2;
    this._r.pairsLeft.textContent = 18;
    this._setStatus(`${this._playerNames[this._currentTurn]}'s turn — flip a tile!`);
  }

  onTick()   { /* turn-based — no continuous physics */ }
  onRender() { this._drawBoard(); }

  // ── Canvas click ─────────────────────────────────────────────────────────────
  _setupCanvasClick() {
    this._r.canvas.addEventListener('click', (e) => {
      if (this._state !== STATE.RUNNING) return;
      if (this._locked) return;
      if (this._mode === 'computer' && this._currentTurn === 'p2') return;
      const idx = this._hitTest(e);
      if (idx !== null) this._flipTile(idx);
    });
  }

  _tileRect(idx) {
    const W = this._r.canvas.width;
    const tileSize = (W - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = MARGIN + col * (tileSize + GAP);
    const y = MARGIN + row * (tileSize + GAP);
    return { x, y, w: tileSize, h: tileSize };
  }

  _hitTest(e) {
    const rect = this._r.canvas.getBoundingClientRect();
    const mx   = (e.clientX - rect.left) * (this._r.canvas.width  / rect.width);
    const my   = (e.clientY - rect.top)  * (this._r.canvas.height / rect.height);
    for (let i = 0; i < this._tiles.length; i++) {
      if (this._tiles[i].matched) continue;
      const { x, y, w, h } = this._tileRect(i);
      if (mx >= x && mx <= x + w && my >= y && my <= y + h) return i;
    }
    return null;
  }

  // ── Tile flip & match logic ──────────────────────────────────────────────────
  _flipTile(idx) {
    const tile = this._tiles[idx];
    if (tile.flipped || tile.matched) return;
    if (this._selected.includes(idx)) return;

    tile.flipped = true;

    // AI memory: record seen tile
    if (!this._seenByAI.has(idx)) this._seenByAI.set(idx, tile.id);

    this._selected.push(idx);

    if (this._selected.length === 2) {
      this._locked = true;
      const [a, b] = this._selected;
      if (this._tiles[a].id === this._tiles[b].id) {
        // Match!
        setTimeout(() => this._resolveMatch(a, b), 400);
      } else {
        // Mismatch
        setTimeout(() => this._resolveMismatch(a, b), 900);
      }
    }
  }

  _resolveMatch(a, b) {
    this._tiles[a].matched = true;
    this._tiles[b].matched = true;
    this._selected = [];
    this._scores[this._currentTurn]++;
    this._pairsLeft--;

    this._r.scoreP1.textContent   = this._scores.p1;
    this._r.scoreP2.textContent   = this._scores.p2;
    this._r.pairsLeft.textContent = this._pairsLeft;

    if (this._pairsLeft === 0) {
      this._locked = false;
      this._endGame();
      return;
    }

    const name = this._playerNames[this._currentTurn];
    this._setStatus(`✅ Match! ${name} scores — go again!`);
    this._locked = false;

    // Same player goes again — if computer, trigger AI
    if (this._mode === 'computer' && this._currentTurn === 'p2') {
      this._locked = true;
      setTimeout(() => this._aiTurn(), 700);
    }
  }

  _resolveMismatch(a, b) {
    this._tiles[a].flipped = false;
    this._tiles[b].flipped = false;
    this._selected = [];
    this._locked   = false;

    // Switch turn
    this._currentTurn = this._currentTurn === 'p1' ? 'p2' : 'p1';
    const name = this._playerNames[this._currentTurn];
    this._setStatus(`❌ No match — ${name}'s turn!`);

    if (this._mode === 'computer' && this._currentTurn === 'p2') {
      this._locked = true;
      setTimeout(() => this._aiTurn(), 900);
    }
  }

  // ── Computer AI ──────────────────────────────────────────────────────────────
  _aiTurn() {
    // Build list of face-down unmatched tiles
    const faceDown = this._tiles
      .map((t, i) => ({ ...t, i }))
      .filter(t => !t.flipped && !t.matched);

    // Check if AI knows a matching pair from memory
    const known = [...this._seenByAI.entries()]
      .filter(([idx]) => !this._tiles[idx].matched && !this._tiles[idx].flipped);

    const knownByType = {};
    known.forEach(([idx, id]) => {
      if (!knownByType[id]) knownByType[id] = [];
      knownByType[id].push(idx);
    });

    let pick1 = null, pick2 = null;
    // Find a known pair
    for (const id of Object.keys(knownByType)) {
      if (knownByType[id].length >= 2) {
        [pick1, pick2] = knownByType[id];
        break;
      }
    }

    if (pick1 !== null) {
      // Smart move: AI remembers the pair
      this._flipTile(pick1);
      setTimeout(() => { this._locked = false; this._flipTile(pick2); }, 600);
    } else {
      // Pick a random unseen tile first
      const unseen = faceDown.filter(t => !this._seenByAI.has(t.i));
      const pool1  = unseen.length > 0 ? unseen : faceDown;
      pick1 = pool1[Math.floor(Math.random() * pool1.length)].i;
      this._locked = false;
      this._flipTile(pick1);

      setTimeout(() => {
        // After seeing pick1, check if AI now knows its pair
        const id1    = this._tiles[pick1].id;
        const match  = known.find(([idx, id]) => id === id1 && idx !== pick1);
        let   pick2i;
        if (match) {
          pick2i = match[0];
        } else {
          const pool2 = faceDown.filter(t => t.i !== pick1 && !this._tiles[t.i].flipped);
          pick2i = pool2[Math.floor(Math.random() * pool2.length)].i;
        }
        this._locked = false;
        this._flipTile(pick2i);
      }, 700);
    }
  }

  // ── Win detection & game over ────────────────────────────────────────────────
  _endGame() {
    const { p1, p2 } = this._scores;
    const n1 = this._playerNames.p1, n2 = this._playerNames.p2;
    let emoji, title, subtitle;
    if (p1 > p2)       { emoji = '🎉'; title = `${n1} Wins!`;  subtitle = `${n1} found more pairs!`; }
    else if (p2 > p1)  { emoji = '🏆'; title = `${n2} Wins!`;  subtitle = `${n2} found more pairs!`; }
    else               { emoji = '🤝'; title = "It's a Tie!"; subtitle = 'Both players matched equally!'; }

    this.end({
      emoji, title, subtitle,
      finalScore:  `${n1} ${p1}  ·  ${n2} ${p2}`,
      buttonLabel: 'Play Again',
    });
  }

  // ── Rendering ────────────────────────────────────────────────────────────────
  _drawBoard() {
    const ctx = this.ctx;
    const W   = this._r.canvas.width;
    const H   = this._r.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < this._tiles.length; i++) {
      const { x, y, w, h } = this._tileRect(i);
      const tile = this._tiles[i];
      this._drawTile(ctx, tile, x, y, w, h, this._selected.includes(i));
    }
  }

  _drawTile(ctx, tile, x, y, w, h, selected) {
    const r = 8;

    if (tile.matched) {
      // Faded matched tile slot
      ctx.globalAlpha = 0.18;
      this._roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    if (!tile.flipped) {
      // Face-down back
      this._roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = '#1e3a5f';
      ctx.fill();
      ctx.strokeStyle = selected ? '#f59e0b' : '#2d5a8e';
      ctx.lineWidth   = selected ? 3 : 1.5;
      ctx.stroke();
      // Decorative pattern
      ctx.fillStyle = '#2d5a8e';
      ctx.font = `${w * 0.45}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🀄', x + w / 2, y + h / 2);
    } else {
      // Face-up
      this._roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      // Accent border using tile color
      ctx.strokeStyle = selected ? '#f59e0b' : (tile.color || '#475569');
      ctx.lineWidth   = selected ? 3.5 : 2;
      ctx.stroke();
      // Emoji
      ctx.font = `${w * 0.42}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.emoji, x + w / 2, y + h * 0.44);
      // Label
      ctx.fillStyle = '#cbd5e1';
      ctx.font      = `600 ${Math.max(9, w * 0.14)}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(tile.label, x + w / 2, y + h * 0.82);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  _setStatus(msg) { this._r.statusText.textContent = msg; }
}

new MahjongGame();
