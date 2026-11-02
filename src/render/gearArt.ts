import { Container, Graphics } from 'pixi.js'
import type { Layer } from '../core/types'

export interface GearPalette {
  face: number
  faceLight: number
  faceDark: number
  side: number
  rim: number
  tooth: number
}

export const LAYER_PALETTE: Record<Layer, GearPalette> = {
  0: {
    face: 0xd9a441,
    faceLight: 0xf3cf82,
    faceDark: 0xa87526,
    side: 0x7d531a,
    rim: 0x8b5e1d,
    tooth: 0xe8b95e,
  },
  1: {
    face: 0xc97b4a,
    faceLight: 0xeda87a,
    faceDark: 0x8f5030,
    side: 0x6c3a21,
    rim: 0x7a4125,
    tooth: 0xdb9160,
  },
}

const WOOD_PALETTE: GearPalette = {
  face: 0xb98952,
  faceLight: 0xd8ae77,
  faceDark: 0x8b6034,
  side: 0x63432a,
  rim: 0x6f4b2a,
  tooth: 0xc79a64,
}

export const paletteFor = (layer: Layer, variant?: 'brass' | 'wood'): GearPalette =>
  variant === 'wood' ? WOOD_PALETTE : LAYER_PALETTE[layer]

/**
 * Cog silhouette: four points per tooth, alternating between the root and the
 * tip radius with a small flat top. Kept in local coordinates around (0,0).
 */
export function gearOutline(teeth: number, radius: number): number[] {
  const points: number[] = []
  const root = radius * 0.82
  const tip = radius
  const pitch = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i += 1) {
    const base = i * pitch
    const angles = [base, base + pitch * 0.18, base + pitch * 0.46, base + pitch * 0.64]
    const radii = [root, tip, tip, root]
    for (let j = 0; j < 4; j += 1) {
      const angle = angles[j]!
      const r = radii[j]!
      points.push(Math.cos(angle) * r, Math.sin(angle) * r)
    }
  }
  return points
}

/** Draws a complete toy gear into a fresh container. */
export function createGear(
  teeth: number,
  radius: number,
  layer: Layer,
  options: { selected?: boolean; variant?: 'brass' | 'wood'; locked?: boolean } = {},
): Container {
  const palette = paletteFor(layer, options.variant)
  const root = new Container()
  const shadow = new Graphics()
  shadow
    .ellipse(2, radius * 0.28, radius * 0.94, radius * 0.82)
    .fill({ color: 0x1d1308, alpha: options.selected ? 0.32 : 0.22 })
  root.addChild(shadow)

  const rotor = new Container()
  rotor.label = 'rotor'
  const depth = new Graphics()
  depth.poly(gearOutline(teeth, radius * 0.985)).fill(palette.side)
  depth.position.set(0, radius * 0.07)
  rotor.addChild(depth)

  const body = new Graphics()
  body.poly(gearOutline(teeth, radius)).fill(palette.face)
  body.poly(gearOutline(teeth, radius)).stroke({ width: Math.max(1, radius * 0.035), color: palette.rim, alpha: 0.85 })
  body
    .circle(0, 0, radius * 0.78)
    .fill(palette.faceLight)
    .circle(0, radius * 0.09, radius * 0.78)
    .fill({ color: palette.faceDark, alpha: 0.28 })
    .circle(0, -radius * 0.04, radius * 0.7)
    .fill(palette.face)

  // Spokes: five rounded cut-outs read as a cast toy gear.
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + 0.3
    body
      .ellipse(Math.cos(angle) * radius * 0.4, Math.sin(angle) * radius * 0.4, radius * 0.19, radius * 0.12)
      .fill({ color: palette.faceDark, alpha: 0.42 })
  }
  body
    .circle(0, 0, radius * 0.27)
    .fill(palette.faceDark)
    .circle(0, 0, radius * 0.2)
    .fill(palette.rim)
    .circle(0, 0, radius * 0.11)
    .fill(0x241a0e)
  body
    .arc(0, 0, radius * 0.62, Math.PI * 1.08, Math.PI * 1.62)
    .stroke({ width: radius * 0.07, color: 0xffffff, alpha: 0.32 })
  rotor.addChild(body)

  if (options.selected) {
    const ring = new Graphics()
    ring.circle(0, 0, radius * 1.03).stroke({ width: 3.5, color: 0xfff0c4, alpha: 0.95 })
    root.addChild(ring)
  }
  if (options.locked) {
    const bolt = new Graphics()
    bolt
      .circle(radius * 0.62, -radius * 0.62, radius * 0.17)
      .fill(0x3a2a18)
      .circle(radius * 0.62, -radius * 0.62, radius * 0.1)
      .fill(0xd9c08a)
    rotor.addChild(bolt)
  }
  root.addChild(rotor)
  root.rotation = 0
  return root
}

/** A small preview gear for the tray, already fitted to the requested size. */
export function createPreviewGear(teeth: number, radius: number, layer: Layer): Container {
  return createGear(teeth, radius, layer)
}

export function drawAxle(g: Graphics, x: number, y: number, radius: number, color: number): void {
  g.circle(x, y + 3, radius).fill({ color: 0x1a1208, alpha: 0.3 })
  g.circle(x, y, radius).fill(color)
  g.circle(x, y - radius * 0.1, radius * 0.86).fill({ color: 0xffffff, alpha: 0.14 })
  g.circle(x, y, radius * 0.42).fill(0x2b2014)
  g.circle(x, y, radius * 0.22).fill(0x0e0a05)
}
