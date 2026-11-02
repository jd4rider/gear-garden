import type { GearSpec, Level, Objective, Peg, Teeth } from '../src/core/types'

export function makeLevel(input: {
  pegs: Peg[]
  fixed?: GearSpec[]
  slots?: { peg: string; layer: 0 | 1 }[]
  stock?: Level['stock']
  objectives?: Objective[]
  belts?: Level['belts']
  switches?: Level['switches']
  width?: number
  height?: number
}): Level {
  return {
    id: 'gg-0001',
    world: 1,
    index: 0,
    seed: 'test',
    name: 'Test garden',
    mechanics: [],
    width: input.width ?? 5,
    height: input.height ?? 5,
    pegs: input.pegs,
    belts: input.belts ?? [],
    switches: input.switches ?? [],
    fixed: input.fixed ?? [],
    slots: input.slots ?? [],
    stock: input.stock ?? [],
    objectives: input.objectives ?? [],
    par: 1,
    difficulty: 1,
    solution: [],
    hint: '',
  }
}

export const motorPeg = (id: string, x: number, y: number, direction: 1 | -1 = 1): Peg => ({
  id,
  x,
  y,
  kind: 'motor',
  motor: { direction, speed: { n: 1, d: 1 }, torque: 10 },
})

export const plainPeg = (id: string, x: number, y: number): Peg => ({ id, x, y, kind: 'plain' })

export const outputPeg = (
  id: string,
  x: number,
  y: number,
  need = 0,
): Peg => ({ id, x, y, kind: 'plain', output: { kind: 'bell', name: 'Bell', need } })

export const gear = (peg: string, teeth: Teeth, layer: 0 | 1 = 0): GearSpec => ({ peg, teeth, layer })

export const directionObjective = (peg: string, direction: 1 | -1): Objective => ({
  kind: 'direction',
  peg,
  layer: 0,
  direction,
  label: 'Bell',
})
