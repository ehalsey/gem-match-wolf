# Testing & Debug Guide

This guide explains how to test different game scenarios and report bugs efficiently.

## Quick Reference

**Enable Debug Mode**: `http://localhost:8000/?debug=true`

**Most Useful Commands**:
- `gameDebug.captureMove(fromRow, fromCol, toRow, toCol, "expected")` - **Bug reporting tool** (undo first!)
- `gameDebug.logBoard()` - View current board state
- `gameDebug.exportBoard()` - Export board as JSON
- `gameDebug.loadTestBoard('match5')` - Load test scenario
- `gameDebug.getWinningMoves()` - Show available moves

**Keyboard Shortcuts**:
- `U` or `Z` - **Undo last move** (essential for bug reporting!)

---

## URL Parameters (Recommended)

Add parameters to the URL to configure the game on load:

### Seed the Random Number Generator
```
http://localhost:8000/?seed=12345
```
This ensures consistent board generation for reproducible testing.

### Enable Debug Mode
```
http://localhost:8000/?debug=true
```
Enables console logging, exposes debug commands, and **disables "no more moves" game over** to allow continuous testing.

### Load a Test Board
```
http://localhost:8000/?board=match5
```
Available test boards:
- `match5` - 5 blue gems in a row (creates Light Ball)
- `match4h` - 4 blue gems horizontally (creates Horizontal Rocket)
- `match4v` - 4 red gems vertically (creates Vertical Rocket)
- `lshape` - Red L-shape pattern (creates TNT)
- `rect3x2` - Blue 3x2 rectangle pattern (creates TNT)
- `rect2x3` - Blue 2x3 rectangle pattern (creates TNT)
- `square` - 2x2 red square (creates Fly-Away)
- `tnt-test` or `bomb-test` - TNT already spawned in center (test blast radius)

### Combine Parameters
```
http://localhost:8000/?debug=true&seed=12345&board=match5
```

## Console Commands

When debug mode is enabled, use these commands in the browser console:

### Set Random Seed
```javascript
gameDebug.setSeed(12345)
```
Note: Restart the game to see the effect.

### Spawn a Power-Up
```javascript
gameDebug.spawnPowerup('light-ball', 4, 4)
```
Power-up types:
- `'horizontal-rocket'`
- `'vertical-rocket'`
- `'tnt'`
- `'light-ball'`
- `'fly-away'`

### Load a Test Board
```javascript
gameDebug.loadTestBoard('match5')
```
Instantly loads a predefined board configuration.

### Log Current Board State
```javascript
gameDebug.logBoard()
```
Displays the current board in the console.

### Get Available Moves
```javascript
gameDebug.getWinningMoves()
```
Returns array of all valid moves that would create matches.

### Export Board State
```javascript
gameDebug.exportBoard()
```
Exports the current board as JSON with visual display. Useful for sharing board states or saving test scenarios.

### Capture Move for Bug Reporting (NEW!)
```javascript
gameDebug.captureMove(fromRow, fromCol, toRow, toCol, "Expected behavior description")
```
**The easiest way to report bugs!** This command:
1. Captures board state BEFORE the move
2. Executes the move automatically
3. Captures board state AFTER the move
4. Generates a formatted bug report you can copy/paste

**Example:**
```javascript
// Test a move from [0,0] to [0,1] that should create a horizontal rocket
gameDebug.captureMove(0, 0, 0, 1, "Should create horizontal rocket when 4 blues align")
```

The console will output a complete bug report template with before/after states that you can copy and share.

## Testing Workflow Examples

### Test Light Ball (5-Match)
1. Visit: `http://localhost:8000/?board=match5`
2. Swap any gem in row 0 to complete the match
3. Observe Light Ball creation and activation

### Test 3x2 Rectangle
1. Visit: `http://localhost:8000/?board=rect3x2`
2. Swap any gem in rows 0-1, columns 0-2 to complete the rectangle
3. Observe TNT creation in the center of the rectangle
4. Swap the TNT to activate and see cross-pattern explosion

### Test 2x3 Rectangle
1. Visit: `http://localhost:8000/?board=rect2x3`
2. Swap any gem in rows 0-2, columns 0-1 to complete the rectangle
3. Observe TNT creation in the center of the rectangle
4. Swap the TNT to activate and see cross-pattern explosion

### Test TNT Blast Radius (Quick)
1. Visit: `http://localhost:8000/?board=tnt-test`
2. Click the TNT in the center
3. Observe: Should destroy 2 cells in each direction (up, down, left, right)
4. Total: 9 cells destroyed (center + 8 surrounding in cross pattern)

### Test TNT with Specific Seed
1. Visit: `http://localhost:8000/?debug=true&seed=777`
2. Open browser console (F12)
3. Run: `gameDebug.loadTestBoard('lshape')`
4. Swap to complete the L-shape
5. Test the increased blast radius

### Test Power-Up Spawning
1. Visit: `http://localhost:8000/?debug=true`
2. Open console
3. Spawn a TNT: `gameDebug.spawnPowerup('tnt', 3, 3)`
4. Click it to test the blast radius

### Debug Specific Scenario
1. Play normally until you find an interesting board state
2. Run: `gameDebug.logBoard()`
3. Copy the seed from the URL
4. Reload with that seed to reproduce the scenario

## Bug Reporting Workflow

Found a bug? Here's the most efficient way to report it:

### Quick Method (Recommended)
1. Enable debug mode: `http://localhost:8000/?debug=true`
2. Open browser console (F12)
3. Play until you find the problematic move
4. **IMPORTANT: Press `U` or `Z` to undo that move** (captureMove needs to execute it fresh)
5. Use the bug capture command:
   ```javascript
   gameDebug.captureMove(fromRow, fromCol, toRow, toCol, "What should happen")
   ```
6. The console outputs a **complete bug report** - just copy and paste it!

**Note:** If you already made the move and forgot to undo, you can still manually capture state with `gameDebug.exportBoard()` and describe what happened.

### Example Bug Report Workflow
```javascript
// 1. You make a move from [2,3] to [2,4] and notice it doesn't create the expected rocket
// 2. Press U or Z to undo the move
// 3. Run captureMove to automatically test and capture the bug:
gameDebug.captureMove(2, 3, 2, 4, "Should create horizontal rocket from 4 blues")

// Console outputs:
// ╔═══════════════════════════════════════════════════════════════╗
// ║               MOVE CAPTURE - BUG REPORTING TOOL               ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// 📸 BEFORE MOVE:
//    From: [2, 3] → To: [2, 4]
//    ... complete before state ...
//
// 📸 AFTER MOVE:
//    ... complete after state ...
//
// ╔═══════════════════════════════════════════════════════════════╗
// ║                    BUG REPORT TEMPLATE                        ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// ## Bug Report
// **Move**: [2, 3] → [2, 4]
// **Expected**: Should create horizontal rocket from 4 blues
// **Actual**: [You describe what actually happened]
//
// **Before State**: { ... complete JSON ... }
// **After State**: { ... complete JSON ... }
```

### Manual Method
If you prefer to capture state manually:
1. Before making the move: `gameDebug.exportBoard()`
2. Make the move by clicking
3. After the move: `gameDebug.exportBoard()`
4. Copy both outputs and describe the issue

## Tips

- **Quick Testing**: Use URL parameters to instantly set up test scenarios
- **Reproducible Bugs**: Share seed values to reproduce specific board states
- **No Rebuild**: All commands work at runtime - no need to restart dev server
- **Debug Logging**: Enable `?debug=true` to see helpful console messages
- **Infinite Testing**: Debug mode disables "no more moves" game over, so you can keep testing even without valid moves
- **Bug Reporting**: Use `gameDebug.captureMove()` for instant bug reports with before/after state
- **Production Safety**: Debug features only work in development, won't affect deployed game

## Common Test Cases

| Test Case | URL |
|-----------|-----|
| Match 5 gems | `?board=match5` |
| Horizontal rocket | `?board=match4h` |
| Vertical rocket | `?board=match4v` |
| TNT blast radius (instant) | `?board=tnt-test` |
| TNT blast radius (L-shape) | `?board=lshape` |
| TNT from 3x2 rectangle | `?board=rect3x2` |
| TNT from 2x3 rectangle | `?board=rect2x3` |
| Fly-away double explosion | `?board=square` |
| Specific seed | `?seed=42` |
| Full debug mode | `?debug=true&seed=999` |

## Debug Command Reference

| Command | Purpose | Example |
|---------|---------|---------|
| `gameDebug.captureMove(fromRow, fromCol, toRow, toCol, expected)` | **Bug reporting** - Auto-capture before/after state | `captureMove(2, 3, 2, 4, "Should create rocket")` |
| `gameDebug.logBoard()` | View current board with sprite validation | `logBoard()` |
| `gameDebug.exportBoard()` | Export board as JSON | `exportBoard()` |
| `gameDebug.getWinningMoves()` | List all valid moves | `getWinningMoves()` |
| `gameDebug.loadTestBoard(name)` | Load predefined test board | `loadTestBoard('match5')` |
| `gameDebug.spawnPowerup(type, row, col)` | Spawn specific power-up | `spawnPowerup('tnt', 4, 4)` |
| `gameDebug.setSeed(number)` | Set random seed (restart required) | `setSeed(12345)` |
