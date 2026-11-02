# Solver

`src/solver/solver.ts` is an exact, bounded search over the same transitions the
player uses. It never has a second, looser rule set.

## Inputs and outputs

- Input: a level, a starting state, and budgets (`maxStates`, `maxMillis`).
- Output: `solved | unsolvable | unknown`, the shortest action list found, and
  the number of explored nodes.

`solved` actions are immediately **replayed through `applyAction` and
`evaluate`**; if the replay fails the result is downgraded to `unknown` rather
than shipped.

## Search

1. Open fitting slots and remaining tray gears are collected.
2. Depth-first assignment over slots. Each slot is either left empty or given one
   of the distinct remaining gear types for its layer.
3. At a complete assignment, every switch combination is evaluated.
4. Branch-and-bound prunes any branch that cannot beat the best action count.
5. The best sequence wins; ties keep the first found.

Switch states are part of the leaf evaluation, so clutch puzzles are solved
without treating the clutch as a hint.

## Budgets and honesty

- Exhausting `maxStates` or `maxMillis` returns `unknown`, never `unsolvable`.
- The generator rejects `unknown` rather than shipping an unproven garden.
- The campaign re-solves a sample independently and fails the build if the par
  in the manifest disagrees.

## Hints

`nextHint(level, state)` runs the solver on the **current** state. If it solves,
the first action is described and applied. If the position is unsolvable, the
hint says so and suggests undo/reset. Only when the search budget is exhausted
does it fall back to the next untried step of the stored solution — and it says
that a verified step is being applied. Hints can never recommend an illegal
move.
