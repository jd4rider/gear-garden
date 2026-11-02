import {
  abs,
  div,
  equals,
  mul,
  neg,
  rat,
  sign,
  toNumber,
  ZERO,
  type Rational,
} from '../core/rational'
import { MESH_SUM, type GearSpec, type Layer, type Level, type Peg } from '../core/types'

/** Nodes are shaft layers: a peg can carry independent gears on two layers. */
export const nodeId = (peg: string, layer: Layer): string => `${peg}@${layer}`

export function parseNode(id: string): { peg: string; layer: Layer } {
  const at = id.lastIndexOf('@')
  return { peg: id.slice(0, at), layer: Number(id.slice(at + 1)) as Layer }
}

export type EdgeKind = 'mesh' | 'belt' | 'shaft'

export interface NetworkEdge {
  id: string
  a: string
  b: string
  kind: EdgeKind
  /** omega(b) = omega(a) * ratio */
  ratio: Rational
  /** Switch that must be engaged for this connection to exist. */
  gate?: string
  /** Clutch that only transmits when the driving side turns this way. */
  oneWay?: 1 | -1
}

export interface Network {
  nodes: string[]
  edges: NetworkEdge[]
  /** Solved angular velocity per node, in turns per second. */
  omega: Map<string, Rational>
  conflicts: string[]
  collisions: string[]
  motorNodes: string[]
  overloads: string[]
  /** Torque delivered to a node by its motor. */
  torque: Map<string, number>
  powered: Set<string>
}

const edgeId = (a: string, b: string, kind: EdgeKind): string => `${kind}:${a}|${b}`

function pegLabel(peg: Peg | undefined, fallback: string): string {
  if (!peg) return fallback
  return `${peg.id} (${peg.x}, ${peg.y})`
}

/**
 * Builds and solves the transmission network for a set of gears. This is the
 * single source of truth for both the game and the solver.
 */
export function buildNetwork(
  level: Level,
  gears: readonly GearSpec[],
  switches: Record<string, boolean>,
): Network {
  const pegs = new Map(level.pegs.map((peg) => [peg.id, peg]))
  const byGrid = new Map(level.pegs.map((peg) => [`${peg.x},${peg.y}`, peg]))
  const gearAt = new Map<string, number>()
  for (const gear of gears) gearAt.set(nodeId(gear.peg, gear.layer), gear.teeth)

  const nodes = new Set<string>(gearAt.keys())
  const motorNodes: string[] = []
  const outputNodes = new Set<string>()

  for (const peg of level.pegs) {
    if (peg.kind === 'motor') {
      const node = nodeId(peg.id, peg.motorLayer ?? 0)
      nodes.add(node)
      motorNodes.push(node)
    }
    if (peg.kind === 'brake') nodes.add(nodeId(peg.id, peg.brakeLayer ?? 0))
    if (peg.output) outputNodes.add(nodeId(peg.id, 0))
  }
  for (const objective of level.objectives) {
    if (objective.kind === 'sync') {
      outputNodes.add(nodeId(objective.a, objective.layer))
      outputNodes.add(nodeId(objective.b, objective.layer))
    } else {
      outputNodes.add(nodeId(objective.peg, objective.layer))
    }
  }

  const edges: NetworkEdge[] = []
  const seen = new Set<string>()
  const collisions: string[] = []

  const addEdge = (edge: NetworkEdge): void => {
    const identity = edgeId(edge.a, edge.b, edge.kind)
    const reverse = edgeId(edge.b, edge.a, edge.kind)
    if (seen.has(identity) || seen.has(reverse)) return
    seen.add(identity)
    edges.push(edge)
  }

  // Meshing gears: neighbours on the same layer whose radii meet.
  for (const gear of gears) {
    const peg = pegs.get(gear.peg)
    if (!peg) continue
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const other = byGrid.get(`${peg.x + dx},${peg.y + dy}`)
      if (!other) continue
      const otherTeeth = gearAt.get(nodeId(other.id, gear.layer))
      if (otherTeeth === undefined) continue
      const sum = gear.teeth + otherTeeth
      if (sum > MESH_SUM) {
        collisions.push(
          `${gear.teeth}- and ${otherTeeth}-tooth gears collide at ${pegLabel(peg, gear.peg)}.`,
        )
        continue
      }
      if (sum !== MESH_SUM) continue
      addEdge({
        id: edgeId(nodeId(gear.peg, gear.layer), nodeId(other.id, gear.layer), 'mesh'),
        a: nodeId(gear.peg, gear.layer),
        b: nodeId(other.id, gear.layer),
        kind: 'mesh',
        ratio: rat(-gear.teeth, otherTeeth),
      })
    }
  }

  // Rigid shafts: two gears on one peg turn together unless a clutch is open.
  for (const peg of level.pegs) {
    const low = gearAt.get(nodeId(peg.id, 0))
    const high = gearAt.get(nodeId(peg.id, 1))
    if (low === undefined || high === undefined) continue
    addEdge({
      id: edgeId(nodeId(peg.id, 0), nodeId(peg.id, 1), 'shaft'),
      a: nodeId(peg.id, 0),
      b: nodeId(peg.id, 1),
      kind: 'shaft',
      ratio: rat(1),
      gate: peg.clutch?.id,
    })
  }

  // Belts and pulleys.
  for (const belt of level.belts) {
    const a = gearAt.get(nodeId(belt.a, belt.layerA))
    const b = gearAt.get(nodeId(belt.b, belt.layerB))
    if (a === undefined || b === undefined) continue
    addEdge({
      id: belt.id,
      a: nodeId(belt.a, belt.layerA),
      b: nodeId(belt.b, belt.layerB),
      kind: 'belt',
      ratio: rat((belt.crossed ? -1 : 1) * a, b),
      gate: belt.gate,
      oneWay: belt.oneWay,
    })
  }

  const powered = new Set<string>()
  const omega = new Map<string, Rational>()
  const conflicts = new Set<string>()

  for (const peg of level.pegs) {
    if (peg.kind === 'motor' && peg.motor) {
      omega.set(
        nodeId(peg.id, peg.motorLayer ?? 0),
        rat(peg.motor.direction * peg.motor.speed.n, peg.motor.speed.d),
      )
    }
    if (peg.kind === 'brake') omega.set(nodeId(peg.id, peg.brakeLayer ?? 0), ZERO)
  }

  const adjacency = new Map<string, NetworkEdge[]>()
  const connect = (node: string, edge: NetworkEdge): void => {
    const list = adjacency.get(node)
    if (list) list.push(edge)
    else adjacency.set(node, [edge])
  }
  for (const edge of edges) {
    connect(edge.a, edge)
    connect(edge.b, edge)
  }

  const queue: string[] = []
  for (const node of nodes) if (omega.has(node)) queue.push(node)

  const edgeActive = (edge: NetworkEdge, from: string): boolean => {
    if (edge.gate && switches[edge.gate] !== true) return false
    if (edge.oneWay) {
      const source = omega.get(from)
      if (!source) return false
      if (sign(source) !== edge.oneWay) return false
    }
    return true
  }

  const reached = new Set<string>(queue)
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentOmega = omega.get(current)
    if (!currentOmega) continue
    if (!equals(currentOmega, ZERO)) powered.add(current)
    for (const edge of adjacency.get(current) ?? []) {
      if (!edgeActive(edge, current)) continue
      const forward = edge.a === current
      const next = forward ? edge.b : edge.a
      const candidate = forward ? mul(currentOmega, edge.ratio) : div(currentOmega, edge.ratio)
      const existing = omega.get(next)
      if (existing) {
        if (!equals(existing, candidate)) {
          const from = parseNode(current)
          const to = parseNode(next)
          if (equals(candidate, ZERO) || equals(existing, ZERO)) {
            conflicts.add(`The brake on ${pegLabel(pegs.get(to.peg), to.peg)} stalls a shaft the motor is driving.`)
          } else {
            conflicts.add(
              `Two drives disagree on ${pegLabel(pegs.get(from.peg), from.peg)} → ${pegLabel(pegs.get(to.peg), to.peg)}. The gear train cannot turn as built.`,
            )
          }
        }
        continue
      }
      omega.set(next, candidate)
      if (!reached.has(next)) {
        reached.add(next)
        queue.push(next)
      }
    }
  }

  // Torque: reflect each mechanism's demand back to the motor through the ratio.
  const torque = new Map<string, number>()
  const overloads: string[] = []

  for (const peg of level.pegs) {
    if (peg.kind !== 'motor' || !peg.motor) continue
    const source = nodeId(peg.id, peg.motorLayer ?? 0)
    const sourceOmega = omega.get(source)
    if (!sourceOmega || equals(sourceOmega, ZERO)) continue
    const component = new Set<string>([source])
    const walk = [source]
    while (walk.length > 0) {
      const current = walk.pop()!
      for (const edge of adjacency.get(current) ?? []) {
        if (edge.gate && switches[edge.gate] !== true) continue
        const next = edge.a === current ? edge.b : edge.a
        if (!component.has(next)) {
          component.add(next)
          walk.push(next)
        }
      }
    }
    let reflected = 0
    for (const node of outputNodes) {
      if (!component.has(node)) continue
      const outOmega = omega.get(node)
      if (!outOmega || equals(outOmega, ZERO)) continue
      const ratio = div(outOmega, sourceOmega)
      const magnitude = Math.abs(toNumber(ratio))
      if (magnitude < 1e-9) continue
      const need = outputNeed(level, node)
      if (need > 0) reflected += need / magnitude
      torque.set(node, Math.max(torque.get(node) ?? 0, peg.motor.torque * magnitude))
    }
    if (reflected > peg.motor.torque + 1e-9) {
      overloads.push(
        `The motor at ${pegLabel(peg, peg.id)} is overloaded by the garden mechanisms (needs ${reflected.toFixed(2)} torque, has ${peg.motor.torque.toFixed(2)}).`,
      )
    }
  }

  return {
    nodes: [...nodes].sort(),
    edges,
    omega,
    conflicts: [...conflicts],
    collisions,
    motorNodes,
    overloads,
    torque,
    powered,
  }
}

/** Torque demand attached to a node, if it is a mechanism axle. */
export function outputNeed(level: Level, node: string): number {
  const { peg } = parseNode(node)
  const found = level.pegs.find((item) => item.id === peg)
  return found?.output?.need ?? 0
}

export function motorOmega(level: Level, network: Network): Rational | null {
  for (const peg of level.pegs) {
    if (peg.kind !== 'motor' || !peg.motor) continue
    const value = network.omega.get(nodeId(peg.id, peg.motorLayer ?? 0))
    if (value) return value
  }
  return null
}

/** Angular speed of a node relative to the first motor, used by `ratio` goals. */
export function relativeOmega(level: Level, network: Network, node: string): Rational | null {
  const base = motorOmega(level, network)
  const value = network.omega.get(node)
  if (!base || !value || equals(base, ZERO)) return null
  return div(value, base)
}

export const spin = (direction: 1 | -1, speed: Rational): Rational =>
  direction > 0 ? abs(speed) : neg(abs(speed))
