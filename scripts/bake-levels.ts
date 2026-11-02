// Bakes and verifies the whole 1,000-garden campaign.
//
// Usage:
//   npm run bake                 # full campaign, writes src/data/levels.json
//   npm run bake -- --from 1 --to 40 --no-write   # quick spot check
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLevel, levelSignature, GENERATOR_VERSION } from '../src/generator/generator'
import { validateLevel } from '../src/core/validate'
import { WORLD_COUNT, WORLD_SIZE, type Level, type LevelManifest } from '../src/core/types'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const args = process.argv.slice(2)
const readArg = (name: string): number | null => {
  const index = args.indexOf(`--${name}`)
  if (index < 0) return null
  const value = Number(args[index + 1])
  return Number.isFinite(value) ? value : null
}
const from = readArg('from') ?? 1
const to = readArg('to') ?? WORLD_COUNT * WORLD_SIZE
const partial = from !== 1 || to !== WORLD_COUNT * WORLD_SIZE

const levels: Level[] = []
const signatures = new Map<string, string>()
const started = Date.now()
let fixedFallbacks = 0

for (let world = 1; world <= WORLD_COUNT; world += 1) {
  for (let index = 0; index < WORLD_SIZE; index += 1) {
    const global = (world - 1) * WORLD_SIZE + index + 1
    if (global < from || global > to) continue
    let level: Level | null = null
    let problems: string[] = []
    for (let salt = 0; salt < 6; salt += 1) {
      const candidate = buildLevel(world, index, salt)
      const errors = validateLevel(candidate)
      const signature = levelSignature(candidate)
      const clash = signatures.get(signature)
      if (errors.length > 0) {
        problems = errors
        continue
      }
      if (clash && salt < 5) {
        problems = [`${candidate.id}: near-duplicate of ${clash}`]
        continue
      }
      level = candidate
      signatures.set(signature, candidate.id)
      break
    }
    if (!level) {
      console.error(`\nFAILED level ${global}:`)
      for (const problem of problems) console.error(`  ${problem}`)
      process.exitCode = 1
      continue
    }
    if (level.par === 1 && level.slots.length === 1) fixedFallbacks += 1
    levels.push(level)
    process.stdout.write(
      `✓ ${String(global).padStart(4, ' ')} w${String(level.world).padStart(2, ' ')} ${level.name.padEnd(22)} pegs ${String(level.pegs.length).padStart(2)} slots ${level.slots.length} par ${level.par} diff ${level.difficulty}\n`,
    )
  }
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1)

if (partial) {
  console.log(`\nBuilt ${levels.length} level(s) in ${elapsed}s (no manifest written).`)
  process.exit(process.exitCode ?? 0)
}

if (levels.length !== WORLD_COUNT * WORLD_SIZE) {
  throw new Error(`expected ${WORLD_COUNT * WORLD_SIZE} levels, built ${levels.length}`)
}

const manifest: LevelManifest = {
  format: 1,
  generator: GENERATOR_VERSION,
  levels,
}

mkdirSync(resolve(root, 'src/data'), { recursive: true })
writeFileSync(resolve(root, 'src/data/levels.json'), `${JSON.stringify(manifest)}\n`)

const averagePar = levels.reduce((sum, level) => sum + level.par, 0) / levels.length
const hardest = levels.reduce((max, level) => Math.max(max, level.difficulty), 0)
console.log(`\nBaked ${levels.length} verified gardens in ${elapsed}s`)
console.log(`Average par ${averagePar.toFixed(1)} · hardest ${hardest} · simple fallbacks ${fixedFallbacks}`)
