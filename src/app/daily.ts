import { buildLevel } from '../generator/generator'
import type { Level } from '../core/types'
import { hashSeed } from '../generator/seededRandom'

/** UTC date key — the daily garden is the same for every player, everywhere. */
export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Daily puzzle: a stable function of the UTC date and the generator version.
 * `buildLevel` only returns solver-verified gardens, else a verified fallback,
 * so the daily can never be unsolvable.
 */
export function dailyLevel(key: string): Level {
  const h = hashSeed(`daily:${key}`)
  const world = 5 + (h % 12)
  const index = Math.floor(h / 12) % 50
  const level = buildLevel(world, index, Math.floor(h / 604) % 7)
  return { ...level, id: `daily-${key}`, name: `Daily · ${key}` }
}

/** Endless garden N for a run seed. Reproducible from (seed, N). */
export function endlessLevel(seed: string, n: number): Level {
  const h = hashSeed(`endless:${seed}:${n}`)
  const world = Math.min(20, 1 + Math.floor((n - 1) / 6))
  const index = Math.floor(h % 50)
  const level = buildLevel(world, index, Math.floor(h / 50) % 7)
  return {
    ...level,
    id: `endless-${seed}-${n}`,
    name: `Endless garden ${n}`,
    difficulty: Math.min(10, level.difficulty + Math.min(3, n / 40)),
  }
}
