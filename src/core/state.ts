import type { Action, GearSpec, GearStock, Layer, Level, Teeth } from './types'
import { nodeId } from '../mechanics/network'

export interface LevelState {
  gears: GearSpec[]
  switches: Record<string, boolean>
}

export interface History {
  past: LevelState[]
  present: LevelState
  future: LevelState[]
}

export const cloneState = (state: LevelState): LevelState => ({
  gears: state.gears.map((gear) => ({ ...gear })),
  switches: { ...state.switches },
})

export function initialState(level: Level): LevelState {
  const switches: Record<string, boolean> = {}
  for (const item of level.switches) switches[item.id] = item.initial
  return { gears: level.fixed.map((gear) => ({ ...gear })), switches }
}

export function gearAt(state: LevelState, peg: string, layer: Layer): GearSpec | undefined {
  return state.gears.find((gear) => gear.peg === peg && gear.layer === layer)
}

export function isFixedGear(level: Level, peg: string, layer: Layer): boolean {
  return level.fixed.some((gear) => gear.peg === peg && gear.layer === layer)
}

export function isSlot(level: Level, peg: string, layer: Layer): boolean {
  return level.slots.some((slot) => slot.peg === peg && slot.layer === layer)
}

/** Stock minus what the player has already fitted. */
export function remainingStock(level: Level, state: LevelState): GearStock[] {
  return level.stock
    .map((item) => {
      const used = state.gears.filter(
        (gear) =>
          gear.layer === item.layer &&
          gear.teeth === item.teeth &&
          !level.fixed.some((fixed) => fixed.peg === gear.peg && fixed.layer === gear.layer),
      ).length
      return { ...item, count: Math.max(0, item.count - used) }
    })
    .filter((item) => item.count > 0)
}

export function stockCount(level: Level, state: LevelState, teeth: Teeth, layer: Layer): number {
  return remainingStock(level, state).find((item) => item.teeth === teeth && item.layer === layer)?.count ?? 0
}

export type ActionResult = { ok: true; state: LevelState } | { ok: false; error: string }

export function applyAction(level: Level, state: LevelState, action: Action): ActionResult {
  if (action.type === 'place') {
    if (!isSlot(level, action.peg, action.layer)) return { ok: false, error: 'That peg is not a fitting slot.' }
    if (gearAt(state, action.peg, action.layer)) return { ok: false, error: 'That axle already holds a gear.' }
    if (stockCount(level, state, action.teeth, action.layer) <= 0) {
      return { ok: false, error: 'No gear of that size left in the tray.' }
    }
    return {
      ok: true,
      state: {
        switches: { ...state.switches },
        gears: [...state.gears, { peg: action.peg, layer: action.layer, teeth: action.teeth }],
      },
    }
  }

  if (action.type === 'remove') {
    if (isFixedGear(level, action.peg, action.layer)) {
      return { ok: false, error: 'That gear is bolted to the frame.' }
    }
    const gear = gearAt(state, action.peg, action.layer)
    if (!gear) return { ok: false, error: 'There is no gear there.' }
    return {
      ok: true,
      state: {
        switches: { ...state.switches },
        gears: state.gears.filter((item) => !(item.peg === action.peg && item.layer === action.layer)),
      },
    }
  }

  if (!level.switches.some((item) => item.id === action.id)) {
    return { ok: false, error: 'Unknown switch.' }
  }
  if (state.switches[action.id] === action.value) {
    return { ok: false, error: 'The clutch is already in that position.' }
  }
  return { ok: true, state: { gears: [...state.gears], switches: { ...state.switches, [action.id]: action.value } } }
}

export function legalActions(level: Level, state: LevelState): Action[] {
  const actions: Action[] = []
  for (const slot of level.slots) {
    const existing = gearAt(state, slot.peg, slot.layer)
    if (existing) {
      if (!isFixedGear(level, slot.peg, slot.layer)) actions.push({ type: 'remove', peg: slot.peg, layer: slot.layer })
      continue
    }
    for (const item of remainingStock(level, state)) {
      if (item.layer !== slot.layer) continue
      actions.push({ type: 'place', peg: slot.peg, layer: slot.layer, teeth: item.teeth })
    }
  }
  for (const item of level.switches) {
    const current = state.switches[item.id] ?? item.initial
    actions.push({ type: 'switch', id: item.id, value: !current })
  }
  return actions
}

export function createHistory(level: Level): History {
  return { past: [], present: initialState(level), future: [] }
}

export function commit(history: History, next: LevelState): History {
  return { past: [...history.past, cloneState(history.present)], present: cloneState(next), future: [] }
}

export function undo(history: History): History {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]!
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [cloneState(history.present), ...history.future],
  }
}

export function redo(history: History): History {
  if (history.future.length === 0) return history
  const next = history.future[0]!
  return {
    past: [...history.past, cloneState(history.present)],
    present: next,
    future: history.future.slice(1),
  }
}

export function stateKey(state: LevelState): string {
  const gears = [...state.gears]
    .sort((a, b) => (a.peg === b.peg ? a.layer - b.layer : a.peg < b.peg ? -1 : 1))
    .map((gear) => `${gear.peg}${gear.layer}:${gear.teeth}`)
    .join(',')
  const switches = Object.keys(state.switches)
    .sort()
    .map((id) => `${id}:${state.switches[id] ? 1 : 0}`)
    .join(',')
  return `${gears}|${switches}`
}

export const gearNode = (gear: GearSpec): string => nodeId(gear.peg, gear.layer)
