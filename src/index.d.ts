/**
 * The slice plane to render:
 * - `'cl'` — x: lightness, y: chroma, fixed hue (the H chart)
 * - `'ch'` — x: hue, y: chroma, fixed lightness (the L chart)
 * - `'lh'` — x: hue, y: lightness, fixed chroma (the C chart)
 */
export type ChartPlane = 'ch' | 'cl' | 'lh'

export type BorderRgba = [number, number, number, number] | Float32Array

export interface ChartPaintOptions {
  /** RGBA 0–1 for the sRGB↔P3 boundary line */
  borderP3: BorderRgba
  /** RGBA 0–1 for the P3↔Rec2020 (or sRGB↔Rec2020) boundary line */
  borderRec2020: BorderRgba
  /** Encode output for a display-p3 drawing buffer (wide-gamut displays) */
  p3Output?: boolean
  plane: ChartPlane
  showP3: boolean
  showRec2020: boolean
  /** The fixed component, in the model's native scale */
  value: number
  /** Component value at the right edge (e.g. 360 for hue, L_MAX for lightness) */
  xMax: number
  /** Component value at the top edge (e.g. C_MAX) */
  yMax: number
}

export interface ChartRenderer {
  readonly canvas: HTMLCanvasElement
  /**
   * Release GPU resources and make the renderer inert. Does not lose the
   * WebGL context (a canvas can only ever produce one), so a new renderer
   * can be created on the same canvas afterwards.
   */
  destroy(): void
  /** Render a slice; returns false while the WebGL context is lost */
  paint(opts: ChartPaintOptions): boolean
}

export interface ChartRendererOptions {
  /** Color model: OKLCH (default) or CIE LCH (D50) */
  model?: 'lch' | 'oklch'
}

/**
 * Create a WebGL2 chart renderer on the canvas, or null when WebGL2 is
 * unavailable. Note: the canvas can no longer provide a '2d' context after
 * this succeeds — decide GPU vs CPU before the first paint.
 */
export function createChartRenderer(
  canvas: HTMLCanvasElement,
  options?: ChartRendererOptions
): ChartRenderer | null

export * as math from './math.js'
