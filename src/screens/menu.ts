import { Container, Graphics } from 'pixi.js'
import { registerScreen, type Screen, type ScreenContext } from '../app/types'
import { createGear } from '../render/gearArt'
import { createMechanism, type Mechanism } from '../render/gardenArt'
import { label } from '../render/theme'
import { Button, tween } from '../ui/widgets'
import { WORLDS, worldOf } from '../content/worlds'
import { ACHIEVEMENTS } from '../platform/achievements'
import { todayKey } from '../app/daily'

class MenuScreen implements Screen {
  readonly container = new Container()
  private readonly scene = new Container()
  private readonly chrome = new Container()
  private readonly bigGear: Container
  private readonly smallGear: Container
  private readonly windmill: Mechanism
  private readonly flower: Mechanism
  private readonly butterfly: Mechanism
  private readonly pollen: Graphics[] = []
  private time = 0
  private width: number
  private height: number
  private ctx: ScreenContext
  private gearAngle = 0
  private smallAngle = 0

  constructor(context: ScreenContext, width: number, height: number) {
    this.ctx = context
    this.width = width
    this.height = height
    const theme = worldOf(context.save.data.lastLevel)
    const palette = theme.palette

    const sky = new Graphics()
      .rect(0, 0, width, height)
      .fill(palette.background)
      .ellipse(width * 0.5, height * 0.28, width * 0.9, height * 0.34)
      .fill({ color: palette.sky, alpha: 0.65 })
      .ellipse(width * 0.18, height * 0.62, width * 0.7, height * 0.3)
      .fill({ color: palette.backgroundAccent, alpha: 0.55 })
      .ellipse(width * 0.86, height * 0.7, width * 0.65, height * 0.26)
      .fill({ color: palette.foliage, alpha: 0.32 })
    this.scene.addChild(sky)

    for (let i = 0; i < 26; i += 1) {
      const dot = new Graphics()
      const size = 2 + (i % 4)
      dot.circle(0, 0, size).fill({ color: 0xfff4c9, alpha: 0.35 })
      dot.x = ((i * 137) % width) + 10
      dot.y = ((i * 211) % Math.max(1, height * 0.7)) + 40
      this.pollen.push(dot)
      this.scene.addChild(dot)
    }

    this.bigGear = createGear(16, Math.min(126, width * 0.19), 0, { variant: 'brass' })
    this.bigGear.position.set(width * 0.48, height * 0.31)
    this.smallGear = createGear(8, Math.min(56, width * 0.084), 0, { variant: 'wood' })
    const bigRadius = Math.min(126, width * 0.19)
    this.smallGear.position.set(width * 0.48 + bigRadius + Math.min(56, width * 0.084) - 2, height * 0.31 - bigRadius * 0.1)
    this.scene.addChild(this.bigGear, this.smallGear)

    this.windmill = createMechanism('windmill', width * 0.16, theme)
    this.windmill.position.set(width * 0.15, height * 0.46)
    this.flower = createMechanism('flower', width * 0.13, theme)
    this.flower.position.set(width * 0.86, height * 0.47)
    this.butterfly = createMechanism('butterfly', width * 0.09, theme)
    this.butterfly.position.set(width * 0.78, height * 0.36)
    this.scene.addChild(this.windmill, this.flower, this.butterfly)

    this.container.addChild(this.scene, this.chrome)
    this.buildChrome()
  }

  private buildChrome(): void {
    const { width, height } = this
    const save = this.ctx.save
    const logo = new Container()
    const gearGlyph = createGear(10, 24, 0, { variant: 'brass' })
    gearGlyph.position.set(-152, 12)
    const title = label('GEAR', 72, 0xfff1cf, 'bold')
    title.anchor.set(0.5, 0)
    const garden = label('GARDEN', 60, 0xe7b45c, 'bold')
    garden.anchor.set(0.5, 0)
    garden.position.set(0, title.height * 0.76)
    const tagline = label('a clockwork puzzle garden', 19, 0x3f573f, 'bold')
    tagline.anchor.set(0.5, 0)
    tagline.position.set(0, title.height * 0.76 + garden.height + 14)
    const shadow = label('GEAR', 72, 0x2b1d0d, 'bold')
    shadow.anchor.set(0.5, 0)
    shadow.position.set(3, 4)
    shadow.alpha = 0.28
    logo.addChild(shadow, title, garden, tagline, gearGlyph)
    logo.position.set(width / 2, height * 0.075)
    this.chrome.addChild(logo)
    void gearGlyph

    const gearIcon = this.ctx.app.utility('⚙', () => this.ctx.app.navigate('settings'), 'brass')
    gearIcon.position.set(46, 46)
    const trophy = this.ctx.app.utility('★', () => this.ctx.app.navigate('achievements'))
    trophy.position.set(width - 46, 46)
    this.chrome.addChild(gearIcon, trophy)

    const last = Math.min(1000, Math.max(1, save.data.lastLevel))
    const world = worldOf(last)
    const hasProgress = save.solvedCount() > 0
    const buttons: { text: string; variant: 'primary' | 'soft' | 'ghost'; action: () => void }[] = [
      {
        text: hasProgress ? `Continue · Garden ${last}` : 'Play',
        variant: 'primary',
        action: () => this.ctx.app.navigate('gameplay', { level: last, mode: 'journey' }),
      },
      { text: 'Journey', variant: 'soft', action: () => this.ctx.app.navigate('worlds') },
      {
        text: 'Endless',
        variant: 'soft',
        action: () => this.ctx.app.navigate('gameplay', { mode: 'endless', level: 1, seed: `${Date.now() % 100000}` }),
      },
      {
        text: `Daily · ${todayKey()}`,
        variant: 'soft',
        action: () => this.ctx.app.navigate('gameplay', { mode: 'daily', seed: todayKey() }),
      },
      { text: 'Zen', variant: 'soft', action: () => this.ctx.app.navigate('gameplay', { mode: 'zen', level: last }) },
      { text: 'Free Build', variant: 'soft', action: () => this.ctx.app.navigate('sandbox') },
    ]
    const buttonHeight = Math.min(66, Math.max(52, (height * 0.4) / buttons.length - 10))
    const gap = 10
    let y = height * 0.5
    const startY = Math.max(height * 0.42, height - 24 - buttons.length * (buttonHeight + gap) - 64)
    y = startY
    for (const item of buttons) {
      const view = new Button({
        text: item.text,
        width: Math.min(460, width - 90),
        height: buttonHeight,
        variant: item.variant,
        fontSize: 25,
        onTap: item.action,
      })
      view.position.set((width - view.hitWidth) / 2, y)
      view.label = `menu-${item.text.toLowerCase().split(' ')[0]}`
      this.chrome.addChild(view)
      y += buttonHeight + gap
    }

    const progress = label(
      `${save.solvedCount()} gardens awake · ${save.totalStars()} stars · ${WORLDS.length} worlds`,
      18,
      0x3c4c3a,
      'bold',
    )
    progress.anchor.set(0.5, 0)
    progress.position.set(width / 2, height - 58)
    const arcade = label('Little Joy Arcade  ↗', 17, 0x2f4935, 'bold')
    arcade.anchor.set(0.5, 0)
    arcade.position.set(width / 2, height - 32)
    arcade.eventMode = 'static'
    arcade.cursor = 'pointer'
    arcade.on('pointertap', () => this.ctx.app.openArcade())
    this.chrome.addChild(progress, arcade)

    const badges = label(`${ACHIEVEMENTS.length} badges · ${save.data.achievements.length} earned`, 14, 0x4a5b47)
    badges.anchor.set(0.5, 0)
    badges.position.set(width / 2, height * 0.055)
    this.chrome.addChild(badges)
    void world
  }

  enter(): void {
    this.ctx.audio.configure(this.ctx.save.data.settings)
    this.container.alpha = 0
    tween(320, (t) => {
      this.container.alpha = t
    })
  }

  exit(): void {}

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  update(delta: number): void {
    this.time += delta
    if (this.ctx.save.data.settings.reducedMotion) {
      this.flower.update(this.time * 1000, true, 0.3)
      return
    }
    this.gearAngle += delta * 0.32
    this.smallAngle -= delta * 0.66
    this.bigGear.rotation = this.gearAngle
    this.smallGear.rotation = this.smallAngle
    this.windmill.update(this.time * 1000, true, 0.32)
    this.flower.update(this.time * 1000, true, 0.2)
    this.butterfly.update(this.time * 1000, true, 0.1)
    this.butterfly.x += Math.sin(this.time * 0.7) * 0.35
    this.butterfly.y += Math.cos(this.time * 0.9) * 0.22
    for (const [index, dot] of this.pollen.entries()) {
      dot.y -= (0.16 + (index % 5) * 0.04) * delta * 60
      dot.x += Math.sin(this.time * 0.5 + index) * 0.12
      if (dot.y < 20) dot.y = this.height * 0.72
    }
  }
}

registerScreen('menu', (context) => new MenuScreen(context, context.app.width, context.app.height))
