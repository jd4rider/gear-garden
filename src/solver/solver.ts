import { evaluate, type Evaluation } from '../mechanics/objectives'
import { applyAction, gearAt, initialState, remainingStock, type LevelState } from '../core/state'
import type { Action, GearSpec, GearStock, Level, Teeth } from '../core/types'
import { label as ratioLabel } from '../core/rational'

export type SolveStatus = 'solved' | 'unsolvable' | 'unknown'

export interface SolveOptions {
  maxStates?: number
  maxMillis?: number
}

export interface SolveResult {
  status: SolveStatus
  /** Shortest verified action list (empty unless solved). */
  actions: Action[]
  explored: number
  reason?: string
}

export interface ReplayResult {
  ok: boolean
  state: LevelState
  error?: string
  evaluation?: Evaluation
}

/** Plays an action list through the real rules, exactly as a player would. */
export function replay(level: Level, actions: readonly Action[], start?: LevelState): ReplayResult {
  let state = start ?? initialState(level)
  for (const action of actions) {
    const result = applyAction(level, state, action)
    if (!result.ok) return { ok: false, state, error: result.error }
    state = result.state
  }
  const evaluation = evaluate(level, state.gears, state.switches)
  if (!evaluation.solved) {
    const why = evaluation.failures[0] ?? evaluation.objectives.find((item) => !item.met)?.actual
    return { ok: false, state, error: why ? `Objectives not met: ${why}` : 'Objectives not met.', evaluation }
  }
  return { ok: true, state, evaluation }
}

interface StockItem extends GearStock {
  id: number
}

/**
 * Exhaustive, deterministic search over gear placements and clutch states. It
 * shares `applyAction` / `evaluate` with gameplay, so it can never accept a
 * solution the game would reject. Bounded by state count and wall clock; when a
 * bound is hit the result is UNKNOWN, never UNSOLVABLE.
 */
export function solve(level: Level, start: LevelState, options: SolveOptions = {}): SolveResult {
  const maxStates = options.maxStates ?? 30_000
  const maxMillis = options.maxMillis ?? 4_000
  const startedAt = Date.now()

  const openSlots = level.slots.filter((slot) => !gearAt(start, slot.peg, slot.layer))
  const stockList: StockItem[] = []
  let nextId = 0
  for (const item of remainingStock(level, start)) {
    for (let i = 0; i < item.count; i += 1) stockList.push({ ...item, id: nextId++ })
  }

  const switchIds = level.switches.map((item) => item.id)
  const combos = 1 << switchIds.length
  const placed: GearSpec[] = []
  const used = new Set<number>()
  let explored = 0
  let aborted = false
  let best: Action[] | null = null

  const leaf = (): void => {
    for (let mask = 0; mask < combos; mask += 1) {
      const switches = { ...start.switches }
      const toggles: Action[] = []
      for (const [index, id] of switchIds.entries()) {
        const value = (mask & (1 << index)) !== 0
        switches[id] = value
        if (value !== (start.switches[id] ?? false)) toggles.push({ type: 'switch', id, value })
      }
      const evaluation = evaluate(level, [...start.gears, ...placed], switches)
      if (!evaluation.solved) continue
      const actions: Action[] = [
        ...placed.map((gear) => ({ type: 'place', peg: gear.peg, layer: gear.layer, teeth: gear.teeth }) as Action),
        ...toggles,
      ]
      if (!best || actions.length < best.length) best = actions
    }
  }

  const search = (index: number): void => {
    if (aborted) return
    explored += 1
    if (explored > maxStates || Date.now() - startedAt > maxMillis) {
      aborted = true
      return
    }
    if (best && placed.length >= best.length) return
    if (index >= openSlots.length) {
      leaf()
      return
    }
    const slot = openSlots[index]!
    const seenTypes = new Set<Teeth>()
    for (const item of stockList) {
      if (used.has(item.id) || item.layer !== slot.layer || seenTypes.has(item.teeth)) continue
      seenTypes.add(item.teeth)
      used.add(item.id)
      placed.push({ peg: slot.peg, layer: slot.layer, teeth: item.teeth })
      search(index + 1)
      placed.pop()
      used.delete(item.id)
      if (aborted) return
    }
    search(index + 1)
  }

  search(0)

  if (best) {
    const verified = replay(level, best, start)
    if (!verified.ok) {
      return { status: 'unknown', actions: [], explored, reason: `solver produced an unplayable solution: ${verified.error}` }
    }
    return { status: 'solved', actions: best, explored }
  }
  if (aborted) return { status: 'unknown', actions: [], explored, reason: 'search budget exhausted' }
  return { status: 'unsolvable', actions: [], explored }
}

/** A one-line explanation for an action, used by hints and the action feed. */
export function describeAction(level: Level, action: Action): string {
  if (action.type === 'place') {
    const peg = level.pegs.find((item) => item.id === action.peg)
    const where = peg ? `at (${peg.x}, ${peg.y})` : action.peg
    const layer = action.layer === 1 ? ' upper shaft' : ''
    return `Fit the ${action.teeth}-tooth gear on the${layer} axle ${where}.`
  }
  if (action.type === 'remove') return `Take the gear off axle ${action.peg}.`
  return `Set ${action.id} to ${action.value ? 'engaged' : 'released'}.`
}

export interface HintResult {
  text: string
  action: Action | null
  source: 'solver' | 'stored' | 'none'
}

/**
 * Solver-backed hint for the player's *current* state. If the position is not
 * solvable within budget, falls back to the next untried step of the stored
 * solution and says so instead of inventing a move.
 */
export function nextHint(level: Level, state: LevelState): HintResult {
  const solved = solve(level, state, { maxStates: 12_000, maxMillis: 1_500 })
  if (solved.status === 'solved' && solved.actions.length > 0) {
    return { text: describeAction(level, solved.actions[0]!), action: solved.actions[0]!, source: 'solver' }
  }
  if (solved.status === 'unsolvable') {
    return {
      text: 'This arrangement cannot reach every mechanism. Undo a gear or reset the garden.',
      action: null,
      source: 'none',
    }
  }
  for (const action of level.solution) {
    const applied = applyAction(level, state, action)
    if (applied.ok) return { text: describeAction(level, action), action, source: 'stored' }
  }
  return { text: 'The garden is waiting — try a gear from the tray.', action: null, source: 'none' }
}

/** Human description of an objective's target ratio, for the HUD. */
export const ratioText = ratioLabel
