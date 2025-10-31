# Testing & Debug Guide

This guide explains how to test different game scenarios without rebuilding.

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

## Tips

- **Quick Testing**: Use URL parameters to instantly set up test scenarios
- **Reproducible Bugs**: Share seed values to reproduce specific board states
- **No Rebuild**: All commands work at runtime - no need to restart dev server
- **Debug Logging**: Enable `?debug=true` to see helpful console messages
- **Infinite Testing**: Debug mode disables "no more moves" game over, so you can keep testing even without valid moves
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
