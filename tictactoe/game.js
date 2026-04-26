import { GameBase } from '../shared/GameBase.js';

// ── Constants ───────────────────────────────────────────────────────────────
const CELL  = 150;       // logical px per cell
const SIZE  = CELL * 3;  // 450 × 450 canvas
const DELAY = 500;       // ms before computer plays

// All 8 win conditions expressed as [row, col] triplets
const WIN_LINES = [
  [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]], // rows
  [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]], // cols
  [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]],                      // diagonals
];

// ── DOM helpers ─────────────────────────────────────────────────────────────
function _getEls() {
  return {
    canvas:          document.getElementById('gameCanvas'),
    overlay:         document.getElementById('overlay'),
    overlayEmoji:    document.getElementById('overlayEmoji'),
    overlayTitle:    document.getElementById('overlayTitle'),
    overlaySubtitle: document.getElementById('overlaySubtitle'),
    overlayFinal:    document.getElementById('overlayFinal'),
    btnStart:        document.getElementById('btnStart'),
    speedBadge:      document.getElementById('speedBadge'), // hidden; required by GameBase
    scoreEl:         null,
    // Tic-Tac-Toe-specific
    scoreX:          document.getElementById('scoreX'),
    scoreO:          document.getElementById('scoreO'),
    scoreDraw:       document.getElementById('scoreDraw'),
    nameX:           document.getElementById('nameX'),
    nameO:           document.getElementById('nameO'),
    statusText:      document.getElementById('statusText'),
    nameInputX:      document.getElementById('nameInputX'),
    nameInputO:      document.getElementById('nameInputO'),
    modeComputer:    document.getElementById('modeComputer'),
    modeFriend:      document.getElementById('modeFriend'),
    oLabelText:      document.getElementById('oLabelText'),
  };
}

// ── Game class ──────────────────────────────────────────────────────────────
class TicTacToeGame extends GameBase {
  constructor() {
    const els = _getEls();
    super({ canvas: els.canvas, els });
    this._r = els; // shorthand for extra TicTacToe elements

    // Persistent across rounds
    this._scores = { X: 0, O: 0, draw: 0 };

    // Per-round state (reset in onInit)
    this._board         = null;
    this._currentPlayer = 'X';
    this._mode          = 'computer'; // 'computer' | 'friend'
    this._playerNames   = { X: 'Player 1', O: 'Computer' };
    this._winLine       = null;
    this._gameActive    = false;
    this._hover         = null;
    this._thinkTimer    = null;
    this._endTimer      = null;

    this._setupModeToggle();
    this._setupCanvasEvents();

    this.showOverlay({
      emoji: '⭕', title: 'Tic Tac Toe',
      subtitle: 'Get 3 in a row to win! Play vs an unbeatable computer or a friend.',
      finalScore: null, buttonLabel: 'Start Game',
    });
  }

  // ── Mode toggle ─────────────────────────────────────────────────────────
  _setupModeToggle() {
    const { modeComputer, modeFriend, nameInputO, oLabelText } = this._r;
    modeComputer.addEventListener('click', () => {
      this._mode = 'computer';
      modeComputer.classList.add('active');
      modeFriend.classList.remove('active');
      nameInputO.classList.add('hidden');
      oLabelText.textContent = 'Computer';
    });
    modeFriend.addEventListener('click', () => {
      this._mode = 'friend';
      modeFriend.classList.add('active');
      modeComputer.classList.remove('active');
      nameInputO.classList.remove('hidden');
      oLabelText.textContent = 'Player';
    });
  }

  // ── Canvas events ────────────────────────────────────────────────────────
  _setupCanvasEvents() {
    const { canvas } = this._r;
    canvas.addEventListener('click', (e) => {
      if (!this._gameActive) return;
      if (this._mode === 'computer' && this._currentPlayer === 'O') return;
      const [row, col] = this._canvasToCell(e);
      if (row >= 0 && row < 3 && col >= 0 && col < 3) this._makeMove(row, col);
    });
    canvas.addEventListener('mousemove', (e) => {
      const blocked = !this._gameActive || (this._mode === 'computer' && this._currentPlayer === 'O');
      if (blocked) { this._hover = null; canvas.style.cursor = 'default'; return; }
      const [row, col] = this._canvasToCell(e);
      if (row >= 0 && row < 3 && col >= 0 && col < 3 && this._board && !this._board[row][col]) {
        this._hover = { row, col }; canvas.style.cursor = 'pointer';
      } else {
        this._hover = null; canvas.style.cursor = 'default';
      }
    });
    canvas.addEventListener('mouseleave', () => { this._hover = null; });
  }

  _canvasToCell(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
    const y = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
    return [Math.floor(y / CELL), Math.floor(x / CELL)];
  }

  // ── GameBase hooks ───────────────────────────────────────────────────────
  onInit() {
    clearTimeout(this._thinkTimer);
    clearTimeout(this._endTimer);

    this.canvas.width  = SIZE;
    this.canvas.height = SIZE;
    this._board         = Array.from({ length: 3 }, () => Array(3).fill(null));
    this._currentPlayer = 'X';
    this._winLine       = null;
    this._hover         = null;
    this._gameActive    = true;

    const xName = this._r.nameInputX.value.trim() || 'Player 1';
    const oName = this._mode === 'computer'
      ? 'Computer'
      : (this._r.nameInputO.value.trim() || 'Player 2');
    this._playerNames = { X: xName, O: oName };

    this._r.nameX.textContent     = xName;
    this._r.nameO.textContent     = oName;
    this._r.scoreX.textContent    = this._scores.X;
    this._r.scoreO.textContent    = this._scores.O;
    this._r.scoreDraw.textContent = this._scores.draw;
    this._setStatus(`${xName}'s turn (✕)`);
  }

  onTick()   { /* turn-based — no continuous tick logic */ }
  onRender() { this._drawBoard(); }

  // ── Game logic ───────────────────────────────────────────────────────────
  _makeMove(row, col) {
    if (!this._board || this._board[row][col] !== null) return;

    this._board[row][col] = this._currentPlayer;
    this._hover = null;

    const result = this._checkResult(this._board);
    if (result) {
      this._gameActive = false;
      this._endRound(result);
      return;
    }

    // Switch turns
    this._currentPlayer = this._currentPlayer === 'X' ? 'O' : 'X';
    const name = this._playerNames[this._currentPlayer];
    const sym  = this._currentPlayer === 'X' ? '✕' : '○';

    if (this._mode === 'computer' && this._currentPlayer === 'O') {
      this._setStatus('Computer is thinking…');
      this._gameActive = false;
      this._thinkTimer = setTimeout(() => {
        const move = this._bestMove();
        if (move) { this._gameActive = true; this._makeMove(move[0], move[1]); }
      }, DELAY);
    } else {
      this._gameActive = true;
      this._setStatus(`${name}'s turn (${sym})`);
    }
  }

  _checkResult(board) {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      const v = board[a[0]][a[1]];
      if (v && v === board[b[0]][b[1]] && v === board[c[0]][c[1]]) {
        this._winLine = line;
        return v; // 'X' or 'O'
      }
    }
    if (board.every(row => row.every(cell => cell !== null))) return 'draw';
    return null;
  }

  _endRound(result) {
    if (result === 'draw') {
      this._scores.draw++;
      this._setStatus("It's a draw!");
    } else {
      this._scores[result]++;
      const sym = result === 'X' ? '✕' : '○';
      this._setStatus(`${this._playerNames[result]} wins! ${sym}`);
    }
    this._r.scoreX.textContent    = this._scores.X;
    this._r.scoreO.textContent    = this._scores.O;
    this._r.scoreDraw.textContent = this._scores.draw;

    this._endTimer = setTimeout(() => {
      const winner = result === 'draw' ? null : this._playerNames[result];
      const scoreLine = `✕ ${this._scores.X}  ·  Draw ${this._scores.draw}  ·  ○ ${this._scores.O}`;
      this.end({
        emoji:       result === 'draw' ? '🤝' : (result === 'X' ? '✕' : '⭕'),
        title:       result === 'draw' ? "It's a Draw!" : `${winner} Wins!`,
        subtitle:    result === 'draw' ? 'Play again?' : `${winner} got 3 in a row!`,
        finalScore:  scoreLine,
        buttonLabel: 'Play Again',
      });
    }, 1200);
  }

  _setStatus(msg) { this._r.statusText.textContent = msg; }

  // ── Minimax AI ───────────────────────────────────────────────────────────
  _minimax(board, depth, isMaximizing) {
    const w = this._staticCheck(board);
    if (w === 'O') return 10 - depth;
    if (w === 'X') return depth - 10;
    if (w === 'draw') return 0;

    if (isMaximizing) {
      let best = -Infinity;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          if (!board[r][c]) {
            board[r][c] = 'O';
            best = Math.max(best, this._minimax(board, depth + 1, false));
            board[r][c] = null;
          }
      return best;
    } else {
      let best = Infinity;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          if (!board[r][c]) {
            board[r][c] = 'X';
            best = Math.min(best, this._minimax(board, depth + 1, true));
            board[r][c] = null;
          }
      return best;
    }
  }

  _staticCheck(board) {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      const v = board[a[0]][a[1]];
      if (v && v === board[b[0]][b[1]] && v === board[c[0]][c[1]]) return v;
    }
    if (board.every(row => row.every(cell => cell !== null))) return 'draw';
    return null;
  }

  _bestMove() {
    const board = this._board.map(r => [...r]);
    let bestVal = -Infinity, bestMove = null;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        if (!board[r][c]) {
          board[r][c] = 'O';
          const val = this._minimax(board, 0, false);
          board[r][c] = null;
          if (val > bestVal) { bestVal = val; bestMove = [r, c]; }
        }
    return bestMove;
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  _drawBoard() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 18); ctx.lineTo(i * CELL, SIZE - 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18, i * CELL); ctx.lineTo(SIZE - 18, i * CELL); ctx.stroke();
    }

    // Hover ghost (semi-transparent mark for current player)
    if (this._hover && this._board) {
      const { row, col } = this._hover;
      if (!this._board[row][col]) {
        ctx.globalAlpha = 0.22;
        this._drawMark(ctx, row, col, this._currentPlayer);
        ctx.globalAlpha = 1;
      }
    }

    // Placed marks
    if (this._board) {
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          if (this._board[r][c]) this._drawMark(ctx, r, c, this._board[r][c]);
    }

    // Win line
    if (this._winLine) this._drawWinLine(ctx);
  }

  _drawMark(ctx, row, col, player) {
    const pad = 30;
    ctx.lineCap = 'round';
    if (player === 'X') {
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 13;
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 18;
      const x1 = col * CELL + pad, y1 = row * CELL + pad;
      const x2 = (col + 1) * CELL - pad, y2 = (row + 1) * CELL - pad;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x1, y2); ctx.stroke();
    } else {
      const cx = col * CELL + CELL / 2, cy = row * CELL + CELL / 2;
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 13;
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 - pad + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  _drawWinLine(ctx) {
    const [a, , c] = this._winLine;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(a[1] * CELL + CELL / 2, a[0] * CELL + CELL / 2);
    ctx.lineTo(c[1] * CELL + CELL / 2, c[0] * CELL + CELL / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

new TicTacToeGame();
