import type { Container } from 'pixi.js'
import type { LevelManifest } from '../core/types'
import type { AudioManager } from '../audio/audioManager'
import type { SaveStore } from '../platform/saves'
import type { GameApp } from './app'

export type ScreenName = 'menu' | 'worlds' | 'levels' | 'gameplay' | 'settings' | 'achievements' | 'sandbox'

export type GameMode = 'journey' | 'zen' | 'daily' | 'endless' | 'free'

export interface ScreenParams {
  level?: number
  world?: number
  mode?: GameMode
  seed?: string
  boardId?: string
}

export interface Screen {
  container: Container
  enter(): void
  exit(): void
  resize(width: number, height: number): void
  update?(deltaSeconds: number): void
}

export interface ScreenContext {
  app: GameApp
  save: SaveStore
  audio: AudioManager
  levels: LevelManifest
}

export type ScreenFactory = (context: ScreenContext, params: ScreenParams) => Screen

const registry = new Map<ScreenName, ScreenFactory>()

export function registerScreen(name: ScreenName, factory: ScreenFactory): void {
  registry.set(name, factory)
}

export function screenFactory(name: ScreenName): ScreenFactory | undefined {
  return registry.get(name)
}
