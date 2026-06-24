# Changelog

## 0.4.0

- **a98-rgb and prophoto-rgb gamuts.** Adds the Adobe RGB (1998) and ProPhoto (ROMM) wide gamuts, with matrices copied from `@colordx/core@5.5.0` and parity-tested against its plugins so classification matches the library exactly.
- **Gamuts are now independent layers, not a fixed nesting.** New `paint()` option `gamuts` — an ordered list of `{ space, fill?, border? }` layers (`'srgb' | 'p3' | 'a98' | 'rec2020' | 'prophoto'`). Fill is the union of every `fill: true` layer; each `border` draws that gamut's own edge, composited in array order. Nested gamuts (p3 ⊂ rec2020) and siblings (a98 vs p3) render the same way, so one renderer backs both an OKLCH picker (overlaid nested regions) and a wide-gamut picker (a single working gamut over an sRGB reference).
- The legacy `showP3` / `showRec2020` / `borderP3` / `borderRec2020` options still work — they map onto equivalent layers — but are deprecated in favour of `gamuts`.

## 0.3.0

- `renderer.gl` exposes the underlying WebGL2 context, so integrators can read back, share state, or benchmark the renderer end-to-end (e.g. with `gl.finish()`) instead of treating it as a black box.
- New `paint()` option `transpose` swaps which screen axis each component occupies — e.g. chroma on x and lightness on y for a `cl` slice. `xMax`/`yMax` stay bound to their components, so the same maxes work in either orientation.
- Internal: shader comments live in JS now, never inside the emitted GLSL strings — a minifier can't strip `//` from a string literal, so they no longer ship in bundles. No behaviour change.

## 0.2.1

- Boundary lines are crisp again: a hard step instead of an anti-aliased feather, so each line is a solid strip of the border colour rather than a ramp that pastels into the gamut fill. Width is measured with `length(grad)` so curved boundaries stay uniform.

## 0.2.0

- Boundary lines are anti-aliased hairlines (1 device pixel by default) instead of a ~1.5 px opaque band that read too heavy on HiDPI displays. New `paint()` option `borderWidth` (device pixels, fractional values work) for thicker lines.
- Chart output now matches a fp64 CPU painter of the same math: `floor(255 * v)` quantization, corner-of-pixel sampling, and dithering disabled. Remaining differences are ±1 on a channel where fp32 lands on the other side of a quantization edge.
- `destroy()` no longer force-loses the WebGL context (a canvas can only ever produce one), so a new renderer can be created on the same canvas — fixes React StrictMode double-mounts. `createChartRenderer` returns `null` for an already-lost context instead of throwing.

## 0.1.1

Docs: README and package description reframed around the core idea — colordx's color math as generated GLSL for per-pixel workloads — with the chart renderer positioned as the first module. No code changes.

## 0.1.0

Initial release.

- `createChartRenderer(canvas, { model })` — WebGL2 renderer for OKLCH / CIE LCH (D50) gamut-slice charts
- Three slice planes (`cl`, `ch`, `lh`) with sRGB / Display-P3 / Rec.2020 classification
- Crisp gamut-boundary lines drawn as analytic contours (`fwidth`-based, DPR-independent)
- Optional `display-p3` drawing-buffer output for wide-gamut displays
- Context-loss recovery; returns `null` without WebGL2 so callers can keep a CPU fallback
- Shader GLSL generated from constants mirrored from `@colordx/core`, guarded by parity tests against the published library
