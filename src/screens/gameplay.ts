import { Container, Graphics } from 'pixi.js'
import { openTipJar } from '../platform/support'
import { registerScreen, type GameMode, type Screen, type ScreenContext, type ScreenParams } from '../app/types'
import { dailyLevel, endlessLevel, todayKey } from '../app/daily'
import { applyAction, commit, createHistory, isSlot, redo, remainingStock, undo, type History } from '../core/state'
import { evaluate, describeObjective, type Evaluation } from '../mechanics/objectives'
import { nodeId } from '../mechanics/network'
import { sign, toNumber, abs } from '../core/rational'
import type { Action, Layer, Level, Teeth, WorldTheme } from '../core/types'
import { worldById } from '../content/worlds'
import { BoardView } from '../render/board'
import { createPreviewGear } from '../render/gearArt'
import { label } from '../render/theme'
import { Button, IconButton } from '../ui/widgets'
import { nextHint } from '../solver/solver'
import { ACHIEVEMENTS, evaluateAchievements } from '../platform/achievements'

interface ConfettiPiece {
  view: Graphics
  vx: number
  vy: number
  spin: number
  life: number
}

export class GameplayScreen implements Screen {
  readonly container = new Container()
  private readonly backdrop = new Graphics()
  private readonly chrome = new Container()
  private readonly boardLayer = new Container()
  private readonly fx = new Container()
  private board: BoardView
  private ctx: ScreenContext
  private level: Level
  private theme: WorldTheme
  private history: History
  private evaluation: Evaluation
  private selected: { teeth: Teeth; layer: Layer } | null = null
  private mode: GameMode
  private levelNumber: number
  private width: number
  private height: number
  private moves = 0
  private hints = 0
  private running = false
  private won = false
  private confetti: ConfettiPiece[] = []
  private timers: number[] = []
  private status = ''
  private keyHandler: (event: KeyboardEvent) => void
  private trayStart = 0

  constructor(context: ScreenContext, params: ScreenParams) {
    this.ctx = context
    this.mode = params.mode ?? 'journey'
    this.width = context.app.width
    this.height = context.app.height

    if (this.mode === 'daily') {
      this.level = dailyLevel(params.seed ?? todayKey())
      this.levelNumber = 0
    } else if (this.mode === 'endless') {
      this.levelNumber = Math.max(1, params.level ?? 1)
      this.level = endlessLevel(params.seed ?? 'garden', this.levelNumber)
    } else if (this.mode === 'zen') {
      this.levelNumber = Math.min(1000, Math.max(1, params.level ?? context.save.data.lastLevel))
      this.level = context.levels.levels[this.levelNumber - 1] ?? context.levels.levels[0]!
    } else {
      this.levelNumber = Math.min(1000, Math.max(1, params.level ?? context.save.data.lastLevel))
      this.level = context.levels.levels[this.levelNumber - 1] ?? context.levels.levels[0]!
    }
    this.theme = worldById(this.level.world)
    this.history = createHistory(this.level)
    this.evaluation = evaluate(this.level, this.history.present.gears, this.history.present.switches)
    this.status = 'Tap a gear from the tray, then an empty axle.'
    this.board = new BoardView(this.level, this.theme, {
      onTap: (pegId) => this.tapPeg(pegId),
      onHold: (pegId) => this.showInfo(pegId),
    })
    this.container.addChild(this.backdrop, this.boardLayer, this.chrome, this.fx)
    this.boardLayer.addChild(this.board)
    this.keyHandler = (event) => this.onKey(event)
    this.renderChrome()
  }

  enter(): void {
    this.ctx.audio.configure(this.ctx.save.data.settings)
    window.addEventListener('keydown', this.keyHandler)
    this.resize(this.width, this.height)
  }

  exit(): void {
    window.removeEventListener('keydown', this.keyHandler)
    for (const timer of this.timers) window.clearTimeout(timer)
    this.timers = []
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    const palette = this.theme.palette
    this.backdrop
      .clear()
      .rect(0, 0, width, height)
      .fill(palette.background)
      .ellipse(width * 0.5, height * 0.1, width * 0.9, height * 0.24)
      .fill({ color: palette.sky, alpha: 0.5 })
      .ellipse(width * 0.1, height * 0.95, width * 0.8, height * 0.26)
      .fill({ color: palette.backgroundAccent, alpha: 0.45 })
    this.layout()
    this.renderChrome()
  }

  private get state() {
    return this.history.present
  }

  private objectiveHeight(): number {
    return 46 + Math.max(1, this.level.objectives.length) * 30
  }

  private layout(): void {
    const width = this.width
    const height = this.height
    const objectivesY = 112
    const objectivesH = this.objectiveHeight()
    const controlsH = 68
    const controlsY = height - 22 - controlsH
    const trayY = controlsY - 12 - 112
    const clutchH = this.level.switches.length > 0 ? 48 : 0
    const boardBottom = trayY - 30 - clutchH
    const boardTop = objectivesY + objectivesH + 10
    this.board.resize(16, boardTop, width - 32, Math.max(220, boardBottom - boardTop))
    this.board.setState(this.state, this.evaluation, this.selected)
    this.boardLayer.position.set(0, 0)
    this.trayStart = trayY
  }

  private renderChrome(): void {
    this.layout()
    for (const child of [...this.chrome.children]) child.destroy({ children: true })
    this.chrome.removeChildren()
    const width = this.width
    const objectivesY = 112
    const objectivesH = this.objectiveHeight()

    const back = new IconButton({
      glyph: '←',
      size: 50,
      onTap: () => this.leave(),
    })
    back.position.set(42, 52)
    const pause = new IconButton({ glyph: 'II', size: 50, onTap: () => this.pause(), tone: 'brass' })
    pause.position.set(width - 42, 52)
    this.chrome.addChild(back, pause)

    const title =
      this.mode === 'daily'
        ? 'Daily Garden'
        : this.mode === 'endless'
          ? 'Endless'
          : this.mode === 'zen'
            ? 'Zen Garden'
            : `Garden ${this.levelNumber}`
    const heading = label(title, 30, 0x2c2114, 'bold')
    heading.anchor.set(0.5, 0)
    heading.position.set(width / 2, 26)
    const subtitle = label(
      this.mode === 'journey' || this.mode === 'zen' ? `${this.theme.name} · ${this.theme.tagline}` : this.level.name,
      15,
      0x495c49,
      'bold',
    )
    subtitle.anchor.set(0.5, 0)
    subtitle.position.set(width / 2, 62)
    this.chrome.addChild(heading, subtitle)

    // Objectives card
    const card = new Graphics()
      .roundRect(20, objectivesY, width - 40, objectivesH, 18)
      .fill({ color: 0xf6ead2, alpha: 0.94 })
      .roundRect(20, objectivesY, width - 40, objectivesH, 18)
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.4 })
    this.chrome.addChild(card)
    const cardTitle = label('GARDEN NEEDS', 13, 0x8a7554, 'bold')
    cardTitle.anchor.set(0, 0)
    cardTitle.position.set(38, objectivesY + 12)
    this.chrome.addChild(cardTitle)
    const par = label(`par ${this.level.par} · ${this.moves} used`, 13, 0x8a7554, 'bold')
    par.anchor.set(1, 0)
    par.position.set(width - 38, objectivesY + 12)
    this.chrome.addChild(par)

    this.level.objectives.slice(0, 4).forEach((objective, index) => {
      const result = this.evaluation.objectives[index]
      const y = objectivesY + 34 + index * 30
      const met = result?.met ?? false
      const dot = new Graphics()
        .circle(44, y + 6, 9)
        .fill(met ? 0x5f9f5f : 0xc9a978)
      const tick = label(met ? '✓' : '·', 15, 0xffffff, 'bold')
      tick.anchor.set(0.5)
      tick.position.set(44, y + 6)
      const text = label(describeObjective(objective, this.level), 17, 0x3a2c1a, 'bold')
      text.anchor.set(0, 0)
      text.position.set(62, y - 4)
      this.chrome.addChild(dot, tick, text)
    })

    if (this.status) {
      const statusText = label(this.status, 14, 0x3d523d, 'bold')
      statusText.anchor.set(0.5, 0)
      statusText.position.set(width / 2, this.trayStart - 24)
      this.chrome.addChild(statusText)
    }

    this.renderTray()
    this.renderControls()

    if (this.level.switches.length > 0) {
      const clutchY = this.trayStart - 74
      this.level.switches.forEach((item, index) => {
        const engaged = this.state.switches[item.id] ?? item.initial
        const button = new Button({
          text: `${item.label}: ${engaged ? 'engaged' : 'released'}`,
          width: Math.min(360, width - 60),
          height: 36,
          variant: engaged ? 'primary' : 'soft',
          fontSize: 16,
          onTap: () => {
            this.apply({ type: 'switch', id: item.id, value: !engaged })
            this.ctx.audio.engage()
          },
        })
        button.position.set((width - button.hitWidth) / 2, clutchY + index * 40)
        this.chrome.addChild(button)
      })
    }
  }

  private renderTray(): void {
    const width = this.width
    const trayY = this.trayStart
    const stock = remainingStock(this.level, this.state)
    const trayItems = stock.map((item) => ({ teeth: item.teeth, layer: item.layer, count: item.count }))
    const card = new Graphics()
      .roundRect(20, trayY, width - 40, 100, 18)
      .fill({ color: 0x203024, alpha: 0.72 })
      .roundRect(20, trayY, width - 40, 100, 18)
      .stroke({ width: 1.2, color: 0xffffff, alpha: 0.12 })
    this.chrome.addChild(card)
    const heading = label('GEAR TRAY', 12, 0xd7c9a8, 'bold')
    heading.anchor.set(0, 0)
    heading.position.set(36, trayY + 9)
    this.chrome.addChild(heading)

    if (trayItems.length === 0) {
      const empty = label('All gears fitted', 18, 0xe8dcc2)
      empty.anchor.set(0.5)
      empty.position.set(width / 2, trayY + 58)
      this.chrome.addChild(empty)
      return
    }

    const count = Math.max(1, trayItems.length)
    const slotWidth = Math.min(96, (width - 64) / count)
    const startX = width / 2 - (slotWidth * count) / 2
    trayItems.forEach((item, index) => {
      const x = startX + slotWidth * index + slotWidth / 2
      const selected = this.selected?.teeth === item.teeth && this.selected.layer === item.layer
      const node = new Container()
      const plate = new Graphics()
        .roundRect(-slotWidth / 2 + 4, 0, slotWidth - 8, 66, 14)
        .fill(selected ? 0xf3d79b : 0x3b4f3d)
        .roundRect(-slotWidth / 2 + 4, 0, slotWidth - 8, 66, 14)
        .stroke({ width: selected ? 2.5 : 1, color: selected ? 0xfff4dc : 0xffffff, alpha: selected ? 0.9 : 0.16 })
      const preview = createPreviewGear(item.teeth, Math.min(25, slotWidth * 0.29), item.layer)
      preview.position.set(0, 30)
      const sizeTag = label(`${item.teeth}`, 12, 0x3b2d19, 'bold')
      sizeTag.anchor.set(0, 1)
      sizeTag.position.set(-slotWidth / 2 + 10, 62)
      const countBadge = label(`×${item.count}`, 12, 0xfff1d4, 'bold')
      countBadge.anchor.set(1, 1)
      countBadge.position.set(slotWidth / 2 - 10, 62)
      node.addChild(plate, preview, sizeTag, countBadge)
      node.label = `tray-${item.teeth}-${item.layer}`
      node.position.set(x, trayY + 24)
      node.eventMode = 'static'
      node.cursor = 'pointer'
      node.on('pointertap', () => {
        this.selected = { teeth: item.teeth, layer: item.layer }
        this.ctx.audio.select()
        this.status = `${item.teeth}-tooth gear selected — tap an empty axle.`
        this.renderChrome()
        this.board.setState(this.state, this.evaluation, this.selected)
      })
      this.chrome.addChild(node)
    })
  }

  private renderControls(): void {
    const width = this.width
    const height = this.height
    const y = height - 22 - 68
    const controls: { glyph: string; action: () => void; enabled: boolean }[] = [
      { glyph: '↶', action: () => this.undo(), enabled: this.history.past.length > 0 },
      { glyph: '↷', action: () => this.redo(), enabled: this.history.future.length > 0 },
      { glyph: '⟲', action: () => this.restart(), enabled: this.moves > 0 },
      { glyph: '?', action: () => this.hint(), enabled: !this.won },
    ]
    // Leave the bottom-left corner free: the arcade account button lives there.
    let x = 118
    for (const [index, control] of controls.entries()) {
      const button = new IconButton({ glyph: control.glyph, size: 54, onTap: control.action })
      button.label = ['undo', 'redo', 'reset', 'hint'][index] ?? 'control'
      button.position.set(x, y + 34)
      button.alpha = control.enabled ? 1 : 0.4
      if (!control.enabled) button.eventMode = 'none'
      this.chrome.addChild(button)
      x += 66
    }
    const runWidth = Math.min(250, width - x - 40)
    const run = new Button({
      text: this.running ? 'STOP' : 'RUN',
      width: runWidth,
      height: 62,
      variant: this.running ? 'danger' : 'primary',
      fontSize: 27,
      onTap: () => this.toggleRun(),
    })
    run.label = 'run'
    run.position.set(width - 26 - runWidth, y + 3)
    this.chrome.addChild(run)
  }

  private tapPeg(pegId: string): void {
    if (this.won) return
    const peg = this.level.pegs.find((item) => item.id === pegId)
    if (!peg) return
    this.board.focus = pegId
    const gear = this.state.gears.find((item) => item.peg === pegId)
    if (gear) {
      if (this.level.fixed.some((item) => item.peg === pegId && item.layer === gear.layer)) {
        this.showInfo(pegId)
        return
      }
      this.status = `Removed the ${gear.teeth}-tooth gear. Take your time.`
      this.apply({ type: 'remove', peg: pegId, layer: gear.layer })
      this.ctx.audio.remove()
      return
    }
    if (!this.selected) {
      this.ctx.audio.tap()
      this.status = 'Choose a gear from the tray first.'
      this.renderChrome()
      return
    }
    if (!isSlot(this.level, pegId, this.selected.layer)) {
      this.ctx.audio.error()
      this.status = 'That axle is fixed — only the empty pegs take gears.'
      this.renderChrome()
      return
    }
    if (peg.kind === 'brake') {
      this.ctx.audio.error()
      this.status = 'That axle is braked. A gear there would stall the garden.'
      this.renderChrome()
      return
    }
    this.status = 'Fitted. Press RUN when the train looks right.'
    this.apply({ type: 'place', peg: pegId, layer: this.selected.layer, teeth: this.selected.teeth })
    this.ctx.audio.place()
  }

  private apply(action: Action): void {
    const result = applyAction(this.level, this.state, action)
    if (!result.ok) {
      this.ctx.audio.error()
      this.status = result.error
      this.renderChrome()
      return
    }
    this.history = commit(this.history, result.state)
    this.moves = this.history.past.length
    this.running = false
    this.board.setRunning(false)
    this.refresh()
  }

  private refresh(): void {
    this.evaluation = evaluate(this.level, this.state.gears, this.state.switches)
    if (this.selected && !remainingStock(this.level, this.state).some((item) => item.teeth === this.selected!.teeth && item.layer === this.selected!.layer)) {
      this.selected = null
    }
    this.board.setState(this.state, this.evaluation, this.selected)
    this.renderChrome()
  }

  private undo(): void {
    if (this.history.past.length === 0) return
    this.history = undo(this.history)
    this.moves = this.history.past.length
    this.running = false
    this.board.setRunning(false)
    this.ctx.audio.tap()
    this.status = 'Stepped back one move.'
    this.refresh()
  }

  private redo(): void {
    if (this.history.future.length === 0) return
    this.history = redo(this.history)
    this.moves = this.history.past.length
    this.ctx.audio.tap()
    this.status = 'Restored the next move.'
    this.refresh()
  }

  private restart(): void {
    if (this.won) return
    this.history = createHistory(this.level)
    this.moves = 0
    this.running = false
    this.board.setRunning(false)
    this.selected = null
    this.ctx.audio.remove()
    this.status = 'Fresh garden. Nothing is lost.'
    this.refresh()
  }

  private hint(): void {
    if (this.won) return
    const hint = nextHint(this.level, this.state)
    this.hints += 1
    this.ctx.audio.hint()
    if (!hint.action) {
      this.status = hint.text
      this.ctx.app.toast(hint.text, 'warn')
      this.renderChrome()
      return
    }
    this.board.focus = hint.action.type === 'place' || hint.action.type === 'remove' ? hint.action.peg : null
    const result = applyAction(this.level, this.state, hint.action)
    if (result.ok) {
      this.history = commit(this.history, result.state)
      this.moves = this.history.past.length
      this.status = hint.text
      this.refresh()
      this.ctx.app.toast('A verified step is on the board.', 'good')
    } else {
      this.status = hint.text
      this.renderChrome()
    }
  }

  private toggleRun(): void {
    if (this.won) return
    if (this.running) {
      this.running = false
      this.board.setRunning(false)
      this.status = 'Stopped. Edit freely.'
      this.renderChrome()
      return
    }
    this.running = true
    this.board.setRunning(true)
    this.ctx.audio.motor()
    this.renderChrome()
    if (this.evaluation.solved) {
      this.status = 'Every mechanism is turning!'
      this.win()
      return
    }
    const issue = this.evaluation.failures[0]
    const missing = this.evaluation.objectives.find((item) => !item.met)
    const missingName = missing
      ? missing.objective.kind === 'sync'
        ? 'Both mechanisms'
        : this.descriptionOf(missing.objective.peg)
      : ''
    this.status = issue ?? (missing ? `${missingName}: ${missing.actual}` : 'Not quite yet.')
    this.ctx.audio.error()
    const timer = window.setTimeout(() => {
      if (!this.won) {
        this.running = false
        this.board.setRunning(false)
        this.renderChrome()
      }
    }, 2200)
    this.timers.push(timer)
  }

  private descriptionOf(pegId: string): string {
    return this.level.pegs.find((peg) => peg.id === pegId)?.output?.name ?? 'Mechanism'
  }

  private win(): void {
    if (this.won) return
    this.won = true
    this.running = true
    this.board.setRunning(true)
    this.ctx.audio.win()
    this.status = 'The garden is awake!'
    this.renderChrome()
    this.spawnConfetti()
    const stars = this.moves <= this.level.par ? 3 : this.moves <= this.level.par + 2 ? 2 : 1
    if (this.mode !== 'zen') {
      this.ctx.save.recordLevel(this.level.id, stars, this.moves, this.hints)
      if (this.mode === 'journey') {
        this.ctx.save.unlockThrough(this.levelNumber + 1)
        this.ctx.save.setLastLevel(Math.min(1000, this.levelNumber + 1))
      }
      if (this.mode === 'daily') this.ctx.save.recordDaily(todayKey(), this.moves)
      if (this.mode === 'endless') {
        this.ctx.save.data.endlessBest = Math.max(this.ctx.save.data.endlessBest, this.levelNumber)
        this.ctx.save.write()
      }
      this.checkAchievements()
    }
    const timer = window.setTimeout(() => this.showResults(stars), 2100)
    this.timers.push(timer)
  }

  private checkAchievements(): void {
    const save = this.ctx.save
    const earned = evaluateAchievements({
      solved: save.solvedCount(),
      totalStars: save.totalStars(),
      perfectClears: save.data.perfectClears,
      exactRatioSolved: this.level.mechanics.includes('ratio'),
      endlessBest: save.data.endlessBest,
      dailyStreak: save.data.dailyStreak,
      savedSandbox: save.data.sandbox.length > 0,
    })
    for (const id of earned) {
      if (save.addAchievement(id)) {
        const definition = ACHIEVEMENTS.find((item) => item.id === id)
        if (definition) this.ctx.app.toast(`${definition.glyph}  ${definition.name}`, 'good', 3200)
      }
    }
  }

  private showResults(stars: number): void {
    const save = this.ctx.save
    const best = save.data.levels[this.level.id]?.bestMoves ?? this.moves
    const starLine = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`
    const moveWord = this.moves === 1 ? 'move' : 'moves'
    const body =
      `${starLine}\n${this.moves} ${moveWord} · par ${this.level.par} · best ${best}` +
      (this.hints > 0 ? `\n${this.hints} hint${this.hints === 1 ? '' : 's'} used` : '\nNo hints — beautifully done.') +
      (this.mode === 'daily' ? `\n\nDaily streak: ${save.data.dailyStreak} day${save.data.dailyStreak === 1 ? '' : 's'}` : '')
    const buttons = []
    if (this.mode === 'journey') {
      const next = Math.min(1000, this.levelNumber + 1)
      buttons.push({
        text: this.levelNumber >= 1000 ? 'Back to worlds' : `Next garden · ${next}`,
        variant: 'primary' as const,
        onTap: () => {
          this.ctx.app.closeModal()
          if (this.levelNumber >= 1000) this.ctx.app.navigate('worlds')
          else this.ctx.app.navigate('gameplay', { level: next, mode: 'journey' })
        },
      })
    } else if (this.mode === 'endless') {
      buttons.push({
        text: `Next endless · ${this.levelNumber + 1}`,
        variant: 'primary' as const,
        onTap: () => {
          this.ctx.app.closeModal()
          this.ctx.app.navigate('gameplay', { mode: 'endless', level: this.levelNumber + 1, seed: `${this.level.seed}` })
        },
      })
    } else if (this.mode === 'zen') {
      buttons.push({
        text: 'Another zen garden',
        variant: 'primary' as const,
        onTap: () => {
          this.ctx.app.closeModal()
          this.ctx.app.navigate('gameplay', { mode: 'zen', level: (this.levelNumber % 1000) + 1 })
        },
      })
    } else {
      buttons.push({
        text: 'Back to the arcade',
        variant: 'primary' as const,
        onTap: () => {
          this.ctx.app.closeModal()
          this.ctx.app.navigate('menu')
        },
      })
    }
    buttons.push({
      text: 'Replay this garden',
      variant: 'soft' as const,
      onTap: () => {
        this.ctx.app.closeModal()
        if (this.mode === 'journey' || this.mode === 'zen') {
          this.ctx.app.navigate('gameplay', { level: this.levelNumber, mode: this.mode })
        } else if (this.mode === 'endless') {
          this.ctx.app.navigate('gameplay', { mode: 'endless', level: this.levelNumber, seed: this.level.seed })
        } else {
          this.ctx.app.navigate('gameplay', { mode: this.mode, seed: this.level.id.replace('daily-', '') })
        }
      },
    })
    buttons.push({
      text: this.mode === 'journey' ? 'World map' : 'Main menu',
      variant: 'ghost' as const,
      onTap: () => {
        this.ctx.app.closeModal()
        if (this.mode === 'journey') this.ctx.app.navigate('levels', { world: this.level.world })
        else this.ctx.app.navigate('menu')
      },
    })
    buttons.push({
      text: '☕ Buy me a coffee',
      variant: 'soft' as const,
      onTap: () => openTipJar(),
    })
    const resultTitle =
      this.mode === 'journey'
        ? `Garden ${this.levelNumber} cleared`
        : this.mode === 'zen'
          ? 'Zen garden complete'
          : this.level.name
    this.ctx.app.modal({
      title: resultTitle,
      body,
      buttons,
      onDismiss: () => {
        this.ctx.app.closeModal()
        if (this.mode === 'journey') this.ctx.app.navigate('levels', { world: this.level.world })
        else this.ctx.app.navigate('menu')
      },
    })
  }

  private showInfo(pegId: string): void {
    const peg = this.level.pegs.find((item) => item.id === pegId)
    if (!peg) return
    const gears = this.state.gears.filter((item) => item.peg === pegId)
    const lines: string[] = [`Axle at column ${peg.x + 1}, row ${peg.y + 1}.`]
    if (peg.kind === 'motor' && peg.motor) {
      lines.push(
        `Motor · turns ${peg.motor.direction > 0 ? 'clockwise' : 'anti-clockwise'} at ${toNumber(peg.motor.speed)} turn/s · ${peg.motor.torque} torque.`,
      )
    }
    if (peg.kind === 'brake') lines.push('Braked axle: any gear fitted here will stall.')
    if (peg.output) lines.push(`${peg.output.name}: ${peg.output.need > 0 ? `needs ${peg.output.need} torque` : 'no load'}.`)
    if (gears.length === 0) lines.push('Empty — ready for a gear.')
    for (const gear of gears) {
      const omega = this.evaluation.network.omega.get(nodeId(pegId, gear.layer))
      const layer = gear.layer === 1 ? 'upper shaft' : 'lower shaft'
      const motion = omega
        ? sign(omega) === 0
          ? 'still (braked or unpowered)'
          : `${sign(omega) > 0 ? 'clockwise' : 'anti-clockwise'}, ${abs(omega).n / abs(omega).d} turns/s`
        : 'not connected to a motor'
      lines.push(`${gear.teeth} teeth on the ${layer} · ${motion}.`)
    }
    if (this.level.switches.length > 0) {
      for (const item of this.level.switches) {
        lines.push(`${item.label}: ${this.state.switches[item.id] ? 'engaged' : 'released'}.`)
      }
    }
    this.ctx.audio.tap()
    this.ctx.app.modal({
      title: gears.length > 0 ? `${gears[0]!.teeth}-tooth gear` : 'Empty axle',
      body: lines.join('\n'),
      buttons: [{ text: 'Close', variant: 'soft', onTap: () => this.ctx.app.closeModal() }],
      onDismiss: () => this.ctx.app.closeModal(),
    })
  }

  private pause(): void {
    this.running = false
    this.board.setRunning(false)
    this.ctx.app.modal({
      title: 'Paused',
      body: `${this.theme.name}\n${this.level.name}`,
      buttons: [
        { text: 'Resume', variant: 'primary', onTap: () => this.ctx.app.closeModal() },
        {
          text: 'Restart garden',
          variant: 'soft',
          onTap: () => {
            this.ctx.app.closeModal()
            this.restart()
          },
        },
        {
          text: 'Settings',
          variant: 'soft',
          onTap: () => {
            this.ctx.app.closeModal()
            this.ctx.app.navigate('settings')
          },
        },
        { text: 'Leave garden', variant: 'ghost', onTap: () => this.leave() },
      ],
      onDismiss: () => this.ctx.app.closeModal(),
    })
  }

  private leave(): void {
    if (this.won) {
      if (this.mode === 'journey') this.ctx.app.navigate('levels', { world: this.level.world })
      else this.ctx.app.navigate('menu')
      return
    }
    if (this.moves === 0) {
      if (this.mode === 'journey' || this.mode === 'zen') this.ctx.app.navigate('levels', { world: this.level.world })
      else this.ctx.app.navigate('menu')
      return
    }
    this.ctx.app.modal({
      title: 'Leave the garden?',
      body: 'Your build is not saved, but the garden itself will be waiting.',
      buttons: [
        { text: 'Keep building', variant: 'primary', onTap: () => this.ctx.app.closeModal() },
        {
          text: 'Leave',
          variant: 'ghost',
          onTap: () => {
            this.ctx.app.closeModal()
            if (this.mode === 'journey') this.ctx.app.navigate('levels', { world: this.level.world })
            else this.ctx.app.navigate('menu')
          },
        },
      ],
      onDismiss: () => this.ctx.app.closeModal(),
    })
  }

  private onKey(event: KeyboardEvent): void {
    if (this.ctx.app.hasModal) {
      if (event.key === 'Escape') this.ctx.app.closeModal()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      this.pause()
    } else if (event.key === 'ArrowUp') this.board.moveFocus(0, -1)
    else if (event.key === 'ArrowDown') this.board.moveFocus(0, 1)
    else if (event.key === 'ArrowLeft') this.board.moveFocus(-1, 0)
    else if (event.key === 'ArrowRight') this.board.moveFocus(1, 0)
    else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      this.board.activateFocus()
    } else if (event.key.toLowerCase() === 'u') this.undo()
    else if (event.key.toLowerCase() === 'r') this.restart()
    else if (event.key.toLowerCase() === 'h') this.hint()
    else if (event.key.toLowerCase() === 'z') this.redo()
  }

  private spawnConfetti(): void {
    if (this.ctx.save.data.settings.reducedMotion) return
    const colors = [0xf6cf86, 0xef9ac0, 0x8fd3a8, 0x9fc7ea, 0xe8a66a]
    for (let i = 0; i < 34; i += 1) {
      const piece = new Graphics()
      const color = colors[i % colors.length]!
      if (i % 3 === 0) piece.circle(0, 0, 4 + (i % 4)).fill(color)
      else piece.roundRect(-4, -2, 8, 4, 2).fill(color)
      piece.position.set(this.width / 2 + (Math.random() - 0.5) * this.width * 0.7, this.height * 0.35)
      piece.rotation = Math.random() * Math.PI
      this.fx.addChild(piece)
      this.confetti.push({
        view: piece,
        vx: (Math.random() - 0.5) * 150,
        vy: -120 - Math.random() * 160,
        spin: (Math.random() - 0.5) * 5,
        life: 2.4 + Math.random() * 0.9,
      })
    }
  }

  update(delta: number): void {
    this.board.tick(delta)
    for (const piece of [...this.confetti]) {
      piece.life -= delta
      piece.vy += 260 * delta
      piece.view.x += piece.vx * delta
      piece.view.y += piece.vy * delta
      piece.view.rotation += piece.spin * delta
      if (piece.life <= 0) {
        piece.view.destroy()
        this.confetti = this.confetti.filter((item) => item !== piece)
      }
    }
  }
}

registerScreen('gameplay', (context, params) => new GameplayScreen(context, params))
