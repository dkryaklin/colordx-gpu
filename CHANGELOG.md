# Changelog

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
