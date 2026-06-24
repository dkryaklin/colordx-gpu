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
  gamuts: [
    { space: 'srgb', border: [1, 1, 1, 1] },   // sRGB edge as a white line
    { space: 'p3', fill: true },               // also fill the P3 region
  ],
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
| `value` | The fixed component, in the model's native scale |
| `xMax`, `yMax` | Component values at the right / top edges |
| `gamuts` | Ordered gamut layers — see below |
| `transpose` | Swap which screen axis each component occupies (default `false`); `xMax`/`yMax` stay bound to their components |
| `borderWidth` | Boundary line width in device pixels (default `1`) |
| `p3Output` | Encode output as Display-P3 (Chrome 104+, Safari 16.4+; silently stays sRGB elsewhere) |

#### `gamuts` — gamut layers

Gamuts are **independent layers, not a fixed nesting**. Each layer names a `space` (`'srgb'`, `'p3'`, `'a98'`, `'rec2020'`, `'prophoto'`) and opts into a fill, a border, or both:

```js
gamuts: [
  { space: 'srgb',    border: WHITE },             // boundary line only
  { space: 'a98',     fill: true, border: WHITE },  // fill + its own edge
  { space: 'rec2020', border: GRAY },
]
```

- **Fill** is the union of every layer with `fill: true`.
- **Border** draws each layer's *own* gamut edge (its zero-contour), composited in array order — so where two non-nested boundaries cross (e.g. a98 vs p3), the later layer's line wins. No containment is assumed, so nested and sibling gamuts render the same way.
- Wide-gamut fills display **clamped** to the output space (sRGB, or P3 with `p3Output`); the boundary line still marks the true extent.

This is one renderer for several pickers — an OKLCH picker overlays `srgb`/`p3`/`rec2020`; a wide-gamut picker shows a single working gamut like `a98` over an sRGB reference. The legacy `showP3` / `showRec2020` / `borderP3` / `borderRec2020` flags still work (mapped onto equivalent layers) but are deprecated in favour of `gamuts`.

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
