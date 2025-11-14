Your current implementation is already very solid — it's clean, well-organized, and already does everything a production-grade match-3 needs (cascades, power-up creation order, smart fly-away targeting, combos, levels, shaped boards, undo, hammer, analytics, debug tools, etc.).  
You have clearly thought through the hard parts (match-then-power-up-before-trigger order, 2×2 → fly-away, swap context for smart positioning, non-rectangular boards, etc.), so most “better way” suggestions are only incremental wins, not a complete rewrite.

Still, here are the realistic ways you could make the codebase smaller, faster to iterate on, and less error-prone — ranked from “biggest impact” to “nice-to-have polish”.

### 1. Switch the core grid logic to rexBoard + rexMatch (biggest single win)

rexrainbow’s plugins are the de-facto standard for grid / match-3 games in Phaser 3.

- rexBoard gives you a real chessboard-style grid with built-in:
  - hex/square/quad grid
  - shaped boards (you just set visible: false on the missing tiles)
  - easy move-to / swap-to with animation
  - built-in fall-down logic (moveTo with Reel or custom mover)
  - getNeighbor, get neighbors in direction, etc.
- rexMatch adds one-line match detection and removal (horizontal/vertical + L/T/+ shapes + 2×2 squares).

A minimal example that replaces ~800 lines of your current swap/fall/refill/match code:

```ts
import Board from 'phaser3-rex-plugins/plugins/board/board/Board'
import Match from 'phaser3-rex-plugins/plugins/board/match/Match'

this.board = new Board(this, {
  grid: { gridType: 'quadGrid', x: ..., y: ..., cellWidth: CELL_SIZE, cellHeight: CELL_SIZE },
  width: size, height: size
})

// create tiles (your Cell is now a Rex Board Tile)
this.board.forEachTileXY((tileXY, board) => {
  const gem = this.add.sprite(...).setInteractive()
  board.addChess(gem, tileXY.x, tileXY.y, 0)  // layer 0 = gems
})

// swapping becomes one line
this.board.swapChess(gemA, gemB, { duration: this.duration(swapDuration) })

// falling + refilling
this.board.reelMoveTo(topEmptyTile, { duration: ... })  // or custom fall tween

// matching
this.match = new Match(this.board, {
  dirMask: {  // 4 directions + 2×2 squares
    horizontal: true, vertical: true, square: true
  },
  // you can add your own wildcard/power-up checks here
})
const result = this.match.match(3)  // returns all chains
```

Benefits you get immediately:
- shaped boards (octagon/diamond) become trivial — just hide tiles instead of null-checking everywhere
- no more manual x/y math or sprite.destroy() ghosts
- built-in moveTo/swapTo animations with easing
- fall-down with Reel or custom mover (you keep your tween style)
- neighbor queries are 1-liner instead of your own getCellLeft/Right/Up/Down

You still keep your PowerUpSystem and all combo logic — you just query `tile.xyz` instead of your Cell object.

Most people who have a big custom match-3 rewrite end up moving to rexBoard after a year and regret not doing it sooner.

Link: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/board/

### 2. Object pooling for gem sprites (medium win)

You currently create/destroy sprites constantly. With 64 cells + cascades it’s fine, but pooling removes GC hitches and makes refilling instant.

```ts
this.gemPool = this.add.group({
  classType: Phaser.GameObjects.Sprite,
  maxSize: 100,
  key: [...all textures],
  active: false,
  visible: false
})

// acquire
const sprite = this.gemPool.get(x, y)
sprite.setTexture(key).setActive(true).setVisible(true)

// release
this.gemPool.killAndHide(sprite)
```

### 3. Use a proper state machine instead of moveInProgress flag

Your game has clear states: Idle → Selecting → Swapping → Cascading → GameOver.

Using something tiny like xstate or just a simple enum + switch makes the giant onPointerDown much easier to read and prevents subtle bugs (e.g. hammer while swapping).

### 4. Minor polish that costs almost nothing

- Put all gems in a single Container (this.add.container()) and move the container instead of every sprite individually — useful if you ever want screen shake or zoom.
- Use Phaser.Actions.GridAlign on a Group when you rebuild the board — one line instead of the double loop.
- Particle emitters: instead of manually creating a particle texture and then add.particles every combo, just make one emitter and reuse it.
- Tween chaining: you already await a lot — you can chain everything with .then() instead of multiple await lines, which makes the cascade loop cleaner.

### 5. If you really don’t want rex plugins

Your current code is already better than 95 % of custom match-3 implementations I see. The only things I would personally refactor:

- Extract the cascade loop into its own async method (handleCascade()) — the onPointerDown method is 600+ lines and scary.
- Make BoardState store only data; let the scene own all sprites (or vice-versa). Right now you have a mix.
- Add a Gem class that extends Sprite and holds its own row/col/powerup — reduces the Cell ↔ Sprite coupling.

### Bottom line

If you are happy maintaining the current codebase and it works perfectly → keep it. It’s good code.

If you want to cut the file size in half, make shaped boards trivial, and never worry about “ghost sprite” bugs again → switch the grid to rexBoard + rexMatch. You will throw away a lot of your current swap/fall/refill/match code, but you will gain a rock-solid foundation and finish the remaining features (power-up combos, hammer, levels) much faster.

Let me know which direction you want to go and I can give you a concrete migration, copy-paste migration plan or a cleaned-up version of your current approach.