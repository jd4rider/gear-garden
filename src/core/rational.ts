// Exact rational arithmetic. Gear ratios are compared and propagated as
// reduced integer fractions, so a solved puzzle never depends on floating-point
// rounding and `1/3 * 3` is exactly 1.

export interface Rational {
  readonly n: number
  readonly d: number
}

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

export function rat(n: number, d = 1): Rational {
  if (!Number.isFinite(n) || !Number.isFinite(d)) throw new Error(`bad rational ${n}/${d}`)
  if (d === 0) throw new Error('rational with zero denominator')
  const flip = d < 0 ? -1 : 1
  const g = gcd(n, d)
  const numerator = (flip * n) / g
  return { n: numerator === 0 ? 0 : numerator, d: (flip * d) / g }
}

export const ZERO = rat(0)
export const ONE = rat(1)

export const add = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d)
export const sub = (a: Rational, b: Rational): Rational => rat(a.n * b.d - b.n * a.d, a.d * b.d)
export const mul = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d)
export const div = (a: Rational, b: Rational): Rational => rat(a.n * b.d, a.d * b.n)
export const neg = (a: Rational): Rational => rat(-a.n, a.d)
export const abs = (a: Rational): Rational => rat(Math.abs(a.n), a.d)
export const sign = (a: Rational): -1 | 0 | 1 => (a.n > 0 ? 1 : a.n < 0 ? -1 : 0)
export const isZero = (a: Rational): boolean => a.n === 0
export const equals = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d
export const toNumber = (a: Rational): number => a.n / a.d
export const key = (a: Rational): string => `${a.n}/${a.d}`

export function parse(value: unknown): Rational | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { n?: unknown; d?: unknown }
  if (typeof record.n !== 'number' || typeof record.d !== 'number') return null
  if (!Number.isInteger(record.n) || !Number.isInteger(record.d) || record.d === 0) return null
  return rat(record.n, record.d)
}

/** Human label for a ratio, e.g. `1/2`, `2`, `7/5`. */
export function label(value: Rational): string {
  if (value.d === 1) return `${value.n}`
  return `${value.n}/${value.d}`
}

/** “1/2 speed”, “2× speed”, “same speed”. */
export function speedLabel(value: Rational): string {
  if (value.n === 0) return 'stopped'
  if (value.d === 1 && Math.abs(value.n) === 1) return 'same speed'
  if (value.d === 1 && value.n > 0) return `${value.n}× speed`
  return `${label(abs(value))} speed`
}

export function compare(a: Rational, b: Rational): number {
  return a.n * b.d - b.n * a.d
}
