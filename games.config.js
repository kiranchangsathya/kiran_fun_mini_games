/**
 * games.config.js
 *
 * Central registry of every game in the arcade.
 * The home page reads this to auto-generate tiles —
 * adding a new game only requires adding one entry here.
 *
 * Fields:
 *   id          Unique slug, matches the subfolder name
 *   name        Display name shown on the tile
 *   emoji       Large icon shown on the tile
 *   accentColor CSS color for the tile glow on hover
 *   description Shown on the game's own start overlay (not the home page)
 *   href        Path to the game's index.html
 *   controls    One-liner hint shown in the game's footer
 */

export const GAMES = [
  {
    id:          'snake',
    name:        'Snake',
    emoji:       '🐍',
    accentColor: '#4ade80',
    description: 'Eat food, grow your snake, and don\'t crash!<br>Solo or 2-player mode.',
    href:        './snake/index.html',
    controls:    'Arrow keys · WASD · D-pad',
  },
  {
    id:          'dino',
    name:        'Dino Run',
    emoji:       '🦕',
    accentColor: '#fb923c',
    description: 'Jump over cacti and survive as long as you can!<br>Speed increases as you level up.',
    href:        './dino/index.html',
    controls:    'Space · Arrow Up · Jump button',
  },
  {
    id:          'pong',
    name:        'Ping Pong',
    emoji:       '🏓',
    accentColor: '#38bdf8',
    description: 'Classic 1v1 or vs-computer paddle battle.<br>First to 10 wins — pick your colors!',
    href:        './pong/index.html',
    controls:    'W/S · Arrow keys · D-pad',
  },
  {
    id:          'tetris',
    name:        'Tetris',
    emoji:       '🟪',
    accentColor: '#a855f7',
    description: 'Stack falling blocks and clear lines!<br>Speed increases as you level up.',
    href:        './tetris/index.html',
    controls:    '← → Move · ↑ Rotate · ↓ Soft drop · Space Hard drop',
  },
  {
    id:          'tictactoe',
    name:        'Tic Tac Toe',
    emoji:       '⭕',
    accentColor: '#facc15',
    description: 'Get 3 in a row to win!<br>Play vs an unbeatable computer or a friend.',
    href:        './tictactoe/index.html',
    controls:    'Click any cell to place your mark',
  },
  {
    id:          'sudoku',
    name:        'Sudoku',
    emoji:       '🔢',
    accentColor: '#60a5fa',
    description: 'Fill the 9×9 grid with no repeats in any row, column, or box.<br>Easy, Medium, and Hard modes.',
    href:        './sudoku/index.html',
    controls:    'Click a cell · type 1–9 · arrow keys to navigate',
  },
];
