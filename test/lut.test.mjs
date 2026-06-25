// The chroma-stretch LUT must put the gamut edge exactly where the shader's
// overflow() test does. These checks re-derive gamut membership independently
// from the exported converters (not maxChromaLUT's internals), so a drift in the
// builder can't hide behind shared code.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CHROMA_LUT_SIZE } from '../src/constants.js'
import {
  maxChromaLUT,
  maxChromaRadialLUT,
  oklchToLinearSrgb,
  srgbLinearToP3Linear,
  srgbLinearToRec2020Linear,
} from '../src/math.js'

const EPS = 1e-7
const TO_GAMUT = {
  srgb: lin => lin,
  p3: lin => srgbLinearToP3Linear(...lin),
  rec2020: lin => srgbLinearToRec2020Linear(...lin),
}

function inGamut(gamut, l, c, h) {
  return TO_GAMUT[gamut](oklchToLinearSrgb(l, c, h)).every(v => v >= -EPS && v <= 1 + EPS)
}

test('LUT length defaults to the shared shader size, and honours size', () => {
  assert.equal(maxChromaLUT({ hue: 30 }).length, CHROMA_LUT_SIZE)
  assert.equal(maxChromaLUT({ hue: 30, size: 64 }).length, 64)
})

// The in-gamut chroma at fixed L/H is an interval [0, Cmax] (the gamut is convex
// and contains the gray axis), so the entry brackets the boundary: just inside
// is in, just outside is out. A small relative bracket keeps this robust to the
// Float32Array quantization of the stored entry at thin near-black/white rows.
test('each entry brackets the gamut boundary', () => {
  for (const gamut of ['srgb', 'p3', 'rec2020']) {
    for (const hue of [0, 90, 200, 330]) {
      const lut = maxChromaLUT({ hue, gamut, size: 48 })
      for (let i = 0; i < lut.length; i++) {
        const l = i / (lut.length - 1)
        const c = lut[i]
        if (c <= 1e-6) continue // achromatic-only row (pure black/white)
        assert.ok(inGamut(gamut, l, c * 0.97, hue), `${gamut} h${hue} L${l}: 0.97·C should be in gamut`)
        assert.ok(!inGamut(gamut, l, c * 1.03 + 1e-3, hue), `${gamut} h${hue} L${l}: 1.03·C should be out`)
      }
    }
  }
})

test('wider gamuts admit at least as much chroma as sRGB', () => {
  for (const hue of [0, 120, 270]) {
    const srgb = maxChromaLUT({ hue, gamut: 'srgb', size: 48 })
    const p3 = maxChromaLUT({ hue, gamut: 'p3', size: 48 })
    const rec = maxChromaLUT({ hue, gamut: 'rec2020', size: 48 })
    for (let i = 0; i < srgb.length; i++) {
      assert.ok(p3[i] >= srgb[i] - EPS, `p3 < srgb at i${i} h${hue}`)
      assert.ok(rec[i] >= p3[i] - EPS, `rec2020 < p3 at i${i} h${hue}`)
    }
  }
})

// At pure black and white the gamut pinches to a sliver, so the endpoints carry
// far less chroma than the mid-lightness peak (they're not exactly 0 — the
// boundary chroma scales as Cmax³, so a tiny nonzero survives the bisection).
test('lightness endpoints collapse far below the mid-lightness peak', () => {
  const lut = maxChromaLUT({ hue: 60, gamut: 'srgb' })
  const peak = Math.max(...lut)
  assert.ok(lut[0] < 0.1 * peak, `L=0 chroma ${lut[0]} vs peak ${peak}`)
  assert.ok(lut[lut.length - 1] < 0.1 * peak, `L=1 chroma ${lut[lut.length - 1]} vs peak ${peak}`)
})

test('lch model samples its 0..100 lightness range and stays finite', () => {
  const lut = maxChromaLUT({ model: 'lch', hue: 40, gamut: 'srgb', size: 32 })
  assert.ok(lut.every(Number.isFinite))
  assert.ok(Math.max(...lut) > 1, 'lch chroma is on a ~0..150 scale, should exceed 1')
  assert.ok(lut[0] < 1e-2 && lut[lut.length - 1] < 1e-2, 'endpoints ~0')
})

// --- Radial (hue-swept) LUT for the Cartesian 'ab' plane -------------------
// Entry i is the max in-gamut chroma at hue 360*i/size, at a fixed lightness.
// The grid is periodic (i/size, not i/(size-1)), so it wraps cleanly at the seam.

test('radial LUT length defaults to the shared shader size, and honours size', () => {
  assert.equal(maxChromaRadialLUT({ lightness: 0.6 }).length, CHROMA_LUT_SIZE)
  assert.equal(maxChromaRadialLUT({ lightness: 0.6, size: 64 }).length, 64)
})

test('each radial entry brackets the gamut boundary at its hue', () => {
  for (const gamut of ['srgb', 'p3', 'rec2020']) {
    const size = 64
    const lut = maxChromaRadialLUT({ model: 'oklab', lightness: 0.6, gamut, size })
    for (let i = 0; i < size; i++) {
      const hue = (i / size) * 360
      const c = lut[i]
      assert.ok(c > 1e-6, `${gamut} hue${hue}: mid-lightness slice surrounds gray, chroma should be > 0`)
      assert.ok(inGamut(gamut, 0.6, c * 0.97, hue), `${gamut} hue${hue}: 0.97·C should be in gamut`)
      assert.ok(!inGamut(gamut, 0.6, c * 1.03 + 1e-3, hue), `${gamut} hue${hue}: 1.03·C should be out`)
    }
  }
})

// sRGB is a strict subset of both P3 and Rec2020 (same D65 white, contained
// primaries), so every hue admits at least as much chroma in the wider gamuts.
// Note: P3 ⊄ Rec2020 at the cube level for every hue — at some oranges a Rec2020
// channel dips negative just before a P3 channel maxes — so rec ≥ p3 is NOT an
// invariant and is deliberately not asserted (the gamuts are classified
// independently; the renderer never assumes nesting).
test('wider gamuts admit at least as much radial chroma as sRGB', () => {
  const srgb = maxChromaRadialLUT({ model: 'oklab', lightness: 0.6, gamut: 'srgb', size: 64 })
  const p3 = maxChromaRadialLUT({ model: 'oklab', lightness: 0.6, gamut: 'p3', size: 64 })
  const rec = maxChromaRadialLUT({ model: 'oklab', lightness: 0.6, gamut: 'rec2020', size: 64 })
  for (let i = 0; i < srgb.length; i++) {
    assert.ok(p3[i] >= srgb[i] - EPS, `p3 < srgb at i${i}`)
    assert.ok(rec[i] >= srgb[i] - EPS, `rec2020 < srgb at i${i}`)
  }
})

// The seam (last entry → first entry) is just two adjacent angular samples, so
// the chroma is continuous across it — no discontinuity for the shader to wrap.
test('radial LUT is continuous across the periodic seam', () => {
  const lut = maxChromaRadialLUT({ model: 'oklab', lightness: 0.6, gamut: 'srgb', size: 64 })
  const peak = Math.max(...lut)
  const seam = Math.abs(lut[0] - lut[lut.length - 1])
  const typical = Math.abs(lut[1] - lut[0])
  assert.ok(seam < 0.15 * peak, `seam jump ${seam} vs peak ${peak}`)
  assert.ok(seam < 5 * typical + 1e-4, 'seam step should be the same scale as a normal step')
})

test('lab radial model uses the CIE 0..100 chroma scale', () => {
  const lut = maxChromaRadialLUT({ model: 'lab', lightness: 60, gamut: 'srgb', size: 32 })
  assert.ok(lut.every(Number.isFinite))
  assert.ok(Math.max(...lut) > 1, 'lab chroma is on a ~0..150 scale, should exceed 1')
})
