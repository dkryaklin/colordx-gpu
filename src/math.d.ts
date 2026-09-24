export type Vec3 = [number, number, number]

export function oklchToLinearSrgb(l: number, c: number, h: number): Vec3
export function lchToLinearSrgb(l: number, c: number, h: number): Vec3
export function oklabToLinearSrgb(L: number, a: number, b: number): Vec3
export function labToLinearSrgb(L: number, a: number, b: number): Vec3

/**
 * Okhsl → linear sRGB, unclamped (Björn Ottosson's picker space; JS twin of the
 * `okhsl` shader). h in degrees, s and l in 0–100 — the scale core's `toOkhsl()`
 * reports. l ≥ 100 is white, l ≤ 0 is black. s = 100 can overshoot the gamut by
 * a hair (the reference's cusp fit is a polynomial); clamp before encoding.
 */
export function okhslToLinearSrgb(h: number, s: number, l: number): Vec3
/**
 * Okhsv → linear sRGB, unclamped (JS twin of the `okhsv` shader). h in degrees,
 * s and v in 0–100 — the scale core's `toOkhsv()` reports. s = v = 100 is the
 * gamut cusp for that hue; the cusp fit can overshoot by a hair, so clamp.
 */
export function okhsvToLinearSrgb(h: number, s: number, v: number): Vec3

export function srgbLinearToP3Linear(r: number, g: number, b: number): Vec3
export function srgbLinearToRec2020Linear(r: number, g: number, b: number): Vec3
export function srgbLinearToA98Linear(r: number, g: number, b: number): Vec3
export function srgbLinearToProphotoLinear(r: number, g: number, b: number): Vec3

export function srgbFromLinear(n: number): number

export type ChromaModel = 'oklch' | 'lch' | 'oklab' | 'lab'
export type ChromaGamut = 'srgb' | 'p3' | 'a98' | 'rec2020' | 'prophoto'

export interface MaxChromaOptions {
  /** Model (a Cartesian name means its polar twin: oklab → oklch, lab → lch). Default `'oklch'` */
  model?: ChromaModel
  /** Fixed lightness (model's native range: 0..1 for ok*, 0..100 for CIE) */
  lightness: number
  /** Fixed hue (degrees) */
  hue: number
  /** Gamut to test against. Default `'srgb'` */
  gamut?: ChromaGamut
}

/**
 * Max in-gamut chroma at one (lightness, hue) point — the value the LUT
 * builders sample on a grid. Clamp a picker's chroma with it, or place a handle
 * on the true gamut edge. Returns 0 when the achromatic color at that lightness
 * is already out of gamut. Throws `RangeError` on an unknown model or gamut,
 * `TypeError` on a non-finite lightness or hue.
 */
export function maxChroma(opts: MaxChromaOptions): number

export interface MaxChromaLUTOptions {
  /** Model the chart renders (a Cartesian name means its polar twin). Default `'oklch'` */
  model?: ChromaModel
  /** Fixed hue (degrees) */
  hue: number
  /** Gamut to fill. Default `'srgb'` */
  gamut?: ChromaGamut
  /** Entry count (any length ≥ 2; the renderer reads the array's length). Default 128 */
  size?: number
}

/**
 * Build a per-row chroma stretch LUT for `paint({ chromaLUT })`. Entry i is the
 * max in-gamut chroma at normalized lightness i/(size-1), for a fixed hue, found
 * by binary search on the same colordx math the shader runs. Throws on an
 * unknown model/gamut or a non-finite hue.
 */
export function maxChromaLUT(opts: MaxChromaLUTOptions): Float32Array

export interface MaxChromaRadialLUTOptions {
  /** Model the chart renders (oklab/lab, or their polar twins). Default `'oklch'` */
  model?: ChromaModel
  /** Fixed lightness (model's native range: 0..1 oklab, 0..100 lab) */
  lightness: number
  /** Gamut to fill. Default `'srgb'` */
  gamut?: ChromaGamut
  /** Entry count (any length ≥ 2; the renderer reads the array's length). Default 128 */
  size?: number
}

/**
 * Build a radial (hue-swept) max-chroma LUT for `paint({ radialLUT })` on the
 * Cartesian `'ab'` plane. Entry i is the max in-gamut chroma at hue 360*i/size
 * degrees, for a fixed lightness — periodic, so the renderer wraps the last entry
 * back to the first. Built by the same binary search as `maxChromaLUT`.
 */
export function maxChromaRadialLUT(opts: MaxChromaRadialLUTOptions): Float32Array

/**
 * Read a `maxChromaLUT` the way the shader does: linear interpolation between
 * the two nearest entries, clamped at the ends, at normalized lightness `t`
 * (= L / L_MAX, 0..1). Puts a picker handle exactly where the GPU drew the
 * stretched edge: `screenY = chroma / sampleChromaLUT(lut, L / L_MAX)`.
 */
export function sampleChromaLUT(lut: ArrayLike<number>, t: number): number

/**
 * Read a `maxChromaRadialLUT` the way the shader does: linear interpolation on
 * the periodic hue grid (entry i at 360·i/length degrees, wrapping the last entry
 * back to the first). `hue` is in degrees and may be outside 0..360.
 * Maps a picker's (a, b) onto the disc the GPU drew: `r = chroma / sampleRadialLUT(lut, hue)`.
 */
export function sampleRadialLUT(lut: ArrayLike<number>, hue: number): number
