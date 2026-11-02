import { describe, expect, it } from 'vitest'
import { add, div, equals, mul, rat } from '../src/core/rational'
import { MESH_SUM } from '../src/core/types'
import { buildNetwork, nodeId } from '../src/mechanics/network'
import { evaluate } from '../src/mechanics/objectives'
import { applyAction, commit, createHistory, initialState, redo, remainingStock, undo } from '../src/core/state'
import { gear, directionObjective, makeLevel, motorPeg, outputPeg, plainPeg } from './helpers'

describe('rational arithmetic', () => {
  it('keeps ratios exact through multiplication and division', () => {
    const third = rat(1, 3)
    expect(equals(mul(third, rat(3)), rat(1))).toBe(true)
    expect(equals(add(rat(1, 3), rat(1, 6)), rat(1, 2))).toBe(true)
    expect(equals(div(rat(7, 5), rat(7, 5)), rat(1))).toBe(true)
  })

  it('normalises signs and reduces fractions', () => {
    expect(rat(4, -8)).toEqual({ n: -1, d: 2 })
    expect(rat(0, -9)).toEqual({ n: 0, d: 1 })
  })
})

describe('meshing geometry', () => {
  it('reverses direction at every mesh', () => {
    const level = makeLevel({
      pegs: [motorPeg('p0', 0, 0), plainPeg('p1', 1, 0), outputPeg('p2', 2, 0)],
      fixed: [gear('p0', 10), gear('p1', 14), gear('p2', 10)],
      objectives: [directionObjective('p2', 1)],
    })
    const evaluation = evaluate(level, level.fixed, {})
    expect(evaluation.network.omega.get(nodeId('p1', 0))).toEqual(rat(-5, 7))
    expect(evaluation.network.omega.get(nodeId('p2', 0))).toEqual(rat(1))
    expect(evaluation.solved).toBe(true)
  })

  it('only meshes when the tooth counts add up to the shared pitch', () => {
    const level = makeLevel({
      pegs: [motorPeg('p0', 0, 0), plainPeg('p1', 1, 0)],
      fixed: [gear('p0', 10), gear('p1', 10)],
    })
    const network = buildNetwork(level, level.fixed, {})
    expect(network.edges).toHaveLength(0)
    expect(network.omega.get(nodeId('p1', 0))).toBeUndefined()
  })

  it('reports colliding gears instead of meshing them', () => {
    const level = makeLevel({
      pegs: [motorPeg('p0', 0, 0), plainPeg('p1', 1, 0)],
      fixed: [gear('p0', 14), gear('p1', 12)],
    })
    expect(buildNetwork(level, level.fixed, {}).collisions).toHaveLength(1)
    expect(MESH_SUM).toBe(24)
  })

  it('does not connect diagonal axles', () => {
    const level = makeLevel({
      pegs: [motorPeg('p0', 0, 0), plainPeg('p1', 1, 1)],
      fixed: [gear('p0', 12), gear('p1', 12)],
    })
    expect(buildNetwork(level, level.fixed, {}).edges).toHaveLength(0)
  })
})

describe('belts, compound shafts and brakes', () => {
  it('an open belt preserves direction and a crossed belt reverses it', () => {
    const make = (crossed: boolean) =>
      makeLevel({
        pegs: [motorPeg('p0', 0, 0), outputPeg('p1', 2, 0)],
        fixed: [gear('p0', 8), gear('p1', 16)],
        belts: [{ id: 'belt', a: 'p0', b: 'p1', layerA: 0, layerB: 0, crossed }],
      })
    expect(buildNetwork(make(false), [gear('p0', 8), gear('p1', 16)], {}).omega.get(nodeId('p1', 0))).toEqual(rat(1, 2))
    expect(buildNetwork(make(true), [gear('p0', 8), gear('p1', 16)], {}).omega.get(nodeId('p1', 0))).toEqual(rat(-1, 2))
  })

  it('a clutch decouples the two layers until it is engaged', () => {
    const level = makeLevel({
      pegs: [
        motorPeg('p0', 0, 0),
        { id: 'p1', x: 1, y: 0, kind: 'plain', clutch: { id: 'c1', label: 'Clutch' } },
        outputPeg('p2', 2, 0),
      ],
      fixed: [gear('p0', 12), gear('p1', 12, 0), gear('p1', 12, 1), gear('p2', 12, 1)],
      switches: [{ id: 'c1', label: 'Clutch', initial: false }],
      objectives: [{ kind: 'direction', peg: 'p2', layer: 1, direction: 1, label: 'Bell' }],
    })
    expect(buildNetwork(level, level.fixed, { c1: false }).omega.get(nodeId('p2', 1))).toBeUndefined()
    expect(evaluate(level, level.fixed, { c1: true }).solved).toBe(true)
  })

  it('a brake stalls a driven shaft and reports it', () => {
    const level = makeLevel({
      pegs: [motorPeg('p0', 0, 0), { id: 'p1', x: 1, y: 0, kind: 'brake', brakeLayer: 0 }],
      fixed: [gear('p0', 12), gear('p1', 12)],
    })
    const evaluation = evaluate(level, level.fixed, {})
    expect(evaluation.network.conflicts.length).toBeGreaterThan(0)
    expect(evaluation.failures[0]).toMatch(/brake|stalls/i)
  })

  it('detects an overloaded motor using reflected torque', () => {
    const level = makeLevel({
      pegs: [motorPeg('p0', 0, 0), outputPeg('p1', 1, 0, 10)],
      fixed: [gear('p0', 12), gear('p1', 12)],
      objectives: [{ kind: 'torque', peg: 'p1', layer: 0, need: 10, label: 'Load' }],
    })
    level.pegs[0]!.motor!.torque = 4
    const evaluation = evaluate(level, level.fixed, {})
    expect(evaluation.network.overloads.length).toBe(1)
    expect(evaluation.solved).toBe(false)
  })
})

describe('objectives', () => {
  it('requires both branches to turn in step', () => {
    const level = makeLevel({
      pegs: [
        motorPeg('p0', 0, 0),
        plainPeg('p1', 1, 0),
        outputPeg('p2', 2, 0),
        plainPeg('p3', 0, 1),
        outputPeg('p4', 1, 1),
      ],
      fixed: [gear('p0', 12), gear('p1', 12), gear('p2', 12), gear('p3', 12), gear('p4', 12)],
      objectives: [{ kind: 'sync', a: 'p2', b: 'p4', layer: 0, label: 'In step' }],
    })
    expect(evaluate(level, level.fixed, {}).solved).toBe(true)
  })

  it('rejects the wrong direction even when the train is powered', () => {
    const level = makeLevel({
      pegs: [motorPeg('p0', 0, 0), plainPeg('p1', 1, 0), outputPeg('p2', 2, 0)],
      fixed: [gear('p0', 12), gear('p1', 12), gear('p2', 12)],
      objectives: [directionObjective('p2', -1)],
    })
    expect(evaluate(level, level.fixed, {}).solved).toBe(false)
  })
})

describe('edit state', () => {
  const level = makeLevel({
    pegs: [motorPeg('p0', 0, 0), plainPeg('p1', 1, 0), outputPeg('p2', 2, 0)],
    fixed: [gear('p0', 12), gear('p2', 12)],
    slots: [{ peg: 'p1', layer: 0 }],
    stock: [{ teeth: 12, layer: 0, count: 1 }],
    objectives: [directionObjective('p2', 1)],
  })

  it('places, removes, undoes and redoes without corrupting stock', () => {
    let history = createHistory(level)
    expect(remainingStock(level, history.present)[0]?.count).toBe(1)
    const placed = applyAction(level, history.present, { type: 'place', peg: 'p1', layer: 0, teeth: 12 })
    expect(placed.ok).toBe(true)
    if (!placed.ok) return
    history = commit(history, placed.state)
    expect(remainingStock(level, history.present)).toHaveLength(0)
    history = undo(history)
    expect(remainingStock(level, history.present)[0]?.count).toBe(1)
    history = redo(history)
    expect(history.present.gears.some((item) => item.peg === 'p1')).toBe(true)
  })

  it('refuses to remove a bolted gear and refuses gears not in stock', () => {
    const state = initialState(level)
    expect(applyAction(level, state, { type: 'remove', peg: 'p0', layer: 0 }).ok).toBe(false)
    expect(applyAction(level, state, { type: 'place', peg: 'p1', layer: 0, teeth: 8 }).ok).toBe(false)
  })
})
