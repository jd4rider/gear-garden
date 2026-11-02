import { MESH_SUM, PITCH_RADIUS, type Teeth } from '../core/types'

/** Pitch radius in lattice units. */
export const pitchRadius = (teeth: number): number => teeth * PITCH_RADIUS

/** Two meshing gears must have tooth counts adding up to MESH_SUM. */
export const meshes = (a: number, b: number): boolean => a + b === MESH_SUM

/** True when the pair would physically overlap (sum larger than the gap). */
export const collides = (a: number, b: number): boolean => a + b > MESH_SUM

export const isOrthogonalNeighbour = (ax: number, ay: number, bx: number, by: number): boolean =>
  Math.abs(ax - bx) + Math.abs(ay - by) === 1

/**
 * Where a gear tooth sits at a given rotation, used for phase alignment so two
 * meshed gears never appear to grind through each other.
 */
export function toothAngle(teeth: number, index: number): number {
  return (index / teeth) * Math.PI * 2
}

/** The rotation that lines a gear's teeth up with a neighbour's gaps. */
export function meshPhase(driverTeeth: number, driverAngle: number, followerTeeth: number): number {
  const step = (Math.PI * 2) / followerTeeth
  const half = (Math.PI * 2) / driverTeeth / 2
  const target = -(driverAngle * (driverTeeth / followerTeeth))
  return target + (half % step) / 2
}

/** A rough tooth count for a gear that can mesh with `teeth`. */
export function complement(teeth: Teeth): Teeth {
  const value = MESH_SUM - teeth
  if (value >= 8 && value <= 16 && value % 2 === 0) return value as Teeth
  return 12
}
