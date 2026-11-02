# Architecture

## Layers

```
PixiJS screens ──► core/state ──► mechanics/network ──► objectives
                        ▲
        generator ──────┴────── solver (same transitions)
```

The rule engine never imports PixiJS. Rendering only reads a solved network; it
cannot change whether a garden is complete.

| Layer | Responsibility |
| --- | --- |
| `core/types.ts` | Board grammar: pegs, gears, belts, switches, objectives |
| `core/rational.ts` | Exact integer fractions for every ratio |
| `core/state.ts` | Immutable edit state, legal actions, undo/redo history |
| `mechanics/network.ts` | Transmission graph, propagation, conflicts, torque |
| `mechanics/objectives.ts` | Objective evaluation and player-facing descriptions |
| `solver/solver.ts` | Bounded exact search, replay, hints |
| `generator/*` | Seeded construct-then-scramble generation and validation |
| `render/*` | Procedural 2.5D gears, board, mechanisms, effects |
| `screens/*` | Menu, world map, level select, gameplay, settings, sandbox |
| `platform/*` | Versioned saves, achievements, arcade adapter, sandbox boards |

## State and actions

`LevelState` is `{ gears, switches }`. A player action is one of `place`,
`remove` or `switch`. `applyAction` validates against the level and returns a new
state or a readable error. `History` stores past/present/future snapshots, which
makes undo, redo and restart independent of animation.

## Rendering

`BoardView` derives all geometry from the level grid:

- one cell per lattice step, gears sized `teeth / 24` of a cell;
- the board crops to the axles actually used, so small gardens stay legible;
- gears are drawn as separate shadow, depth and rotor layers;
- the rotor spins from the solved angular velocity in radians per second;
- mechanisms animate only when their shaft is powered.

Nothing in the renderer is allowed to decide that a puzzle is solved.

## Save format

`SaveStore` owns `gear-garden-save-v1` in `localStorage`:

```ts
{
  version: 1,
  levels: { "gg-0001": { stars, bestMoves, hints } },
  unlocked, lastLevel,
  daily: { "2026-11-02": { moves, at } }, dailyStreak,
  endlessBest,
  achievements: string[],
  settings: { sound, music, reducedMotion, highContrast, speed, leftHanded },
  sandbox: SandboxBoard[],
  perfectClears, hintsUsed
}
```

Loads are coerced field by field. A save from a newer version is copied to
`gear-garden-save-v1:backup` before defaults are filled in, so progress is never
silently erased. The arcade client mirrors the key to the signed-in account.
