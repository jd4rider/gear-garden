import { equals, label as ratioLabel, speedLabel, sign, toNumber } from '../core/rational'
import type { Level, Objective } from '../core/types'
import { buildNetwork, nodeId, relativeOmega, type Network } from './network'

export interface ObjectiveResult {
  objective: Objective
  met: boolean
  /** Short “what is happening now” line for the HUD. */
  actual: string
}

export interface Evaluation {
  network: Network
  objectives: ObjectiveResult[]
  solved: boolean
  failures: string[]
}

function directionWord(value: number): string {
  if (value > 0) return 'clockwise'
  if (value < 0) return 'anti-clockwise'
  return 'still'
}

export function describeObjective(objective: Objective, level: Level): string {
  const name =
    objective.kind === 'sync'
      ? undefined
      : level.pegs.find((peg) => peg.id === objective.peg)?.output?.name
  switch (objective.kind) {
    case 'direction':
      return `${objective.label || name || 'Mechanism'}: turn ${directionWord(objective.direction)}`
    case 'speed':
      return `${objective.label || name || 'Mechanism'}: ${speedLabel(objective.speed)}, ${directionWord(objective.speed.n)}`
    case 'ratio': {
      const prefix = objective.ratio.n < 0 ? 'reversed at' : 'at'
      return `${objective.label || name || 'Mechanism'}: ${prefix} ${ratioLabel(objective.ratio)}× motor speed`
    }
    case 'sync':
      return `${objective.label || 'Both mechanisms'}: turn in step`
    case 'torque':
      return `${objective.label || name || 'Mechanism'}: at least ${objective.need} torque`
  }
}

export function evaluate(
  level: Level,
  gears: Parameters<typeof buildNetwork>[1],
  switches: Record<string, boolean>,
): Evaluation {
  const network = buildNetwork(level, gears, switches)
  const results: ObjectiveResult[] = level.objectives.map((objective) => {
    switch (objective.kind) {
      case 'direction': {
        const omega = network.omega.get(nodeId(objective.peg, objective.layer))
        const dir = omega ? sign(omega) : 0
        return {
          objective,
          met: dir === objective.direction,
          actual: `turning ${directionWord(dir)}`,
        }
      }
      case 'speed': {
        const omega = network.omega.get(nodeId(objective.peg, objective.layer))
        return {
          objective,
          met: Boolean(omega && equals(omega, objective.speed)),
          actual: omega
            ? `${directionWord(sign(omega))} at ${Math.abs(toNumber(omega)).toFixed(2)} turns/s`
            : 'not turning',
        }
      }
      case 'ratio': {
        const ratio = relativeOmega(level, network, nodeId(objective.peg, objective.layer))
        return {
          objective,
          met: Boolean(ratio && equals(ratio, objective.ratio)),
          actual: ratio ? `${toNumber(ratio).toFixed(2)}× motor speed` : 'not connected',
        }
      }
      case 'sync': {
        const a = network.omega.get(nodeId(objective.a, objective.layer))
        const b = network.omega.get(nodeId(objective.b, objective.layer))
        return {
          objective,
          met: Boolean(a && b && equals(a, b) && !equals(a, { n: 0, d: 1 })),
          actual: a && b ? (equals(a, b) ? 'in step' : 'out of step') : 'one side is still',
        }
      }
      case 'torque': {
        const delivered = network.torque.get(nodeId(objective.peg, objective.layer)) ?? 0
        return {
          objective,
          met: delivered + 1e-9 >= objective.need,
          actual: `${delivered.toFixed(1)} torque`,
        }
      }
    }
  })

  const failures = [...network.collisions, ...network.conflicts, ...network.overloads]
  const solved = failures.length === 0 && results.every((result) => result.met)
  return { network, objectives: results, solved, failures }
}
