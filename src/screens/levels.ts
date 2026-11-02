import { Container, Graphics } from 'pixi.js'
import { registerScreen, type Screen, type ScreenContext, type ScreenParams } from '../app/types'
import { worldById, worldOf } from '../content/worlds'
import { label } from '../render/theme'
import { Button, IconButton } from '../ui/widgets'
import { ScrollView } from '../ui/scroll'

class LevelsScreen implements Screen {
  readonly container = new Container()
  private readonly backdrop = new Graphics()
  private readonly chrome = new Container()
  private scroll: ScrollView | null = null
  private ctx: ScreenContext
  private world: number
  private width: number
  private height: number

  constructor(context: ScreenContext, params: ScreenParams) {
    this.ctx = context
    this.world = Math.min(20, Math.max(1, params.world ?? worldOf(context.save.data.lastLevel).id))
    this.width = context.app.width
    this.height = context.app.height
    this.container.addChild(this.backdrop, this.chrome)
  }

  enter(): void {
    this.ctx.audio.configure(this.ctx.save.data.settings)
    this.draw()
  }

  exit(): void {}

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.draw()
  }

  update(): void {
    this.scroll?.update()
  }

  private draw(): void {
    const { width, height, ctx } = this
    const world = worldById(this.world)
    this.backdrop
      .clear()
      .rect(0, 0, width, height)
      .fill(world.palette.background)
      .ellipse(width * 0.5, height * 0.03, width, height * 0.22)
      .fill({ color: world.palette.sky, alpha: 0.55 })
      .ellipse(width * 0.9, height * 0.95, width * 0.7, height * 0.2)
      .fill({ color: world.palette.foliage, alpha: 0.28 })
    for (const child of [...this.chrome.children]) child.destroy({ children: true })
    this.chrome.removeChildren()
    this.scroll = null

    const back = new IconButton({ glyph: '←', size: 50, onTap: () => ctx.app.navigate('worlds') })
    back.position.set(42, 52)
    this.chrome.addChild(back)
    const title = label(world.name, 28, 0x2c2114, 'bold')
    title.anchor.set(0.5, 0)
    title.position.set(width / 2, 24)
    const info = label(`${world.id} · ${world.teaches} · ${ctx.save.worldStars(world.id)}/150 ★`, 14, 0x5f5138, 'bold')
    info.anchor.set(0.5, 0)
    info.position.set(width / 2, 58)
    this.chrome.addChild(title, info)

    const continueLevel = Math.min(
      (this.world - 1) * 50 + 50,
      Math.max((this.world - 1) * 50 + 1, ctx.save.data.lastLevel),
    )
    const quick = new Button({
      text: `Continue · ${continueLevel}`,
      width: 220,
      height: 44,
      variant: 'primary',
      fontSize: 19,
      onTap: () => ctx.app.navigate('gameplay', { level: continueLevel, mode: 'journey' }),
    })
    quick.position.set(width - 26 - 220, 106)
    this.chrome.addChild(quick)

    const view = new ScrollView(width - 32, height - 236)
    view.position.set(16, 168)
    this.chrome.addChild(view)
    this.scroll = view

    const columns = 5
    const gap = 8
    const cellHeight = 72
    const usable = width - 32
    const cell = Math.floor((usable - gap * (columns - 1)) / columns)
    for (let index = 0; index < 50; index += 1) {
      const levelNumber = (this.world - 1) * 50 + index + 1
      const id = `gg-${String(levelNumber).padStart(4, '0')}`
      const stars = ctx.save.starsFor(id)
      const unlocked = levelNumber <= ctx.save.data.unlocked
      const current = levelNumber === ctx.save.data.lastLevel && unlocked
      const col = index % columns
      const row = Math.floor(index / columns)
      const x = col * (cell + gap)
      const y = row * (cellHeight + gap)
      const tile = new Container()
      const plate = new Graphics()
        .roundRect(0, 2, cell, cellHeight - 4, 12)
        .fill({ color: 0x1b2a1e, alpha: 0.28 })
        .roundRect(0, 0, cell, cellHeight - 6, 12)
        .fill(!unlocked ? 0x66705f : stars > 0 ? 0xf6dc9f : 0xf7edd7)
        .roundRect(0, 0, cell, cellHeight - 6, 12)
        .stroke({ width: current ? 2.5 : 1, color: current ? 0xe0a441 : 0xffffff, alpha: current ? 0.95 : 0.25 })
      const number = label(unlocked ? String(index + 1) : '🔒', 22, unlocked ? 0x2c2114 : 0xd8ddce, 'bold')
      number.anchor.set(0.5, 0)
      number.position.set(cell / 2, 10)
      tile.addChild(plate, number)
      if (stars > 0) {
        const dots = new Graphics()
        for (let i = 0; i < 3; i += 1) {
          dots.circle(cell / 2 - 13 + i * 13, cellHeight - 24, 4).fill(i < stars ? 0xe0a441 : 0xc8bda4)
        }
        tile.addChild(dots)
      }
      tile.position.set(x, y)
      tile.label = `level-${levelNumber}`
      if (unlocked) {
        tile.eventMode = 'static'
        tile.cursor = 'pointer'
        tile.on('pointertap', () => ctx.app.navigate('gameplay', { level: levelNumber, mode: 'journey' }))
      } else {
        tile.alpha = 0.7
      }
      view.content.addChild(tile)
    }

    const zen = new Button({
      text: 'Zen mode for this world',
      width: Math.min(420, width - 60),
      height: 46,
      variant: 'ghost',
      fontSize: 18,
      onTap: () => ctx.app.navigate('gameplay', { mode: 'zen', level: (this.world - 1) * 50 + 1 }),
    })
    zen.position.set((width - zen.hitWidth) / 2, height - 58)
    this.chrome.addChild(zen)
  }
}

registerScreen('levels', (context, params) => new LevelsScreen(context, params))
