import { Application } from 'pixi.js'
import './style.css'
import { GameApp } from './app/app'
import { audio } from './audio/audioManager'
import './screens/menu'
import './screens/worlds'
import './screens/levels'
import './screens/gameplay'
import './screens/settings'
import './screens/achievements'
import './screens/sandbox'

declare global {
  interface Window {
    __GEAR_GARDEN__?: GameApp
  }
}

async function boot(): Promise<void> {
  const host = document.getElementById('game')
  if (!host) throw new Error('Missing #game host')

  const app = new Application()
  await app.init({
    background: '#16211a',
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    resizeTo: window,
    powerPreference: 'high-performance',
  })
  host.appendChild(app.canvas)

  const game = new GameApp(app)
  window.__GEAR_GARDEN__ = game
  await game.start()

  const unlock = (): void => audio.unlock()
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  window.addEventListener('keydown', unlock, { once: true, capture: true })

  // Keep iOS Safari from rubber-banding the page while the board is in use.
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) return
      const target = event.target as HTMLElement | null
      if (target && target.tagName === 'CANVAS') event.preventDefault()
    },
    { passive: false },
  )
}

void boot()
