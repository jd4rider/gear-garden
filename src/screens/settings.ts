import { Container, Graphics } from 'pixi.js'
import { registerScreen, type Screen, type ScreenContext } from '../app/types'
import { UI, label } from '../render/theme'
import { Button, IconButton } from '../ui/widgets'
import { GENERATOR_VERSION } from '../generator/generator'

class SettingsScreen implements Screen {
  readonly container = new Container()
  private readonly backdrop = new Graphics()
  private readonly chrome = new Container()
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

  private draw(): void {
    const { width, height, ctx } = this
    this.backdrop
      .clear()
      .rect(0, 0, width, height)
      .fill(0x1a2a1f)
      .ellipse(width * 0.5, height * 0.08, width, height * 0.24)
      .fill({ color: 0x2c4031, alpha: 0.9 })
    for (const child of [...this.chrome.children]) child.destroy({ children: true })
    this.chrome.removeChildren()

    const back = new IconButton({ glyph: '←', size: 50, onTap: () => ctx.app.navigate('menu') })
    back.position.set(42, 52)
    this.chrome.addChild(back)
    const title = label('Settings', 30, UI.cream, 'bold')
    title.anchor.set(0.5, 0)
    title.position.set(width / 2, 30)
    this.chrome.addChild(title)

    const settings = ctx.save.data.settings
    const rows: { name: string; detail: string; value: string; toggle: () => void }[] = [
      {
        name: 'Sound',
        detail: 'Clicks, clinks and motor hum',
        value: settings.sound ? 'On' : 'Off',
        toggle: () => ctx.save.updateSettings({ sound: !settings.sound }),
      },
      {
        name: 'Music',
        detail: 'A quiet clockwork melody',
        value: settings.music ? 'On' : 'Off',
        toggle: () => ctx.save.updateSettings({ music: !settings.music }),
      },
      {
        name: 'Reduced motion',
        detail: 'Calmer menus and celebrations',
        value: settings.reducedMotion ? 'On' : 'Off',
        toggle: () => ctx.save.updateSettings({ reducedMotion: !settings.reducedMotion }),
      },
      {
        name: 'High contrast',
        detail: 'Stronger outlines on the board',
        value: settings.highContrast ? 'On' : 'Off',
        toggle: () => ctx.save.updateSettings({ highContrast: !settings.highContrast }),
      },
      {
        name: 'Animation speed',
        detail: 'How briskly the garden turns',
        value: settings.speed === 0.5 ? 'Slow' : settings.speed === 2 ? 'Fast' : 'Normal',
        toggle: () =>
          ctx.save.updateSettings({ speed: settings.speed === 1 ? 2 : settings.speed === 2 ? 0.5 : 1 }),
      },
      {
        name: 'Left-handed controls',
        detail: 'Mirror the bottom control strip',
        value: settings.leftHanded ? 'On' : 'Off',
        toggle: () => ctx.save.updateSettings({ leftHanded: !settings.leftHanded }),
      },
    ]

    let y = 104
    for (const row of rows) {
      const card = new Container()
      const plate = new Graphics()
        .roundRect(0, 0, width - 48, 66, 15)
        .fill({ color: 0xf5ead4, alpha: 0.95 })
        .roundRect(0, 0, width - 48, 66, 15)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.4 })
      const name = label(row.name, 20, 0x2c2114, 'bold')
      name.anchor.set(0, 0)
      name.position.set(18, 10)
      const detail = label(row.detail, 13, 0x7a6748)
      detail.anchor.set(0, 0)
      detail.position.set(18, 37)
      const value = new Button({
        text: row.value,
        width: 108,
        height: 42,
        variant: 'soft',
        fontSize: 16,
        onTap: () => {
          row.toggle()
          this.ctx.audio.tap()
          this.ctx.audio.configure(this.ctx.save.data.settings)
          this.draw()
        },
      })
      value.position.set(width - 48 - 122, 12)
      card.addChild(plate, name, detail, value)
      card.position.set(24, y)
      this.chrome.addChild(card)
      y += 74
    }

    const account = ctx.save.status()
    const arcadeCard = new Container()
    const plate = new Graphics()
      .roundRect(0, 0, width - 48, 112, 15)
      .fill({ color: 0x24382a, alpha: 0.9 })
      .roundRect(0, 0, width - 48, 112, 15)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.12 })
    const arcadeTitle = label('Little Joy Arcade', 19, 0xfff1d2, 'bold')
    arcadeTitle.position.set(18, 12)
    const status = label(account.signedIn ? 'Signed in — progress syncs' : 'Guest play — saved on this device', 13, 0xb9cbae)
    status.position.set(18, 38)
    const sync = new Button({
      text: account.signedIn ? 'Sync now' : 'Open arcade',
      width: 160,
      height: 40,
      variant: 'ghost',
      fontSize: 15,
      onTap: () => {
        if (account.signedIn) {
          void ctx.save.arcade()?.syncNow('manual')
          ctx.app.toast('Progress is saved on this device and mirrored to your account.', 'good')
        } else ctx.app.openArcade()
      },
    })
    sync.position.set(width - 48 - 176, 58)
    const note = label('Accounts, cloud saves and entitlements come from littlejoyarcade.site.', 11, 0x93a88c)
    note.position.set(18, 66)
    arcadeCard.addChild(plate, arcadeTitle, status, note, sync)
    arcadeCard.position.set(24, Math.min(y + 4, height - 268))
    this.chrome.addChild(arcadeCard)

    const about = label(
      `Gear Garden 1.0 · 1,000 gardens · ${GENERATOR_VERSION}\nEvery shipped garden is solver-verified.`,
      12,
      0x8ea389,
    )
    about.anchor.set(0.5, 0)
    about.position.set(width / 2, height - 84)
    this.chrome.addChild(about)

    const reset = new Button({
      text: 'Reset tutorial progress',
      width: 260,
      height: 42,
      variant: 'ghost',
      fontSize: 14,
      onTap: () => {
        ctx.app.modal({
          title: 'Reset progress?',
          body: 'This clears stars and unlocked gardens on this device. Achievements and settings stay.',
          buttons: [
            { text: 'Keep my gardens', variant: 'primary', onTap: () => ctx.app.closeModal() },
            {
              text: 'Reset stars',
              variant: 'danger',
              onTap: () => {
                ctx.save.data.levels = {}
                ctx.save.data.unlocked = 1
                ctx.save.data.lastLevel = 1
                ctx.save.write()
                ctx.app.closeModal()
                ctx.app.toast('Progress reset.', 'info')
                this.draw()
              },
            },
          ],
          onDismiss: () => ctx.app.closeModal(),
        })
      },
    })
    reset.position.set((width - reset.hitWidth) / 2, height - 44)
    this.chrome.addChild(reset)
  }
}

registerScreen('settings', (context) => new SettingsScreen(context))
