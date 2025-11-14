# Game Improvements Implementation Plan

This document provides a structured plan for implementing the features and fixes listed in `ideas.md`.

## Overview

- **Total Items:** 16
- **Current Branch:** `feature/game-improvements`
- **Base Branch:** `master`
- **Status:** Ready for implementation

---

## Priority Matrix

### Category A: Critical Bugs (Fix First)

#### A1: Quick Visual Fixes
| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 9 | Goal icon alignment issue | Low | 15min | `src/GameScene.ts` |
| 14 | Stars cut off at top of end level screen | Low | 15min | `src/LevelCompleteScene.ts` |

#### A2: Core Power-Up Bugs
| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 10 | Horizontal rocket not working properly | Medium | 1-2hrs | `src/GameScene.ts`, tests |
| 13 | Vertical rocket only exploding up, not down | Medium | 1hr | `src/GameScene.ts`, tests |

---

### Category B: Game Logic Improvements

#### B1: Power-Up Behavior
| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 6 | Match should execute before power-up triggers | High | 2-3hrs | `src/GameScene.ts`, cascade logic |
| 15 | Double fly-away combo (create 3 total) | Medium | 2hrs | `src/GameScene.ts`, combo logic |

#### B2: New Combos
| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 7 | Horizontal + vertical rocket combo | Medium | 2hrs | `src/GameScene.ts` |
| 8 | Fly away + bomb combo | Medium | 2hrs | `src/GameScene.ts` |

---

### Category C: UI/UX Enhancements

| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 5 | Combo display smaller, over scoreboard not board | Medium | 1-2hrs | `src/GameScene.ts` |
| 3 | Display "new best" on main scene, not level | Medium | 1-2hrs | `src/MenuScene.ts`, `src/LevelCompleteScene.ts` |
| 4 | Move shop to main/home scene | Medium | 2-3hrs | `src/MenuScene.ts`, `src/ShopScene.ts` |

---

### Category D: Advanced Features

| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 1 | Fluid-like refill with gravity physics | Very High | 1-2 days | `src/GameScene.ts`, refill system |

---

### Category E: Game Balance & Design

| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 2 | 1 rocket too easy for a level | Low | 30min | `src/LevelSystem.ts` |
| 16 | Color bomb goals should not be back-to-back | Low | 30min | `src/LevelSystem.ts` |

---

### Category F: Polish

| # | Item | Complexity | Est. Time | Files |
|---|------|------------|-----------|-------|
| 11 | Rename from bejeweled to wolf-match | Low | 1hr | Multiple files, assets |
| 12 | Rocket explosion (needs clarification) | Unknown | TBD | TBD |

---

## Recommended Implementation Order

### Phase 1: Quick Wins & Critical Bugs (Day 1)
1. **#9: Goal icon alignment** ⚡ Fast
2. **#14: Stars cut off at top** ⚡ Fast
3. **#13: Vertical rocket explosion fix** - Core gameplay
4. **#10: Horizontal rocket investigation** - Core gameplay

**Deliverable:** Core power-ups working correctly, UI polished

---

### Phase 2: Game Feel Improvements (Day 2)
5. **#6: Match before power-up trigger** - Major game feel improvement
6. **#15: Verify/fix double fly-away combo** - Complete combo system

**Deliverable:** Improved game mechanics, smoother gameplay

---

### Phase 3: New Combos (Day 3)
7. **#7: Horizontal + Vertical Rocket Combo**
   - Create cross explosion pattern
   - Add visual effects
   - Write tests
8. **#8: Fly Away + Bomb Combo**
   - Execute fly-away, then bomb at target
   - Add visual effects
   - Write tests

**Deliverable:** Enhanced combo system with 2 new interactions

---

### Phase 4: UI/UX Polish (Day 4)
9. **#5: Combo display positioning** - Better visibility during play
10. **#3: "New best" on main scene** - Better achievement feedback
11. **#4: Shop on main scene** - Streamlined navigation

**Deliverable:** Improved UI/UX flow

---

### Phase 5: Balance & Polish (Day 5)
12. **#2: Level difficulty tuning** - Adjust easy levels
13. **#16: Goal pattern design** - Prevent back-to-back color bombs
14. **#11: Rebranding to wolf-match** - Update names/references

**Deliverable:** Balanced gameplay, updated branding

---

### Phase 6: Advanced Features (Future)
15. **#1: Fluid refill system** - Major feature (optional)
16. **#12: Rocket explosion** - Needs clarification

---

## Detailed Item Breakdowns

### #9: Goal Icon Alignment
**Description:** The goal icon on the scoreboard isn't aligned with goal text
**Files:** `src/GameScene.ts` (scoreboard creation)
**Approach:**
- Locate goal icon and text positioning code
- Adjust Y-offset or alignment property
- Test on various goals

**Testing:** Visual inspection in-game

---

### #14: Stars Cut Off at Top
**Description:** Stars on end level screen are cut off at the top
**Files:** `src/LevelCompleteScene.ts`
**Approach:**
- Find star positioning/container bounds
- Adjust Y-position or increase container height
- Test with 1, 2, and 3 star displays

**Testing:** Visual inspection on level complete

---

### #13: Vertical Rocket Not Exploding Down
**Description:** Vertical rocket only explodes upward, should explode both directions
**Files:** `src/GameScene.ts` (vertical rocket logic)
**Approach:**
- Search for vertical rocket explosion code
- Verify loop iterates both directions (row - 1 and row + 1)
- Add test case

**Test Case:**
```typescript
// tests/vertical-rocket.spec.ts
// Place vertical rocket at row 4, col 4
// Verify cells destroyed in rows 0-7 at col 4
```

---

### #10: Horizontal Rocket Not Working
**Description:** Horizontal rocket isn't working properly (needs investigation)
**Files:** `src/GameScene.ts`, `tests/powerups.spec.ts`
**Approach:**
1. Check if test exists for horizontal rocket
2. Debug rocket creation conditions
3. Debug rocket explosion behavior
4. Compare to vertical rocket implementation

**Investigation Steps:**
- Test board: `?debug=true&board=match4h`
- Check console logs during rocket trigger
- Verify entire row is destroyed

---

### #6: Match Before Power-Up Trigger
**Description:** When swapping power-up with gem that makes a match, match should execute before power-up
**Files:** `src/GameScene.ts` (cascade/match detection order)
**Current Behavior:** Power-up triggers immediately
**Desired Behavior:**
1. Swap pieces
2. Check for matches
3. Destroy matches
4. Then trigger power-up

**Impact:** High - Changes fundamental game mechanic order
**Risk:** Medium - Could affect cascade logic

**Approach:**
- Locate swap handler in `onDragEnd()`
- Reorder: match detection → match destruction → power-up trigger
- Ensure power-up context preserved through cascade
- Extensive testing required

---

### #15: Double Fly-Away Combo
**Description:** Dropping two fly-aways should execute both + create a 3rd fly-away
**Current Status:** May already be implemented (needs verification)
**Files:** `src/GameScene.ts` (look for `triggerFlyAwayFlyAwayCombo()`)
**Approach:**
1. Check if combo handler exists
2. Verify behavior:
   - Execute first fly-away
   - Execute second fly-away
   - Create new fly-away at swap location
   - New fly-away targets 3rd best option
3. Create test board: `?debug=true&board=double-flyaway`

**Test Case:**
```typescript
// Should verify:
// - 2 fly-aways triggered
// - 1 new fly-away created
// - Total 3 targets hit (prioritized by goal)
```

---

### #7: Horizontal + Vertical Rocket Combo
**Description:** Swapping horizontal and vertical rockets should create cross explosion
**Files:** `src/GameScene.ts`
**New Method:** `triggerCrossRocketCombo(cell1, cell2)`
**Behavior:**
- Destroy entire row where rockets meet
- Destroy entire column where rockets meet
- Visual: Cross explosion effect

**Implementation:**
```typescript
async triggerCrossRocketCombo(cell1: Cell, cell2: Cell) {
  // Determine swap position
  // Destroy entire row at swapRow
  // Destroy entire column at swapCol
  // Enhanced visual effect
}
```

**Test Board:** Create `cross-rocket-combo` test board

---

### #8: Fly Away + Bomb Combo
**Description:** Fly away + bomb should execute fly-away first, then bomb at target location
**Files:** `src/GameScene.ts`
**New Method:** `triggerFlyAwayBombCombo(cell1, cell2)`
**Behavior:**
1. Execute fly-away (select best target)
2. Place bomb at target location
3. Explode bomb (3x3 area)

**Implementation Considerations:**
- Which type of bomb? (TNT?)
- Should bomb be placed before fly-away hits target?
- Visual sequence timing

---

### #5: Combo Display Over Scoreboard
**Description:** Combo display should be smaller and positioned over scoreboard, not game board
**Files:** `src/GameScene.ts` (combo display creation)
**Current:** Large, centered over board
**Desired:** Smaller, positioned over scoreboard area
**Approach:**
- Reduce font size (e.g., 48px → 32px)
- Reposition Y to scoreboard area (top-right)
- Shorten duration if too intrusive

---

### #3: "New Best" on Main Scene
**Description:** Display "new best" achievement on main menu, not during level
**Files:** `src/MenuScene.ts`, `src/LevelCompleteScene.ts`
**Approach:**
- Remove "new best" display from level complete scene
- Add persistent storage flag for "new high score achieved"
- Display notification on MenuScene when flag is set
- Clear flag after display

---

### #4: Shop on Main Scene
**Description:** Move shop access to main/home scene instead of separate screen
**Files:** `src/MenuScene.ts`, `src/ShopScene.ts`
**Approach:**
- Add shop button/section to MenuScene
- Option A: Inline shop UI in MenuScene
- Option B: Modal overlay from MenuScene
- Update navigation flow

---

### #1: Fluid Refill with Gravity
**Description:** Make gem refill work like fluid with gravity physics
**Files:** `src/GameScene.ts` (refill system)
**Complexity:** Very High
**Approach:**
- Research Phaser physics systems
- Implement fluid-like fall behavior
- May need particle system or custom physics
- Significant rewrite of `makeCellsFall()` and `refillBoard()`

**Recommendation:** Consider as separate major feature, not part of this sprint

---

### #2 & #16: Level Balance
**Files:** `src/LevelSystem.ts`
**#2:** Increase difficulty for levels with only 1 rocket requirement
**#16:** Ensure color bomb goals don't appear consecutively
**Approach:**
- Audit level definitions
- Adjust goal requirements
- Add logic to prevent consecutive similar goals

---

### #11: Rename to Wolf-Match
**Description:** Rebrand from "bejeweled" to "wolf-match"
**Files:** Multiple (search for "bejeweled" references)
**Approach:**
- Search codebase for "bejeweled" (case-insensitive)
- Update references in:
  - HTML title
  - Comments
  - Variable names
  - Documentation
  - Package.json

---

## Testing Strategy

### For Each Fix/Feature:
1. **Create test board** (if applicable) in `loadTestBoard()`
2. **Write automated test** in `tests/` directory
3. **Manual testing** with `?debug=true&board=test-name`
4. **Regression testing** - ensure existing features still work

### Test Coverage Priority:
- Power-up explosions (rockets, bombs)
- Combo interactions
- UI positioning (visual tests)
- Level progression

---

## Definition of Done

For each item to be considered complete:
- [ ] Code implemented and reviewed
- [ ] Automated test written (where applicable)
- [ ] Manual testing completed
- [ ] No regression in existing features
- [ ] Documentation updated (if needed)
- [ ] Committed with descriptive message

---

## Notes

- **#12 (Rocket explosion)** needs clarification - what specifically needs improvement?
- **#15 (Double fly-away)** may already be implemented - verify first
- Consider splitting Phase 6 (#1 fluid refill) into separate epic
- All combos should follow existing pattern in `GameScene.ts`
- Use existing test patterns from `tests/` directory

---

## Getting Started

1. Checkout branch: `git checkout feature/game-improvements`
2. Start with Phase 1 quick wins
3. Create test board for each feature
4. Write tests following `docs/TEST_APPROACH.md`
5. Commit after each completed item
6. Update this document with progress

---

**Last Updated:** 2025-11-13
**Current Phase:** Not started
**Next Action:** Begin Phase 1 - Quick wins (#9, #14)
