import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateLevel } from '../src/core/validate'
import { replay, solve } from '../src/solver/solver'
import { initialState } from '../src/core/state'
import { LEVEL_COUNT, WORLD_COUNT, WORLD_SIZE, type LevelManifest } from '../src/core/types'
import { GENERATOR_VERSION } from '../src/generator/generator'

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/data/levels.json'), 'utf8'),
) as LevelManifest

describe('campaign', () => {
  it('ships exactly 1,000 gardens in twenty worlds of fifty', () => {
    expect(manifest.format).toBe(1)
    expect(manifest.generator).toBe(GENERATOR_VERSION)
    expect(manifest.levels).toHaveLength(LEVEL_COUNT)
    expect(new Set(manifest.levels.map((level) => level.id)).size).toBe(LEVEL_COUNT)
    for (let world = 1; world <= WORLD_COUNT; world += 1) {
      const levels = manifest.levels.filter((level) => level.world === world)
      expect(levels).toHaveLength(WORLD_SIZE)
    }
  })

  it('has no duplicate shape fingerprints beyond a small allowance', () => {
    const signatures = manifest.levels.map(
      (level) =>
        `${level.width}x${level.height}|${level.pegs.map((peg) => `${peg.x},${peg.y}`).join(';')}|${level.fixed
          .map((gear) => `${gear.peg}:${gear.teeth}`)
          .sort()
          .join(',')}|${level.stock.map((item) => `${item.teeth}x${item.count}`).join(',')}`,
    )
    expect(new Set(signatures).size).toBeGreaterThan(LEVEL_COUNT - 8)
  })

  it('validates and replays every stored solution', () => {
    const problems: string[] = []
    for (const level of manifest.levels) {
      problems.push(...validateLevel(level))
      const replayed = replay(level, level.solution)
      if (!replayed.ok) problems.push(`${level.id}: ${replayed.error}`)
    }
    expect(problems).toEqual([])
  })

  it('re-solves a sample independently, including the last garden', () => {
    const sample = manifest.levels.filter((_, index) => index % 25 === 0 || index === LEVEL_COUNT - 1)
    const failures: string[] = []
    for (const level of sample) {
      const result = solve(level, initialState(level), { maxStates: 40_000, maxMillis: 3_000 })
      if (result.status !== 'solved') failures.push(`${level.id}: ${result.status}`)
      else if (result.actions.length !== level.par) failures.push(`${level.id}: par ${level.par} vs ${result.actions.length}`)
    }
    expect(failures).toEqual([])
  })

  it('starts every garden unpowered', () => {
    const awake = manifest.levels.filter((level) => {
      const result = solve(level, initialState(level), { maxStates: 1, maxMillis: 1 })
      return result.status === 'solved'
    })
    expect(awake.map((level) => level.id)).toEqual([])
  })
})
