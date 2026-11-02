import { Container, Graphics } from 'pixi.js'
import type { OutputKind, WorldTheme } from '../core/types'

export interface Mechanism extends Container {
  kind: OutputKind
  /** Animate with the shaft: `rate` is turns per second (signed). */
  update(time: number, powered: boolean, rate: number): void
}

export const toColor = (value: string | number): number => {
  if (typeof value === 'number') return value
  const clean = value.replace('#', '')
  const parsed = Number.parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
  return Number.isFinite(parsed) ? parsed : 0xffffff
}

const shade = (color: string | number, factor: number): number => {
  const base = toColor(color)
  const r = Math.min(255, Math.max(0, Math.round(((base >> 16) & 0xff) * factor)))
  const g = Math.min(255, Math.max(0, Math.round(((base >> 8) & 0xff) * factor)))
  const b = Math.min(255, Math.max(0, Math.round((base & 0xff) * factor)))
  return (r << 16) | (g << 8) | b
}

function petal(g: Graphics, angle: number, length: number, width: number, color: string | number): void {
  const x = Math.cos(angle) * length * 0.55
  const y = Math.sin(angle) * length * 0.55
  g.ellipse(x, y, length * 0.5, width * 0.5)
    .fill(color)
  g.ellipse(x, y, length * 0.5, width * 0.5)
    .stroke({ width: 1, color: shade(color, 0.7), alpha: 0.55 })
}

export function createMechanism(kind: OutputKind, size: number, theme: WorldTheme): Mechanism {
  const root = new Container() as Mechanism
  root.kind = kind
  const flower = theme.palette.flower
  const accent = theme.palette.accent
  const foliage = theme.palette.foliage
  let phase = 0

  const base = new Graphics()
  base.ellipse(0, size * 0.38, size * 0.34, size * 0.12).fill({ color: 0x1a1208, alpha: 0.28 })
  root.addChild(base)

  if (kind === 'windmill') {
    const tower = new Graphics()
      .poly([-size * 0.16, size * 0.36, size * 0.16, size * 0.36, size * 0.11, -size * 0.16, -size * 0.11, -size * 0.16])
      .fill(0xf2e3c3)
      .stroke({ width: 1.5, color: 0x8a6a42 })
      .poly([-size * 0.13, size * 0.08, size * 0.13, size * 0.08, size * 0.16, size * 0.24, -size * 0.16, size * 0.24])
      .fill(accent)
    const rotor = new Container()
    for (let i = 0; i < 4; i += 1) {
      const blade = new Graphics()
        .roundRect(-size * 0.035, -size * 0.5, size * 0.07, size * 0.45, size * 0.03)
        .fill(0xfff6e0)
        .roundRect(-size * 0.035, -size * 0.5, size * 0.07, size * 0.45, size * 0.03)
        .stroke({ width: 1, color: 0x9c7a4b })
      blade.rotation = (i / 4) * Math.PI * 2
      rotor.addChild(blade)
    }
    rotor.addChild(new Graphics().circle(0, 0, size * 0.07).fill(0x8a5a2a))
    const hub = new Graphics().circle(0, 0, size * 0.05).fill(0xf7d796)
    rotor.addChild(hub)
    rotor.position.set(0, -size * 0.12)
    root.addChild(tower, rotor)
    root.update = (time, powered, rate) => {
      phase += powered ? rate * 0.12 : 0
      rotor.rotation = phase + time * (powered ? 0.0006 * rate : 0)
    }
  } else if (kind === 'flower') {
    const stem = new Graphics()
      .roundRect(-size * 0.025, -size * 0.02, size * 0.05, size * 0.4, size * 0.02)
      .fill(foliage)
    const leaves = new Graphics()
      .ellipse(-size * 0.1, size * 0.2, size * 0.11, size * 0.05)
      .fill(shade(foliage, 0.92))
      .ellipse(size * 0.09, size * 0.27, size * 0.1, size * 0.045)
      .fill(shade(foliage, 0.85))
    const bloom = new Container()
    for (let i = 0; i < 7; i += 1) {
      const g = new Graphics()
      petal(g, (i / 7) * Math.PI * 2, size * 0.42, size * 0.2, i % 2 === 0 ? flower : shade(flower, 1.12))
      bloom.addChild(g)
    }
    bloom.addChild(new Graphics().circle(0, 0, size * 0.1).fill(0xffe9a8).circle(0, 0, size * 0.04).fill(0xd99a2b))
    bloom.position.set(0, -size * 0.12)
    root.addChild(stem, leaves, bloom)
    root.update = (time, powered, rate) => {
      const target = powered ? 1 : 0.6
      bloom.scale.x += (target - bloom.scale.x) * 0.08
      bloom.scale.y = bloom.scale.x
      bloom.rotation = powered ? Math.sin(time * 0.0006) * 0.16 + (rate < 0 ? phase : 0) : 0
      if (powered) phase += rate * 0.004
      bloom.y = -size * 0.12 - bloom.scale.y * size * 0.02
    }
  } else if (kind === 'fountain') {
    const basin = new Graphics()
      .ellipse(0, size * 0.26, size * 0.36, size * 0.12)
      .fill(0x8fb9c4)
      .ellipse(0, size * 0.23, size * 0.33, size * 0.1)
      .fill(0xbfe3ea)
      .ellipse(0, size * 0.23, size * 0.2, size * 0.055)
      .fill(0xdcf2f6)
    const jet = new Graphics()
      .roundRect(-size * 0.03, -size * 0.28, size * 0.06, size * 0.5, size * 0.03)
      .fill({ color: 0xd9f3f7, alpha: 0.82 })
    const drops: Graphics[] = []
    for (let i = 0; i < 6; i += 1) {
      const drop = new Graphics().circle(0, 0, size * 0.035).fill({ color: 0xdff6f9, alpha: 0.95 })
      drops.push(drop)
      root.addChild(drop)
    }
    root.addChild(basin, jet)
    root.update = (time, powered) => {
      phase = powered ? time * 0.0032 : 0
      jet.visible = powered
      for (const [i, drop] of drops.entries()) {
        const t = (time * 0.0012 + i / drops.length) % 1
        const spread = size * 0.32 * t
        drop.visible = powered
        drop.x = Math.cos(i * 1.7) * spread
        drop.y = -size * 0.3 + Math.sin(t * Math.PI) * size * 0.36
        drop.alpha = 0.9 - t * 0.55
        void phase
      }
    }
  } else if (kind === 'butterfly') {
    const body = new Graphics()
      .ellipse(0, 0, size * 0.045, size * 0.19)
      .fill(0x4a3a2a)
      .circle(0, -size * 0.2, size * 0.045)
      .fill(0x4a3a2a)
    const left = new Graphics()
      .ellipse(-size * 0.12, -size * 0.03, size * 0.13, size * 0.19)
      .fill(flower)
      .ellipse(-size * 0.12, -size * 0.03, size * 0.13, size * 0.19)
      .stroke({ width: 1.2, color: shade(flower, 0.7) })
    const right = new Graphics()
      .ellipse(size * 0.12, -size * 0.03, size * 0.13, size * 0.19)
      .fill(shade(flower, 1.1))
      .ellipse(size * 0.12, -size * 0.03, size * 0.13, size * 0.19)
      .stroke({ width: 1.2, color: shade(flower, 0.7) })
    left.pivot.set(0, 0)
    right.pivot.set(0, 0)
    root.addChild(left, right, body)
    root.update = (time, powered) => {
      const flap = powered ? Math.sin(time * 0.012) * 0.5 + 0.5 : 0.1
      left.scale.x = 0.45 + flap * 0.65
      right.scale.x = 0.45 + flap * 0.65
      body.y = powered ? Math.sin(time * 0.002) * size * 0.03 : 0
    }
  } else if (kind === 'bell') {
    const arch = new Graphics()
      .roundRect(-size * 0.06, -size * 0.36, size * 0.12, size * 0.2, size * 0.04)
      .fill(0x7d5a33)
      .rect(-size * 0.026, -size * 0.48, size * 0.052, size * 0.14)
      .fill(0x7d5a33)
    const bell = new Container()
    const shell = new Graphics()
      .poly([
        -size * 0.06,
        -size * 0.12,
        size * 0.06,
        -size * 0.12,
        size * 0.2,
        size * 0.18,
        -size * 0.2,
        size * 0.18,
      ])
      .fill(0xe0ac4c)
      .stroke({ width: 1.2, color: 0x8a5f1d })
      .circle(0, -size * 0.12, size * 0.05)
      .fill(0xe8b95e)
      .ellipse(0, size * 0.19, size * 0.21, size * 0.05)
      .fill(0xc98f2f)
    const clapper = new Graphics().circle(0, size * 0.22, size * 0.05).fill(0x8a5f1d)
    bell.addChild(shell, clapper)
    bell.pivot.set(0, -size * 0.1)
    root.addChild(arch, bell)
    root.update = (time, powered, rate) => {
      if (powered) phase += Math.abs(rate) * 0.02
      bell.rotation = powered ? Math.sin(phase + time * 0.008) * 0.24 : 0
    }
  } else if (kind === 'ferris') {
    const frame = new Graphics()
      .moveTo(0, 0)
      .lineTo(-size * 0.22, size * 0.36)
      .moveTo(0, 0)
      .lineTo(size * 0.22, size * 0.36)
      .stroke({ width: size * 0.035, color: 0xc9a06a })
    const wheel = new Container()
    wheel.addChild(new Graphics().circle(0, 0, size * 0.34).stroke({ width: 2, color: 0xe8cf9e }))
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2
      const spoke = new Graphics()
        .moveTo(0, 0)
        .lineTo(Math.cos(angle) * size * 0.34, Math.sin(angle) * size * 0.34)
        .stroke({ width: 1.5, color: 0xe8cf9e })
      const cabin = new Graphics()
        .roundRect(-size * 0.05, -size * 0.05, size * 0.1, size * 0.1, size * 0.03)
        .fill(i % 2 === 0 ? flower : accent)
      cabin.position.set(Math.cos(angle) * size * 0.36, Math.sin(angle) * size * 0.36)
      spoke.addChild(cabin)
      wheel.addChild(spoke)
    }
    wheel.addChild(new Graphics().circle(0, 0, size * 0.05).fill(0xd6b072))
    wheel.position.set(0, -size * 0.08)
    root.addChild(frame, wheel)
    root.update = (time, powered, rate) => {
      if (powered) phase += rate * 0.018
      wheel.rotation = phase
      void time
    }
  } else if (kind === 'bird') {
    const body = new Graphics()
      .ellipse(0, 0, size * 0.16, size * 0.11)
      .fill(accent)
      .circle(size * 0.15, -size * 0.08, size * 0.08)
      .fill(accent)
      .poly([size * 0.22, -size * 0.08, size * 0.3, -size * 0.04, size * 0.22, -size * 0.02])
      .fill(0xe0a63a)
      .circle(size * 0.17, -size * 0.11, size * 0.015)
      .fill(0x2a2014)
    const wing = new Graphics()
      .ellipse(0, 0, size * 0.14, size * 0.06)
      .fill(shade(accent, 1.25))
    wing.position.set(-size * 0.02, -size * 0.04)
    root.addChild(body, wing)
    root.update = (time, powered) => {
      wing.rotation = powered ? Math.sin(time * 0.014) * 0.5 : -0.15
    }
  } else {
    const basePlate = new Graphics()
      .roundRect(-size * 0.18, size * 0.2, size * 0.36, size * 0.1, size * 0.04)
      .fill(0x8a6a42)
      .circle(0, size * 0.2, size * 0.03)
      .fill(0xd9b06a)
    const arm = new Container()
    const bar = new Graphics().roundRect(-size * 0.24, -size * 0.02, size * 0.48, size * 0.04, size * 0.02).fill(0xc9a06a)
    const nozzle = new Graphics().circle(size * 0.24, 0, size * 0.035).fill(0x8fb9c4)
    arm.addChild(bar, nozzle)
    arm.position.set(0, -size * 0.02)
    root.addChild(basePlate, arm)
    const drops: Graphics[] = []
    for (let i = 0; i < 5; i += 1) {
      const drop = new Graphics().circle(0, 0, size * 0.022).fill({ color: 0xd9f3f7, alpha: 0.9 })
      drops.push(drop)
      root.addChild(drop)
    }
    root.update = (time, powered, rate) => {
      if (powered) phase += rate * 0.01
      arm.rotation = phase
      for (const [index, drop] of drops.entries()) {
        const t = (time * 0.001 + index / drops.length) % 1
        drop.visible = powered
        drop.x = Math.cos(phase) * (size * 0.2 + t * size * 0.18)
        drop.y = -size * 0.02 - Math.sin(t * Math.PI) * size * 0.16 + Math.sin(phase) * (size * 0.1 + t * size * 0.1)
        drop.alpha = 1 - t
      }
    }
  }

  if (!root.update) {
    root.update = () => {}
  }
  return root
}
