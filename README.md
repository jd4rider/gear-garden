# Gear Garden

A 2.5D clockwork logic puzzle for [Little Joy Arcade](https://littlejoyarcade.site).
Place brass gears on wooden axles, engage clutches, and route a motor's power to
the garden mechanisms — a thousand miniature machines waiting to wake up.

**Play:** <https://jd4rider.github.io/gear-garden/play/>

## The game

- 1,000 garden puzzles across 20 themed worlds, each solver-verified.
- 20 mechanics, introduced gradually: meshing gears, direction, exact ratios,
  multiple outputs, limited trays, belts, crossed belts, compound shafts,
  clutches, torque loads, multiple motors, synchronisation and one-way drives.
- Portrait-first touch controls with tap-to-place, tap-to-remove, solver-backed
  hints, unlimited undo/redo, restart and a full keyboard path.
- Journey, Zen, Daily, Endless and Free Build modes.
- Local progress, stars and achievements; the Little Joy Arcade drop-in client
  mirrors saves to a player's account when one is signed in.

## Stack

PixiJS 8 · TypeScript (strict) · Vite · Vitest · Playwright · WebAudio.

The rule engine is pure TypeScript with no PixiJS imports, so the same code
runs the game, the solver, the generator and the tests.

## Commands

```bash
npm install
npm run dev          # http://localhost:5175
npm run build        # typecheck + production bundle
npm run preview
npm test             # mechanics, solver, generator and full-campaign tests
npm run validate     # re-validates and re-solves a sample of the shipped 1,000
npm run bake         # regenerates src/data/levels.json (solver-verified)
npm run e2e          # Playwright, desktop Chrome + iPhone-sized Chromium
```

## Layout

```
src/core        types, exact rationals, edit state, level validation
src/mechanics   gear geometry, transmission graph, objectives
src/solver      bounded exact search and solver-backed hints
src/generator   seeded construction, tribes/tutorials, difficulty
src/data        the baked, validated campaign manifest
src/render      procedural gears, garden mechanisms, 2.5D board
src/screens     menu, world map, level select, gameplay, settings, sandbox
src/platform    versioned saves, achievements, sandbox format
src/audio       synthesised clockwork soundscape
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Mechanics](docs/MECHANICS.md)
- [Solver](docs/SOLVER.md)
- [Levels and generation](docs/LEVELS.md)
- [Arcade integration](docs/ARCADE_INTEGRATION.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)
