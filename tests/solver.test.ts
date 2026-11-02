import { describe, expect, it } from 'vitest'
import { replay, solve } from '../src/solver/solver'
import { initialState } from '../src/core/state'
import { gear, directionObjective, makeLevel, motorPeg, outputPeg, plainPeg } from './helpers'

const puzzle = makeLevel({
  pegs: [motorPeg('p0', 0, 0), plainPeg('p1', 1, 0), outputPeg('p2', 2, 0)],
  fixed: [gear('p0', 12), gear('p2', 12)],
  slots: [{ peg: 'p1', layer: 0 }],
  stock: [{ teeth: 12, layer: 0, count: 1 }],
  objectives: [directionObjective('p2', 1)],
})

describe('solver', () => {
  it('finds the single legal gear and returns a replayable action', () => {
    const result = solve(puzzle, initialState(puzzle))
    expect(result.status).toBe('solved')
    expect(result.actions).toEqual([{ type: 'place', peg: 'p1', layer: 0, teeth: 12 }])
    expect(replay(puzzle, result.actions).ok).toBe(true)
  })

  it('proves a state unsolvable rather than guessing', () => {
    const blocked = makeLevel({
      ...puzzle,
      stock: [{ teeth: 8, layer: 0, count: 1 }],
    })
    const result = solve(blocked, initialState(blocked))
    expect(result.status).toBe('unsolvable')
    expect(result.actions).toHaveLength(0)
  })

  it('reports UNKNOWN when the state budget is exhausted', () => {
    const result = solve(puzzle, initialState(puzzle), { maxStates: 1, maxMillis: 50 })
    expect(result.status).toBe('unknown')
    expect(result.reason).toBeTruthy()
  })

  it('rejects a solution that does not wake the garden', () => {
    const replayResult = replay(puzzle, [])
    expect(replayResult.ok).toBe(false)
  })

  it('explores switch states when a clutch gate is in the way', () => {
    const clutchLevel = makeLevel({
      pegs: [
        motorPeg('p0', 0, 0),
        { id: 'p1', x: 1, y: 0, kind: 'plain', clutch: { id: 'c1', label: 'Clutch' } },
        outputPeg('p2', 2, 0),
      ],
      fixed: [gear('p0', 12), gear('p1', 12, 0), gear('p1', 12, 1), gear('p2', 12, 1)],
      switches: [{ id: 'c1', label: 'Clutch', initial: false }],
      objectives: [{ kind: 'direction', peg: 'p2', layer: 1, direction: 1, label: 'Bell' }],
    })
    const result = solve(clutchLevel, initialState(clutchLevel))
    expect(result.status).toBe('solved')
    expect(result.actions).toContainEqual({ type: 'switch', id: 'c1', value: true })
  })
})
