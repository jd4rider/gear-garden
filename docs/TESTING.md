# Testing

## Unit and simulation (`npm test`)

`tests/mechanics.test.ts`
- exact rational arithmetic;
- mesh direction and 24-tooth rule;
- collisions and diagonal non-connection;
- belts (open/crossed), compound shafts and clutches;
- brake contradictions and torque overload;
- objective direction, ratio, torque and synchronisation;
- placement, removal, stock accounting, undo/redo.

`tests/solver.test.ts`
- known solvable and unsolvable states;
- budget exhaustion returning `unknown`;
- solution replay;
- switch-state search.

`tests/generator.test.ts`
- deterministic seeds and generator version;
- every world produces a valid garden;
- distinct shape fingerprints;
- daily and endless reproducibility.

`tests/campaign.test.ts`
- 1,000 gardens, 20 × 50, unique ids;
- every level validates and replays;
- independent solves agree with par on a sample;
- no garden starts solved.

`npm run validate` is the standalone campaign check used by CI.

## Browser (`npm run e2e`)

Playwright runs desktop Chrome and an iPhone-sized Chromium project against the
Vite dev server:

- boot, menu, Journey entry;
- tray selection, axle placement, RUN, results, Next garden;
- undo, redo, hint, pause, keyboard focus;
- small portrait layout and rotation to landscape;
- world map → level select → settings → achievements → free build;
- progress surviving a reload.

Viewports covered by the suite: 360 × 800, 390 × 844 (iPhone 13 project),
desktop Chrome. Tablet and very tall phones are handled by the same responsive
layout code; they are not separately automated.

## What is not claimed

- No physical-device testing was performed in CI.
- Firefox and Safari are not in the browser matrix.
- Frame-rate is not asserted; performance is kept low-cost by small Pixi
  scenes, procedural art and no solver work during animation.
