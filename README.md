# @colordx/gpu

[![npm version](https://img.shields.io/npm/v/@colordx/gpu?labelColor=764be5&color=ffc200)](https://www.npmjs.com/package/@colordx/gpu)
[![bundle size](https://img.shields.io/bundlejs/size/@colordx/gpu?labelColor=764be5&color=ffc200)](https://bundlejs.com/?q=@colordx/gpu)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-ffc200?labelColor=764be5)](https://github.com/dkryaklin/colordx-gpu/blob/main/package.json)
[![MIT license](https://img.shields.io/badge/license-MIT-ffc200?labelColor=764be5)](https://github.com/dkryaklin/colordx-gpu/blob/main/LICENSE)

[**@colordx/core**](https://github.com/dkryaklin/colordx)'s color math, running on the GPU.

**The idea:** a color library converts one color at a time, and on the CPU that's the right tool for app logic. But a whole class of color work is *per-pixel*: gamut visualizations, picker charts, gradients, image filters. There you don't want to convert a color — you want to convert **millions of them, every frame**. `@colordx/gpu` takes colordx's conversions — OKLCH/OKLab, CIE LCH/Lab (D50), Display-P3, Rec.2020, gamut tests — and generates GLSL from the library's own constants, so the exact same math runs in a shader at GPU speed. A parity test suite locks the two implementations together: if colordx's math ever changes, the build fails before the shader can drift.

What that buys you in practice: work that costs tens of milliseconds across a full worker pool on the CPU takes **well under a millisecond** as a single GPU draw — fast enough to recompute every visible pixel on every frame of a slider drag, at any canvas size up to fullscreen.

**What ships today** is the first module built on that foundation: a gamut-slice chart renderer (the core of every OKLCH/LCH picker UI) — slice planes through the color space with sRGB / Display-P3 / Rec.2020 classification and crisp gamut-boundary lines. Next up: the GLSL chunks as public API so you can compose colordx math into your own shaders, gradient strips, and a WebGPU batch-conversion path — see the [Roadmap](#roadmap).

## Performance

Measured in the [oklch-picker](https://github.com/evilmartians/oklch-picker) integration (three charts, full repaint on a component change), using the picker's built-in `?bench` overlay. Headless Chrome with software GL — real GPUs are faster still:

| | Chart paint | Worker time |
|---|---|---|
| **@colordx/gpu** | **~5 ms** | — (single main-thread draw, ~1 ms submit) |
| CPU worker pool | 30 ms (warm) – 950 ms (cold) | 30–930 ms across all cores |

## Install

```bash
npm install @colordx/gpu
```

No runtime dependencies. `@colordx/core` is not required at runtime — the relevant math is baked into the generated shader and verified against the library by the test suite.

## Quick start

```js
import { createChartRenderer } from '@colordx/gpu';

const renderer = createChartRenderer(canvas, { model: 'oklch' });
if (!renderer) {
  // WebGL2 unavailable — fall back to your CPU painting path.
}

renderer.paint({
  plane: 'cl',            // x: lightness, y: chroma, fixed hue
  value: 264,             // the fixed component (hue here)
  xMax: 1,                // lightness at the right edge
  yMax: 0.37,             // chroma at the top edge
  showP3: true,
  showRec2020: false,
  borderP3: [1, 1, 1, 1],         // RGBA 0–1 for the sRGB↔P3 line
  borderRec2020: [1, 1, 1, 1],    // RGBA 0–1 for the P3↔Rec2020 line
  p3Output: true,         // encode for a display-p3 drawing buffer
});
```

Each `paint()` is one full-canvas draw — call it as often as you like (every frame during a slider drag is fine).

## API

### `createChartRenderer(canvas, options?)`

Creates a WebGL2 renderer on the canvas. Returns `null` when WebGL2 is unavailable — keep a CPU fallback for that case.

> **One-way door:** a canvas that has handed out a WebGL context can never provide a `'2d'` context again. Decide GPU vs CPU per canvas *before* the first paint.

| Option | Default | Description |
|---|---|---|
| `model` | `'oklch'` | `'oklch'` or `'lch'` (CIE LCH, D50 white point, CSS Color 4 semantics) |

### `renderer.paint(opts)`

Renders one gamut slice. Returns `false` while the WebGL context is lost (it re-initializes automatically on restore).

| Option | Description |
|---|---|
| `plane` | `'cl'` (x: L, y: C, fixed H) · `'ch'` (x: H, y: C, fixed L) · `'lh'` (x: H, y: L, fixed C) |
| `value` | The fixed component, in the model's native scale (OKLCH: L 0–1, C ~0–0.4; LCH: L 0–100, C ~0–150) |
| `xMax`, `yMax` | Component values at the right / top edges |
| `showP3` | Also paint the P3-only region (sRGB-only pixels otherwise) |
| `showRec2020` | Also paint the Rec.2020-only region |
| `borderP3`, `borderRec2020` | RGBA arrays (0–1) for the boundary lines |
| `p3Output` | Encode output as Display-P3 and switch the drawing buffer to `display-p3` (Chrome 104+, Safari 16.4+; silently stays sRGB elsewhere) |

Pixels outside every enabled gamut are transparent. Boundary lines are analytic contours of the gamut overflow field (`fwidth`-based), so they stay ~1.5 px crisp at any canvas size or DPR.

### `renderer.destroy()`

Releases the WebGL context.

### `math`

The JS twin of the shader math, exported for reference and testing:

```js
import { math } from '@colordx/gpu';
math.oklchToLinearSrgb(0.7, 0.1, 150);  // [r, g, b] linear, unclamped
```

## Parity with @colordx/core

The GLSL is generated from [`src/constants.js`](src/constants.js), which mirrors colordx's source constants — OKLab matrices, the Lab D50 path with Bradford adaptation, P3 and Rec.2020 primaries. `npm test` verifies the constants-based math against `@colordx/core` itself over a dense sample grid (agreement < 1e-9; the GPU then runs the same math in float32, more than enough for rendering). If colordx's math ever changes, the parity test fails before the shader can drift.

## Demo

```bash
npm run demo
```

opens a live three-plane chart demo (vite). Or see it in production shape inside [oklch-picker](https://github.com/evilmartians/oklch-picker), where this package replaces a `hardwareConcurrency`-wide worker pool — add `?bench` to compare, `?nogpu` to force the CPU path.

## Browser support

WebGL2 — all evergreen browsers (~98% global). `display-p3` output additionally needs Chrome 104+ / Safari 16.4+; on other browsers wide-gamut colors are clipped to sRGB for display (classification is unaffected). `createChartRenderer` returns `null` rather than throwing when unsupported.

## Roadmap

- **v0.2 — `@colordx/gpu/glsl`**: the conversion and gamut-test shader chunks as documented public API, so you can compose colordx math into your own shaders.
- **v0.3 — gradient strips**: a 1D renderer for slider tracks and gradient previews (the other half of every color-picker UI).
- **v0.4 — `@colordx/gpu/batch`**: WebGPU compute path — `convertBatch(Float32Array, from, to)` for bulk numeric conversion with async readback, for workloads that need numbers back, not pixels.
- **Later**: 3D gamut-body renderer, WGSL chunk variants, OffscreenCanvas/worker rendering, generated-from-source constants (import directly from `@colordx/core` at build time).

## Ecosystem

- [**@colordx/core**](https://github.com/dkryaklin/colordx) — the color library this package renders for: parsing, conversion, manipulation, gamut mapping. [colordx.dev](https://colordx.dev)
- [**oklch-picker**](https://github.com/evilmartians/oklch-picker) — OKLCH color picker; first production consumer of this renderer.

## License

[MIT](LICENSE) © Dmitrii Kriaklin
