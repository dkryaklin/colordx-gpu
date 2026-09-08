# Changelog

## 0.7.0

- **Borders beyond the fill are drawn.** A border layer whose gamut extends past the fill union (the README's own `{ space: 'rec2020', border }` over an `a98` fill, or a P3 outline over an sRGB-only fill) was silently invisible outside the fill. It now draws there as the inner half of the line over the transparent background, in every mode (plain, `chromaLUT`, `radialLUT`). Renders where every border sat inside the fill are unchanged.
- **Stretch LUTs of any length.** The shader hard-coded the LUT length to 128, so a `chromaLUT` / `radialLUT` built with another `size` sampled out of range and rendered garbage. The length is now a uniform read from the array you pass; `size` is a real knob.
- **Chroma stretch on a partial lightness range.** With `chromaLUT` and `xMin`/`xMax` narrower than `0..L_MAX`, the LUT was indexed by screen position instead of lightness, so the stretched edge was in the wrong place. It's now indexed by absolute lightness (`L / L_MAX`), and a partial-range render matches the corresponding crop of a full-range one.
- **Dithering stays off after a context restore.** `gl.disable(DITHER)` ran once at creation; a restored context comes back with dithering on, making the float → 8-bit conversion driver-dependent again. It's now part of the per-context init.
- **`destroy()` removes its context-loss listeners** (they accumulated on the canvas across React StrictMode remounts) and is idempotent; shader objects are deleted once the program is linked.
- **Contour derivatives in uniform control flow.** The boundary line's `dFdx`/`dFdy` were taken inside the border loop after per-fragment branches — undefined in GLSL ES, and in practice the pixels on quads straddling the fill edge depended on what the compiler did with exited lanes (they changed with unrelated edits to the shader). They're now computed once, up front. Only fill-edge quads of unstretched lines differ; stretched (`chromaLUT` / `radialLUT`) renders are bit-identical to 0.6. Known limitation, unchanged in kind: right at the black cusp a channel can dip a hair below zero across a few pixels, so the first-order estimate can paint a faint speck or two.
- **New `math.maxChroma({ model, lightness, hue, gamut })`** — the max in-gamut chroma at one point (what the LUT builders sample on a grid), for clamping a picker value into gamut or placing a handle on the true edge.
- **New `math.sampleChromaLUT(lut, t)` and `math.sampleRadialLUT(lut, hue)`** — read a stretch LUT with exactly the shader's interpolation (clamped grid / periodic wrap), so a picker handle lands on the rendered edge to the pixel.
- **Input validation in the chroma helpers.** `maxChromaLUT` / `maxChromaRadialLUT` / `maxChroma` throw `RangeError` on an unknown model or gamut and `TypeError` on a non-finite lightness/hue. Before, an unknown gamut silently meant sRGB, a `lab` model silently meant OKLCH on the wrong scale, and an undefined hue returned an all-zero LUT. `maxChromaLUT` also accepts `'oklab'` / `'lab'` (meaning their polar twin), like `maxChromaRadialLUT` already did.
- **New `createChartRenderer(canvas, { contextAttributes })`** — extra `WebGLContextAttributes` merged over the defaults: `preserveDrawingBuffer` for `toDataURL` / readback after the frame, `desynchronized` for lower scrub latency, `powerPreference`.
- Types: `createChartRenderer` accepts `OffscreenCanvas` (it already worked in a worker); `ChromaModel` / `ChromaGamut` exported from `math`.
- Tests: `test/math-api.test.mjs` (point query, samplers, validation) and `test/glsl.test.mjs` (generated-shader invariants).

## 0.6.1

- **Docs: `renderer.destroy()` no longer claims to release the WebGL context.** It releases the program and texture and makes the renderer inert, but deliberately leaves the context alive — a canvas can only ever produce one, so losing it would break any later renderer on the same canvas (a React StrictMode remount, say). The behaviour has been this way since 0.5.2; only the README was wrong.
- **Docs: `renderer.canvas` and `renderer.gl` are now documented** in the API reference, alongside the `math.maxChromaRadialLUT` and `srgbLinearTo*Linear` helpers in the `math` example. No API change — `gl` has been exposed since 0.3.0.
- Parity suite now runs against `@colordx/core@6.4.0` (dev-only; the shipped code is unchanged).

## 0.6.0

- **Radial chroma stretch for the Cartesian `'ab'` plane (oklab/lab).** New `paint({ radialLUT })` (the radial analogue of `chromaLUT`): the renderer scales each hue direction so the gamut edge maps to a unit radius, filling the `a`/`b` square as a disc instead of a small off-centre blob — the last piece a wide-gamut oklab/lab picker needs on the GPU. Build it with `math.maxChromaRadialLUT({ model, lightness, gamut })`, which binary-searches the same colordx math (parity-correct by construction). The boundary line is drawn from the LUT analytically (perpendicular-distance AA), so it's a single clean line — no doubling. Read the `a`/`b` axes as the normalized direction: `xMin`/`yMin` = -1, `xMax`/`yMax` = 1. Polar `'cl'` stretch and all other planes are unchanged.

## 0.5.2

- **Fix the doubled gamut boundary line under chroma stretch.** With `paint({ chromaLUT })`, the stretched border read the (LUT-warped) overflow field and the per-row stretch injected a steep lightness gradient that corrupted the contour's width estimate — painting a spurious second line and horizontal jogs near the high-chroma edge. The stretched border now draws from a per-row analytic position LUT (`math.maxChromaLUT` for the border gamut ÷ the stretch scale) with perpendicular-distance anti-aliasing: a single clean line that tracks the true edge to sub-pixel at every boundary orientation. Unstretched borders and non-`cl` planes are unchanged. Internal: the stretch LUTs moved from the `u_chromaLUT[128]` uniform into an R32F texture, freeing that uniform budget.

## 0.5.1

- **Smoother gamut boundary lines.** The boundary contour is anti-aliased again (a solid core with a ~1px coverage falloff) instead of a hard pixel step, so lines stay crisp without the staircase aliasing and the spikes/breaks that showed up near gamut cusps at certain hues. Width still set by `borderWidth`.
- **Fix `math` type definitions.** `math.maxChromaLUT` and the 0.4.0/0.5.0 converters (`oklabToLinearSrgb`, `labToLinearSrgb`, a98 / prophoto) were missing from the hand-written `math.d.ts`, so TypeScript callers had to cast. They're now declared.

## 0.5.0

- **OKLab and CIE Lab models.** `createChartRenderer(canvas, { model: 'oklab' | 'lab' })` renders the Cartesian form of the same math — axes are `a`/`b` instead of `C`/`H`, sharing one parity-tested conversion with their polar twins. New Cartesian slice planes `'ab'` / `'la'` / `'lb'`, and `xMin` / `yMin` paint options so an `a`/`b` axis can span negatives.
- **Per-row chroma stretch.** New `paint({ chromaLUT })` option (polar models, `'cl'` plane): a `Float32Array` of max in-gamut chroma sampled along the lightness axis, so the gamut edge fills the chroma axis instead of sitting at an absolute coordinate. Build it with `math.maxChromaLUT({ model, hue, gamut, size })`, which binary-searches the same colordx math — so the stretched render is parity-correct by construction. Omit it for the previous absolute-coordinate behaviour.
- With these and the 0.4.0 gamuts, the chart renderer covers the full OKLCH / OKLab / LCH / Lab + wide-gamut surface a real picker's GPU fast path needs ([css-color-component#68](https://github.com/argyleink/css-color-component/pull/68), [#8](https://github.com/dkryaklin/colordx-gpu/issues/8)).

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
