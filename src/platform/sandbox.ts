import { rat } from '../core/rational'
import { TEETH, type GearSpec, type Level, type Peg, type Teeth } from '../core/types'

export interface SandboxBoard {
  id: string
  name: string
  gears: GearSpec[]
  savedAt: number
}

const peg = (id: string, x: number, y: number, rest: Partial<Peg> = {}): Peg => ({ id, x, y, kind: 'plain', ...rest })

export const SANDBOX_PEGS: Peg[] = [
  peg('a0', 0, 1, { kind: 'motor', motor: { direction: 1, speed: rat(1), torque: 20 } }),
  peg('a1', 1, 1),
  peg('a2', 2, 1, { output: { kind: 'windmill', name: 'Windmill', need: 0 } }),
  peg('a3', 1, 0, { output: { kind: 'flower', name: 'Flower', need: 0 } }),
  peg('a4', 1, 2, { output: { kind: 'fountain', name: 'Fountain', need: 0 } }),
  peg('a5', 2, 0),
  peg('a6', 2, 2),
]

export function sandboxLevel(name = 'My machine'): Level {
  return {
    id: 'sandbox',
    world: 1,
    index: 0,
    seed: 'sandbox',
    name,
    mechanics: ['sandbox'],
    width: 3,
    height: 3,
    pegs: SANDBOX_PEGS.map((item) => ({ ...item })),
    belts: [],
    switches: [],
    fixed: [],
    slots: SANDBOX_PEGS.map((item) => ({ peg: item.id, layer: 0 as const })),
    stock: (TEETH as readonly Teeth[]).map((teeth) => ({ teeth, layer: 0 as const, count: 9 })),
    objectives: [],
    par: 0,
    difficulty: 0,
    solution: [],
    hint: 'Place gears so the motor can reach a mechanism. Save what you like.',
  }
}

export function emptySandbox(id: string, name: string): SandboxBoard {
  return { id, name, gears: [], savedAt: Date.now() }
}
