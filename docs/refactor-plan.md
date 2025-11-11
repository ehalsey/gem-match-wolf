# Gem Match Wolf - Refactoring Plan

## Goals

Enable the following features with minimal friction:
1. **Variable board sizes** (e.g., 9x9, 10x10)
2. **Non-rectangular boards** (missing tiles in corners, custom shapes)
3. **Obstacles and special tiles** (ice blocks, locked gems, stone blocks)
4. **New power-up types** (faster to implement)

## Current Architecture Issues

### Critical Pain Points
1. **Board size is hardcoded** - The `size` constant and `Cell[][]` structure assumes 8x8
2. **No null/missing cell support** - Can't represent non-rectangular boards
3. **No obstacle/tile state system** - Cells can only be gems or power-ups
4. **Power-up system is procedural** - 280+ line switch statement, hard to extend
5. **GameScene God Class** - 3,943 lines handling input, logic, rendering, animation

### What Works Well
- Gem system (GemConfig) is clean and extensible
- LevelSystem is well-designed and modular
- Match detection logic is solid
- Meta-progression features are properly separated

## Refactoring Strategy

**Approach:** Incremental refactoring with continuous testing

Each phase:
- Maintains backward compatibility
- Passes all existing tests
- Can be committed independently
- Sets up the next phase

---

## Phase 1: Extract Board State Manager

**Duration:** 1 day
**Branch:** `refactor/board-state-manager`

### Objectives
- Centralize board state management
- Support variable dimensions
- Support null cells (for non-rectangular boards)
- Move board queries out of GameScene

### Implementation Steps

#### 1.1 Create BoardState Class

**New file:** `src/game/BoardState.ts`

```typescript
export interface BoardConfig {
  width: number
  height: number
  shape?: 'rectangle' | 'diamond' | 'octagon' | 'custom'
  missingCells?: Array<{ row: number; col: number }>
}

export class BoardState {
  private cells: (Cell | null)[][]
  private config: BoardConfig

  constructor(config: BoardConfig) {
    this.config = config
    this.cells = this.initializeCells()
  }

  // Core queries
  getCell(row: number, col: number): Cell | null
  setCell(row: number, col: number, cell: Cell | null): void
  getAllCells(): Cell[]
  getValidCells(): Cell[] // Non-null cells only

  // Dimensions
  getWidth(): number
  getHeight(): number
  isValidPosition(row: number, col: number): boolean

  // Neighbors
  getNeighbors(row: number, col: number): Cell[]
  getCardinalNeighbors(row: number, col: number): Cell[]

  // State management
  clone(): BoardState
  forEach(callback: (cell: Cell, row: number, col: number) => void): void

  // Validation
  isSwappable(cell1: Cell, cell2: Cell): boolean
  canMatch(cell: Cell): boolean
}
```

#### 1.2 Update Cell Interface

**File:** `src/types.ts`

```typescript
export interface Cell {
  row: number
  column: number
  color: string
  sprite?: Phaser.GameObjects.Sprite
  powerup: PowerUpType
  tween?: Phaser.Tweens.Tween

  // NEW: Board position metadata
  exists: boolean  // false for missing tiles

  // NEW: Obstacle/special tile system (Phase 2)
  obstacle?: ObstacleType
  obstacleState?: ObstacleState
  durability?: number
}
```

#### 1.3 Refactor GameScene to Use BoardState

**Changes to:** `src/GameScene.ts`

Replace:
```typescript
private board: Cell[][]
private size = 8
```

With:
```typescript
private boardState: BoardState
private get board(): Cell[][] {
  return this.boardState.getRawBoard()
}
private get size(): number {
  return this.boardState.getWidth()
}
```

**Migration steps:**
1. Initialize `BoardState` in `create()`
2. Replace direct `board[row][col]` access with `boardState.getCell(row, col)`
3. Use `boardState.getAllCells()` instead of nested loops
4. Use `boardState.getNeighbors()` instead of manual neighbor finding

#### 1.4 Update Match Detection

**File:** `src/game/MatchDetector.ts`

```typescript
export class MatchDetector {
  // Update to accept BoardState
  static getExplodingChains(boardState: BoardState): Cell[][] {
    const board = boardState.getRawBoard()
    // ... existing logic, but skip null cells
  }

  // Add helper
  private static isValidMatchCell(cell: Cell | null): boolean {
    return cell !== null && cell.exists && !cell.obstacle
  }
}
```

#### 1.5 Update PowerUpSystem

**File:** `src/game/PowerUpSystem.ts`

Update methods to:
- Accept `BoardState` instead of `Cell[][]`
- Skip null cells in pattern detection
- Use `boardState.getNeighbors()` for adjacency checks

### Testing Requirements

- All existing tests must pass
- Board operations work identically
- Performance is not degraded

### Deliverables

- [ ] `BoardState.ts` created with full test coverage
- [ ] `GameScene.ts` refactored to use `BoardState`
- [ ] `MatchDetector.ts` updated for `BoardState`
- [ ] `PowerUpSystem.ts` updated for `BoardState`
- [ ] All existing tests passing
- [ ] No visual or gameplay changes

---

## Phase 2: Cell Type & Obstacle System

**Duration:** 1-2 days
**Branch:** `refactor/obstacle-system`

### Objectives
- Add obstacle/special tile types
- Implement obstacle behaviors (blocking, durability, destruction)
- Update rendering to show obstacles
- Make match detection respect obstacles

### Implementation Steps

#### 2.1 Define Obstacle Types

**New file:** `src/game/ObstacleSystem.ts`

```typescript
export type ObstacleType =
  | 'ice'           // Blocks matching, breaks after 1 match nearby
  | 'double-ice'    // Blocks matching, breaks after 2 matches nearby
  | 'stone'         // Permanent blocker, only removed by power-ups
  | 'locked'        // Requires key match to unlock
  | 'chain'         // Requires chain combo to break
  | null

export interface ObstacleState {
  type: ObstacleType
  durability: number  // How many hits until destroyed
  properties?: {
    lockedGemColor?: string  // For locked obstacles
    requiresChain?: number   // For chain obstacles
  }
}

export interface ObstacleDefinition {
  id: ObstacleType
  sprite: string
  blockMatch: boolean      // Prevents matching
  blockSwap: boolean       // Prevents swapping
  blockFall: boolean       // Prevents gems falling through
  durability: number
  onHit?: (cell: Cell, boardState: BoardState) => void
  onDestroy?: (cell: Cell, boardState: BoardState) => void
}

export const OBSTACLE_DEFINITIONS: Record<ObstacleType, ObstacleDefinition> = {
  ice: {
    id: 'ice',
    sprite: 'ice-overlay',
    blockMatch: true,
    blockSwap: false,
    blockFall: false,
    durability: 1,
    onHit: (cell) => {
      cell.durability = (cell.durability || 1) - 1
      if (cell.durability <= 0) {
        cell.obstacle = null
      }
    }
  },
  // ... more obstacles
}
```

#### 2.2 Update Cell Interface

**File:** `src/types.ts`

```typescript
export interface Cell {
  // ... existing fields

  // Obstacle system
  obstacle: ObstacleType
  obstacleState?: ObstacleState
  durability?: number
}
```

#### 2.3 Update BoardState

**File:** `src/game/BoardState.ts`

Add methods:
```typescript
// Obstacle queries
hasObstacle(row: number, col: number): boolean
isBlocked(row: number, col: number): boolean
canSwap(cell1: Cell, cell2: Cell): boolean
canMatch(cell: Cell): boolean

// Obstacle operations
damageObstacle(cell: Cell): void
destroyObstacle(cell: Cell): void
```

#### 2.4 Update Match Detection

**File:** `src/game/MatchDetector.ts`

Skip cells with obstacles that block matching:
```typescript
private static canMatch(cell: Cell | null): boolean {
  if (!cell || !cell.exists) return false
  if (cell.obstacle) {
    const def = OBSTACLE_DEFINITIONS[cell.obstacle]
    if (def?.blockMatch) return false
  }
  return true
}
```

#### 2.5 Update Rendering

**File:** `src/GameScene.ts`

Add obstacle sprite rendering:
```typescript
private renderObstacle(cell: Cell): void {
  if (cell.obstacle && cell.obstacleState) {
    const def = OBSTACLE_DEFINITIONS[cell.obstacle]
    const sprite = this.add.sprite(x, y, def.sprite)
    // Position over cell
    // Store reference for updates
  }
}

private updateObstacleSprite(cell: Cell): void {
  // Update sprite based on durability
  // Show cracks, damage states, etc.
}
```

### Testing Requirements

- Ice blocks prevent matching
- Obstacles take damage from adjacent matches
- Obstacles break after reaching 0 durability
- Stone blocks only removed by power-ups
- All existing tests still pass

### Deliverables

- [ ] `ObstacleSystem.ts` created with obstacle definitions
- [ ] Cell interface updated with obstacle fields
- [ ] BoardState updated with obstacle queries
- [ ] Match detection respects obstacles
- [ ] Rendering shows obstacles correctly
- [ ] Tests for obstacle behaviors
- [ ] All existing tests passing

---

## Phase 3: Power-Up Strategy Pattern

**Duration:** 2-3 days
**Branch:** `refactor/powerup-strategy`

### Objectives
- Create extensible power-up system
- Eliminate 280+ line switch statement
- Make power-ups respect obstacles/missing tiles
- Enable adding new power-ups with ~50 lines of code

### Implementation Steps

#### 3.1 Define Power-Up Interface

**New file:** `src/game/powerups/IPowerUp.ts`

```typescript
export interface PowerUpContext {
  scene: GameScene
  boardState: BoardState
  cell: Cell
  targetedCells?: Set<Cell>
  originCell?: Cell
}

export interface IPowerUp {
  readonly id: PowerUpType
  readonly priority: number
  readonly sprite: string

  // Pattern detection
  detectPatterns(
    boardState: BoardState,
    swapContext?: SwapContext
  ): Cell[][]

  // Execution
  execute(context: PowerUpContext): Promise<void>

  // Visual effects
  createEffect(x: number, y: number, scene: Phaser.Scene): void

  // Behavior
  canChainActivate(): boolean
  canComboWith(other: IPowerUp): boolean
}

export abstract class BasePowerUp implements IPowerUp {
  abstract id: PowerUpType
  abstract priority: number
  abstract sprite: string

  canChainActivate(): boolean { return true }
  canComboWith(other: IPowerUp): boolean { return true }

  // Helper methods for common operations
  protected markCellForDestruction(cell: Cell, context: PowerUpContext): void {
    // Common destruction logic
  }

  protected createParticles(config: ParticleConfig): void {
    // Common particle creation
  }
}
```

#### 3.2 Implement Existing Power-Ups

**New files:**
- `src/game/powerups/HorizontalRocket.ts`
- `src/game/powerups/VerticalRocket.ts`
- `src/game/powerups/TNT.ts`
- `src/game/powerups/LightBall.ts`
- `src/game/powerups/FlyAway.ts`

Example:
```typescript
export class HorizontalRocket extends BasePowerUp {
  id: PowerUpType = 'horizontal-rocket'
  priority = 1
  sprite = 'horizontal-rocket'

  detectPatterns(boardState: BoardState): Cell[][] {
    // Move logic from PowerUpSystem
    return patterns
  }

  async execute(context: PowerUpContext): Promise<void> {
    const { scene, boardState, cell } = context
    const row = cell.row

    // Destroy all cells in row
    for (let col = 0; col < boardState.getWidth(); col++) {
      const targetCell = boardState.getCell(row, col)
      if (targetCell && targetCell !== cell) {
        if (targetCell.powerup) {
          await scene.triggerPowerUp(targetCell, undefined, context.targetedCells)
        } else {
          this.markCellForDestruction(targetCell, context)
        }
      }
    }
  }

  createEffect(x: number, y: number, scene: Phaser.Scene): void {
    // Visual effect logic
  }
}
```

#### 3.3 Create Power-Up Registry

**New file:** `src/game/powerups/PowerUpRegistry.ts`

```typescript
export class PowerUpRegistry {
  private powerUps = new Map<PowerUpType, IPowerUp>()

  register(powerUp: IPowerUp): void {
    this.powerUps.set(powerUp.id, powerUp)
  }

  get(type: PowerUpType): IPowerUp | undefined {
    return this.powerUps.get(type)
  }

  getAll(): IPowerUp[] {
    return Array.from(this.powerUps.values())
      .sort((a, b) => b.priority - a.priority)
  }

  detectPatterns(boardState: BoardState, swapContext?: SwapContext): Map<Cell, PowerUpType> {
    const patterns = new Map<Cell, PowerUpType>()

    for (const powerUp of this.getAll()) {
      const detected = powerUp.detectPatterns(boardState, swapContext)
      for (const pattern of detected) {
        // Use highest priority power-up for each cell
        if (!patterns.has(pattern[0])) {
          patterns.set(pattern[0], powerUp.id)
        }
      }
    }

    return patterns
  }
}

// Initialize registry
export const powerUpRegistry = new PowerUpRegistry()
powerUpRegistry.register(new HorizontalRocket())
powerUpRegistry.register(new VerticalRocket())
powerUpRegistry.register(new TNT())
powerUpRegistry.register(new LightBall())
powerUpRegistry.register(new FlyAway())
```

#### 3.4 Refactor GameScene.triggerPowerUp()

**File:** `src/GameScene.ts`

Replace 280-line switch statement with:
```typescript
private async triggerPowerUp(
  cell: Cell,
  originCell?: Cell,
  targetedCells: Set<Cell> = new Set()
): Promise<void> {
  if (!cell.powerup) return

  const powerUp = powerUpRegistry.get(cell.powerup)
  if (!powerUp) {
    console.error(`Unknown power-up: ${cell.powerup}`)
    return
  }

  const context: PowerUpContext = {
    scene: this,
    boardState: this.boardState,
    cell,
    targetedCells,
    originCell
  }

  // Create visual effect
  const pos = this.getCellPosition(cell.row, cell.column)
  powerUp.createEffect(pos.x, pos.y, this)

  // Execute power-up behavior
  await powerUp.execute(context)
}
```

#### 3.5 Update PowerUpSystem

**File:** `src/game/PowerUpSystem.ts`

Simplify to use registry:
```typescript
export class PowerUpSystem {
  static detectSpecialPatterns(
    boardState: BoardState,
    swapContext?: SwapContext
  ): Map<Cell, PowerUpType> {
    return powerUpRegistry.detectPatterns(boardState, swapContext)
  }

  // Keep activation logic, but simplify
  // ...
}
```

### Testing Requirements

- All existing power-up behaviors work identically
- Power-ups respect obstacles
- Power-ups skip null cells (missing tiles)
- Chain reactions work correctly
- Combos work correctly
- All existing tests pass

### Deliverables

- [ ] `IPowerUp` interface and `BasePowerUp` class created
- [ ] All 5 power-ups converted to strategy classes
- [ ] `PowerUpRegistry` created and initialized
- [ ] `GameScene.triggerPowerUp()` refactored (280 lines → ~30 lines)
- [ ] `PowerUpSystem` simplified
- [ ] Tests for each power-up strategy
- [ ] All existing tests passing

---

## Phase 4: Variable Board Dimensions

**Duration:** 1-2 days
**Branch:** `refactor/variable-boards`

### Objectives
- Support different board sizes (8x8, 9x9, 10x10)
- Support non-rectangular shapes (diamond, octagon)
- Update level config to specify board layout
- Update rendering for variable sizes

### Implementation Steps

#### 4.1 Update LevelSystem

**File:** `src/game/LevelSystem.ts`

```typescript
export interface LevelConfig {
  // ... existing fields

  // NEW: Board configuration
  boardConfig: BoardConfig
}

// Add board configs to levels
export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    difficulty: 'easy',
    boardConfig: {
      width: 8,
      height: 8,
      shape: 'rectangle'
    },
    // ...
  },
  {
    id: 10,
    difficulty: 'medium',
    boardConfig: {
      width: 9,
      height: 9,
      shape: 'octagon',  // Missing corner tiles
      missingCells: [
        { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 7 }, { row: 0, col: 8 },
        { row: 1, col: 0 }, { row: 1, col: 8 },
        // ... more corners
      ]
    },
    // ...
  }
]
```

#### 4.2 Update GameScene Initialization

**File:** `src/GameScene.ts`

```typescript
private initBoard(): void {
  const levelConfig = LevelSystem.getCurrentLevel()

  // Create board state with level's configuration
  this.boardState = new BoardState(levelConfig.boardConfig)

  // Fill with gems
  this.boardState.forEach((cell, row, col) => {
    if (cell) {  // Only fill valid positions
      const gemId = this.getRandomGemId()
      cell.color = gemId
      // Create sprite...
    }
  })

  // Update camera/positioning for variable sizes
  this.updateCameraForBoardSize()
}
```

#### 4.3 Update Rendering

**File:** `src/GameScene.ts`

```typescript
private updateCameraForBoardSize(): void {
  const width = this.boardState.getWidth()
  const height = this.boardState.getHeight()

  // Center board on screen
  // Adjust cell spacing if needed
  // Scale for very large boards
}

private getCellPosition(row: number, col: number): { x: number, y: number } {
  // Calculate based on board dimensions
  // Handle missing cells
}
```

### Testing Requirements

- 8x8 boards work identically to current
- 9x9 boards render correctly
- Octagon shape (missing corners) works
- Match detection works on non-rectangular boards
- Power-ups work on variable sizes
- All existing tests pass

### Deliverables

- [ ] `LevelConfig` updated with `boardConfig`
- [ ] GameScene supports variable board sizes
- [ ] Rendering adapts to different sizes
- [ ] Tests for 9x9 and non-rectangular boards
- [ ] All existing tests passing

---

## Phase 5: Testing & Polish

**Duration:** 1-2 days
**Branch:** `refactor/testing-polish`

### Objectives
- Comprehensive test coverage for new systems
- Update all existing tests
- Performance optimization
- Documentation

### Implementation Steps

#### 5.1 Unit Tests for New Systems

**New test files:**
- `tests/unit/BoardState.test.ts`
- `tests/unit/ObstacleSystem.test.ts`
- `tests/unit/PowerUpStrategies.test.ts`

```typescript
describe('BoardState', () => {
  it('supports variable dimensions', () => { /* ... */ })
  it('handles null cells correctly', () => { /* ... */ })
  it('finds neighbors correctly on non-rectangular boards', () => { /* ... */ })
})

describe('ObstacleSystem', () => {
  it('ice blocks matching', () => { /* ... */ })
  it('obstacles take damage from adjacent matches', () => { /* ... */ })
  it('stone blocks only removed by power-ups', () => { /* ... */ })
})

describe('PowerUpStrategies', () => {
  it('horizontal rocket destroys row', () => { /* ... */ })
  it('power-ups respect obstacles', () => { /* ... */ })
  it('power-ups skip null cells', () => { /* ... */ })
})
```

#### 5.2 Update E2E Tests

Update Playwright tests to work with new architecture:
- Variable board sizes
- Obstacles
- New power-up system

#### 5.3 Performance Testing

- Profile board operations
- Optimize hot paths (match detection, rendering)
- Ensure no performance regression

#### 5.4 Documentation

- Update README with new architecture
- Document how to add new power-ups
- Document how to add new obstacles
- Document board configuration options

### Deliverables

- [ ] Unit tests for all new systems
- [ ] E2E tests updated and passing
- [ ] Performance benchmarks
- [ ] Documentation updated
- [ ] Code review and cleanup

---

## Success Criteria

### Must Have (Blocking)
- ✅ All existing tests pass
- ✅ No visual or gameplay regressions
- ✅ Performance is maintained
- ✅ Variable board sizes work (8x8, 9x9)
- ✅ Non-rectangular boards work (octagon)
- ✅ At least one obstacle type implemented (ice)

### Should Have
- ✅ Power-up strategy pattern fully implemented
- ✅ All 5 existing power-ups converted
- ✅ Unit tests for new systems
- ✅ Documentation updated

### Nice to Have
- 2+ obstacle types implemented
- Data-driven pattern detection
- Event bus for system communication
- Separate rendering engine

---

## Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Board State Manager | 1 day | 1 day |
| Phase 2: Obstacle System | 1-2 days | 2-3 days |
| Phase 3: Power-Up Strategy | 2-3 days | 4-6 days |
| Phase 4: Variable Boards | 1-2 days | 5-8 days |
| Phase 5: Testing & Polish | 1-2 days | 6-10 days |

**Total Estimate: 6-10 days**

---

## Risk Assessment

### High Risk
- **Breaking existing functionality** - Mitigated by running tests after each phase
- **Performance degradation** - Mitigated by profiling and benchmarking

### Medium Risk
- **Scope creep** - Stick to the phase plan, don't add extra features
- **Test maintenance** - Update tests incrementally as we go

### Low Risk
- **Merge conflicts** - Working on dedicated branch
- **Rollback complexity** - Each phase commits independently

---

## Post-Refactor Benefits

### Developer Experience
- **New power-ups:** 6-8 hours → 1-2 hours (70% faster)
- **New obstacles:** N/A → 1-2 hours per type
- **Variable boards:** N/A → Configuration only
- **Bug fixes:** Easier to isolate and fix

### Code Quality
- **GameScene:** 3,943 lines → ~2,500 lines (-37%)
- **Power-up switch:** 280 lines → 30 lines (-89%)
- **Duplication:** -225 lines
- **Test coverage:** E2E only → E2E + Unit tests

### Extensibility
- Power-ups are pluggable (strategy pattern)
- Obstacles are data-driven (definitions)
- Board layouts are configurable (level config)
- Systems are decoupled (can modify independently)

---

## Next Steps

1. Create branch: `refactor/board-state-manager`
2. Implement Phase 1
3. Run tests continuously
4. Commit when tests pass
5. Move to Phase 2

Let's build! 🚀
