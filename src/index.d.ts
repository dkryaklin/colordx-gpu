/**
 * The slice plane to render. Polar planes apply to `oklch` / `lch`:
 * - `'cl'` — x: lightness, y: chroma, fixed hue (the H chart)
 * - `'ch'` — x: hue, y: chroma, fixed lightness (the L chart)
 * - `'lh'` — x: hue, y: lightness, fixed chroma (the C chart)
 *
 * Cartesian planes apply to `oklab` / `lab` (a/b span negatives — set
 * `xMin`/`yMin`):
 * - `'ab'` — x: a, y: b, fixed L
 * - `'la'` — x: L, y: a, fixed b
 * - `'lb'` — x: L, y: b, fixed a
 */
export type ChartPlane = 'ch' | 'cl' | 'lh' | 'ab' | 'la' | 'lb'

export type BorderRgba = [number, number, number, number] | Float32Array

/** A renderable gamut. Gamuts are independent layers, not a fixed nesting. */
export type GamutSpace = 'srgb' | 'p3' | 'a98' | 'rec2020' | 'prophoto'

export interface GamutLayer {
  space: GamutSpace
  /** Add this gamut's in-gamut region to the painted union */
  fill?: boolean
  /**
   * Draw this gamut's own boundary line (its zero-contour), in this color.
   * Layers composite in array order, so a later layer's line wins where two
   * non-nested boundaries (e.g. a98 vs p3) cross.
   */
  border?: BorderRgba
}

export interface ChartPaintOptions {
  plane: ChartPlane
  /** The fixed component, in the model's native scale */
  value: number
  /** Component value at the left edge (default 0; set negative for an a/b axis) */
  xMin?: number
  /** Component value at the right edge (e.g. 360 for hue, L_MAX for lightness) */
  xMax: number
  /** Component value at the bottom edge (default 0; set negative for an a/b axis) */
  yMin?: number
  /** Component value at the top edge (e.g. C_MAX) */
  yMax: number
  /**
   * Per-row chroma stretch LUT (polar models, `'cl'` plane only). Max in-gamut
   * chroma sampled along the lightness axis — entry i at normalized lightness
   * i/(length-1) — so the gamut edge fills the chroma axis instead of sitting at
   * an absolute coordinate. Build it with `math.maxChromaLUT(...)`. Omit for
   * absolute coordinates. Ignored on planes/models where it has no axis.
   */
  chromaLUT?: Float32Array
  /**
   * Radial chroma stretch LUT (Cartesian models, `'ab'` plane only). Max in-gamut
   * chroma sampled around the hue circle — entry i at hue 360*i/length degrees —
   * so the gamut edge maps to a unit radius and the slice fills the square as a
   * disc instead of a small centered blob. The `a`/`b` axes are read as the
   * normalized direction, so set `xMin`/`yMin` = -1 and `xMax`/`yMax` = 1. Build
   * it with `math.maxChromaRadialLUT(...)`. Omit for absolute a/b coordinates.
   * Ignored on planes/models where it has no axis.
   */
  radialLUT?: Float32Array
  /**
   * Gamuts to render, as ordered layers. Fill is the union of every layer with
   * `fill: true`; each `border` draws that gamut's own edge in list order. No
   * containment is assumed, so nested (p3 ⊂ rec2020) and sibling (a98 vs p3)
   * gamuts render the same way. Wide-gamut fills display clamped to the output
   * space; the boundary line marks the true extent.
   *
   * Preferred over the legacy `show*`/`border*` flags. If omitted, those flags
   * are mapped onto an equivalent layer list for backward compatibility.
   */
  gamuts?: GamutLayer[]
  /**
   * Swap which screen axis each component occupies (e.g. put chroma on x and
   * lightness on y for a `'cl'` slice). `xMax`/`yMax` stay bound to their
   * components, so the same maxes work transposed or not.
   */
  transpose?: boolean
  /**
   * Boundary line width in device pixels (default 1 — a hairline, half a
   * CSS pixel on a 2× display). Lines are anti-aliased, so fractional
   * widths work.
   */
  borderWidth?: number
  /** Encode output for a display-p3 drawing buffer (wide-gamut displays) */
  p3Output?: boolean

  /** @deprecated Use `gamuts` instead. Also paint the P3 region. */
  showP3?: boolean
  /** @deprecated Use `gamuts` instead. Also paint the Rec.2020 region. */
  showRec2020?: boolean
  /** @deprecated Use `gamuts` instead. RGBA 0–1 for the sRGB↔P3 boundary line. */
  borderP3?: BorderRgba
  /** @deprecated Use `gamuts` instead. RGBA 0–1 for the P3↔Rec2020 (or sRGB↔Rec2020) boundary line. */
  borderRec2020?: BorderRgba
}

export interface ChartRenderer {
  readonly canvas: HTMLCanvasElement
  /** The underlying WebGL2 context, for readback, sharing, or benchmarking */
  readonly gl: WebGL2RenderingContext
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
  /**
   * Color model. Polar: `'oklch'` (default) or CIE `'lch'` (D50). Cartesian:
   * `'oklab'` or CIE `'lab'` (D50) — same math, axes are a/b instead of C/H.
   */
  model?: 'oklch' | 'lch' | 'oklab' | 'lab'
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
