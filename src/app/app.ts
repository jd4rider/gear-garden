import { Application, Container, Graphics } from 'pixi.js'
import { audio, type AudioManager } from '../audio/audioManager'
import type { LevelManifest } from '../core/types'
import { SaveStore } from '../platform/saves'
import { UI, label, wrapLabel } from '../render/theme'
import { Button, IconButton } from '../ui/widgets'
import { screenFactory, type Screen, type ScreenName, type ScreenParams } from './types'

const LOGICAL_WIDTH = 720

interface ToastEntry {
  container: Container
  until: number
}

interface ModalButton {
  text: string
  variant?: 'primary' | 'soft' | 'ghost' | 'danger'
  onTap: () => void
}

interface ModalOptions {
  title: string
  body?: string
  buttons: ModalButton[]
  /** Called when the dimmer is tapped. Omit to make the dialog modal. */
  onDismiss?: () => void
}

export class GameApp {
  readonly app: Application
  readonly save = new SaveStore()
  readonly audio: AudioManager = audio
  levels: LevelManifest = { format: 1, generator: '', levels: [] }

  readonly root = new Container()
  private readonly backdrop = new Graphics()
  private readonly screenLayer = new Container()
  private readonly overlayLayer = new Container()
  private readonly toastLayer = new Container()
  private screen: Screen | null = null
  private screenNameValue: ScreenName | null = null
  private toasts: ToastEntry[] = []
  private modalNode: Container | null = null
  private time = 0
  width = LOGICAL_WIDTH
  height = 1280
  scaleFactor = 1

  constructor(app: Application) {
    this.app = app
    app.stage.addChild(this.backdrop, this.root)
    this.root.addChild(this.screenLayer, this.toastLayer, this.overlayLayer)
    this.audio.configure(this.save.data.settings)
    window.addEventListener('resize', this.resize)
    window.addEventListener('orientationchange', this.resize)
    app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000))
  }

  async start(): Promise<void> {
    const module = await import('../data/levels.json')
    this.levels = (module.default ?? module) as LevelManifest
    this.resize()
    this.navigate('menu')
  }

  get currentScreen(): ScreenName | null {
    return this.screenNameValue
  }

  /** The live screen object, used by browser tests and accessibility tooling. */
  get screenView(): Screen | null {
    return this.screen
  }

  get context() {
    return { app: this, save: this.save, audio: this.audio, levels: this.levels }
  }

  navigate(name: ScreenName, params: ScreenParams = {}): void {
    const factory = screenFactory(name)
    if (!factory) {
      console.error(`No screen registered for ${name}`)
      return
    }
    if (this.screen) {
      this.screen.exit()
      this.screen.container.destroy({ children: true })
      this.screen = null
    }
    this.closeModal()
    this.screenNameValue = name
    this.screen = factory(this.context, params)
    this.screenLayer.addChild(this.screen.container)
    this.screen.resize(this.width, this.height)
    this.screen.enter()
  }

  resize = (): void => {
    const rect = this.app.renderer.screen
    const w = Math.max(240, rect.width)
    const h = Math.max(320, rect.height)
    const aspect = w / h
    let scale = 1
    if (aspect <= 0.78) {
      this.width = LOGICAL_WIDTH
      this.height = Math.min(1700, Math.max(1040, LOGICAL_WIDTH / aspect))
      scale = w / LOGICAL_WIDTH
    } else {
      this.width = LOGICAL_WIDTH
      this.height = 1280
      scale = Math.min(w / LOGICAL_WIDTH, h / 1280)
    }
    this.scaleFactor = scale
    this.root.scale.set(scale)
    this.root.position.set((w - this.width * scale) / 2, (h - this.height * scale) / 2)
    this.drawBackdrop(w, h)
    this.screen?.resize(this.width, this.height)
  }

  private drawBackdrop(width: number, height: number): void {
    const colors = [
      0x1b2b20,
      0x223428,
      0x16211a,
    ]
    this.backdrop.clear()
    this.backdrop
      .rect(0, 0, width, height)
      .fill(colors[0]!)
      .rect(0, height * 0.45, width, height * 0.55)
      .fill({ color: colors[1]!, alpha: 0.7 })
    for (let i = 0; i < 5; i += 1) {
      this.backdrop
        .circle((width / 6) * (i + 0.5), height * (0.15 + (i % 2) * 0.12), width * 0.28)
        .fill({ color: colors[2]!, alpha: 0.09 })
    }
  }

  private tick(deltaSeconds: number): void {
    this.time += deltaSeconds
    this.screen?.update?.(deltaSeconds)
    const now = performance.now()
    for (const toast of [...this.toasts]) {
      const age = toast.until - now
      toast.container.alpha = Math.min(1, Math.max(0, age / 400))
      if (age <= 0) {
        toast.container.destroy({ children: true })
        this.toasts = this.toasts.filter((item) => item !== toast)
      }
    }
  }

  toast(text: string, tone: 'info' | 'good' | 'warn' = 'info', duration = 2600): void {
    const color = tone === 'good' ? 0xbfe6b4 : tone === 'warn' ? 0xf1bfa4 : 0xfff0d2
    const node = new Container()
    const message = wrapLabel(text, 22, 0x241a0e, Math.min(600, this.width - 120), 'bold')
    message.anchor.set(0.5, 0)
    const plate = new Graphics()
      .roundRect(0, 0, message.width + 44, message.height + 26, 18)
      .fill({ color, alpha: 0.97 })
      .roundRect(0, 0, message.width + 44, message.height + 26, 18)
      .stroke({ width: 1.5, color: 0x000000, alpha: 0.12 })
    message.position.set(plate.width / 2, 13)
    plate.pivot.set(plate.width / 2, 0)
    plate.position.set(this.width / 2, 0)
    message.position.set(this.width / 2, 13)
    node.addChild(plate, message)
    node.y = this.width > 600 ? 18 : 26
    node.alpha = 0
    this.toastLayer.addChild(node)
    this.toasts.push({ container: node, until: performance.now() + duration })
    // A short rise-in keeps the message from popping.
    const start = performance.now()
    const rise = (): void => {
      const t = Math.min(1, (performance.now() - start) / 220)
      node.alpha = t
      node.y = 18 + (1 - t) * 12
      if (t < 1) requestAnimationFrame(rise)
    }
    requestAnimationFrame(rise)
  }

  modal(options: ModalOptions): void {
    this.closeModal()
    const dim = new Graphics().rect(0, 0, this.width, this.height).fill({ color: 0x0b120c, alpha: 0.66 })
    dim.eventMode = 'static'
    if (options.onDismiss) dim.on('pointertap', options.onDismiss)
    const cardWidth = Math.min(600, this.width - 64)
    const title = wrapLabel(options.title, 34, 0x2c2114, cardWidth - 72, 'bold')
    title.anchor.set(0.5, 0)
    const body = options.body ? wrapLabel(options.body, 22, UI.inkSoft, cardWidth - 76) : null
    body?.anchor.set(0.5, 0)
    const buttonHeight = 62
    const gap = 12
    const buttonsHeight = options.buttons.length * (buttonHeight + gap)
    const cardHeight = 54 + title.height + (body ? body.height + 18 : 8) + buttonsHeight + 26
    const card = new Container()
    const plate = new Graphics()
      .roundRect(0, 0, cardWidth, cardHeight, 28)
      .fill(0xe9d9b8)
      .roundRect(0, 0, cardWidth, cardHeight, 28)
      .stroke({ width: 2, color: 0x9a7745, alpha: 0.7 })
      .roundRect(10, 10, cardWidth - 20, cardHeight - 20, 22)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.35 })
    card.addChild(plate, title)
    title.position.set(cardWidth / 2, 30)
    if (body) {
      card.addChild(body)
      body.position.set(cardWidth / 2, 30 + title.height + 12)
    }
    let y = 30 + title.height + (body ? body.height + 22 : 10)
    for (const button of options.buttons) {
      const view = new Button({
        text: button.text,
        width: cardWidth - 72,
        height: buttonHeight,
        variant: button.variant ?? 'primary',
        onTap: button.onTap,
      })
      view.position.set(36, y)
      card.addChild(view)
      y += buttonHeight + gap
    }
    card.pivot.set(cardWidth / 2, cardHeight / 2)
    card.position.set(this.width / 2, this.height / 2)
    card.scale.set(0.95)
    const node = new Container()
    node.addChild(dim, card)
    this.overlayLayer.addChild(node)
    this.modalNode = node
    const start = performance.now()
    const pop = (): void => {
      const t = Math.min(1, (performance.now() - start) / 180)
      card.scale.set(0.95 + t * 0.05)
      if (t < 1) requestAnimationFrame(pop)
    }
    requestAnimationFrame(pop)
  }

  closeModal(): void {
    if (this.modalNode) {
      this.modalNode.destroy({ children: true })
      this.modalNode = null
    }
  }

  get hasModal(): boolean {
    return this.modalNode !== null
  }

  closeTopLayer(): boolean {
    if (this.modalNode) {
      this.closeModal()
      return true
    }
    return false
  }

  /** Small round utility buttons used in screen headers. */
  utility(glyph: string, onTap: () => void, tone: 'brass' | 'dark' = 'dark'): IconButton {
    return new IconButton({ glyph, size: 54, onTap, tone })
  }

  heading(text: string, size = 34, color = UI.cream): Container {
    const node = new Container()
    const shadow = label(text, size, 0x120d07, 'bold')
    shadow.alpha = 0.35
    shadow.position.set(2, 3)
    const face = label(text, size, color, 'bold')
    node.addChild(shadow, face)
    node.pivot.set(face.width / 2, 0)
    return node
  }

  openArcade(): void {
    window.open('https://littlejoyarcade.site', '_blank', 'noopener')
  }
}
