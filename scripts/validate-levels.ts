// Re-validates the shipped 1,000-garden manifest without regenerating it.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateLevel } from '../src/core/validate'
import { replay, solve } from '../src/solver/solver'
import { initialState } from '../src/core/state'
import { LEVEL_COUNT, WORLD_COUNT, WORLD_SIZE, type LevelManifest } from '../src/core/types'
import { GENERATOR_VERSION } from '../src/generator/generator'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'src/data/levels.json'), 'utf8')) as LevelManifest

let problems = 0
const started = Date.now()

if (manifest.levels.length !== LEVEL_COUNT) {
  problems += 1
  console.error(`expected ${LEVEL_COUNT} levels, found ${manifest.levels.length}`)
}
if (manifest.generator !== GENERATOR_VERSION) {
  problems += 1
  console.error(`manifest generator ${manifest.generator} does not match ${GENERATOR_VERSION}`)
}

for (const [index, level] of manifest.levels.entries()) {
  const errors = validateLevel(level)
  if (errors.length > 0) {
    problems += errors.length
    for (const error of errors) console.error(error)
    continue
  }
  if (!replay(level, level.solution).ok) {
    problems += 1
    console.error(`${level.id}: stored solution does not replay`)
  }
  if ((index + 1) % 100 === 0) console.log(`checked ${index + 1}/${manifest.levels.length}`)
}

// Full independent solve of every fifth garden plus the last one.
const sample = manifest.levels.filter((_, index) => index % 5 === 0 || index === LEVEL_COUNT - 1)
for (const level of sample) {
  const result = solve(level, initialState(level), { maxStates: 40_000, maxMillis: 3_000 })
  if (result.status !== 'solved') {
    problems += 1
    console.error(`${level.id}: solver returned ${result.status}`)
  } else if (result.actions.length !== level.par) {
    problems += 1
    console.error(`${level.id}: par ${level.par} but solver optimum ${result.actions.length}`)
  }
}

for (let world = 1; world <= WORLD_COUNT; world += 1) {
  const count = manifest.levels.filter((level) => level.world === world).length
  if (count !== WORLD_SIZE) {
    problems += 1
    console.error(`world ${world} has ${count} gardens`)
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(2)
if (problems > 0) {
  console.error(`\n${problems} problem(s) in ${seconds}s`)
  process.exit(1)
}
console.log(
  `\nAll ${manifest.levels.length} gardens valid; ${sample.length} independent solves match par in ${seconds}s.`,
)
