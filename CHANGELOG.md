# Changelog

## 0.1.2

Fix: `destroy()` no longer force-loses the WebGL context. A canvas can only ever produce one WebGL context, so losing it permanently broke any later renderer created on the same canvas — most visibly a React StrictMode double-mount, where `createChartRenderer` on the remount threw a shader compile error. `destroy()` now releases the program and makes the renderer inert; `createChartRenderer` also returns `null` for an already-lost context instead of throwing.

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
