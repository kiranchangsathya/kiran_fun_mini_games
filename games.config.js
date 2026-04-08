/**
 * games.config.js
 *
 * Central registry of every game in the arcade.
 * The home page reads this to auto-generate game cards —
 * adding a new game only requires adding one entry here.
 *
 * Fields:
 *   id          Unique slug, matches the subfolder name
 *   name        Display name shown on the card
 *   emoji       Large icon shown at the top of the card
 *   accentColor CSS color for the card glow and Play button
 *   description Short description shown on the card (supports <br>)
 *   href        Path to the game's index.html
 *   controls    One-liner hint shown in the card footer
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
];
