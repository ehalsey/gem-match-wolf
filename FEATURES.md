# Feature Tracker & Enhancements

## ✅ Completed Features

### Core Gameplay
- [x] Match-3 basic mechanics
- [x] Drag and drop gem swapping
- [x] Click-to-select gem swapping
- [x] Move counter (30 moves)
- [x] Score tracking
- [x] Cascade multipliers
- [x] Game over detection (no moves / no valid moves)
- [x] "No more moves" detection algorithm

### Power-Ups (5 total)
- [x] Horizontal Rocket (match 4 horizontal)
- [x] Vertical Rocket (match 4 vertical)
- [x] Light Ball / Color Bomb (match 5+)
  - [x] Color selection via swap
- [x] TNT (match L-shape)
  - [x] Destroys all 8 surrounding cells (3x3 area including corners)
- [x] Fly-Away (match 2x2 square)
  - [x] Flying animation with orbit
  - [x] Intelligent target selection
  - [x] Dual explosions (start + end)

### Visual & Audio
- [x] Particle effects on gem destruction
- [x] Floating score text
- [x] Power-up creation burst effects
- [x] Sound effects (swap, match, explode, power-ups)
- [x] Smooth animations and tweens
- [x] Gradient background with checkerboard

### Game Logic
- [x] Prevent 3+ matches in initial board
- [x] Prevent 2x2 squares in initial board
- [x] Power-up chain reactions
- [x] Strategic rocket repositioning via swap
- [x] Cascade detection and scoring

---

## 🎯 Proposed Enhancements

### High Priority

#### 1. **Level System**
- [ ] Multiple levels with increasing difficulty
- [ ] Level-specific goals (reach score, clear X gems, etc.)
- [ ] Progressive move reduction or time limits
- [ ] Level selection screen

#### 2. **High Score / Leaderboard**
- [ ] Local storage for high scores
- [ ] Top 10 scores list
- [ ] Player name entry
- [ ] Score history

#### 3. **Hints System**
- [ ] "Hint" button to highlight valid moves
- [ ] Automatic hint after X seconds of inactivity
- [ ] Limited hints per game (3-5)
- [ ] Visual highlight animation for hinted move

#### 4. **Tutorial / First-Time User Experience**
- [ ] Interactive tutorial on first launch
- [ ] Power-up explanations when first created
- [ ] Tooltips for UI elements
- [ ] "How to Play" modal

### Medium Priority

#### 5. **Visual Improvements**
- [ ] Animated background
- [ ] Better gem sprites with shine/glow effects
- [ ] Power-up preview indicators
- [ ] Particle trails when dragging gems
- [ ] Screen shake on large explosions
- [ ] More dramatic Light Ball explosion effect

#### 6. **Audio Enhancements**
- [ ] Background music (mutable)
- [ ] Volume controls
- [ ] More varied sound effects
- [ ] Combo sound effects (for cascades)
- [ ] Victory/defeat music

#### 7. **Game Modes**
- [ ] **Timed Mode** - Score as much as possible in 60 seconds
- [ ] **Endless Mode** - Play until no valid moves
- [ ] **Puzzle Mode** - Specific board configurations to solve
- [ ] **Challenge Mode** - Daily/weekly challenges

#### 8. **Power-Up Combinations**
- [ ] Rocket + Rocket = Cross explosion (row + column)
- [ ] Light Ball + Rocket = All gems of one color become rockets
- [ ] Light Ball + Light Ball = Clear entire board
- [ ] TNT + Rocket = Larger explosion radius
- [ ] Fly-Away + Light Ball = Multiple fly-away missiles

#### 9. **Statistics & Progression**
- [ ] Total games played
- [ ] Total score across all games
- [ ] Highest cascade achieved
- [ ] Most powerful combo achieved
- [ ] Achievements/badges system

### Low Priority / Nice-to-Have

#### 10. **Mobile Optimization**
- [ ] Touch-friendly UI scaling
- [ ] Responsive design for different screen sizes
- [ ] Mobile gesture controls
- [ ] Haptic feedback on mobile

#### 11. **Customization**
- [ ] Theme selection (dark mode, light mode, etc.)
- [ ] Gem skin packs
- [ ] Board backgrounds
- [ ] Particle effect intensity settings

#### 12. **Social Features**
- [ ] Share score to social media
- [ ] Challenge friends
- [ ] Online leaderboard
- [ ] Multiplayer mode

#### 13. **Accessibility**
- [ ] Colorblind mode
- [ ] Alternative gem shapes/patterns
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Adjustable animation speeds

#### 14. **Quality of Life**
- [ ] Undo last move (limited uses)
- [ ] Pause menu
- [ ] "Restart current game" button
- [ ] Animation skip option
- [ ] Move preview (show what happens before committing)

---

## 🐛 Known Issues / Bugs

- [ ] None currently known

---

## 💡 Ideas & Brainstorming

### Potential Power-Up Ideas
- **Line Blaster** - Diagonal line destruction (match T-shape)
- **Gem Magnet** - Pulls all gems of one color to center, then destroys
- **Shuffle** - Randomizes entire board (rare, emergency power-up)
- **Time Freeze** - Pauses cascade (in timed mode)

### Gameplay Variations
- **Locked Gems** - Gems that require multiple matches to unlock
- **Ice Blocks** - Obstacles that need adjacent matches to clear
- **Golden Gems** - Special gems worth bonus points
- **Multiplier Tiles** - Board positions with 2x/3x score multipliers

### Progression Systems
- **Experience Points** - Level up player profile
- **Unlockables** - New gem sets, backgrounds, effects
- **Season Pass** - Regular content updates with rewards
- **Daily Rewards** - Bonus for playing daily

---

## 📝 Notes

- Focus on polishing existing features before adding new ones
- Performance is good; prioritize content over optimization
- Keep mobile-first mindset for future features
- User feedback will guide priority of enhancements

---

**Last Updated**: 2025-10-30
