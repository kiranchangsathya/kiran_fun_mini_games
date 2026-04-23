import { GameBase, STATE } from '../shared/GameBase.js';

// ── Difficulty settings ──────────────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { clues: 38, label: 'Easy'   },
  medium: { clues: 30, label: 'Medium' },
  hard:   { clues: 24, label: 'Hard'   },
};

// ── DOM helpers ──────────────────────────────────────────────────────────────
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
    // Sudoku-specific
    grid:        document.getElementById('sudokuGrid'),
    timer:       document.getElementById('timerDisplay'),
    diffBadge:   document.getElementById('difficultyBadge'),
    diffEasy:    document.getElementById('diffEasy'),
    diffMedium:  document.getElementById('diffMedium'),
    diffHard:    document.getElementById('diffHard'),
    numpad:      document.getElementById('numpad'),
  };
}

// ── Game class ───────────────────────────────────────────────────────────────
class SudokuGame extends GameBase {
  constructor() {
    const els = _getEls();
    super({ canvas: els.canvas, els });
    this._r = els;

    // Settings (persist across rounds)
    this._difficulty = 'easy';

    // Per-round state (reset in onInit)
    this._solution       = null; // complete solved board [9][9]
    this._board          = null; // current player board  [9][9]
    this._givens         = null; // Set of given-cell flat indices
    this._selected       = null; // flat index of selected cell, or null
    this._cells          = [];   // DOM cell elements [81]
    this._elapsedSeconds = 0;
    this._timerInterval  = null;

    this._buildGrid();
    this._setupDifficultyToggle();
    this._setupNumpad();
    this._setupKeyboard();

    this.showOverlay({
      emoji: '🔢', title: 'Sudoku',
      subtitle: 'Fill the grid — no repeats in any row, column, or 3×3 box.',
      finalScore: null, buttonLabel: 'Start Game',
    });
  }

  // ── Override start() — Sudoku is event-driven, no rAF loop needed ──────────
  start() {
    cancelAnimationFrame(this._raf);
    this._state = STATE.RUNNING;
    this.hideOverlay();
    this.onInit();
    this.onStart();
    // Intentionally not calling this._loop()
  }

  // ── Override togglePause() — manage timer instead of rAF loop ─────────────
  togglePause() {
    if (this._state === STATE.RUNNING) {
      this._state = STATE.PAUSED;
      this._stopTimer();
    } else if (this._state === STATE.PAUSED) {
      this._state = STATE.RUNNING;
      this._startTimer();
    }
  }

  // ── Build the 81-cell DOM grid (called once in constructor) ────────────────
  _buildGrid() {
    const grid = this._r.grid;
    grid.innerHTML = '';
    this._cells = [];

    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9);
      const c = i % 9;
      const cell = document.createElement('div');
      cell.className = 'sudoku-cell';
      if (r % 3 === 0) cell.classList.add('box-top');
      if (c % 3 === 0) cell.classList.add('box-left');
      if (r === 8)     cell.classList.add('box-bottom');
      if (c === 8)     cell.classList.add('box-right');
      cell.addEventListener('click', () => this._selectCell(i));
      grid.appendChild(cell);
      this._cells.push(cell);
    }
  }

  // ── Difficulty toggle ──────────────────────────────────────────────────────
  _setupDifficultyToggle() {
    const map = { easy: this._r.diffEasy, medium: this._r.diffMedium, hard: this._r.diffHard };
    Object.entries(map).forEach(([diff, btn]) => {
      btn.addEventListener('click', () => {
        this._difficulty = diff;
        Object.values(map).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ── Numpad click handler ───────────────────────────────────────────────────
  _setupNumpad() {
    this._r.numpad.addEventListener('click', e => {
      const btn = e.target.closest('[data-num]');
      if (btn) this._inputNumber(+btn.dataset.num);
    });
  }

  // ── Keyboard: numbers 1-9, Backspace/Delete/0, arrow navigation ───────────
  _setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (this._state !== STATE.RUNNING) return;
      if (e.key >= '1' && e.key <= '9') { this._inputNumber(+e.key); return; }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        this._inputNumber(0); return;
      }
      if (this._selected === null) return;
      const r = Math.floor(this._selected / 9), c = this._selected % 9;
      if (e.key === 'ArrowRight') { e.preventDefault(); this._selectCell(r * 9 + Math.min(c + 1, 8)); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); this._selectCell(r * 9 + Math.max(c - 1, 0)); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); this._selectCell(Math.min(r + 1, 8) * 9 + c); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); this._selectCell(Math.max(r - 1, 0) * 9 + c); }
    });
  }

  // ── GameBase hooks ────────────────────────────────────────────────────────
  onInit() {
    this._stopTimer();
    this._elapsedSeconds = 0;
    this._updateTimerDisplay();
    this._selected = null;

    const solution    = this._generateBoard();
    this._solution    = solution;
    this._board       = this._createPuzzle(solution, this._difficulty);
    this._givens      = new Set();
    for (let i = 0; i < 81; i++) {
      if (this._board[Math.floor(i / 9)][i % 9] !== 0) this._givens.add(i);
    }

    this._renderGrid();
    this._r.diffBadge.textContent = DIFFICULTY[this._difficulty].label;
  }

  onStart()  { this._startTimer(); }
  onTick()   { /* event-driven — no tick logic */ }
  onRender() { /* event-driven — no render loop */ }

  onEnd(result) {
    this._stopTimer();
    this.showOverlay(result);
  }

  // ── Puzzle generation ──────────────────────────────────────────────────────
  _generateBoard() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    this._fillBoard(board);
    return board;
  }

  /** Recursive backtracking fill with shuffled candidates. */
  _fillBoard(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) continue;
        for (const num of this._shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (this._isPlaceable(board, r, c, num)) {
            board[r][c] = num;
            if (this._fillBoard(board)) return true;
            board[r][c] = 0;
          }
        }
        return false; // no valid number found — backtrack
      }
    }
    return true; // all cells filled
  }

  _isPlaceable(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num) return false;
      if (board[i][col] === num) return false;
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++)
      for (let c = bc; c < bc + 3; c++)
        if (board[r][c] === num) return false;
    return true;
  }

  _shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Remove cells from a completed board to form the puzzle. */
  _createPuzzle(solution, difficulty) {
    const clues    = DIFFICULTY[difficulty].clues;
    const toRemove = 81 - clues;
    const puzzle   = solution.map(r => [...r]);
    const positions = this._shuffled([...Array(81).keys()]);
    for (let i = 0; i < toRemove; i++) {
      const pos = positions[i];
      puzzle[Math.floor(pos / 9)][pos % 9] = 0;
    }
    return puzzle;
  }

  // ── Cell selection ─────────────────────────────────────────────────────────
  _selectCell(idx) {
    if (this._state !== STATE.RUNNING) return;
    this._selected = idx;
    this._updateGrid();
  }

  // ── Number input ───────────────────────────────────────────────────────────
  _inputNumber(num) {
    if (this._selected === null) return;
    if (this._givens.has(this._selected)) return; // given cells are locked
    const r = Math.floor(this._selected / 9);
    const c = this._selected % 9;
    this._board[r][c] = num;
    this._updateGrid();
    if (num !== 0) this._checkWin();
  }

  // ── Conflict detection ─────────────────────────────────────────────────────
  /** Returns a Set of flat indices where a duplicate exists in row/col/box. */
  _getConflicts() {
    const conflicts = new Set();
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const v = this._board[r][c];
      if (v === 0) continue;
      for (let j = i + 1; j < 81; j++) {
        const r2 = Math.floor(j / 9), c2 = j % 9;
        if (this._board[r2][c2] !== v) continue;
        const sameRow = r === r2;
        const sameCol = c === c2;
        const sameBox = Math.floor(r / 3) === Math.floor(r2 / 3) &&
                        Math.floor(c / 3) === Math.floor(c2 / 3);
        if (sameRow || sameCol || sameBox) { conflicts.add(i); conflicts.add(j); }
      }
    }
    return conflicts;
  }

  // ── Grid rendering ─────────────────────────────────────────────────────────
  /** Full re-render: sets text content + all CSS state classes. */
  _renderGrid() {
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const v = this._board[r][c];
      const cell = this._cells[i];
      cell.textContent = v !== 0 ? v : '';
      cell.classList.toggle('given', this._givens.has(i));
      cell.classList.toggle('user',  !this._givens.has(i) && v !== 0);
    }
    this._updateGrid();
  }

  /** Lightweight update: re-applies highlight classes without touching text/given. */
  _updateGrid() {
    const conflicts = this._getConflicts();
    const sel  = this._selected;
    const selR = sel !== null ? Math.floor(sel / 9) : -1;
    const selC = sel !== null ? sel % 9 : -1;
    const selV = sel !== null ? this._board[selR][selC] : 0;

    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const v = this._board[r][c];
      const cell = this._cells[i];

      // Keep given/user classes in sync after input
      cell.textContent = v !== 0 ? v : '';
      cell.classList.toggle('given', this._givens.has(i));
      cell.classList.toggle('user',  !this._givens.has(i) && v !== 0);

      const isSelected = i === sel;
      const isConflict = conflicts.has(i);
      const isRelated  = sel !== null && !isSelected && (
        r === selR || c === selC ||
        (Math.floor(r / 3) === Math.floor(selR / 3) &&
         Math.floor(c / 3) === Math.floor(selC / 3))
      );
      const isSameNum  = selV > 0 && v === selV && !isSelected;

      cell.classList.toggle('selected', isSelected);
      cell.classList.toggle('conflict', isConflict);
      cell.classList.toggle('related',  isRelated && !isConflict && !isSelected);
      cell.classList.toggle('same-num', isSameNum && !isConflict && !isSelected);
    }
  }

  // ── Win detection ──────────────────────────────────────────────────────────
  _checkWin() {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (this._board[r][c] !== this._solution[r][c]) return;

    this.end({
      emoji:       '🎉',
      title:       'Puzzle Solved!',
      subtitle:    `${DIFFICULTY[this._difficulty].label} difficulty`,
      finalScore:  `⏱ ${this._formatTime(this._elapsedSeconds)}`,
      buttonLabel: 'Play Again',
    });
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  _startTimer() {
    this._timerInterval = setInterval(() => {
      this._elapsedSeconds++;
      this._updateTimerDisplay();
    }, 1000);
  }

  _stopTimer() {
    clearInterval(this._timerInterval);
    this._timerInterval = null;
  }

  _updateTimerDisplay() {
    this._r.timer.textContent = this._formatTime(this._elapsedSeconds);
  }

  _formatTime(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
}

new SudokuGame();
