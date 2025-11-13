# Rocket and Fly Away Special Gem Interactions

## Overview

This document details the complete interaction system between rockets and fly aways in the gem-match-wolf game.

## 1. Special Gem Types

From src/types.ts (line 3):
- horizontal-rocket
- vertical-rocket  
- tnt
- light-ball
- fly-away

## 2. Power-up Priority System

From src/game/PowerUpSystem.ts (lines 5-12):

Priority 4: Color Bomb (light-ball) - 5+ linear match
Priority 3: TNT - T-shapes, L-shapes, rectangles (3x2, 2x3)
Priority 2: Fly-away - 2x2 squares
Priority 1: Rockets - 4-match linear (horizontal/vertical)

## 3. How Rockets Are Created

From src/game/PowerUpSystem.ts (lines 355-424):

4-match linear detection:
- Horizontal match creates horizontal-rocket
- Vertical match creates vertical-rocket
- Placement at 'to' position of swap if available

## 4. How Fly Aways Are Created

From src/game/PowerUpSystem.ts (lines 71-172):

2x2 square detection. Placement based on swap direction:
- RIGHT-to-LEFT swap: TOP-LEFT of 2x2
- LEFT-to-RIGHT swap: BOTTOM-LEFT of 2x2
- VERTICAL swap: 'to' position or 'from' position

## 5. Rocket Activation

From src/GameScene.ts (lines 1577-1876):

triggerPowerUp() method handles all power-up activation.

Horizontal Rocket (lines 1610-1679):
- Destroys entire row in waves radiating outward
- Chain-activates any power-ups in the row
- Tracks challenge progress

Vertical Rocket (lines 1681-1750):
- Destroys entire column in waves radiating outward
- Chain-activates any power-ups in the column
- Tracks challenge progress

## 6. Fly Away Activation

From src/GameScene.ts (lines 1836-1874):

Three-phase animation (lines 2328-2440):

Phase 1: Fly to target (1200ms)
- Sprite travels while spinning
- Uses Cubic.easeInOut easing

Phase 2: Orbit around target (800ms)
- Orbits in a circle once
- Uses Linear easing

Phase 3: Explosion
- Destroys target and 4 adjacent cells (cross pattern)
- Triggers cascade logic

Two explosions:
- START: At fly away position (cross pattern)
- END: At target (cross pattern)

## 7. Target Selection

From src/GameScene.ts (lines 2301-2326):

findBestFlyAwayTarget() algorithm:
- Counts same-color neighbors for each cell
- Prefers cells with most neighbors (strategic value)
- Excludes already-targeted cells
- Ignores empty cells, power-ups, source cell

## 8. Rocket + Fly Away Interaction

Current behavior (from src/GameScene.ts lines 1640-1662):

When rocket encounters fly away during destruction:
1. Rocket calls triggerPowerUp(flyAwayCell)
2. Fly away chain-activates and executes normally
3. First explosion at fly away position
4. Flight to target
5. Final explosion at target

## 9. Test Case

From src/GameScene.ts (lines 3502-3506):

Test board: rocket-match-order
- Vertical rocket at [2,2]
- Green gems form 2x2 at rows 2-3, cols 3-4
- Swap rocket with green at [2,3]

Expected:
1. Creates fly-away from 2x2 BEFORE rocket trigger
2. Fly-away at swap position
3. Rocket clears column

## 10. Rocket Combos

From src/GameScene.ts (lines 1878-1986):

Vertical Rocket + Vertical Rocket:
- First clears column
- Second clears row

Horizontal Rocket + Horizontal Rocket:
- First clears row
- Second clears column

Combo detection (lines 1070-1097):
- If both power-ups are same type, trigger combo
- Otherwise trigger individually

## 11. Chain Activation

From src/GameScene.ts (lines 1640-1662):

When power-up destroys another power-up:
- Automatically triggers it via triggerPowerUp()
- Passes targetedCells set to prevent duplicate targets
- Fly aways track targeted cells to prevent overlap

## 12. Conflict Resolution

From src/game/PowerUpSystem.ts (lines 322-349):

resolvePowerUpPriorities():
1. Sort patterns by priority (highest first)
2. Keep highest priority patterns
3. Skip patterns overlapping with used cells
4. Return final non-overlapping patterns

## 13. Key Code Locations

src/types.ts
- Line 3: PowerUpType definition

src/game/PowerUpSystem.ts
- Lines 25-308: detectSpecialPatterns()
- Lines 314-316: hasSpecialPatterns()
- Lines 322-349: resolvePowerUpPriorities()
- Lines 355-449: createPowerUpsFromChains()
- Lines 528-562: findFlyAwayTarget() (old version)
- Lines 568-603: expandSquarePattern()

src/GameScene.ts
- Lines 1577-1876: triggerPowerUp()
- Lines 1610-1679: Horizontal rocket destruction
- Lines 1681-1750: Vertical rocket destruction
- Lines 1836-1874: Fly away trigger
- Lines 1878-1986: Rocket combo methods
- Lines 2301-2326: findBestFlyAwayTarget()
- Lines 2328-2440: animateFlyAway()

tests/powerups.spec.ts
- E2E tests for rockets and combos

## 14. Summary

- Rockets: 4-gem linear matches, destroy row/column
- Fly Aways: 2x2 squares, fly to strategic target with dual explosions
- Rocket destroys fly away: chain-activates normal fly away behavior
- Priority system: higher priority wins in overlaps
- Multiple fly aways: each targets different cell via targetedCells set

