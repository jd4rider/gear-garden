import { Container, Graphics, Rectangle } from 'pixi.js'
import type { Evaluation } from '../mechanics/objectives'
import type { Level, Layer, Peg, WorldTheme } from '../core/types'
import type { LevelState } from '../core/state'
import { nodeId } from '../mechanics/network'
import { label } from './theme'
import { createGear, drawAxle } from './gearArt'
import { createMechanism, type Mechanism } from './gardenArt'

export interface BoardCallbacks {
  onTap: (pegId: string) => void
  onHold: (pegId: string) => void
}

interface GearVisual {
  rotor: Container
  node: string
  omega: number
  radius: number
}

const HOLD_MS = 520

/**
 * Layered 2.5D board: plate, belts, axles, shadowed gears, mechanisms. All
 * geometry derives from the level grid; the renderer never decides rules.
 */
export class BoardView extends Container {
  readonly content = new Container()
  private level: Level
  private theme: WorldTheme
  private callbacks: BoardCallbacks
  private state: LevelState | null = null
  private evaluation: Evaluation | null = null
  private selected: { teeth: number; layer: Layer } | null = null
  private gears: GearVisual[] = []
  private mechanisms: { peg: string; view: Mechanism; layer: Layer }[] = []
  private cell = 80
  private ox = 0
  private oy = 0
  private minX = 0
  private minY = 0
  private area = { x: 0, y: 0, width: 680, height: 600 }
  private running = false
  private time = 0
  private pressPeg: string | null = null
  private pressTimer: number | null = null
  private held = false
  private focusRing = new Graphics()
  focus: string | null = null

  constructor(level: Level, theme: WorldTheme, callbacks: BoardCallbacks) {
    super()
    this.level = level
    this.theme = theme
    this.callbacks = callbacks
    this.addChild(this.content)
    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.on('pointerdown', this.handleDown)
    this.on('pointerup', this.handleUp)
    this.on('pointerupoutside', this.handleUp)
    this.on('pointercancel', this.handleUp)
  }

  setLevel(level: Level, theme: WorldTheme): void {
    this.level = level
    this.theme = theme
    this.gears = []
    this.mechanisms = []
    this.render()
  }

  setState(state: LevelState, evaluation: Evaluation | null, selected: { teeth: number; layer: Layer } | null): void {
    this.state = state
    this.evaluation = evaluation
    this.selected = selected
    this.render()
  }

  setRunning(running: boolean): void {
    this.running = running
  }

  isRunning(): boolean {
    return this.running
  }

  resize(x: number, y: number, width: number, height: number): void {
    this.area = { x, y, width, height }
    this.position.set(x, y)
    this.hitArea = new Rectangle(0, 0, width, height)
    this.render()
  }

  get layout(): { cell: number; ox: number; oy: number } {
    return { cell: this.cell, ox: this.ox, oy: this.oy }
  }

  private pegX(peg: Peg): number {
    return this.ox + (peg.x - this.minX + 0.5) * this.cell
  }

  private pegY(peg: Peg): number {
    return this.oy + (peg.y - this.minY + 0.5) * this.cell
  }

  /** Screen-space centre of an axle, used by tests and accessibility tooling. */
  pegPoint(pegId: string): { x: number; y: number } | null {
    const peg = this.level.pegs.find((item) => item.id === pegId)
    if (!peg) return null
    const point = this.toGlobal({ x: this.pegX(peg), y: this.pegY(peg) })
    return { x: point.x, y: point.y }
  }

  private handleDown = (event: { getLocalPosition: (target: Container) => { x: number; y: number } }): void => {
    const local = event.getLocalPosition(this)
    const peg = this.nearestPeg(local.x, local.y)
    this.pressPeg = peg?.id ?? null
    this.held = false
    if (this.pressTimer !== null) window.clearTimeout(this.pressTimer)
    if (peg) {
      this.focus = peg.id
      this.pressTimer = window.setTimeout(() => {
        this.held = true
        this.callbacks.onHold(peg.id)
      }, HOLD_MS)
    }
  }

  private handleUp = (): void => {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer)
      this.pressTimer = null
    }
    if (this.pressPeg && !this.held) this.callbacks.onTap(this.pressPeg)
    this.pressPeg = null
    this.held = false
  }

  private nearestPeg(x: number, y: number): Peg | null {
    let best: Peg | null = null
    let bestDistance = this.cell * 0.62
    for (const peg of this.level.pegs) {
      const px = this.pegX(peg)
      const py = this.pegY(peg)
      const distance = Math.hypot(px - x, py - y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = peg
      }
    }
    return best
  }

  /** Keyboard focus travel, used by the board's accessibility controls. */
  moveFocus(dx: number, dy: number): void {
    const pegs = [...this.level.pegs].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    if (pegs.length === 0) return
    if (!this.focus) {
      this.focus = pegs[0]!.id
      this.render()
      return
    }
    const current = pegs.find((peg) => peg.id === this.focus)
    if (!current) {
      this.focus = pegs[0]!.id
      this.render()
      return
    }
    let best: Peg | null = null
    let bestScore = Number.POSITIVE_INFINITY
    for (const peg of pegs) {
      if (peg.id === current.id) continue
      const vx = peg.x - current.x
      const vy = peg.y - current.y
      const forward = vx * dx + vy * dy
      if (forward <= 0) continue
      const side = Math.abs(vx * dy - vy * dx)
      const score = Math.hypot(vx, vy) + side * 1.5
      if (score < bestScore) {
        bestScore = score
        best = peg
      }
    }
    this.focus = (best ?? current).id
    this.render()
  }

  activateFocus(): void {
    if (!this.focus) {
      this.focus = this.level.pegs[0]?.id ?? null
      this.render()
      return
    }
    this.callbacks.onTap(this.focus)
  }

  tick(deltaSeconds: number): void {
    this.time += deltaSeconds
    this.pulse()
    if (this.evaluation) {
      for (const gear of this.gears) {
        const omega = this.evaluation.network.omega.get(gear.node)
        const rate = omega ? omega.n / omega.d : 0
        if (this.running && rate !== 0) gear.rotor.rotation += rate * Math.PI * 2 * deltaSeconds
      }
      for (const item of this.mechanisms) {
        const omega = this.evaluation.network.omega.get(nodeId(item.peg, item.layer))
        const rate = omega ? omega.n / omega.d : 0
        item.view.update(this.time * 1000, this.running && rate !== 0, rate)
      }
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    if (this.pressTimer !== null) window.clearTimeout(this.pressTimer)
    super.destroy(options)
  }

  private render(): void {
    const { width, height } = this.area
    const xs = this.level.pegs.map((peg) => peg.x)
    const ys = this.level.pegs.map((peg) => peg.y)
    this.minX = xs.length ? Math.min(...xs) : 0
    this.minY = ys.length ? Math.min(...ys) : 0
    const cols = xs.length ? Math.max(...xs) - this.minX + 1 : 1
    const rows = ys.length ? Math.max(...ys) - this.minY + 1 : 1
    this.cell = Math.min(width / (cols + 1.15), height / (rows + 1.25))
    this.cell = Math.max(52, Math.min(this.cell, 204))
    this.ox = (width - cols * this.cell) / 2
    this.oy = (height - rows * this.cell) / 2

    for (const child of [...this.content.children]) child.destroy({ children: true })
    this.content.removeChildren()
    this.gears = []
    this.mechanisms = []
    this.focusRing = new Graphics()

    const plateX = this.ox - this.cell * 0.32
    const plateY = this.oy - this.cell * 0.32
    const plateW = cols * this.cell + this.cell * 0.64
    const plateH = rows * this.cell + this.cell * 0.64
    const plate = new Graphics()
      .roundRect(plateX + 3, plateY + 8, plateW, plateH, this.cell * 0.16)
      .fill({ color: 0x120d07, alpha: 0.32 })
      .roundRect(plateX, plateY, plateW, plateH, this.cell * 0.15)
      .fill(this.theme.palette.rim)
      .roundRect(plateX + 4, plateY + 4, plateW - 8, plateH - 8, this.cell * 0.13)
      .fill(this.theme.palette.boardDark)
      .roundRect(plateX + 6, plateY + 5, plateW - 12, plateH - 16, this.cell * 0.12)
      .fill(this.theme.palette.board)
      .roundRect(plateX + 10, plateY + 9, plateW - 20, plateH * 0.42, this.cell * 0.1)
      .fill({ color: 0xffffff, alpha: 0.1 })
      .roundRect(plateX, plateY, plateW, plateH, this.cell * 0.15)
      .stroke({ width: 2, color: this.theme.palette.rim, alpha: 0.85 })
    this.content.addChild(plate)

    // Wood grain: a handful of soft arcs keeps the plate from reading flat.
    const grain = new Graphics()
    for (let i = 1; i < 5; i += 1) {
      const y = plateY + (plateH / 5) * i
      grain
        .moveTo(plateX + plateW * 0.1, y)
        .bezierCurveTo(plateX + plateW * 0.35, y - 5, plateX + plateW * 0.65, y + 6, plateX + plateW * 0.9, y)
        .stroke({ width: 1, color: this.theme.palette.rim, alpha: 0.16 })
    }
    this.content.addChild(grain)

    for (const [x, y] of [
      [plateX + 16, plateY + 16],
      [plateX + plateW - 16, plateY + 16],
      [plateX + 16, plateY + plateH - 16],
      [plateX + plateW - 16, plateY + plateH - 16],
    ] as const) {
      grain.circle(x, y, 3.2).fill({ color: this.theme.palette.rim, alpha: 0.5 })
    }

    this.drawBelts()
    this.drawAxles()

    if (this.state) {
      const sorted = [...this.state.gears].sort((a, b) => a.layer - b.layer)
      for (const gear of sorted) this.drawGear(gear.peg, gear.layer, gear.teeth)
      this.drawMechanisms()
    }
    this.drawFocus()
    this.content.addChild(this.focusRing)
  }

  private drawBelts(): void {
    const belts = new Graphics()
    for (const belt of this.level.belts) {
      const a = this.level.pegs.find((peg) => peg.id === belt.a)
      const b = this.level.pegs.find((peg) => peg.id === belt.b)
      if (!a || !b) continue
      const ax = this.pegX(a)
      const ay = this.pegY(a)
      const bx = this.pegX(b)
      const by = this.pegY(b)
      const width = Math.max(5, this.cell * 0.11)
      if (belt.crossed) {
        belts
          .moveTo(ax, ay)
          .lineTo(bx, by)
          .stroke({ width, color: 0x3a2a18, alpha: 0.85 })
          .moveTo(ax, by)
          .lineTo(bx, ay)
          .stroke({ width: width * 0.8, color: 0x3a2a18, alpha: 0.85 })
      } else {
        belts
          .moveTo(ax, ay)
          .lineTo(bx, by)
          .stroke({ width, color: 0x3a2a18, alpha: 0.85 })
          .moveTo(ax, ay)
          .lineTo(bx, by)
          .stroke({ width: width * 0.55, color: 0x6d4a2c, alpha: 0.9 })
      }
      belts
        .circle(ax, ay, width * 0.9)
        .fill(0x2a1c10)
        .circle(bx, by, width * 0.9)
        .fill(0x2a1c10)
    }
    this.content.addChild(belts)
  }

  private drawAxles(): void {
    const layer = new Graphics()
    for (const peg of this.level.pegs) {
      const x = this.pegX(peg)
      const y = this.pegY(peg)
      const hasGear = this.state?.gears.some((gear) => gear.peg === peg.id) ?? false
      const isSlot = this.level.slots.some((slot) => slot.peg === peg.id)
      const compatible =
        this.selected && this.state && isSlot && !hasGear && this.level.slots.some((slot) => slot.peg === peg.id && slot.layer === this.selected!.layer)

      layer.ellipse(x, y + this.cell * 0.06, this.cell * 0.25, this.cell * 0.1).fill({ color: 0x1a1208, alpha: 0.2 })
      const radius = this.cell * 0.19
      drawAxle(layer, x, y, radius, 0xb08a58)

      if (!hasGear) {
        layer.circle(x, y, radius * 0.52).fill(0x2a1d10)
        layer.circle(x, y, radius * 0.32).fill(0x120c06)
        if (isSlot) {
          layer
            .circle(x, y, this.cell * 0.34)
            .stroke({ width: 2, color: compatible ? 0xffe9a8 : 0xfff4dc, alpha: compatible ? 0.95 : 0.28 })
        }
      }

      if (peg.kind === 'motor') this.drawMotor(layer, x, y, peg)
      if (peg.kind === 'brake') {
        layer
          .circle(x, y, this.cell * 0.3)
          .stroke({ width: 3, color: 0xd9614f, alpha: 0.9 })
          .circle(x, y, this.cell * 0.22)
          .stroke({ width: 1.5, color: 0xd9614f, alpha: 0.5 })
      }
    }
    this.content.addChild(layer)
  }

  private drawMotor(g: Graphics, x: number, y: number, peg: Peg): void {
    const size = this.cell * 0.34
    const direction = peg.motor?.direction ?? 1
    g.roundRect(x - size, y + size * 0.55, size * 2, size * 0.7, size * 0.2)
      .fill({ color: 0x1a1208, alpha: 0.25 })
      .roundRect(x - size, y + size * 0.4, size * 2, size * 0.7, size * 0.2)
      .fill(0x3d5b3f)
      .roundRect(x - size, y + size * 0.4, size * 2, size * 0.32, size * 0.16)
      .fill({ color: 0x6f8f63, alpha: 0.9 })
      .roundRect(x - size, y + size * 0.4, size * 2, size * 0.7, size * 0.2)
      .stroke({ width: 1.2, color: 0x22331f })
    const glyph = label(direction > 0 ? '↻' : '↺', this.cell * 0.24, 0xfff1c8, 'bold')
    glyph.anchor.set(0.5)
    glyph.position.set(x, y + size * 0.75)
    this.content.addChild(glyph)
  }

  private drawGear(pegId: string, layer: Layer, teeth: number): void {
    const peg = this.level.pegs.find((item) => item.id === pegId)
    if (!peg) return
    const x = this.pegX(peg)
    const y = this.pegY(peg) - (layer === 1 ? this.cell * 0.06 : 0)
    const radius = (teeth / 24) * this.cell
    const fixed = this.level.fixed.some((gear) => gear.peg === pegId && gear.layer === layer)
    const view = createGear(teeth, radius, layer, { locked: fixed })
    view.position.set(x, y)
    view.rotation = ((peg.x * 7 + peg.y * 13 + layer * 3) % 12) * 0.05
    this.content.addChild(view)
    const rotor = view.getChildByLabel('rotor') as Container
    const omega = this.evaluation?.network.omega.get(nodeId(pegId, layer))
    this.gears.push({ rotor, node: nodeId(pegId, layer), omega: omega ? omega.n / omega.d : 0, radius })
  }

  private drawMechanisms(): void {
    for (const peg of this.level.pegs) {
      if (!peg.output) continue
      const layer: Layer = this.state?.gears.some((gear) => gear.peg === peg.id && gear.layer === 1) ? 1 : 0
      const x = this.pegX(peg)
      const y = this.pegY(peg)
      const view = createMechanism(peg.output.kind, this.cell * 0.78, this.theme)
      view.position.set(x, y - this.cell * 0.52)
      this.content.addChild(view)
      this.mechanisms.push({ peg: peg.id, view, layer })
      const name = label(peg.output.name, Math.max(11, this.cell * 0.14), 0x3a2a17, 'bold')
      name.anchor.set(0.5)
      name.position.set(0, this.cell * 0.62)
      view.addChild(name)
    }
  }

  private drawFocus(): void {
    if (!this.focus) return
    const peg = this.level.pegs.find((item) => item.id === this.focus)
    if (!peg) return
    const x = this.pegX(peg)
    const y = this.pegY(peg)
    this.focusRing
      .circle(x, y, this.cell * 0.4)
      .stroke({ width: 2.5, color: 0xfff4d0, alpha: 0.75 })
  }

  /** Airy idle lift for the selection ring, called from the scene ticker. */
  pulse(): void {
    const alpha = 0.45 + Math.sin(this.time * 3) * 0.2
    this.focusRing.alpha = alpha
  }

  get gearCount(): number {
    return this.gears.length
  }

  get mechanismList(): { peg: string; view: Mechanism }[] {
    return this.mechanisms.map(({ peg, view }) => ({ peg, view }))
  }
}
