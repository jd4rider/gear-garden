import type { Rational } from './rational'

// ---------------------------------------------------------------------------
// Board model. A garden board is a lattice of shafts ("pegs"). Two pegs one
// step apart (orthogonally) can mesh gears; a gear's pitch radius is its tooth
// count divided by MESH_SUM, so two gears mesh exactly when their tooth counts
// add up to MESH_SUM. That keeps the geometry honest without floating point.
// ---------------------------------------------------------------------------

export type Layer = 0 | 1
export type Direction = 1 | -1

export const LAYERS: readonly Layer[] = [0, 1]
export const TEETH: readonly Teeth[] = [8, 10, 12, 14, 16]
export const MESH_SUM = 24
export const PITCH_RADIUS = 1 / MESH_SUM

export type Teeth = 8 | 10 | 12 | 14 | 16

export type OutputKind =
  | 'windmill'
  | 'flower'
  | 'fountain'
  | 'butterfly'
  | 'bell'
  | 'ferris'
  | 'bird'
  | 'sprinkler'

export interface MotorSpec {
  /** +1 clockwise, -1 counter-clockwise (viewed from above). */
  direction: Direction
  /** Turns per second. */
  speed: Rational
  /** Abstract torque capacity used by the load model. */
  torque: number
}

export interface OutputSpec {
  kind: OutputKind
  name: string
  /** Torque the mechanism needs before it will run. */
  need: number
}

export type PegKind = 'plain' | 'motor' | 'brake'

export interface Peg {
  id: string
  x: number
  y: number
  kind: PegKind
  output?: OutputSpec
  motor?: MotorSpec
  /** Layer the motor drives. Defaults to 0. */
  motorLayer?: Layer
  /** Layer a brake locks. Defaults to 0. */
  brakeLayer?: Layer
  /** A clutch between the two layers of this shaft. */
  clutch?: { id: string; label: string }
}

export interface Belt {
  id: string
  a: string
  b: string
  layerA: Layer
  layerB: Layer
  /** A crossed belt reverses rotation. */
  crossed: boolean
  /** Transmits only when the driving side turns this way. */
  oneWay?: Direction
  /** Switch that must be engaged for the belt to work. */
  gate?: string
}

export interface LevelSwitch {
  id: string
  label: string
  initial: boolean
}

export interface GearSpec {
  peg: string
  layer: Layer
  teeth: Teeth
}

export interface GearStock {
  teeth: Teeth
  layer: Layer
  count: number
}

export type Objective =
  | { kind: 'direction'; peg: string; layer: Layer; direction: Direction; label: string }
  | { kind: 'speed'; peg: string; layer: Layer; speed: Rational; label: string }
  | { kind: 'ratio'; peg: string; layer: Layer; ratio: Rational; label: string }
  | { kind: 'sync'; a: string; b: string; layer: Layer; label: string }
  | { kind: 'torque'; peg: string; layer: Layer; need: number; label: string }

export type Action =
  | { type: 'place'; peg: string; layer: Layer; teeth: Teeth }
  | { type: 'remove'; peg: string; layer: Layer }
  | { type: 'switch'; id: string; value: boolean }

export interface Level {
  id: string
  world: number
  index: number
  seed: string
  name: string
  /** Mechanic tags, used for hints, badges and tests. */
  mechanics: string[]
  width: number
  height: number
  pegs: Peg[]
  belts: Belt[]
  switches: LevelSwitch[]
  /** Gears already fitted to the board. */
  fixed: GearSpec[]
  /** Slots the player may fill, in canonical order. */
  slots: { peg: string; layer: Layer }[]
  /** Gears the player starts with. */
  stock: GearStock[]
  objectives: Objective[]
  /** Fewest actions found by the solver. */
  par: number
  difficulty: number
  /** A solver-verified action sequence. */
  solution: Action[]
  hint: string
}

export interface LevelManifest {
  format: number
  generator: string
  levels: Level[]
}

export interface WorldTheme {
  id: number
  name: string
  tagline: string
  teaches: string
  palette: {
    background: string
    backgroundAccent: string
    board: string
    boardDark: string
    rim: string
    accent: string
    foliage: string
    flower: string
    sky: string
  }
}

export interface World extends WorldTheme {
  start: number
  end: number
}

export const WORLD_SIZE = 50
export const WORLD_COUNT = 20
export const LEVEL_COUNT = WORLD_SIZE * WORLD_COUNT

export function emptyStateSwitches(level: Level): Record<string, boolean> {
  const switches: Record<string, boolean> = {}
  for (const item of level.switches) switches[item.id] = item.initial
  return switches
}

export function pegAt(level: Level, id: string): Peg | undefined {
  return level.pegs.find((peg) => peg.id === id)
}

export function stockTotal(level: Level): number {
  return level.stock.reduce((sum, item) => sum + item.count, 0)
}

/** Every layer that appears anywhere in the level. */
export function activeLayers(level: Level): Layer[] {
  const layers = new Set<Layer>([0])
  for (const gear of level.fixed) layers.add(gear.layer)
  for (const gear of level.stock) layers.add(gear.layer)
  for (const slot of level.slots) layers.add(slot.layer)
  for (const belt of level.belts) {
    layers.add(belt.layerA)
    layers.add(belt.layerB)
  }
  for (const peg of level.pegs) {
    if (peg.motorLayer !== undefined) layers.add(peg.motorLayer)
    if (peg.brakeLayer !== undefined) layers.add(peg.brakeLayer)
  }
  return [...layers].sort() as Layer[]
}
