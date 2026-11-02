# Levels and generation

## Format

`src/data/levels.json` is a versioned manifest:

```ts
{
  format: 1,
  generator: "gear-garden/gen-v1",
  levels: [{
    id, world, index, seed, name, mechanics,
    width, height,
    pegs: [{ id, x, y, kind, motor?, output?, clutch? }],
    belts: [{ a, b, layerA, layerB, crossed, oneWay?, gate? }],
    switches: [{ id, label, initial }],
    fixed: [{ peg, layer, teeth }],
    slots: [{ peg, layer }],
    stock: [{ teeth, layer, count }],
    objectives: [...],
    par, difficulty, solution: [action...], hint
  }]
}
```

The manifest is compact JSON (one line per 1,000 gardens) and is loaded
asynchronously at boot.

## Pipeline

Each garden is built **from a solved reference network**, not by scattering
parts:

1. Pick the world profile: shape, size, outputs, tray size and decoys.
2. Grow an induced tree of axles (extra branches become dead ends and decoys).
3. Assign tooth counts by depth so every adjacent pair sums to 24.
4. Add motors, garden mechanisms, belts, compound shafts or clutches.
5. Compute the reference network and derive objectives from what it actually
   does (direction, exact ratio, load, synchronisation).
6. Remove gears into the tray, add decoy sizes, and place any optional trap axle.
7. Reject the candidate if the initial state already works, if it collides, or if
   the solver cannot recover it within budget.
8. Store the solver's shortest action sequence as `solution` and `par`.

The first 25 gardens are curated: individual names, hand-written hints and a
gentle mechanic order. Everything after is seeded generation; `npm run bake`
regenerates the whole manifest in about a second.

## Worlds

| # | World | Mechanic |
| --- | --- | --- |
| 1 | Seedling Springs | placement and connectivity |
| 2 | Turning Tulips | direction |
| 3 | Sunflower Workshop | sizes and ratios |
| 4 | Butterfly Meadow | multiple outputs |
| 5 | Wooden Windmills | limited inventory |
| 6 | Copper Creek | belts |
| 7 | Clockwork Orchard | compound gears |
| 8 | Rosewood Factory | clutches |
| 9 | Crystal Conservatory | branching networks |
| 10 | Moonflower Garden | direction constraints |
| 11 | Gearling Grove | multi-output optimisation |
| 12 | Golden Greenhouse | torque |
| 13 | Waterwheel Valley | speed + load |
| 14 | Mechanical Menagerie | two motors |
| 15 | Starlight Springs | synchronisation |
| 16 | Brass Blossom Palace | one-way drives |
| 17 | The Grand Arboretum | braked axles and routing |
| 18 | Infinity Clockworks | complex compound systems |
| 19 | Master Mechanic's Garden | expert combinations |
| 20 | Eternal Bloom | grand mastery |

## Validation

`scripts/validate-levels.ts` and `tests/campaign.test.ts` check:

- 1,000 unique ids, 20 worlds × 50;
- schema, bounds, axle overlap, stock/layer consistency;
- capacity of every slot to be filled from the tray;
- no colliding fixed gears;
- the stored solution replays and wakes every mechanism;
- the initial state does not;
- an independent solve of every fifth garden agrees with `par`;
- generation is deterministic for a seed.

Any failure fails CI before the build is published. `UNKNOWN` is never counted as
solvable.
