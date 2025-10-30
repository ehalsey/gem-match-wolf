# Gem Match Wolf

A modern match-3 puzzle game built with TypeScript, Phaser 3, and Webpack. Match colorful gems, create powerful boosters, and aim for the highest score!

## Features

- **Classic Match-3 Gameplay** - Swap adjacent gems to create matches of 3 or more
- **Power-Up System** - Create special boosters by matching 4+ gems:
  - **Horizontal Rocket** - Destroys entire row (match 4 horizontally)
  - **Vertical Rocket** - Destroys entire column (match 4 vertically)
  - **Light Ball** - Destroys all gems of one color (match 5+ gems)
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
Power-ups are created automatically when you match 4 or more gems:

- **Match 4 horizontally** → Creates a Horizontal Rocket
- **Match 4 vertically** → Creates a Vertical Rocket
- **Match 5+ gems** → Creates a Light Ball (Color Bomb)

**Activating Power-Ups:**
- Click directly on a power-up to activate it immediately
- Swap a power-up with an adjacent gem to activate it
- Power-ups clear large sections of the board and can trigger massive cascades!

## Tips & Hints to Win

### Strategic Planning
1. **Look for 4+ matches first** - Always prioritize creating power-ups over simple 3-matches
2. **Scan the whole board** - Don't just focus on one area; the best move might be elsewhere
3. **Plan cascade reactions** - Try to set up matches that will create chain reactions when gems fall

### Power-Up Mastery
4. **Save power-ups for combos** - Try to activate multiple power-ups at once for massive points
5. **Light Ball + Rocket combo** - The most powerful combination in the game
6. **Create power-ups in the center** - They're easier to activate when surrounded by gems

### Scoring Tips
7. **Watch the floating scores** - Gold text appears showing exactly how many points each match earned
8. **Cascades multiply your score** - Each cascade level increases your points exponentially
9. **Longer chains = more points** - A 6-match is worth much more than two 3-matches
10. **Power-up activations are huge** - They clear many gems and can trigger cascades

### Move Management
11. **Don't rush** - Think before each move; you only get 30 moves
12. **Watch the move counter** - Changes color at 10 moves (orange) and 5 moves (red)
13. **Forced moves** - If you see "No more moves!" you weren't looking carefully enough

### Advanced Tactics
14. **Corner strategy** - Work from corners and edges to create cascades toward the center
15. **T and L shapes** - These create power-ups at the intersection when they match
16. **Setup moves** - Sometimes make a "bad" move to set up a better one next turn

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
