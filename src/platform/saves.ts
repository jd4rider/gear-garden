import type { SandboxBoard } from './sandbox'

export interface Settings {
  sound: boolean
  music: boolean
  reducedMotion: boolean
  highContrast: boolean
  /** 1 = normal, 2 = fast, 0.5 = slow. */
  speed: number
  leftHanded: boolean
}

export interface LevelRecord {
  stars: number
  bestMoves: number
  hints: number
}

export interface DailyRecord {
  moves: number
  at: number
}

export interface SaveData {
  version: number
  levels: Record<string, LevelRecord>
  /** Highest unlocked campaign level (1-based). */
  unlocked: number
  lastLevel: number
  daily: Record<string, DailyRecord>
  dailyStreak: number
  endlessBest: number
  achievements: string[]
  settings: Settings
  sandbox: SandboxBoard[]
  perfectClears: number
  hintsUsed: number
}

export const SAVE_KEY = 'gear-garden-save-v1'
const SAVE_VERSION = 1

export const defaultSettings = (): Settings => ({
  sound: true,
  music: true,
  reducedMotion: false,
  highContrast: false,
  speed: 1,
  leftHanded: false,
})

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  levels: {},
  unlocked: 1,
  lastLevel: 1,
  daily: {},
  dailyStreak: 0,
  endlessBest: 0,
  achievements: [],
  settings: defaultSettings(),
  sandbox: [],
  perfectClears: 0,
  hintsUsed: 0,
})

function coerce(raw: unknown): SaveData {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<SaveData>
  const settings = { ...base.settings, ...(data.settings ?? {}) }
  return {
    ...base,
    levels: data.levels && typeof data.levels === 'object' ? data.levels : {},
    unlocked: Number.isFinite(data.unlocked) ? Math.max(1, data.unlocked as number) : 1,
    lastLevel: Number.isFinite(data.lastLevel) ? Math.max(1, data.lastLevel as number) : 1,
    daily: data.daily && typeof data.daily === 'object' ? data.daily : {},
    dailyStreak: Number.isFinite(data.dailyStreak) ? (data.dailyStreak as number) : 0,
    endlessBest: Number.isFinite(data.endlessBest) ? (data.endlessBest as number) : 0,
    achievements: Array.isArray(data.achievements) ? data.achievements.filter((id): id is string => typeof id === 'string') : [],
    settings,
    sandbox: Array.isArray(data.sandbox) ? data.sandbox : [],
    perfectClears: Number.isFinite(data.perfectClears) ? (data.perfectClears as number) : 0,
    hintsUsed: Number.isFinite(data.hintsUsed) ? (data.hintsUsed as number) : 0,
  }
}

export interface ArcadeBridge {
  gameId: string
  configured: boolean
  user(): { email?: string | null } | null
  syncNow(reason: string): Promise<void>
  status(): { text: string; signedIn: boolean }
  push(): Promise<boolean>
}

declare global {
  interface Window {
    LittleJoyArcade?: ArcadeBridge
    LJA_SNAPSHOT?: () => unknown
  }
}

/**
 * Versioned local save with the arcade's drop-in client mirroring it to the
 * player's account when one is signed in. The game never needs the network.
 */
export class SaveStore {
  data: SaveData
  private memoryOnly = false
  private listeners = new Set<() => void>()

  constructor() {
    this.data = this.read()
  }

  private read(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return defaultSave()
      const parsed: unknown = JSON.parse(raw)
      const record = parsed as { version?: number }
      if (typeof record.version !== 'number' || record.version > SAVE_VERSION) {
        // Never throw a save away silently: keep the raw copy for support.
        try {
          localStorage.setItem(`${SAVE_KEY}:backup`, raw)
        } catch {
          /* quota */
        }
      }
      return coerce(parsed)
    } catch {
      this.memoryOnly = true
      return defaultSave()
    }
  }

  write(): void {
    if (this.memoryOnly) return
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch {
      this.memoryOnly = true
    }
    for (const listener of this.listeners) listener()
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  arcade(): ArcadeBridge | undefined {
    return typeof window === 'undefined' ? undefined : window.LittleJoyArcade
  }

  status(): { signedIn: boolean; text: string } {
    const arcade = this.arcade()
    if (!arcade) return { signedIn: false, text: 'Saved on this device' }
    const state = arcade.status()
    return { signedIn: state.signedIn, text: state.text }
  }

  recordLevel(id: string, stars: number, moves: number, hints: number): LevelRecord {
    const previous = this.data.levels[id]
    const record: LevelRecord = {
      stars: Math.max(previous?.stars ?? 0, stars),
      bestMoves: previous?.bestMoves ? Math.min(previous.bestMoves, moves) : moves,
      hints: (previous?.hints ?? 0) + hints,
    }
    this.data.levels[id] = record
    this.data.hintsUsed += hints
    if (stars >= 3 && (!previous || previous.stars < 3)) this.data.perfectClears += 1
    this.write()
    return record
  }

  unlockThrough(levelNumber: number): void {
    if (levelNumber > this.data.unlocked) {
      this.data.unlocked = Math.min(1000, levelNumber)
      this.write()
    }
  }

  setLastLevel(levelNumber: number): void {
    if (this.data.lastLevel !== levelNumber) {
      this.data.lastLevel = levelNumber
      this.write()
    }
  }

  starsFor(id: string): number {
    return this.data.levels[id]?.stars ?? 0
  }

  totalStars(): number {
    return Object.values(this.data.levels).reduce((sum, record) => sum + record.stars, 0)
  }

  worldStars(world: number): number {
    let total = 0
    for (let index = 0; index < 50; index += 1) {
      const level = (world - 1) * 50 + index + 1
      total += this.starsFor(`gg-${String(level).padStart(4, '0')}`)
    }
    return total
  }

  solvedCount(): number {
    return Object.values(this.data.levels).filter((record) => record.stars > 0).length
  }

  hasAchievement(id: string): boolean {
    return this.data.achievements.includes(id)
  }

  addAchievement(id: string): boolean {
    if (this.hasAchievement(id)) return false
    this.data.achievements.push(id)
    this.write()
    return true
  }

  recordDaily(key: string, moves: number): void {
    const previous = this.data.daily[key]
    this.data.daily[key] = { moves: previous ? Math.min(previous.moves, moves) : moves, at: Date.now() }
    const keys = Object.keys(this.data.daily).sort()
    let streak = 0
    const cursor = new Date(`${key}T00:00:00Z`)
    for (let i = 0; i < 400; i += 1) {
      const stamp = cursor.toISOString().slice(0, 10)
      if (this.data.daily[stamp]) {
        streak += 1
        cursor.setUTCDate(cursor.getUTCDate() - 1)
      } else break
    }
    this.data.dailyStreak = streak
    this.write()
    void keys
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch }
    this.write()
  }

  saveSandbox(board: SandboxBoard): boolean {
    const existing = this.data.sandbox.findIndex((item) => item.id === board.id)
    if (existing >= 0) this.data.sandbox[existing] = board
    else this.data.sandbox = [...this.data.sandbox.slice(-5), board]
    this.write()
    return true
  }
}
