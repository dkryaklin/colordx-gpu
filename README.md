# @colordx/gpu

[![npm version](https://img.shields.io/npm/v/@colordx/gpu?labelColor=764be5&color=ffc200)](https://www.npmjs.com/package/@colordx/gpu)
[![bundle size](https://img.shields.io/bundlejs/size/@colordx/gpu?labelColor=764be5&color=ffc200)](https://bundlejs.com/?q=@colordx/gpu)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-ffc200?labelColor=764be5)](https://github.com/dkryaklin/colordx-gpu/blob/main/package.json)
[![MIT license](https://img.shields.io/badge/license-MIT-ffc200?labelColor=764be5)](https://github.com/dkryaklin/colordx-gpu/blob/main/LICENSE)

Experimental companion to [**@colordx/core**](https://github.com/dkryaklin/colordx) ([colordx.dev](https://colordx.dev)) that runs its color math on the GPU for maximum speed when rendering gamut colors. Read the story behind it in [this blog post](https://dkryaklin.com/blog/colordx-gpu).

The library's OKLCH/LCH conversions and gamut tests are generated as GLSL and verified against `@colordx/core` by a parity test suite, so the exact same math runs in a shader. The first module built on that foundation is a WebGL2 gamut-slice chart renderer — the core of every OKLCH/LCH picker UI.

## Install

```bash
npm install @colordx/gpu
```

## Quick start

```js
import { createChartRenderer } from '@colordx/gpu';

const renderer = createChartRenderer(canvas, { model: 'oklch' });
if (!renderer) {
  // WebGL2 unavailable — fall back to your CPU painting path.
}

renderer.paint({
  plane: 'cl',          // x: lightness, y: chroma, fixed hue
  value: 264,           // the fixed component (hue here)
  xMax: 1,              // lightness at the right edge
  yMax: 0.37,           // chroma at the top edge
  showP3: true,
  borderP3: [1, 1, 1, 1],   // RGBA 0–1 for the sRGB↔P3 boundary line
  p3Output: true,       // encode for a display-p3 drawing buffer
});
```

Each `paint()` is one full-canvas draw — call it as often as you like, every frame during a slider drag is fine.

## API

### `createChartRenderer(canvas, options?)`

Creates a WebGL2 renderer on the canvas. Returns `null` when WebGL2 is unavailable — keep a CPU fallback for that case.

> **One-way door:** a canvas that has handed out a WebGL context can never provide a `'2d'` context again. Decide GPU vs CPU per canvas *before* the first paint.

| Option | Default | Description |
|---|---|---|
| `model` | `'oklch'` | `'oklch'` or `'lch'` (CIE LCH, D50 white point) |

### `renderer.paint(opts)`

Renders one gamut slice. Returns `false` while the WebGL context is lost (it re-initializes automatically on restore).

| Option | Description |
|---|---|
| `plane` | `'cl'` (x: L, y: C, fixed H) · `'ch'` (x: H, y: C, fixed L) · `'lh'` (x: H, y: L, fixed C) |
| `transpose` | Swap which screen axis each component occupies (default `false`); `xMax`/`yMax` stay bound to their components |
| `value` | The fixed component, in the model's native scale |
| `xMax`, `yMax` | Component values at the right / top edges |
| `showP3`, `showRec2020` | Also paint the P3-only / Rec.2020-only regions |
| `borderP3`, `borderRec2020` | RGBA arrays (0–1) for the boundary lines |
| `borderWidth` | Boundary line width in device pixels (default `1`) |
| `p3Output` | Encode output as Display-P3 (Chrome 104+, Safari 16.4+; silently stays sRGB elsewhere) |

### `renderer.destroy()`

Releases the WebGL context.

### `math`

The JS twin of the shader math, exported for reference and testing:

```js
import { math } from '@colordx/gpu';
math.oklchToLinearSrgb(0.7, 0.1, 150);  // [r, g, b] linear, unclamped
```

## Browser support

WebGL2 — all evergreen browsers. `display-p3` output additionally needs Chrome 104+ / Safari 16.4+; elsewhere wide-gamut colors are clipped to sRGB for display. `createChartRenderer` returns `null` rather than throwing when unsupported.

## License

[MIT](LICENSE) © Dmitrii Kriaklin
