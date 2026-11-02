import { describe, expect, it } from 'vitest'
import { buildLevel, GENERATOR_VERSION, levelSignature, profileFor } from '../src/generator/generator'
import { validateLevel } from '../src/core/validate'
import { dailyLevel, endlessLevel } from '../src/app/daily'
import { WORLD_COUNT } from '../src/core/types'

describe('level generator', () => {
  it('is deterministic for a seed and version', () => {
    const a = buildLevel(6, 12)
    const b = buildLevel(6, 12)
    expect(a.id).toBe(b.id)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(GENERATOR_VERSION).toContain('gen-v1')
  })

  it('produces valid, solver-verified gardens for every world', () => {
    for (let world = 1; world <= WORLD_COUNT; world += 1) {
      const level = buildLevel(world, 0)
      const errors = validateLevel(level)
      expect(errors, `world ${world}: ${errors.join(' | ')}`).toHaveLength(0)
      expect(level.solution.length).toBeGreaterThan(0)
      expect(level.par).toBe(level.solution.length)
    }
  })

  it('grows difficulty with the world index instead of only the level number', () => {
    const early = profileFor(1, 10)
    const late = profileFor(19, 10)
    expect(late.size).toBeGreaterThanOrEqual(early.size)
    expect(late.empties).toBeGreaterThanOrEqual(early.empties)
  })

  it('gives each garden a distinct shape fingerprint in a world sample', () => {
    const signatures = new Set<string>()
    for (let index = 0; index < 12; index += 1) signatures.add(levelSignature(buildLevel(9, index)))
    expect(signatures.size).toBeGreaterThanOrEqual(10)
  })

  it('builds the same daily garden for the same UTC date', () => {
    const first = dailyLevel('2026-11-02')
    const second = dailyLevel('2026-11-02')
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.id).toBe('daily-2026-11-02')
  })

  it('builds reproducible endless gardens and raises the difficulty tier', () => {
    const a = endlessLevel('run-1', 5)
    const b = endlessLevel('run-1', 5)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const late = endlessLevel('run-1', 90)
    expect(late.world).toBeGreaterThan(a.world)
  })
})
