// The first 25 gardens are curated: each one has a hand-written name and hint,
// and a deliberately simple layout so the mechanic lands before the difficulty
// starts climbing.

export interface Tutorial {
  name: string
  hint: string
  /** Preferred archetype; the generator falls back if a shape cannot be built. */
  shape: 'line' | 'ell' | 'branch' | 'belt' | 'compound' | 'clutch'
  /** Number of shafts in the main run. */
  length: number
}

export const TUTORIALS: Tutorial[] = [
  { name: 'Dewdrop First Turn', hint: 'Tap the empty axle, then tap a gear in the tray. Gears must touch to pass the turn on.', shape: 'line', length: 3 },
  { name: 'Pebble Path', hint: 'Two gears pass motion along. The one next to the motor decides which way everything turns.', shape: 'line', length: 3 },
  { name: 'Little Lantern', hint: 'Teeth must meet: neighbouring gears need tooth counts that add up to 24.', shape: 'line', length: 4 },
  { name: 'Mossy Milestone', hint: 'Follow the chain from the motor to the windmill. Every shaft on the way needs a gear.', shape: 'line', length: 4 },
  { name: 'Fern Fitting', hint: 'A gear two axles away can only reach through the axle between them.', shape: 'ell', length: 4 },
  { name: 'Clover Crank', hint: 'Look at the axle beside the motor first — its size is forced by the gear already bolted there.', shape: 'ell', length: 4 },
  { name: 'Puddle Pinion', hint: 'The garden only wakes when every objective is met. Press RUN to test your build.', shape: 'ell', length: 5 },
  { name: 'Snail Street', hint: 'The tray shows what you have. You never need every piece.', shape: 'line', length: 5 },
  { name: 'Acorn Assembly', hint: 'Undo is free and always available. Experiment, then step back.', shape: 'line', length: 5 },
  { name: 'Buttercup Bench', hint: 'Direction changes at every mesh: clockwise becomes anti-clockwise.', shape: 'line', length: 5 },
  { name: 'Wheelbarrow Walk', hint: 'A longer train does not change the output speed by itself — the end gears decide.', shape: 'ell', length: 5 },
  { name: 'Rain Barrel', hint: 'If the motor turns one way, count the meshes to the mechanism.', shape: 'ell', length: 6 },
  { name: 'Trellis Turn', hint: 'Shafts can bend: follow the pegs around the corner.', shape: 'ell', length: 6 },
  { name: 'Herb Spiral', hint: 'The same gear can serve a different purpose in a different garden. Read the objective.', shape: 'ell', length: 6 },
  { name: 'Greenhouse Nook', hint: 'Try the largest gear first when you need a slower mechanism.', shape: 'line', length: 6 },
  { name: 'Twine and Timber', hint: 'A mechanism that needs half speed wants a driven gear twice the size of the driver.', shape: 'line', length: 6 },
  { name: 'Copper Kettle', hint: 'The ratio label on the objective tells you exactly what the motor must deliver.', shape: 'line', length: 6 },
  { name: 'Fernery Fork', hint: 'Two mechanisms can share one motor. Both need power.', shape: 'branch', length: 5 },
  { name: 'Twin Watering Cans', hint: 'Each branch has its own tooth pattern. Solve one side at a time.', shape: 'branch', length: 5 },
  { name: 'Petal Press', hint: 'Watch the axle count on each branch: direction depends on how many meshes the power crosses.', shape: 'branch', length: 6 },
  { name: 'Copper Cup', hint: 'A belt can reach a shaft that gears cannot. Open belts keep the direction.', shape: 'belt', length: 5 },
  { name: 'Winding Creek', hint: 'A crossed belt reverses the turn without adding a gear.', shape: 'belt', length: 5 },
  { name: 'Two Storeys', hint: 'Two gears on one axle turn together. That is how power climbs to the upper layer.', shape: 'compound', length: 4 },
  { name: 'Upper Orchard', hint: 'Upper-layer gears only mesh with other upper-layer gears.', shape: 'compound', length: 5 },
  { name: 'Clutch and Clover', hint: 'A clutch must be engaged before its shaft passes power. Tap the clutch lever, then RUN.', shape: 'clutch', length: 4 },
]
