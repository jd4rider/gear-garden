import { Container, Graphics } from 'pixi.js'
import { registerScreen, type Screen, type ScreenContext } from '../app/types'
import { applyAction, commit, createHistory, remainingStock, undo, type History } from '../core/state'
import { evaluate, type Evaluation } from '../mechanics/objectives'
import { emptySandbox, sandboxLevel, type SandboxBoard } from '../platform/sandbox'
import { TEETH, type Layer, type Level, type Teeth } from '../core/types'
import { BoardView } from '../render/board'
import { createPreviewGear } from '../render/gearArt'
import { worldById } from '../content/worlds'
import { UI, label } from '../render/theme'
import { Button, IconButton } from '../ui/widgets'

class SandboxScreen implements Screen {
  readonly container = new Container()
  private readonly backdrop = new Graphics()
  private readonly chrome = new Container()
  private readonly boardLayer = new Container()
  private ctx: ScreenContext
  private board: BoardView
  private level: Level
  private history: History
  private evaluation: Evaluation
  private selected: { teeth: Teeth; layer: Layer } | null = null
  private width: number
  private height: number
  private running = false
  private boardId = 'sandbox-main'
  private name = 'My machine'
  private status = 'Pick a gear and build whatever you like.'
  private keyHandler: (event: KeyboardEvent) => void
  private controlsY = 0
  private trayY = 0

  constructor(context: ScreenContext) {
    this.ctx = context
    this.width = context.app.width
    this.height = context.app.height
    const saved = context.save.data.sandbox.find((item) => item.id === this.boardId) ?? emptySandbox(this.boardId, 'My machine')
    this.name = saved.name
    this.level = sandboxLevel(this.name)
    const base = createHistory(this.level)
    const valid = saved.gears.filter(
      (gear) => this.level.pegs.some((peg) => peg.id === gear.peg) && TEETH.includes(gear.teeth),
    )
    this.history = { ...base, present: { ...base.present, gears: valid } }
    this.evaluation = evaluate(this.level, this.history.present.gears, this.history.present.switches)
    this.board = new BoardView(this.level, worldById(1), {
      onTap: (pegId) => this.tapPeg(pegId),
      onHold: (pegId) => this.ctx.app.toast(`Axle ${pegId}: ${this.level.pegs.find((p) => p.id === pegId)?.output?.name ?? 'plain shaft'}`, 'info'),
    })
    this.boardLayer.addChild(this.board)
    this.container.addChild(this.backdrop, this.boardLayer, this.chrome)
    this.keyHandler = (event) => {
      if (event.key === 'Escape') this.ctx.app.navigate('menu')
    }
  }

  enter(): void {
    window.addEventListener('keydown', this.keyHandler)
    this.resize(this.width, this.height)
  }

  exit(): void {
    window.removeEventListener('keydown', this.keyHandler)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    const theme = worldById(1)
    this.backdrop
      .clear()
      .rect(0, 0, width, height)
      .fill(theme.palette.background)
      .ellipse(width * 0.5, height * 0.05, width, height * 0.24)
      .fill({ color: theme.palette.sky, alpha: 0.6 })
    this.chrome.removeChildren()
    this.buildChrome()
  }

  private get state() {
    return this.history.present
  }

  private buildChrome(): void {
    const { width, height, ctx } = this
    this.controlsY = height - 94
    this.trayY = this.controlsY - 118
    const boardTop = 104
    this.board.resize(16, boardTop, width - 32, Math.max(240, this.trayY - boardTop - 30))
    for (const child of [...this.chrome.children]) child.destroy({ children: true })
    this.chrome.removeChildren()

    const back = new IconButton({ glyph: '←', size: 50, onTap: () => ctx.app.navigate('menu') })
    back.position.set(42, 52)
    this.chrome.addChild(back)
    const title = label('Free Build', 28, UI.cream, 'bold')
    title.anchor.set(0.5, 0)
    title.position.set(width / 2, 26)
    const subtitle = label('Every gear, one motor, three mechanisms', 13, 0x4b5f4b, 'bold')
    subtitle.anchor.set(0.5, 0)
    subtitle.position.set(width / 2, 58)
    this.chrome.addChild(title, subtitle)

    const status = label(this.status, 14, 0x3a4f3a, 'bold')
    status.anchor.set(0.5, 0)
    status.position.set(width / 2, this.trayY - 28)
    this.chrome.addChild(status)

    const tray = new Graphics()
      .roundRect(20, this.trayY, width - 40, 100, 18)
      .fill({ color: 0x203024, alpha: 0.75 })
      .roundRect(20, this.trayY, width - 40, 100, 18)
      .stroke({ width: 1.2, color: 0xffffff, alpha: 0.12 })
    this.chrome.addChild(tray)
    const stock = remainingStock(this.level, this.state)
    const slotWidth = Math.min(96, (width - 64) / Math.max(1, stock.length))
    const startX = width / 2 - (slotWidth * stock.length) / 2
    stock.forEach((item, index) => {
      const selected = this.selected?.teeth === item.teeth
      const node = new Container()
      const plate = new Graphics()
        .roundRect(-slotWidth / 2 + 4, 0, slotWidth - 8, 66, 14)
        .fill(selected ? 0xf3d79b : 0x3b4f3d)
        .stroke({ width: selected ? 2.5 : 1, color: selected ? 0xfff4dc : 0xffffff, alpha: selected ? 0.9 : 0.16 })
      const preview = createPreviewGear(item.teeth, Math.min(25, slotWidth * 0.29), 0)
      preview.position.set(0, 30)
      node.addChild(plate, preview)
      node.label = `tray-${item.teeth}-0`
      node.position.set(startX + slotWidth * index + slotWidth / 2, this.trayY + 24)
      node.eventMode = 'static'
      node.cursor = 'pointer'
      node.on('pointertap', () => {
        this.selected = { teeth: item.teeth, layer: 0 }
        this.status = `${item.teeth}-tooth gear selected.`
        this.board.setState(this.state, this.evaluation, this.selected)
        this.buildChrome()
      })
      this.chrome.addChild(node)
    })

    const undoButton = new IconButton({ glyph: '↶', size: 54, onTap: () => this.undo() })
    undoButton.position.set(118, this.controlsY + 30)
    const reset = new IconButton({ glyph: '⟲', size: 54, onTap: () => this.reset() })
    reset.position.set(184, this.controlsY + 30)
    this.chrome.addChild(undoButton, reset)

    const save = new Button({
      text: 'Save',
      width: 104,
      height: 58,
      variant: 'soft',
      fontSize: 20,
      onTap: () => this.saveBoard(),
    })
    save.position.set(width - 26 - 104, this.controlsY + 2)
    const run = new Button({
      text: this.running ? 'STOP' : 'RUN',
      width: Math.min(190, width - 320),
      height: 58,
      variant: this.running ? 'danger' : 'primary',
      fontSize: 23,
      onTap: () => {
        this.running = !this.running
        this.board.setRunning(this.running)
        if (this.running) this.ctx.audio.motor()
        this.buildChrome()
      },
    })
    run.position.set(width - 26 - 104 - 10 - run.hitWidth, this.controlsY + 2)
    this.chrome.addChild(save, run)
  }

  private tapPeg(pegId: string): void {
    const existing = this.state.gears.find((gear) => gear.peg === pegId)
    if (existing) {
      const result = applyAction(this.level, this.state, { type: 'remove', peg: pegId, layer: existing.layer })
      if (result.ok) {
        this.history = commit(this.history, result.state)
        this.ctx.audio.remove()
        this.refresh()
      }
      return
    }
    if (!this.selected) {
      this.status = 'Choose a gear from the tray first.'
      this.buildChrome()
      return
    }
    const result = applyAction(this.level, this.state, {
      type: 'place',
      peg: pegId,
      layer: this.selected.layer,
      teeth: this.selected.teeth,
    })
    if (!result.ok) {
      this.status = result.error
      this.ctx.audio.error()
      this.buildChrome()
      return
    }
    this.history = commit(this.history, result.state)
    this.ctx.audio.place()
    this.status = 'Fitted. Run it and see what turns.'
    this.refresh()
  }

  private refresh(): void {
    this.evaluation = evaluate(this.level, this.state.gears, this.state.switches)
    this.board.setState(this.state, this.evaluation, this.selected)
    this.buildChrome()
  }

  private undo(): void {
    this.history = undo(this.history)
    this.ctx.audio.tap()
    this.refresh()
  }

  private reset(): void {
    this.history = createHistory(this.level)
    this.running = false
    this.board.setRunning(false)
    this.ctx.audio.remove()
    this.status = 'Cleared the board.'
    this.refresh()
  }

  private saveBoard(): void {
    const board: SandboxBoard = {
      id: this.boardId,
      name: this.name,
      gears: this.state.gears.map((gear) => ({ ...gear })),
      savedAt: Date.now(),
    }
    this.ctx.save.saveSandbox(board)
    if (this.ctx.save.addAchievement('clockwork-architect')) {
      this.ctx.app.toast('✎  Clockwork Architect', 'good', 3200)
    }
    this.ctx.app.toast('Machine saved on this device.', 'good')
    this.ctx.audio.select()
  }

  update(delta: number): void {
    this.board.tick(delta)
  }
}

registerScreen('sandbox', (context) => new SandboxScreen(context))
