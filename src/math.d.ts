export type Vec3 = [number, number, number]

export function oklchToLinearSrgb(l: number, c: number, h: number): Vec3
export function lchToLinearSrgb(l: number, c: number, h: number): Vec3
export function oklabToLinearSrgb(L: number, a: number, b: number): Vec3
export function labToLinearSrgb(L: number, a: number, b: number): Vec3

export function srgbLinearToP3Linear(r: number, g: number, b: number): Vec3
export function srgbLinearToRec2020Linear(r: number, g: number, b: number): Vec3
export function srgbLinearToA98Linear(r: number, g: number, b: number): Vec3
export function srgbLinearToProphotoLinear(r: number, g: number, b: number): Vec3

export function srgbFromLinear(n: number): number

export interface MaxChromaLUTOptions {
  /** Polar model the chart renders */
  model?: 'oklch' | 'lch'
  /** Fixed hue (degrees) */
  hue: number
  /** Gamut to fill */
  gamut?: 'srgb' | 'p3' | 'a98' | 'rec2020' | 'prophoto'
  /** Entry count; defaults to the shader's shared 128 */
  size?: number
}

/**
 * Build a per-row chroma stretch LUT for `paint({ chromaLUT })`. Entry i is the
 * max in-gamut chroma at normalized lightness i/(size-1), for a fixed hue, found
 * by binary search on the same colordx math the shader runs.
 */
export function maxChromaLUT(opts: MaxChromaLUTOptions): Float32Array
