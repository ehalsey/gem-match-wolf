# Gem Match Wolf

A modern match-3 puzzle game built with TypeScript, Phaser 3, and Webpack. Match colorful gems, create powerful boosters, and aim for the highest score!

## Features

- **Classic Match-3 Gameplay** - Swap adjacent gems to create matches of 3 or more
- **Power-Up System** - Create special boosters with different match patterns:
  - **Horizontal Rocket** - Destroys entire row (match 4 horizontally)
  - **Vertical Rocket** - Destroys entire column (match 4 vertically)
  - **Light Ball (Color Bomb)** - Destroys all gems of one color across entire board (match 5+ gems)
  - **TNT** - Explodes in a cross pattern, destroying 4 adjacent cells (match L-shape)
  - **Fly-Away** - Flies to best target and explodes twice in cross patterns (match 2x2 square)
- **Drag and Drop Support** - Click-and-drag gems to swap them
- **Floating Score Feedback** - See points earned right where you made the match
- **Move Counter** - Strategic gameplay with limited moves
- **Cascade Scoring** - Chain reactions multiply your score
- **Smooth Animations** - Polished visual feedback and effects
- **Modern Graphics** - High-quality gem sprites

## How to Play

### Basic Rules
1. **Swap adjacent gems** (horizontal or vertical) to create matches
2. **Match 3 or more** gems of the same color to destroy them
3. **Score points** before running out of moves
4. **Plan ahead** - you have 30 moves to reach the highest score possible

### Power-Ups
Power-ups are created automatically when you match gems in special patterns:

#### Linear Matches
- **Match 4 horizontally** → Creates a **Horizontal Rocket** 🚀
  - Destroys the entire row when activated
  - **Swap up/down** to move it to a different row before activating
- **Match 4 vertically** → Creates a **Vertical Rocket** 🚀
  - Destroys the entire column when activated
  - **Swap left/right** to move it to a different column before activating
- **Match 5+ gems** → Creates a **Light Ball** ⚪ (Color Bomb)
  - Destroys ALL gems of one color across the entire board
  - **Swap with a specific gem color** to destroy all of that color

#### Special Patterns
- **Match L-shape** (5 gems in L formation) → Creates **TNT** 💣
  - Explodes in a cross pattern (up, down, left, right)
  - Destroys 4 adjacent cells plus the center
- **Match 2x2 square** (4 gems in a square) → Creates **Fly-Away** 🚁
  - Explodes at starting position in cross pattern
  - Flies to the best strategic target on the board
  - Explodes again at target in cross pattern
  - Clears ~10 gems total

**Activating Power-Ups:**
- **Swap/drag a power-up** with an adjacent gem to activate it
- Gives you strategic control to position rockets or choose Light Ball colors
- Power-ups can chain-activate other power-ups they hit!
- Power-ups clear large sections of the board and trigger massive cascades!

## Tips & Hints to Win

### Strategic Planning
1. **Look for 4+ matches first** - Always prioritize creating power-ups over simple 3-matches
2. **Scan the whole board** - Don't just focus on one area; the best move might be elsewhere
3. **Plan cascade reactions** - Try to set up matches that will create chain reactions when gems fall

### Power-Up Mastery
4. **Save power-ups for combos** - Try to activate multiple power-ups at once for massive points
5. **Light Ball is king** - Destroys all gems of one color; combo with rockets for insane clears
6. **2x2 squares create Fly-Away** - Look for opportunities to drag gems to form 2x2 squares
7. **L-shapes create TNT** - 5 gems in an L pattern make explosive TNT power-ups
8. **Chain reactions** - Power-ups can trigger other power-ups, creating devastating combos
9. **Position your rockets** - Swap rockets to different rows/columns before activating
10. **Choose Light Ball targets** - Swap with specific gem colors to control what gets destroyed
11. **Create power-ups in the center** - They're easier to activate when surrounded by gems

### Scoring Tips
12. **Watch the floating scores** - Gold text appears showing exactly how many points each match earned
13. **Cascades multiply your score** - Each cascade level increases your points exponentially
14. **Longer chains = more points** - A 6-match is worth much more than two 3-matches
15. **Power-up activations are huge** - They clear many gems and can trigger cascades

### Move Management
16. **Don't rush** - Think before each move; you only get 30 moves
17. **Watch the move counter** - Changes color at 10 moves (orange) and 5 moves (red)
18. **Forced moves** - If you see "No more moves!" you weren't looking carefully enough

### Advanced Tactics
19. **Corner strategy** - Work from corners and edges to create cascades toward the center
20. **L-shapes and 2x2 squares** - Special patterns create the most powerful boosters (TNT, Fly-Away)
21. **Setup moves** - Sometimes make a "bad" move to set up a better one next turn
22. **Fly-Away targets** - The Fly-Away automatically finds the best strategic target with most matching neighbors
23. **Rocket positioning** - Move rockets to crowded rows/columns for maximum destruction

## Scoring System

- **Base score**: 50 points per gem (after the 3rd gem in a match)
  - 3-match = 50 points
  - 4-match = 100 points
  - 5-match = 150 points
  - 6-match = 200 points

- **Cascade multiplier**: Each cascade level multiplies your score
  - First cascade: 1x
  - Second cascade: 2x
  - Third cascade: 3x
  - And so on!

- **Power-up bonus**: Each power-up activation can destroy 8-30+ gems depending on type

## Installation & Running

### Prerequisites
- Node.js v22 or higher

### Setup
```bash
cd bejeweled
npm install
```

### Development
```bash
npm run dev
```
Opens the game at http://localhost:8000 with hot-reload

### Production Build
```bash
npm run build
```

## Technology Stack

- **TypeScript 5.3** - Type-safe game logic
- **Phaser 3.80** - HTML5 game framework
- **Webpack 5** - Module bundler with hot-reload
- **ESLint** - Code quality and consistency

## Project Structure

```
bejeweled/
├── src/
│   ├── index.ts          # Entry point
│   ├── GameScene.ts      # Main game logic
│   ├── MenuScene.ts      # Score/moves UI
│   ├── ConfirmPopup.ts   # Confirmation dialogs
│   ├── TextButton.ts     # UI buttons
│   └── constants.ts      # Game configuration
├── assets/               # Gem and power-up sprites
├── index.html           # HTML template
└── styles.css          # Page styling
```

## Credits

- **Base Game**: Forked from [BeLi4L/bejeweled](https://github.com/BeLi4L/bejeweled)
- **Gem Sprites**: From Gem-Match3 asset pack
- **Power-Up Sprites**: From Gem-Match3 Boosters collection
- **Enhanced by**: Claude Code

## License

MIT License - Feel free to use and modify!

---

**Pro Tip**: The game tracks available winning moves. If it says "No more moves!" at game over, every remaining position was checked - there truly were no valid matches left!
