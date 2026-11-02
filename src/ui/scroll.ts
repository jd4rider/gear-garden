import { Container, Graphics } from 'pixi.js'

/** Vertically scrollable, mask-clipped panel. Works with touch, wheel and drag. */
export class ScrollView extends Container {
  readonly content = new Container()
  private readonly maskShape = new Graphics()
  private widthValue = 400
  private heightValue = 600
  private dragging = false
  private startY = 0
  private startOffset = 0
  private velocity = 0
  private lastY = 0
  private lastTime = 0

  constructor(width: number, height: number) {
    super()
    this.widthValue = width
    this.heightValue = height
    this.addChild(this.content, this.maskShape)
    this.content.mask = this.maskShape
    this.eventMode = 'static'
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= this.widthValue && y <= this.heightValue }
    this.on('pointerdown', this.onDown)
    this.on('pointermove', this.onMove)
    this.on('pointerup', this.onUp)
    this.on('pointerupoutside', this.onUp)
    this.on('wheel', (event: { deltaY: number }) => {
      this.content.y -= event.deltaY
      this.clamp()
    })
    this.drawMask()
  }

  private drawMask(): void {
    this.maskShape.clear().rect(0, 0, this.widthValue, this.heightValue).fill(0xffffff)
  }

  resize(width: number, height: number): void {
    this.widthValue = width
    this.heightValue = height
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= width && y <= height }
    this.drawMask()
    this.clamp()
  }

  private onDown = (event: { global: { y: number } }): void => {
    this.dragging = true
    this.startY = event.global.y
    this.startOffset = this.content.y
    this.lastY = event.global.y
    this.lastTime = performance.now()
    this.velocity = 0
  }

  private onMove = (event: { global: { y: number } }): void => {
    if (!this.dragging) return
    const delta = event.global.y - this.startY
    const now = performance.now()
    const dt = Math.max(1, now - this.lastTime)
    this.velocity = ((event.global.y - this.lastY) / dt) * 16
    this.lastY = event.global.y
    this.lastTime = now
    this.content.y = this.startOffset + delta
    this.clamp()
  }

  private onUp = (): void => {
    this.dragging = false
  }

  update(): void {
    if (this.dragging) return
    if (Math.abs(this.velocity) > 0.4) {
      this.content.y += this.velocity
      this.velocity *= 0.9
      this.clamp()
    }
  }

  private clamp(): void {
    const max = 0
    const min = Math.min(0, this.heightValue - this.content.height - 8)
    if (this.content.y > max) {
      this.content.y = max
      this.velocity = 0
    }
    if (this.content.y < min) {
      this.content.y = min
      this.velocity = 0
    }
  }

  scrollTo(y: number): void {
    this.content.y = y
    this.clamp()
  }
}
