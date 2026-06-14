# Changelog

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
