import { Container, Graphics, Ticker } from 'pixi.js'
import { UI, label } from '../render/theme'

export type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'danger'

interface ButtonOptions {
  text: string
  width: number
  height: number
  variant?: ButtonVariant
  fontSize?: number
  onTap: () => void
}

const FILL: Record<ButtonVariant, { top: number; bottom: number; edge: number; text: number }> = {
  primary: { top: 0xf6cf86, bottom: 0xe0a647, edge: 0x9a6b28, text: 0x3a2a10 },
  soft: { top: 0xf4e6cb, bottom: 0xe2ceaa, edge: 0x9b7f57, text: 0x3d2f1d },
  ghost: { top: 0x3c513d, bottom: 0x2c3d2f, edge: 0x1b2a1e, text: 0xf6ecd7 },
  danger: { top: 0xef9c86, bottom: 0xd06851, edge: 0x8b3f30, text: 0x3d150e },
}

/** Rounded, tactile Pixi button with a real press animation and a hit target. */
export class Button extends Container {
  private readonly plate = new Graphics()
  private readonly caption = label('', 26, UI.cream, 'bold')
  private readonly handler: () => void
  private enabled = true
  private readonly baseWidth: number
  private readonly baseHeight: number

  constructor(options: ButtonOptions) {
    super()
    this.handler = options.onTap
    this.baseWidth = options.width
    this.baseHeight = options.height
    const variant = options.variant ?? 'primary'
    const palette = FILL[variant]
    const radius = Math.min(24, options.height / 2)

    this.plate
      .roundRect(0, 5, options.width, options.height, radius)
      .fill({ color: palette.edge, alpha: 0.55 })
      .roundRect(0, 0, options.width, options.height, radius)
      .fill(palette.bottom)
      .roundRect(1.5, 1.5, options.width - 3, options.height * 0.52, radius)
      .fill({ color: palette.top, alpha: 0.92 })
      .roundRect(0, 0, options.width, options.height, radius)
      .stroke({ width: 1.5, color: palette.edge, alpha: 0.5 })

    this.caption.text = options.text
    this.caption.style.fontSize = options.fontSize ?? Math.min(28, Math.max(17, options.height * 0.38))
    this.caption.style.fill = palette.text
    this.caption.anchor.set(0.5)
    this.caption.position.set(options.width / 2, options.height / 2)

    this.addChild(this.plate, this.caption)
    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.on('pointerdown', () => {
      if (!this.enabled) return
      this.scale.set(0.965)
      this.plate.y = 2
    })
    const release = (): void => {
      this.scale.set(1)
      this.plate.y = 0
    }
    this.on('pointerup', release)
    this.on('pointerupoutside', release)
    this.on('pointertap', () => {
      if (!this.enabled) return
      this.handler()
    })
  }

  setText(text: string): this {
    this.caption.text = text
    return this
  }

  setEnabled(value: boolean): this {
    this.enabled = value
    this.alpha = value ? 1 : 0.45
    this.cursor = value ? 'pointer' : 'default'
    return this
  }

  /** Anchored hit rectangle, useful for tests and for accessibility tooling. */
  get hitWidth(): number {
    return this.baseWidth
  }

  get hitHeight(): number {
    return this.baseHeight
  }
}

interface IconOptions {
  glyph: string
  size: number
  onTap: () => void
  tone?: 'brass' | 'dark' | 'danger'
}

/** Round icon button used for undo, redo, hint and the transport controls. */
export class IconButton extends Container {
  constructor(options: IconOptions) {
    super()
    const radius = options.size / 2
    const tone = options.tone ?? 'dark'
    const fill = tone === 'brass' ? 0xe0ab52 : tone === 'danger' ? 0xc4624d : 0x33443a
    const edge = tone === 'brass' ? 0x94641f : tone === 'danger' ? 0x7f3827 : 0x1d2b22

    const plate = new Graphics()
      .circle(0, 3, radius)
      .fill({ color: edge, alpha: 0.6 })
      .circle(0, 0, radius)
      .fill(fill)
      .circle(0, 0, radius)
      .stroke({ width: 1.5, color: edge, alpha: 0.75 })
      .circle(0, -radius * 0.18, radius * 0.62)
      .fill({ color: 0xffffff, alpha: 0.08 })
    const glyph = label(options.glyph, options.size * 0.5, 0xfff5df, 'bold')
    glyph.anchor.set(0.5)

    this.addChild(plate, glyph)
    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.on('pointerdown', () => this.scale.set(0.92))
    this.on('pointerup', () => this.scale.set(1))
    this.on('pointerupoutside', () => this.scale.set(1))
    this.on('pointertap', options.onTap)
  }
}

/** Simple horizontal progress meter. */
export function progressBar(width: number, height: number, ratio: number, fill: number = UI.mint): Graphics {
  const bar = new Graphics()
  bar.roundRect(0, 0, width, height, height / 2).fill({ color: 0x1b2a1f, alpha: 0.55 })
  if (ratio > 0) {
    bar
      .roundRect(0, 0, Math.max(height, width * Math.min(1, ratio)), height, height / 2)
      .fill(fill)
      .roundRect(0, 0, Math.max(height, width * Math.min(1, ratio)), height / 2, height / 4)
      .fill({ color: 0xffffff, alpha: 0.2 })
  }
  return bar
}

/** Tween helper driven by Pixi's shared ticker. */
export function tween(
  duration: number,
  onUpdate: (t: number) => void,
  onComplete?: () => void,
): void {
  let elapsed = 0
  const tick = (ticker: Ticker): void => {
    elapsed += ticker.deltaMS
    const t = Math.min(1, elapsed / duration)
    onUpdate(t)
    if (t >= 1) {
      Ticker.shared.remove(tick)
      onComplete?.()
    }
  }
  Ticker.shared.add(tick)
}

export function starRow(stars: number, size: number, filled = 0xffcf6a, empty = 0x6b5a44): Container {
  const row = new Container()
  for (let index = 0; index < 3; index += 1) {
    const star = new Graphics()
    const points: number[] = []
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI / 5) * i - Math.PI / 2
      const radius = i % 2 === 0 ? size / 2 : size / 4.4
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    star.poly(points).fill(index < stars ? filled : empty)
    star.position.set(index * size * 1.12 + size / 2, size / 2)
    row.addChild(star)
  }
  row.pivot.set((size * 1.12 * 3 - size * 0.12) / 2, size / 2)
  return row
}
