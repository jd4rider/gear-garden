import { rat, sign, toNumber } from '../core/rational'
import { initialState } from '../core/state'
import {
  TEETH,
  type Action,
  type Belt,
  type GearSpec,
  type GearStock,
  type Layer,
  type Level,
  type LevelSwitch,
  type Objective,
  type OutputKind,
  type Peg,
  type Teeth,
} from '../core/types'
import { buildNetwork, nodeId, relativeOmega } from '../mechanics/network'
import { evaluate } from '../mechanics/objectives'
import { solve } from '../solver/solver'
import { hashSeed, mulberry32, pick, randInt, shuffled } from './seededRandom'
import { TUTORIALS } from './tutorials'
import { WORLDS } from '../content/worlds'

export const GENERATOR_VERSION = 'gear-garden/gen-v1'

type Shape = 'tree' | 'belt' | 'compound' | 'clutch' | 'dual'

interface Profile {
  shape: Shape
  size: number
  outputs: 1 | 2
  empties: number
  decoys: number
  ratio: boolean
  sync: boolean
  torque: boolean
  brake: boolean
  beltCrossed: boolean
  oneWay: boolean
}

interface Cell {
  x: number
  y: number
}

interface Layout {
  cells: Cell[]
  parent: number[]
  depth: number[]
  outputs: number[]
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

const complement = (teeth: Teeth): Teeth => (24 - teeth) as Teeth

const OUTPUT_KINDS: OutputKind[] = ['windmill', 'flower', 'fountain', 'butterfly', 'bell', 'ferris', 'bird', 'sprinkler']

const OUTPUT_NAMES: Record<OutputKind, string> = {
  windmill: 'Windmill',
  flower: 'Flower',
  fountain: 'Fountain',
  butterfly: 'Butterfly',
  bell: 'Bell',
  ferris: 'Ferris wheel',
  bird: 'Clockwork bird',
  sprinkler: 'Sprinkler',
}

export function profileFor(world: number, index: number): Profile {
  const t = index / 49
  const base: Profile = {
    shape: 'tree',
    size: 4,
    outputs: 1,
    empties: 1,
    decoys: 1,
    ratio: false,
    sync: false,
    torque: false,
    brake: false,
    beltCrossed: false,
    oneWay: false,
  }
  const grown = (size: number, empties: number, decoys: number): Pick<Profile, 'size' | 'empties' | 'decoys'> => ({
    size: Math.min(7, size + (t > 0.33 ? 1 : 0) + (t > 0.7 ? 1 : 0)),
    empties: Math.min(5, empties + (t > 0.5 ? 1 : 0)),
    decoys,
  })
  switch (world) {
    case 1:
      return { ...base, ...grown(3, 1, 0) }
    case 2:
      return { ...base, ...grown(4, 2, 1) }
    case 3:
      return { ...base, shape: 'tree', ...grown(5, 2, 1), ratio: true }
    case 4:
      return { ...base, ...grown(5, 2, 1), outputs: 2 }
    case 5:
      return { ...base, ...grown(6, 3, 0) }
    case 6:
      return { ...base, shape: 'belt', ...grown(5, 2, 1), beltCrossed: index % 3 === 1 }
    case 7:
      return { ...base, shape: 'compound', ...grown(5, 2, 1), ratio: true }
    case 8:
      return { ...base, shape: 'clutch', ...grown(5, 2, 1) }
    case 9:
      return { ...base, ...grown(6, 3, 2), outputs: 2, ratio: true }
    case 10:
      return { ...base, ...grown(6, 3, 1), outputs: 2 }
    case 11:
      return { ...base, ...grown(6, 3, 0), outputs: 2 }
    case 12:
      return { ...base, ...grown(6, 2, 1), torque: true }
    case 13:
      return { ...base, shape: 'belt', ...grown(5, 3, 1), torque: true, ratio: true }
    case 14:
      return { ...base, shape: 'dual', ...grown(4, 2, 1) }
    case 15:
      return { ...base, ...grown(6, 3, 1), outputs: 2, sync: true }
    case 16:
      return {
        ...base,
        shape: 'belt',
        ...grown(5, 3, 2),
        beltCrossed: index % 2 === 0,
        oneWay: index % 3 !== 0,
      }
    case 17:
      return { ...base, ...grown(7, 3, 2), outputs: 2, brake: true }
    case 18:
      return { ...base, shape: 'compound', ...grown(5, 3, 2), ratio: true }
    case 19:
      return { ...base, ...grown(7, 4, 2), outputs: 2, ratio: true, torque: true, brake: true }
    default:
      return {
        ...base,
        shape: index % 4 === 0 ? 'compound' : index % 4 === 1 ? 'belt' : 'clutch',
        ...grown(6, 4, 2),
        outputs: 2,
        ratio: true,
        beltCrossed: index % 2 === 0,
      }
  }
}

function growLayout(rng: () => number, count: number, width: number, height: number): Layout | null {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const cells: Cell[] = [{ x: randInt(rng, 1, width - 2), y: height - 1 }]
    const parent: number[] = [-1]
    while (cells.length < count) {
      const candidates: { cell: Cell; parent: number }[] = []
      for (const [index, cell] of cells.entries()) {
        for (const [dx, dy] of DIRS) {
          const x = cell.x + dx
          const y = cell.y + dy
          if (x < 0 || y < 0 || x >= width || y >= height) continue
          if (cells.some((other) => other.x === x && other.y === y)) continue
          const touches = DIRS.filter(([ex, ey]) => cells.some((other) => other.x === x + ex && other.y === y + ey)).length
          if (touches > 1) continue
          candidates.push({ cell: { x, y }, parent: index })
        }
      }
      if (candidates.length === 0) break
      const chosen = pick(rng, candidates)
      cells.push(chosen.cell)
      parent.push(chosen.parent)
    }
    if (cells.length !== count) continue
    const depth = cells.map(() => 0)
    for (let i = 1; i < cells.length; i += 1) depth[i] = depth[parent[i]!]! + 1
    const leaves = cells.map((_, i) => i).filter((i) => i > 0 && !parent.includes(i))
    if (leaves.length < 2) continue
    return { cells, parent, depth, outputs: [] }
  }
  return null
}

function buildTree(rng: () => number, profile: Profile): { layout: Layout; width: number; height: number } | null {
  const width = 4
  const height = Math.min(7, Math.max(4, profile.size))
  const layout = growLayout(rng, profile.size, width, height)
  if (!layout) return null
  const leaves = layout.cells
    .map((_, index) => index)
    .filter((index) => index > 0 && !layout.parent.includes(index))
    .sort((a, b) => layout.depth[b]! - layout.depth[a]!)
  if (profile.outputs === 2) {
    const first = leaves[0]
    if (first === undefined) return null
    const second = leaves.find((index) => index !== first && layout.parent[index] !== layout.parent[first]) ?? leaves[1]
    if (second === undefined) return null
    layout.outputs = [first, second]
  } else {
    layout.outputs = [leaves[0]!]
  }
  return { layout, width, height }
}

interface Draft {
  width: number
  height: number
  pegs: Peg[]
  belts: Belt[]
  switches: LevelSwitch[]
  reference: GearSpec[]
  candidates: { peg: string; layer: Layer }[]
  /** Axles that must carry a gear for power to reach a mechanism. */
  required: Set<string>
  /** Placeable axles that are never required (trap axles, spare pegs). */
  extraSlots: { peg: string; layer: Layer }[]
  profile: Profile
  mechanics: string[]
}

function outputPeg(id: string, x: number, y: number, kind: OutputKind): Peg {
  return {
    id,
    x,
    y,
    kind: 'plain',
    output: { kind, name: OUTPUT_NAMES[kind], need: 0 },
  }
}

function draftFromTree(rng: () => number, profile: Profile): Draft | null {
  const built = buildTree(rng, profile)
  if (!built) return null
  const { layout, width, height } = built
  const t0 = pick(rng, TEETH as readonly Teeth[])
  const pegs: Peg[] = []
  const reference: GearSpec[] = []
  const kinds = shuffled(rng, OUTPUT_KINDS)

  for (const [index, cell] of layout.cells.entries()) {
    const id = `p${index}`
    const teeth = layout.depth[index]! % 2 === 0 ? t0 : complement(t0)
    if (index === 0) {
      pegs.push({
        id,
        x: cell.x,
        y: cell.y,
        kind: 'motor',
        motor: { direction: rng() > 0.35 ? 1 : -1, speed: rat(1), torque: 8 },
      })
    } else if (layout.outputs.includes(index)) {
      pegs.push(outputPeg(id, cell.x, cell.y, kinds.pop() ?? 'windmill'))
    } else {
      pegs.push({ id, x: cell.x, y: cell.y, kind: 'plain' })
    }
    reference.push({ peg: id, layer: 0, teeth })
  }

  const extraSlots: { peg: string; layer: Layer }[] = []
  if (profile.brake) {
    const trap = pegs
      .map((peg, index) => ({ peg, index }))
      .find(
        ({ peg, index }) =>
          peg.kind === 'plain' && peg.output === undefined && index > 0 && !layout.parent.includes(index),
      )
    if (trap) {
      const kept = reference.filter((gear) => gear.peg !== trap.peg.id)
      reference.length = 0
      reference.push(...kept)
      trap.peg.kind = 'brake'
      extraSlots.push({ peg: trap.peg.id, layer: 0 })
    }
  }

  const required = new Set<string>()
  for (const out of layout.outputs) {
    let cursor = out
    while (cursor >= 0) {
      required.add(`p${cursor}`)
      cursor = layout.parent[cursor] ?? -1
    }
  }
  const candidates = reference.map((gear) => ({ peg: gear.peg, layer: gear.layer }))
  const mechanics = ['mesh', 'direction']
  if (profile.outputs === 2) mechanics.push('multi-output')
  if (profile.ratio) mechanics.push('ratio')
  if (profile.sync) mechanics.push('sync')
  if (profile.torque) mechanics.push('torque')
  if (profile.brake) mechanics.push('brake')
  if (profile.decoys === 0) mechanics.push('limited-stock')

  return {
    width,
    height,
    pegs,
    belts: [],
    switches: [],
    reference,
    candidates,
    required,
    extraSlots,
    profile,
    mechanics,
  }
}

function draftBelt(rng: () => number, profile: Profile): Draft {
  const crossed = profile.beltCrossed
  const t0 = pick(rng, TEETH as readonly Teeth[])
  const mid = complement(t0)
  const pulley = pick(rng, TEETH as readonly Teeth[])
  const out = complement(pulley)
  const cells: Cell[] = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ]
  const pegs: Peg[] = [
    { id: 'p0', x: cells[0]!.x, y: cells[0]!.y, kind: 'motor', motor: { direction: 1, speed: rat(1), torque: 10 } },
    { id: 'p1', x: cells[1]!.x, y: cells[1]!.y, kind: 'plain' },
    { id: 'p2', x: cells[2]!.x, y: cells[2]!.y, kind: 'plain' },
    { id: 'p3', x: cells[3]!.x, y: cells[3]!.y, kind: 'plain' },
    outputPeg('p4', cells[4]!.x, cells[4]!.y, pick(rng, OUTPUT_KINDS)),
  ]
  const reference: GearSpec[] = [
    { peg: 'p0', layer: 0, teeth: t0 },
    { peg: 'p1', layer: 0, teeth: mid },
    { peg: 'p2', layer: 0, teeth: t0 },
    { peg: 'p3', layer: 0, teeth: pulley },
    { peg: 'p4', layer: 0, teeth: out },
  ]
  const belt: Belt = {
    id: 'belt1',
    a: 'p2',
    b: 'p3',
    layerA: 0,
    layerB: 0,
    crossed,
    oneWay: profile.oneWay ? 1 : undefined,
  }
  return {
    width: 4,
    height: 4,
    pegs,
    belts: [belt],
    switches: [],
    reference,
    candidates: reference.map((gear) => ({ peg: gear.peg, layer: gear.layer })),
    required: new Set(reference.map((gear) => gear.peg)),
    extraSlots: [],
    profile,
    mechanics: ['mesh', 'belt', crossed ? 'crossed-belt' : 'open-belt', 'direction'].concat(
      profile.oneWay ? ['one-way'] : [],
      profile.ratio ? ['ratio'] : [],
      profile.torque ? ['torque'] : [],
    ),
  }
}

function draftCompound(rng: () => number, profile: Profile, clutch: boolean): Draft {
  const layer0 = pick(rng, TEETH as readonly Teeth[])
  const layer1 = pick(rng, TEETH as readonly Teeth[])
  const pegs: Peg[] = [
    { id: 'p0', x: 1, y: 3, kind: 'motor', motor: { direction: 1, speed: rat(1), torque: 10 }, motorLayer: 0 },
    { id: 'p1', x: 1, y: 2, kind: 'plain' },
    {
      id: 'p2',
      x: 1,
      y: 1,
      kind: 'plain',
      clutch: clutch ? { id: 'clutch1', label: 'Layer clutch' } : undefined,
    },
    { id: 'p3', x: 2, y: 1, kind: 'plain' },
    outputPeg('p4', 3, 1, pick(rng, OUTPUT_KINDS)),
  ]
  const reference: GearSpec[] = [
    { peg: 'p0', layer: 0, teeth: layer0 },
    { peg: 'p1', layer: 0, teeth: complement(layer0) },
    { peg: 'p2', layer: 0, teeth: layer0 },
    { peg: 'p2', layer: 1, teeth: layer1 },
    { peg: 'p3', layer: 1, teeth: complement(layer1) },
    { peg: 'p4', layer: 1, teeth: layer1 },
  ]
  const switches: LevelSwitch[] = clutch ? [{ id: 'clutch1', label: 'Layer clutch', initial: false }] : []
  return {
    width: 4,
    height: 4,
    pegs,
    belts: [],
    switches,
    reference,
    candidates: reference.map((gear) => ({ peg: gear.peg, layer: gear.layer })),
    required: new Set(reference.map((gear) => gear.peg)),
    extraSlots: [],
    profile,
    mechanics: ['mesh', 'compound', 'direction'].concat(clutch ? ['clutch'] : [], profile.ratio ? ['ratio'] : []),
  }
}

function draftDual(rng: () => number, profile: Profile): Draft {
  const t0 = pick(rng, TEETH as readonly Teeth[])
  const u0 = pick(rng, TEETH as readonly Teeth[])
  const pegs: Peg[] = [
    { id: 'p0', x: 0, y: 0, kind: 'motor', motor: { direction: 1, speed: rat(1), torque: 8 } },
    { id: 'p1', x: 1, y: 0, kind: 'plain' },
    outputPeg('p2', 2, 0, pick(rng, OUTPUT_KINDS)),
    { id: 'p3', x: 0, y: 2, kind: 'motor', motor: { direction: -1, speed: rat(1), torque: 8 } },
    { id: 'p4', x: 1, y: 2, kind: 'plain' },
    outputPeg('p5', 2, 2, pick(rng, OUTPUT_KINDS)),
  ]
  const reference: GearSpec[] = [
    { peg: 'p0', layer: 0, teeth: t0 },
    { peg: 'p1', layer: 0, teeth: complement(t0) },
    { peg: 'p2', layer: 0, teeth: t0 },
    { peg: 'p3', layer: 0, teeth: u0 },
    { peg: 'p4', layer: 0, teeth: complement(u0) },
    { peg: 'p5', layer: 0, teeth: u0 },
  ]
  return {
    width: 3,
    height: 3,
    pegs,
    belts: [],
    switches: [],
    reference,
    candidates: reference.map((gear) => ({ peg: gear.peg, layer: gear.layer })),
    required: new Set(reference.map((gear) => gear.peg)),
    extraSlots: [],
    profile,
    mechanics: ['mesh', 'direction', 'dual-motor'],
  }
}

function allSwitchValues(draft: Draft): Record<string, boolean> {
  const values: Record<string, boolean> = {}
  for (const item of draft.switches) values[item.id] = true
  return values
}

function baseLevel(draft: Draft, world: number, index: number, seed: string): Level {
  const width = draft.width
  const height = draft.height
  return {
    id: `gg-${String((world - 1) * 50 + index + 1).padStart(4, '0')}`,
    world,
    index,
    seed,
    name: '',
    mechanics: draft.mechanics,
    width,
    height,
    pegs: draft.pegs,
    belts: draft.belts,
    switches: draft.switches,
    fixed: [],
    slots: [],
    stock: [],
    objectives: [],
    par: 0,
    difficulty: 1,
    solution: [],
    hint: '',
  }
}

function makeObjectives(
  level: Level,
  reference: GearSpec[],
  switches: Record<string, boolean>,
  profile: Profile,
  outputPegs: Peg[],
): Objective[] {
  const network = buildNetwork(level, reference, switches)
  const objectives: Objective[] = []
  const motor = level.pegs.find((peg) => peg.kind === 'motor' && peg.motor)
  for (const peg of outputPegs) {
    const layer: Layer = reference.some((gear) => gear.peg === peg.id && gear.layer === 1) ? 1 : 0
    const omega = network.omega.get(nodeId(peg.id, layer))
    if (!omega || sign(omega) === 0) continue
    const name = peg.output?.name ?? 'Mechanism'
    objectives.push({
      kind: 'direction',
      peg: peg.id,
      layer,
      direction: sign(omega) as 1 | -1,
      label: name,
    })
    if (profile.ratio && motor && peg === outputPegs[0]) {
      const ratio = relativeOmega(level, network, nodeId(peg.id, layer))
      if (ratio && Math.abs(toNumber(ratio)) > 0.01) {
        objectives.push({
          kind: 'ratio',
          peg: peg.id,
          layer,
          ratio,
          label: `${name} speed`,
        })
      }
    }
    if (profile.torque) {
      const need = Math.round((network.torque.get(nodeId(peg.id, layer)) ?? 0) * 7) / 10
      if (need > 0) {
        objectives.push({ kind: 'torque', peg: peg.id, layer, need, label: `${name} load` })
      }
    }
  }
  if (profile.sync && outputPegs.length > 1) {
    const a = outputPegs[0]!
    const b = outputPegs[1]!
    const layerOf = objectives.find((objective) => objective.kind === 'direction' && objective.peg === a.id)
    const layer = layerOf && layerOf.kind === 'direction' ? layerOf.layer : 0
    const aOmega = network.omega.get(nodeId(a.id, layer))
    const bOmega = network.omega.get(nodeId(b.id, layer))
    if (aOmega && bOmega && aOmega.n === bOmega.n && aOmega.d === bOmega.d) {
      objectives.push({ kind: 'sync', a: a.id, b: b.id, layer, label: 'Both mechanisms in step' })
    }
  }
  return objectives
}

function chooseEmpties(
  rng: () => number,
  candidates: { peg: string; layer: Layer }[],
  reference: GearSpec[],
  required: Set<string>,
  count: number,
): { peg: string; layer: Layer }[] {
  if (candidates.length === 0) return []
  const real = candidates.filter((slot) =>
    reference.some((gear) => gear.peg === slot.peg && gear.layer === slot.layer),
  )
  const critical = shuffled(rng, real.filter((slot) => required.has(slot.peg)))
  const optional = shuffled(rng, real.filter((slot) => !required.has(slot.peg)))
  // Always make the player do real work: fill the line that carries power
  // first, and only spend a spare removal on a decorative branch afterwards.
  const chosen = [...critical, ...optional].slice(0, Math.min(count, real.length))
  return chosen
}

const NAME_PREFIX = [
  'Dewy',
  'Brass',
  'Copper',
  'Sunlit',
  'Mossy',
  'Tiny',
  'Whistling',
  'Polished',
  'Clover',
  'Amber',
  'Willow',
  'Gilded',
  'Quiet',
  'Bramble',
  'Honey',
  'Fern',
  'Marble',
  'Cobble',
  'Twilight',
  'Rose',
]

const NAME_NOUN = [
  'Pinion',
  'Axle',
  'Pulley',
  'Cog',
  'Spindle',
  'Crank',
  'Bellows',
  'Wheel',
  'Gear',
  'Clutch',
  'Spring',
  'Winder',
]

function levelName(world: number, index: number): string {
  return `${NAME_PREFIX[(index + world * 3) % NAME_PREFIX.length]} ${NAME_NOUN[(Math.floor(index / 20) + world) % NAME_NOUN.length]}`
}

const GENERIC_HINTS = [
  'Only the gears that touch can pass the turn along. Follow the chain from the motor.',
  'Check the objective: direction and speed both have to be right.',
  'A gear leaves the tray when you fit it, and comes back when you take it off.',
  'If the train will not turn, look for a tooth count that does not add up to 24.',
  'Press RUN to test the build. Nothing is spent by trying.',
  'Two gears on one axle always turn together.',
]

function hintFor(world: number, index: number, rng: () => number): string {
  if (world === 1 && index < TUTORIALS.length) return TUTORIALS[index]!.hint
  return pick(rng, GENERIC_HINTS)
}

function tutorialProfile(index: number): Profile {
  const tutorial = TUTORIALS[index]!
  const shape: Shape =
    tutorial.shape === 'belt'
      ? 'belt'
      : tutorial.shape === 'compound'
        ? 'compound'
        : tutorial.shape === 'clutch'
          ? 'clutch'
          : 'tree'
  return {
    shape,
    size: tutorial.length,
    outputs: tutorial.shape === 'branch' ? 2 : 1,
    empties: index < 5 ? 1 : 2,
    decoys: index < 8 ? 0 : 1,
    ratio: index >= 15,
    sync: false,
    torque: false,
    brake: false,
    beltCrossed: index === 21,
    oneWay: false,
  }
}

function assemble(
  draft: Draft,
  world: number,
  index: number,
  seed: string,
  rng: () => number,
  hint: string,
): Level | null {
  const { profile } = draft
  if (draft.reference.length === 0) return null

  const outputPegs = draft.pegs.filter((peg) => peg.output !== undefined)
  if (outputPegs.length === 0) return null

  const referenceLevel = baseLevel(draft, world, index, seed)
  const objectives = makeObjectives(referenceLevel, draft.reference, allSwitchValues(draft), profile, outputPegs)
  if (objectives.length === 0) return null
  referenceLevel.objectives = objectives

  const empties = chooseEmpties(rng, draft.candidates, draft.reference, draft.required, profile.empties)
  if (empties.length === 0) return null

  const fixed = draft.reference.filter(
    (gear) => !empties.some((slot) => slot.peg === gear.peg && slot.layer === gear.layer),
  )
  if (fixed.length === 0) return null

  const stock: GearStock[] = []
  for (const slot of empties) {
    const gear = draft.reference.find((item) => item.peg === slot.peg && item.layer === slot.layer)
    if (!gear) continue
    const existing = stock.find((item) => item.teeth === gear.teeth && item.layer === gear.layer)
    if (existing) existing.count += 1
    else stock.push({ teeth: gear.teeth, layer: gear.layer, count: 1 })
  }

  for (let i = 0; i < profile.decoys; i += 1) {
    const layers = [...new Set(empties.map((slot) => slot.layer))]
    const layer = pick(rng, layers)
    const used = new Set(stock.filter((item) => item.layer === layer).map((item) => item.teeth))
    const options = TEETH.filter((teeth) => !used.has(teeth))
    if (options.length === 0) break
    stock.push({ teeth: pick(rng, options), layer, count: 1 })
  }

  const level: Level = {
    ...referenceLevel,
    fixed,
    slots: [...empties, ...draft.extraSlots],
    stock,
    hint,
  }

  const initialSwitches: Record<string, boolean> = {}
  for (const item of level.switches) initialSwitches[item.id] = item.initial

  const before = evaluate(level, level.fixed, initialSwitches)
  if (before.solved) return null
  if (before.network.collisions.length > 0) return null
  if (before.network.conflicts.length > 0) return null

  const solved = solve(level, initialState(level), { maxStates: 24_000, maxMillis: 1_500 })
  if (solved.status !== 'solved') return null

  level.solution = solved.actions
  level.par = solved.actions.length
  level.difficulty = difficultyOf(level, solved.explored)
  return level
}

function difficultyOf(level: Level, explored: number): number {
  const concepts = level.mechanics.filter((tag) =>
    ['belt', 'crossed-belt', 'compound', 'clutch', 'torque', 'sync', 'dual-motor', 'brake', 'one-way'].includes(tag),
  ).length
  const stockTypes = new Set(level.stock.map((item) => `${item.teeth}:${item.layer}`)).size
  const raw =
    1 +
    level.slots.length * 1.05 +
    Math.max(0, stockTypes - level.slots.length) * 0.9 +
    concepts * 0.75 +
    Math.min(1.5, explored / 3000)
  return Math.round(Math.min(10, raw) * 10) / 10
}

function fallback(world: number, index: number, seed: string): Level {
  const pegs: Peg[] = [
    { id: 'p0', x: 0, y: 1, kind: 'motor', motor: { direction: 1, speed: rat(1), torque: 8 } },
    { id: 'p1', x: 1, y: 1, kind: 'plain' },
    outputPeg('p2', 2, 1, 'flower'),
  ]
  const objectives: Objective[] = [
    { kind: 'direction', peg: 'p2', layer: 0, direction: 1, label: 'Flower' },
  ]
  return {
    id: `gg-${String((world - 1) * 50 + index + 1).padStart(4, '0')}`,
    world,
    index,
    seed,
    name: levelName(world, index),
    mechanics: ['mesh', 'direction'],
    width: 3,
    height: 3,
    pegs,
    belts: [],
    switches: [],
    fixed: [
      { peg: 'p0', layer: 0, teeth: 12 },
      { peg: 'p2', layer: 0, teeth: 12 },
    ],
    slots: [{ peg: 'p1', layer: 0 }],
    stock: [{ teeth: 12, layer: 0, count: 1 }],
    objectives,
    par: 1,
    difficulty: 1,
    solution: [{ type: 'place', peg: 'p1', layer: 0, teeth: 12 }],
    hint: 'One gear is all this garden needs.',
  }
}

/**
 * Builds one campaign garden. The reference network is constructed first, then
 * gears are removed to create the puzzle; the result is only accepted when the
 * real solver finds and replays a winning sequence.
 */
export function buildLevel(world: number, index: number, salt = 0): Level {
  const seed = `${GENERATOR_VERSION}:w${world}:l${index}:s${salt}`
  const tutorial = world === 1 && index < TUTORIALS.length
  const hint = hintFor(world, index, mulberry32(hashSeed(seed)))

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const rng = mulberry32(hashSeed(`${seed}#${attempt}`))
    const profile = tutorial ? tutorialProfile(index) : profileFor(world, index)
    let draft: Draft | null = null
    if (profile.shape === 'belt') draft = draftBelt(rng, profile)
    else if (profile.shape === 'compound') draft = draftCompound(rng, profile, false)
    else if (profile.shape === 'clutch') draft = draftCompound(rng, profile, true)
    else if (profile.shape === 'dual') draft = draftDual(rng, profile)
    else draft = draftFromTree(rng, profile)
    if (!draft) continue

    const level = assemble(draft, world, index, seed, rng, hint)
    if (!level) continue
    const name = tutorial ? TUTORIALS[index]!.name : levelName(world, index)
    level.name = name
    return level
  }

  const level = fallback(world, index, seed)
  level.name = tutorial ? TUTORIALS[index]!.name : levelName(world, index)
  if (tutorial) level.hint = TUTORIALS[index]!.hint
  return level
}

/** Compact fingerprint used to reject near-duplicate gardens. */
export function levelSignature(level: Level): string {
  const pegs = [...level.pegs]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((peg) => `${peg.x},${peg.y}`)
    .join(';')
  const fixed = [...level.fixed].sort((a, b) => (a.peg < b.peg ? -1 : 1)).map((gear) => `${gear.peg}${gear.layer}:${gear.teeth}`).join(',')
  const stock = [...level.stock].sort((a, b) => a.teeth - b.teeth).map((item) => `${item.teeth}x${item.count}`).join(',')
  return `${level.width}x${level.height}|${pegs}|${fixed}|${stock}|${level.belts.length}|${level.switches.length}`
}

export const worldName = (world: number): string => (WORLDS[world - 1] ?? WORLDS[0]!).name
export type { Action }
