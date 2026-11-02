import { Container, Graphics } from 'pixi.js'
import { registerScreen, type Screen, type ScreenContext } from '../app/types'
import { ACHIEVEMENTS } from '../platform/achievements'
import { UI, label } from '../render/theme'
import { IconButton } from '../ui/widgets'
import { ScrollView } from '../ui/scroll'

class AchievementsScreen implements Screen {
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
      .fill(0x1a2a1f)
      .ellipse(width * 0.5, height * 0.05, width, height * 0.22)
      .fill({ color: 0x2f4433, alpha: 0.9 })
    for (const child of [...this.chrome.children]) child.destroy({ children: true })
    this.chrome.removeChildren()
    this.scroll = null

    const back = new IconButton({ glyph: '←', size: 50, onTap: () => ctx.app.navigate('menu') })
    back.position.set(42, 52)
    this.chrome.addChild(back)
    const title = label('Achievements', 28, UI.cream, 'bold')
    title.anchor.set(0.5, 0)
    title.position.set(width / 2, 28)
    const count = label(`${ctx.save.data.achievements.length} of ${ACHIEVEMENTS.length} earned`, 14, 0xa9bda2, 'bold')
    count.anchor.set(0.5, 0)
    count.position.set(width / 2, 62)
    this.chrome.addChild(title, count)

    const view = new ScrollView(width - 32, height - 112)
    view.position.set(16, 100)
    this.chrome.addChild(view)
    this.scroll = view

    let y = 4
    for (const achievement of ACHIEVEMENTS) {
      const owned = ctx.save.hasAchievement(achievement.id)
      const card = new Container()
      const plate = new Graphics()
      plate
        .roundRect(0, 0, width - 40, 82, 15)
        .fill(owned ? 0xf6e5bb : 0x2f4234)
        .roundRect(0, 0, width - 40, 82, 15)
        .stroke({ width: 1, color: owned ? 0xfff3d2 : 0xffffff, alpha: owned ? 0.5 : 0.1 })
        .circle(42, 41, 25)
        .fill(owned ? 0xe0a441 : 0x435a47)
      const glyph = label(achievement.glyph, 24, owned ? 0x3a2a10 : 0x8ba58c, 'bold')
      glyph.anchor.set(0.5)
      glyph.position.set(42, 41)
      const name = label(achievement.name, 19, owned ? 0x2c2114 : 0xd7e2cf, 'bold')
      name.anchor.set(0, 0)
      name.position.set(80, 14)
      const description = label(achievement.description, 13, owned ? 0x6d5a40 : 0x9fb49a)
      description.anchor.set(0, 0)
      description.position.set(80, 40)
      const mark = label(owned ? '★' : '·', 22, owned ? 0xe0a441 : 0x6b8070, 'bold')
      mark.anchor.set(1, 0)
      mark.position.set(width - 74, 28)
      card.addChild(plate, glyph, name, description, mark)
      card.position.set(4, y)
      view.content.addChild(card)
      y += 92
    }
    view.content.height = y
    void height
  }
}

registerScreen('achievements', (context) => new AchievementsScreen(context))
