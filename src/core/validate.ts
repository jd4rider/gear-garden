import { applyAction, initialState, type LevelState } from './state'
import { TEETH, WORLD_COUNT, WORLD_SIZE, type Level } from './types'
import { evaluate } from '../mechanics/objectives'
import { replay } from '../solver/solver'

/**
 * Structural + mechanical validation for one garden. Returns one message per
 * problem, so the campaign report can point at the exact fault.
 */
export function validateLevel(level: Level): string[] {
  const errors: string[] = []
  const add = (message: string): void => {
    errors.push(`${level.id}: ${message}`)
  }

  if (!level.id.startsWith('gg-')) add('id must look like gg-0001')
  if (level.world < 1 || level.world > WORLD_COUNT) add(`world ${level.world} out of range`)
  if (level.index < 0 || level.index >= WORLD_SIZE) add(`index ${level.index} out of range`)
  if (!level.name.trim()) add('missing name')
  if (level.width < 2 || level.height < 2) add('board too small')
  if (level.width > 8 || level.height > 10) add('board too large for a portrait screen')

  const ids = new Set<string>()
  const positions = new Set<string>()
  for (const peg of level.pegs) {
    if (ids.has(peg.id)) add(`duplicate peg id ${peg.id}`)
    ids.add(peg.id)
    const position = `${peg.x},${peg.y}`
    if (positions.has(position)) add(`two axles share ${position}`)
    positions.add(position)
    if (peg.x < 0 || peg.y < 0 || peg.x >= level.width || peg.y >= level.height) {
      add(`peg ${peg.id} is outside the board`)
    }
  }

  const motors = level.pegs.filter((peg) => peg.kind === 'motor' && peg.motor)
  if (motors.length === 0) add('no motor')
  for (const motor of motors) {
    if (!motor.motor) continue
    if (motor.motor.speed.n <= 0) add(`motor ${motor.id} has a non-positive speed`)
    if (motor.motor.torque <= 0) add(`motor ${motor.id} has no torque`)
  }

  if (!level.pegs.some((peg) => peg.output)) add('no garden mechanism')
  if (level.objectives.length === 0) add('no objectives')
  if (level.slots.length === 0) add('no fitting slots')

  for (const gear of level.fixed) {
    if (!ids.has(gear.peg)) add(`fixed gear on unknown peg ${gear.peg}`)
    if (!TEETH.includes(gear.teeth)) add(`fixed gear has invalid teeth ${gear.teeth}`)
    if (level.slots.some((slot) => slot.peg === gear.peg && slot.layer === gear.layer)) {
      add(`fixed gear overlaps slot ${gear.peg}`)
    }
  }

  for (const gear of level.fixed) {
    for (const other of level.fixed) {
      if (gear === other || gear.peg === other.peg) continue
      const a = level.pegs.find((peg) => peg.id === gear.peg)
      const b = level.pegs.find((peg) => peg.id === other.peg)
      if (!a || !b) continue
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) continue
      if (gear.layer !== other.layer) continue
      if (gear.teeth + other.teeth > 24) add(`fixed gears collide between ${gear.peg} and ${other.peg}`)
    }
  }

  for (const slot of level.slots) {
    if (!ids.has(slot.peg)) add(`slot on unknown peg ${slot.peg}`)
    if (slot.layer !== 0 && slot.layer !== 1) add(`bad layer on slot ${slot.peg}`)
  }

  for (const item of level.stock) {
    if (!TEETH.includes(item.teeth)) add(`stock has invalid teeth ${item.teeth}`)
    if (item.count <= 0) add('stock entry with no gears')
    if (!level.slots.some((slot) => slot.layer === item.layer)) add(`stock layer ${item.layer} has no slot`)
  }

  for (const objective of level.objectives) {
    const referenced = objective.kind === 'sync' ? [objective.a, objective.b] : [objective.peg]
    for (const peg of referenced) {
      if (!ids.has(peg)) add(`objective references unknown peg ${peg}`)
    }
    if (objective.kind === 'torque' && objective.need <= 0) add('torque objective with no load')
  }

  for (const belt of level.belts) {
    if (!ids.has(belt.a) || !ids.has(belt.b)) add(`belt ${belt.id} references an unknown peg`)
    if (belt.gate && !level.switches.some((item) => item.id === belt.gate)) add(`belt gate ${belt.gate} missing`)
  }
  for (const peg of level.pegs) {
    if (peg.clutch && !level.switches.some((item) => item.id === peg.clutch!.id)) {
      add(`clutch ${peg.clutch.id} has no switch`)
    }
  }

  if (level.solution.length === 0) add('no stored solution')
  if (level.par !== level.solution.length) add(`par ${level.par} does not match solution length ${level.solution.length}`)
  if (level.difficulty < 1 || level.difficulty > 10) add(`difficulty ${level.difficulty} out of range`)

  const initial = initialState(level)
  let state: LevelState = initial
  for (const action of level.solution) {
    const applied = applyAction(level, state, action)
    if (!applied.ok) {
      add(`solution action rejected: ${applied.error}`)
      return errors
    }
    state = applied.state
  }
  const after = evaluate(level, state.gears, state.switches)
  if (!after.solved) {
    const why = after.failures[0] ?? after.objectives.find((item) => !item.met)?.actual
    add(`solution does not wake the garden${why ? ` (${why})` : ''}`)
  }

  const before = evaluate(level, initial.gears, initial.switches)
  if (before.solved) add('garden is already awake before the player does anything')

  const replayed = replay(level, level.solution)
  if (!replayed.ok) add(`solution replay failed: ${replayed.error}`)

  return errors
}

/** Plays the reference solution through the real rules. */
export function solutionPlays(level: Level): boolean {
  let state: LevelState = initialState(level)
  for (const action of level.solution) {
    const applied = applyAction(level, state, action)
    if (!applied.ok) return false
    state = applied.state
  }
  return evaluate(level, state.gears, state.switches).solved
}
