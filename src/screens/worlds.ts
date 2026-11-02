import { Container, Graphics } from 'pixi.js'
import { registerScreen, type Screen, type ScreenContext } from '../app/types'
import { WORLDS } from '../content/worlds'
import { UI, label } from '../render/theme'
import { IconButton, progressBar, starRow } from '../ui/widgets'
import { ScrollView } from '../ui/scroll'
import { toColor } from '../render/gardenArt'

class WorldsScreen implements Screen {
  readonly container = new Container()
  private readonly backdrop = new Graphics()
  private readonly chrome = new Container()
  private scroll: ScrollView | null = null
  private ctx: ScreenContext
  private width: number
  private height: number

  constructor(context: ScreenContext) {
    this.ctx = context
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
    this.backdrop
      .clear()
      .rect(0, 0, width, height)
      .fill(0x1b2b20)
      .ellipse(width * 0.5, height * 0.05, width * 0.9, height * 0.25)
      .fill({ color: 0x2d4531, alpha: 0.9 })
    for (const child of [...this.chrome.children]) child.destroy({ children: true })
    this.chrome.removeChildren()
    this.scroll = null

    const back = new IconButton({ glyph: '←', size: 50, onTap: () => ctx.app.navigate('menu') })
    back.position.set(42, 52)
    this.chrome.addChild(back)
    const title = label('Journey', 32, UI.cream, 'bold')
    title.anchor.set(0.5, 0)
    title.position.set(width / 2, 26)
    const subtitle = label(`${ctx.save.solvedCount()} of 1,000 gardens awake · ${ctx.save.totalStars()} stars`, 15, 0x9fb49a, 'bold')
    subtitle.anchor.set(0.5, 0)
    subtitle.position.set(width / 2, 62)
    this.chrome.addChild(title, subtitle)

    const view = new ScrollView(width - 32, height - 112)
    view.position.set(16, 100)
    this.chrome.addChild(view)
    this.scroll = view

    let y = 6
    for (const world of WORLDS) {
      const unlocked = world.start <= ctx.save.data.unlocked
      const stars = ctx.save.worldStars(world.id)
      const solved = Math.floor(stars / 3)
      const card = new Container()
      const plate = new Graphics()
        .roundRect(0, 4, width - 40, 104, 18)
        .fill({ color: 0x0f1a12, alpha: 0.35 })
        .roundRect(0, 0, width - 40, 104, 18)
        .fill(unlocked ? 0xf4e7cd : 0x53614f)
        .roundRect(0, 0, width - 40, 104, 18)
        .stroke({ width: 1.5, color: unlocked ? 0xffffff : 0x2c3a2c, alpha: 0.35 })
        .roundRect(0, 0, 78, 104, 18)
        .fill(toColor(world.palette.accent))
      const number = label(String(world.id), 34, 0x2c2114, 'bold')
      number.anchor.set(0.5)
      number.position.set(39, 46)
      const lock = label(unlocked ? '❀' : '🔒', 20, 0x2c2114, 'bold')
      lock.anchor.set(0.5)
      lock.position.set(39, 78)
      const name = label(world.name, 22, 0x2c2114, 'bold')
      name.anchor.set(0, 0)
      name.position.set(96, 14)
      const teach = label(world.teaches, 14, 0x6d5a40, 'bold')
      teach.anchor.set(0, 0)
      teach.position.set(96, 42)
      const progress = progressBar(width - 200, 7, solved / 50, toColor(world.palette.accent))
      progress.position.set(96, 64)
      const counter = label(`${solved}/50 · ${stars}/150 ★`, 13, 0x6d5a40, 'bold')
      counter.anchor.set(0, 0)
      counter.position.set(96, 76)
      card.addChild(plate, number, lock, name, teach, progress, counter)
      if (stars > 0) {
        const starsRow = starRow(Math.min(3, Math.ceil(stars / 50)), 14)
        starsRow.position.set(width - 96, 74)
        card.addChild(starsRow)
      }
      card.position.set(4, y)
      card.label = `world-${world.id}`
      card.alpha = unlocked ? 1 : 0.62
      if (unlocked) {
        card.eventMode = 'static'
        card.cursor = 'pointer'
        card.on('pointertap', () => ctx.app.navigate('levels', { world: world.id }))
      }
      view.content.addChild(card)
      y += 116
    }

    const footer = label('Solve a garden to open the next one.', 14, 0x8fa78b, 'bold')
    footer.anchor.set(0.5, 0)
    footer.position.set(width / 2, height - 30)
    this.chrome.addChild(footer)
  }
}

registerScreen('worlds', (context) => new WorldsScreen(context))
