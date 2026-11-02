import { Text, TextStyle } from 'pixi.js'

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif'

export const UI = {
  cream: 0xfff4dc,
  ink: 0x2c2114,
  inkSoft: 0x5d4b34,
  brass: 0xe3ad55,
  brassDark: 0x9a6c28,
  copper: 0xcf8354,
  copperDark: 0x8a4f2d,
  steel: 0xb9c2c8,
  wood: 0x8c6239,
  danger: 0xd9614f,
  mint: 0x82c891,
  sky: 0xbfe3ea,
  white: 0xffffff,
  shadow: 0x2a1c0e,
} as const

export const textStyle = (size: number, color: number, weight: 'normal' | 'bold' = 'normal'): TextStyle =>
  new TextStyle({
    fontFamily: FONT,
    fontSize: size,
    fontWeight: weight,
    fill: color,
    align: 'center',
    wordWrap: false,
  })

export function label(
  text: string,
  size: number,
  color: number = UI.cream,
  weight: 'normal' | 'bold' = 'normal',
): Text {
  return new Text({ text, style: textStyle(size, color, weight) })
}

export function wrapLabel(
  text: string,
  size: number,
  color: number,
  width: number,
  weight: 'normal' | 'bold' = 'normal',
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT,
      fontSize: size,
      fontWeight: weight,
      fill: color,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: width,
      lineHeight: size * 1.32,
    }),
  })
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t)
