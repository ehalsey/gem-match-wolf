# Null Safety Fixes for Non-Rectangular Boards

## Overview

This document details all null reference errors encountered and fixed when implementing non-rectangular board shapes (octagon, diamond) in levels 21-22.

**Root Cause**: Original code assumed rectangular 8x8 boards. Non-rectangular boards use `null` cells in corners/edges of the 2D array, causing null reference errors when accessing cell properties without null checks.

**Date Fixed**: 2025-11-13

---

## Quick Reference: Test Boards

Access non-rectangular test boards from level 1:
- **Octagon**: `http://localhost:8000/?debug=true&board=octagon`
- **Diamond**: `http://localhost:8000/?debug=true&board=diamond`

---

## Summary of Fixes

**Total Errors Fixed**: 12 (8 encountered during gameplay + 4 proactive fixes)

**Files Modified**:
- `src/GameScene.ts` - 12 methods fixed
- `src/game/MatchDetector.ts` - 1 method fixed

**Categories**:
1. **Match Detection & Validation** (2 bugs)
2. **Logging & Debugging** (1 bug)
3. **Game Flow - Gravity & Refill** (3 bugs)
4. **AI Hint System** (2 bugs)
5. **Input Handling** (1 proactive fix)
6. **Power-Up AI Targeting** (3 proactive fixes)

---

## Errors Encountered During Gameplay

### 1. Logging - logBoardState() Null Sprite Access

**Error Log**: `localhost-1763095429195.log`
**Location**: `GameScene.ts:2582`
**Error**: `Cannot read properties of null (reading 'sprite')`

**Cause**: `logBoardState()` accessed `cell.sprite` without checking if `cell` is null.

**Fix** (Lines 2978-3004):
```typescript
logBoardState () {
  console.log('Board State:')
  const board = this.boardState.getRawBoard()
  const config = this.levelConfig?.boardConfig || { width: size, height: size }

  for (let row = 0; row < config.height; row++) {
    const rowData = []
    for (let col = 0; col < config.width; col++) {
      const cell = board[row][col]

      // Handle null cells (for non-rectangular boards)
      if (!cell) {
        rowData.push('    (NULL)')
        continue
      }

      const spriteExists = cell.sprite && !cell.sprite.scene ? 'DESTROYED_SPRITE' : 'OK'
      const display = cell.empty
        ? '____'
        : cell.powerup
          ? `[${cell.powerup.substring(0, 4).toUpperCase()}]`
          : cell.color.substring(0, 4).toUpperCase()
      rowData.push(`${display}(${spriteExists})`)
    }
    console.log(`Row ${row}: ${rowData.join(' | ')}`)
  }
}
```

---

### 2. Match Detection - shouldExplode() Null Access

**Error Log**: `localhost-1763095570855.log`
**Location**: `MatchDetector.ts:94`
**Error**: `Cannot read properties of null (reading 'powerup')`

**Cause**: `getCellsToDestroy()` called `board.flat()` which includes null cells, then passed them to `shouldExplode()` without filtering.

**Fix 2A - MatchDetector.ts** (Lines 68-79):
```typescript
static shouldExplode (cell: Cell, board: Cell[][]): boolean {
  // Handle null cells (for non-rectangular boards)
  if (!cell) {
    return false
  }

  // Power-ups don't explode as part of normal matches - they must be activated
  if (cell.powerup) {
    return false
  }
  return this.shouldExplodeHorizontally(cell, board) || this.shouldExplodeVertically(cell, board)
}
```

**Fix 2B - GameScene.ts** (Lines 3205-3223):
Added try-catch with detailed error logging per user request:
```typescript
getCellsToDestroy (): Cell[] {
  try {
    const board = this.boardState.getRawBoard()
    return board.flat().filter(cell => {
      // Skip null cells (for non-rectangular boards)
      if (!cell) {
        return false
      }

      // Destroy cells that should explode (matching 3+), are marked for destruction, or are already empty
      return (MatchDetector.shouldExplode(cell, board) || cell.markedForDestruction || cell.empty) && !cell.powerup
    })
  } catch (error) {
    console.error('[ERROR] getCellsToDestroy failed:', error)
    console.error('[ERROR] Board state:', this.boardState?.getConfig())
    this.logBoardState()
    throw error
  }
}
```

---

### 3. Gravity - getLowestEmptyCellBelow() Null Access

**Error Log**: `localhost-1763096173250.log`
**Location**: `GameScene.ts:2687` (called from `makeCellsFall()`)
**Error**: `Cannot read properties of null (reading 'row')`

**Cause**: `makeCellsFall()` called `getLowestEmptyCellBelow()` without checking if cell is null; `getLowestEmptyCellBelow()` accessed `belowCell.empty` without null check.

**Fix 3A - makeCellsFall()** (Lines 3006-3026):
```typescript
async makeCellsFall () {
  for (let column = 0; column < size; column++) {
    for (let row = size - 1; row >= 0; row--) {
      const cell = this.board[row][column]

      // Skip null cells (for non-rectangular boards)
      if (!cell) {
        continue
      }

      const lowestEmptyCell = this.getLowestEmptyCellBelow(cell)

      if (lowestEmptyCell !== null && !cell.empty) {
        this.swapCells(cell, lowestEmptyCell)
      }
    }
  }
  await this.moveSpritesWhereTheyBelong()
  this.invalidateWinningMovesCache()
}
```

**Fix 3B - getLowestEmptyCellBelow()** (Lines 3110-3124):
```typescript
getLowestEmptyCellBelow (cell: Cell): Cell {
  for (let row = size - 1; row > cell.row; row--) {
    const belowCell = this.board[row][cell.column]

    // Skip null cells (for non-rectangular boards)
    if (!belowCell) {
      continue
    }

    if (belowCell.empty) {
      return belowCell
    }
  }
  return null
}
```

---

### 4. Refill - refillBoard() Null Access

**Error Log**: `localhost-1763096173250.log` (same error as #3)
**Location**: `GameScene.ts:3034`
**Error**: Implicit - accessing `board[numberOfEmptyCells][column].empty` without null check

**Cause**: Not checking if cell exists before accessing `.empty` property in refill loops.

**Fix** (Lines 3028-3089):
```typescript
async refillBoard () {
  const levelGems = this.levelConfig ? this.levelConfig.gemTypes : gems

  for (let column = 0; column < size; column++) {
    let numberOfEmptyCells = 0
    while (numberOfEmptyCells < size) {
      const cell = this.board[numberOfEmptyCells][column]
      // Skip null cells (for non-rectangular boards) or stop when we hit a non-empty cell
      if (!cell || !cell.empty) {
        break
      }
      numberOfEmptyCells++
    }

    for (let row = 0; row < numberOfEmptyCells; row++) {
      const cell = this.board[row][column]

      // Skip null cells (for non-rectangular boards)
      if (!cell) {
        continue
      }

      cell.color = Phaser.Math.RND.pick(levelGems)
      cell.empty = false
      // ... create sprite
    }
  }

  // Safeguard: Ensure all non-empty, non-powerup cells have sprites
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = this.board[row][col]

      // Skip null cells (for non-rectangular boards)
      if (!cell) {
        continue
      }

      if (!cell.empty && !cell.powerup && !cell.sprite) {
        console.warn(`[REFILL] Cell [${row},${col}] is non-empty but has no sprite!`)
        // ... create sprite
      }
    }
  }
}
```

---

### 5. AI Hints - getWinningMoves() Null Access

**Error Log**: `localhost-1763095843174.log`
**Location**: `GameScene.ts:2847` (in `swapCells()`) called from `GameScene.ts:1067` (in `getWinningMoves()`)
**Error**: `Cannot read properties of null (reading 'row')`

**Cause**: `getWinningMoves()` passed null cells to `swapCells()`; `swapCells()` tried to spread null cell.

**Fix 5A - getWinningMoves()** (Lines 1272-1316):
```typescript
getWinningMoves (): { cell1: Cell, cell2: Cell }[] {
  // Check cache first
  const currentHash = this.getBoardHash()
  if (this.winningMovesCache && this.winningMovesCache.hash === currentHash) {
    return this.winningMovesCache.moves
  }

  const winningMoves: { cell1: Cell, cell2: Cell }[] = []

  for (let row = 0; row < size - 1; row++) {
    for (let column = 0; column < size - 1; column++) {
      const cell = this.board[row][column]
      const right = this.board[row][column + 1]
      const down = this.board[row + 1][column]

      // Skip null cells (for non-rectangular boards)
      if (!cell) {
        continue
      }

      // Swap right
      if (right) {
        this.swapCells(cell, right)
        if (MatchDetector.boardShouldExplode(this.board)) {
          winningMoves.push({ cell1: cell, cell2: right })
        }
        this.swapCells(cell, right)
      }

      // Swap down
      if (down) {
        this.swapCells(cell, down)
        if (MatchDetector.boardShouldExplode(this.board)) {
          winningMoves.push({ cell1: cell, cell2: down })
        }
        this.swapCells(cell, down)
      }
    }
  }

  this.winningMovesCache = { hash: currentHash, moves: winningMoves }
  return winningMoves
}
```

**Fix 5B - swapCells()** (Lines 3303-3317):
```typescript
swapCells (firstCell: Cell, secondCell: Cell) {
  // Handle null cells (for non-rectangular boards)
  if (!firstCell || !secondCell) {
    return
  }

  const firstCellCopy = { ...firstCell }
  firstCell.row = secondCell.row
  firstCell.column = secondCell.column
  secondCell.row = firstCellCopy.row
  secondCell.column = firstCellCopy.column

  this.board[firstCell.row][firstCell.column] = firstCell
  this.board[secondCell.row][secondCell.column] = secondCell
}
```

---

## Proactive Fixes (Found via Code Analysis)

### 6. Input Handling - getCellAt() No Bounds Check

**Location**: `GameScene.ts:3319`
**Issue**: No bounds checking; no null return type; could crash on clicks outside board.

**Fix** (Lines 3319-3330):
```typescript
getCellAt (pointer: Phaser.Input.Pointer): Cell | null {
  const row = Math.floor(pointer.worldY / CELL_SIZE)
  const column = Math.floor(pointer.worldX / CELL_SIZE)

  // Check bounds
  if (row < 0 || row >= size || column < 0 || column >= size) {
    return null
  }

  // Return cell (may be null for non-rectangular boards)
  return this.board[row][column]
}
```

---

### 7. Power-Up AI - findBestFlyAwayTarget() Null Access

**Location**: `GameScene.ts:2784-2813`
**Issue**: Accessing `cell.empty` and neighbor properties without null checks.

**Fix** (Lines 2784-2813):
```typescript
findBestFlyAwayTarget (fromCell: Cell, targetedCells?: Set<Cell>): Cell | null {
  let bestCell: Cell | null = null
  let bestScore = 0

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = this.board[row][col]

      // Skip null cells (for non-rectangular boards)
      if (!cell) continue

      // Skip if cell is empty, a power-up, the source cell, or already targeted
      if (cell.empty || cell.powerup || cell === fromCell) continue
      if (targetedCells && targetedCells.has(cell)) continue

      // Count how many neighbors match this cell's color
      const neighbors = this.getNeighbors(cell)
      const matchCount = neighbors.filter(n => n && !n.empty && !n.powerup && n.color === cell.color).length

      if (matchCount > bestScore) {
        bestScore = matchCount
        bestCell = cell
      }
    }
  }

  return bestCell
}
```

---

### 8. Power-Up AI - findBestRowForRocket() Null Access

**Location**: `GameScene.ts:2627-2685`
**Issue**: Accessing `cell.empty` and `cell.color` in challenge logic without null checks.

**Fix** (Lines 2627-2685):
```typescript
findBestRowForRocket (): number {
  if (!this.currentChallenge) {
    return Math.floor(size / 2)
  }

  if (this.currentChallenge.type === 'color-match') {
    const targetColor = this.currentChallenge.color
    let bestRow = 0
    let maxCount = 0

    for (let row = 0; row < size; row++) {
      let count = 0
      for (let col = 0; col < size; col++) {
        const cell = this.board[row][col]
        // Skip null cells (for non-rectangular boards)
        if (cell && !cell.empty && cell.color === targetColor) {
          count++
        }
      }
      if (count > maxCount) {
        maxCount = count
        bestRow = row
      }
    }
    return bestRow
  } else if (this.currentChallenge.type === 'power-up-create') {
    let bestRow = 0
    let maxPotential = 0

    for (let row = 0; row < size; row++) {
      let potential = 0
      for (let col = 0; col < size - 1; col++) {
        const cell = this.board[row][col]
        const next = this.board[row][col + 1]
        // Skip null cells (for non-rectangular boards)
        if (cell && next && !cell.empty && !next.empty && cell.color === next.color) {
          potential++
        }
      }
      if (potential > maxPotential) {
        maxPotential = potential
        bestRow = row
      }
    }
    return bestRow
  }

  return Math.floor(size / 2)
}
```

---

### 9. Power-Up AI - findBestColumnForRocket() Null Access

**Location**: `GameScene.ts:2687-2745`
**Issue**: Same as `findBestRowForRocket()` but for columns.

**Fix** (Lines 2687-2745):
```typescript
findBestColumnForRocket (): number {
  if (!this.currentChallenge) {
    return Math.floor(size / 2)
  }

  if (this.currentChallenge.type === 'color-match') {
    const targetColor = this.currentChallenge.color
    let bestColumn = 0
    let maxCount = 0

    for (let col = 0; col < size; col++) {
      let count = 0
      for (let row = 0; row < size; row++) {
        const cell = this.board[row][col]
        // Skip null cells (for non-rectangular boards)
        if (cell && !cell.empty && cell.color === targetColor) {
          count++
        }
      }
      if (count > maxCount) {
        maxCount = count
        bestColumn = col
      }
    }
    return bestColumn
  } else if (this.currentChallenge.type === 'power-up-create') {
    let bestColumn = 0
    let maxPotential = 0

    for (let col = 0; col < size; col++) {
      let potential = 0
      for (let row = 0; row < size - 1; row++) {
        const cell = this.board[row][col]
        const next = this.board[row + 1][col]
        // Skip null cells (for non-rectangular boards)
        if (cell && next && !cell.empty && !next.empty && cell.color === next.color) {
          potential++
        }
      }
      if (potential > maxPotential) {
        maxPotential = potential
        bestColumn = col
      }
    }
    return bestColumn
  }

  return Math.floor(size / 2)
}
```

---

## Testing

### Automated Tests
Created `tests/non-rectangular-test-boards.spec.ts` with tests for:
- Octagon board (9x9 with 24 null cells)
- Diamond board (9x9 with 40 null cells)

Both tests verify:
- Board loads correctly
- Configuration matches expected shape
- exportBoard() works
- Making moves doesn't crash

**Test Results**: All tests passing ✅

### Manual Testing URLs
- Octagon: `http://localhost:8000/?debug=true&board=octagon`
- Diamond: `http://localhost:8000/?debug=true&board=diamond`
- Level 21: `http://localhost:8000/?level=21`
- Level 22: `http://localhost:8000/?level=22`

---

## Pattern for Future Development

**When adding any new feature that iterates over `board[][]` or accesses cells:**

1. **Always check if cell is null first**:
   ```typescript
   const cell = this.board[row][col]
   if (!cell) continue  // or return, or whatever is appropriate
   ```

2. **Use `boardState.getRawBoard()`** instead of `this.board` when you need a clean reference

3. **Filter null cells when using array methods**:
   ```typescript
   const validCells = board.flat().filter(cell => cell !== null)
   ```

4. **Test on non-rectangular boards** using `?board=octagon` or `?board=diamond`

5. **Common places to check**:
   - Any loop over `board[row][col]`
   - Any `board.flat()` usage
   - Any neighbor/adjacency checks
   - Any AI/hint system that scans the board
   - Any animation that moves sprites based on board positions

---

## Prevention: Code Review Checklist

Before merging code that touches board iteration:

- [ ] Does it handle `null` cells in the board array?
- [ ] Does it have bounds checking for row/column indices?
- [ ] Have you tested it with `?board=octagon` manually?
- [ ] Does the automated test cover this code path?
- [ ] Does it use `.filter(cell => cell !== null)` when flattening the board?

---

## Related Documentation

- **[Test Boards](../TESTING.md)** - All available test boards including octagon/diamond
- **[Variable Boards Testing](./TESTING_VARIABLE_BOARDS.md)** - Testing different board sizes
- **[BoardState System](../src/game/BoardState.ts)** - How non-rectangular boards are implemented

---

## Build Info

- **Webpack Build**: 146 KiB (main.js)
- **No TypeScript errors**
- **All tests passing**
- **Date**: 2025-11-13
