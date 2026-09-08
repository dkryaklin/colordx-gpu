// The point query and LUT samplers exported for picker UIs: maxChroma must agree
// with the LUT builders' grid, the samplers must interpolate exactly the way the
// shader does (so a handle lands on the drawn edge), and bad input must throw
// instead of silently producing a plausible-looking wrong LUT.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  maxChroma,
  maxChromaLUT,
  maxChromaRadialLUT,
  sampleChromaLUT,
  sampleRadialLUT,
} from '../src/math.js'

test('maxChroma matches the LUT builders at their grid points', () => {
  const lut = maxChromaLUT({ model: 'oklch', hue: 30, gamut: 'p3', size: 17 })
  for (let i = 0; i < lut.length; i++) {
    const c = maxChroma({ model: 'oklch', lightness: i / 16, hue: 30, gamut: 'p3' })
    assert.ok(Math.abs(c - lut[i]) < 1e-6, `row ${i}: ${c} vs ${lut[i]}`)
  }
  const radial = maxChromaRadialLUT({ model: 'oklab', lightness: 0.6, gamut: 'srgb', size: 12 })
  for (let i = 0; i < radial.length; i++) {
    const c = maxChroma({ model: 'oklab', lightness: 0.6, hue: (i / 12) * 360, gamut: 'srgb' })
    assert.ok(Math.abs(c - radial[i]) < 1e-6, `hue ${i}: ${c} vs ${radial[i]}`)
  }
})

test('maxChroma: Cartesian model names mean their polar twin, CIE scale for lab/lch', () => {
  assert.equal(
    maxChroma({ model: 'oklab', lightness: 0.5, hue: 200 }),
    maxChroma({ model: 'oklch', lightness: 0.5, hue: 200 })
  )
  assert.equal(
    maxChroma({ model: 'lab', lightness: 50, hue: 200 }),
    maxChroma({ model: 'lch', lightness: 50, hue: 200 })
  )
  assert.ok(maxChroma({ model: 'lch', lightness: 50, hue: 40 }) > 1, 'CIE chroma is on a ~0..150 scale')
  assert.ok(maxChroma({ model: 'oklch', lightness: 0.5, hue: 40 }) < 1, 'ok chroma is on a ~0..0.4 scale')
})

test('maxChroma is 0 outside the lightness range and widens with the gamut', () => {
  assert.equal(maxChroma({ lightness: 1.2, hue: 90 }), 0)
  assert.equal(maxChroma({ lightness: -0.1, hue: 90 }), 0)
  const s = maxChroma({ lightness: 0.6, hue: 90, gamut: 'srgb' })
  const p = maxChroma({ lightness: 0.6, hue: 90, gamut: 'p3' })
  const r = maxChroma({ lightness: 0.6, hue: 90, gamut: 'rec2020' })
  assert.ok(s > 0 && p >= s && r >= s)
})

test('bad input throws rather than returning a plausible wrong result', () => {
  assert.throws(() => maxChroma({ lightness: 0.5, hue: 'red' }), TypeError)
  assert.throws(() => maxChroma({ lightness: NaN, hue: 0 }), TypeError)
  assert.throws(() => maxChroma({ lightness: 0.5, hue: 0, gamut: 'display-p3' }), RangeError)
  assert.throws(() => maxChroma({ lightness: 0.5, hue: 0, model: 'hsl' }), RangeError)
  assert.throws(() => maxChromaLUT({}), TypeError, 'hue is required')
  assert.throws(() => maxChromaLUT({ hue: 0, gamut: 'cmyk' }), RangeError)
  assert.throws(() => maxChromaRadialLUT({ lightness: 0.5, model: 'xyz' }), RangeError)
  assert.throws(() => maxChromaRadialLUT({ hue: 0 }), TypeError, 'lightness is required')
})

// Shader: x = clamp(t,0,1) * (n-1); i = floor(x); j = min(i+1, n-1); mix(a, b, x-i)
test('sampleChromaLUT interpolates like the shader: exact at grid points, linear between, clamped', () => {
  const lut = Float32Array.from([0, 1, 3, 2])
  assert.equal(sampleChromaLUT(lut, 0), 0)
  assert.equal(sampleChromaLUT(lut, 1 / 3), 1)
  assert.equal(sampleChromaLUT(lut, 1), 2)
  assert.ok(Math.abs(sampleChromaLUT(lut, 0.5) - 2) < 1e-12, 'midpoint of rows 1..2')
  assert.ok(Math.abs(sampleChromaLUT(lut, 1 / 6) - 0.5) < 1e-12)
  assert.equal(sampleChromaLUT(lut, -5), 0, 'clamps below')
  assert.equal(sampleChromaLUT(lut, 7), 2, 'clamps above')
  assert.equal(sampleChromaLUT([], 0.5), 0)
  assert.equal(sampleChromaLUT([4], 0.5), 4, 'single entry is constant')
})

// Shader: x = fract(t) * n; i = floor(x); j = i+1 >= n ? 0 : i+1; mix(a, b, x-i)
test('sampleRadialLUT wraps: exact at grid points, linear between, periodic across the seam', () => {
  const lut = Float32Array.from([1, 2, 4, 3])
  assert.equal(sampleRadialLUT(lut, 0), 1)
  assert.equal(sampleRadialLUT(lut, 90), 2)
  assert.equal(sampleRadialLUT(lut, 270), 3)
  assert.ok(Math.abs(sampleRadialLUT(lut, 45) - 1.5) < 1e-12)
  assert.ok(Math.abs(sampleRadialLUT(lut, 315) - 2) < 1e-12, 'last → first across the seam')
  assert.equal(sampleRadialLUT(lut, 360), 1, 'wraps')
  assert.equal(sampleRadialLUT(lut, -90), 3, 'negative hue wraps')
  assert.equal(sampleRadialLUT(lut, 720 + 90), 2)
})

test('samplers reproduce a real LUT at its own grid and bracket the gamut between rows', () => {
  const lut = maxChromaLUT({ hue: 264, gamut: 'p3', size: 64 })
  for (let i = 0; i < 64; i++) assert.equal(sampleChromaLUT(lut, i / 63), lut[i])
  const c = sampleChromaLUT(lut, 0.5 + 0.5 / 63)
  assert.ok(c > Math.min(lut[31], lut[32]) - 1e-9 && c < Math.max(lut[31], lut[32]) + 1e-9)
  const rad = maxChromaRadialLUT({ model: 'oklab', lightness: 0.7, gamut: 'srgb', size: 64 })
  for (let i = 0; i < 64; i++) assert.equal(sampleRadialLUT(rad, (i / 64) * 360), rad[i])
})
