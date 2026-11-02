export interface AchievementDefinition {
  id: string
  name: string
  description: string
  glyph: string
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first-bloom', name: 'First Bloom', description: 'Wake your first garden.', glyph: '✿' },
  { id: 'gear-apprentice', name: 'Gear Apprentice', description: 'Complete 10 gardens.', glyph: '⚙' },
  { id: 'perfect-transmission', name: 'Perfect Transmission', description: 'Finish a garden at its par.', glyph: '✦' },
  { id: 'clockwise-champion', name: 'Clockwise Champion', description: 'Solve 25 gardens.', glyph: '↻' },
  { id: 'ratio-master', name: 'Ratio Master', description: 'Solve a garden that asks for an exact speed ratio.', glyph: '½' },
  { id: 'master-mechanic', name: 'Master Mechanic', description: 'Complete 300 gardens.', glyph: '⚒' },
  { id: 'hundred-levels', name: 'Hundred Gardens', description: 'Complete 100 gardens.', glyph: '💯' },
  { id: 'five-hundred', name: 'Five Hundred Gardens', description: 'Complete 500 gardens.', glyph: '✧' },
  { id: 'thousand', name: 'Eternal Bloom', description: 'Complete all 1,000 gardens.', glyph: '❀' },
  { id: 'endless-100', name: 'Endless Gardener', description: 'Reach Endless garden 100.', glyph: '∞' },
  { id: 'daily-keeper', name: 'Daily Garden Keeper', description: 'Solve three daily puzzles in a row.', glyph: '☀' },
  { id: 'clockwork-architect', name: 'Clockwork Architect', description: 'Save a machine in Free Build.', glyph: '✎' },
]

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((item) => [item.id, item]))

/** Returns the ids newly earned for the given progress snapshot. */
export function evaluateAchievements(input: {
  solved: number
  totalStars: number
  perfectClears: number
  exactRatioSolved: boolean
  endlessBest: number
  dailyStreak: number
  savedSandbox: boolean
}): string[] {
  const earned: string[] = []
  if (input.solved >= 1) earned.push('first-bloom')
  if (input.solved >= 10) earned.push('gear-apprentice')
  if (input.perfectClears >= 1) earned.push('perfect-transmission')
  if (input.solved >= 25) earned.push('clockwise-champion')
  if (input.exactRatioSolved) earned.push('ratio-master')
  if (input.solved >= 100) earned.push('hundred-levels')
  if (input.solved >= 300) earned.push('master-mechanic')
  if (input.solved >= 500) earned.push('five-hundred')
  if (input.solved >= 1000) earned.push('thousand')
  if (input.endlessBest >= 100) earned.push('endless-100')
  if (input.dailyStreak >= 3) earned.push('daily-keeper')
  if (input.savedSandbox) earned.push('clockwork-architect')
  return earned
}
