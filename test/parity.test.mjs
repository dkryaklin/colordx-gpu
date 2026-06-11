// Parity: the constants-based math that generates the GLSL must match
// @colordx/core exactly (same constants, same operation order). Any drift
// here means the shader no longer renders colordx's colors.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { lchToLinearSrgbInto, oklchToLinearInto } from '@colordx/core'
import { linearToP3ChannelsInto } from '@colordx/core/plugins/p3'
import { linearToRec2020ChannelsInto } from '@colordx/core/plugins/rec2020'

import {
  lchToLinearSrgb,
  oklchToLinearSrgb,
  srgbFromLinear,
  srgbLinearToP3Linear,
  srgbLinearToRec2020Linear,
} from '../src/math.js'

const TOL = 1e-9
const out = new Float64Array(3)

function maxDiff(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

test('oklch → linear sRGB matches @colordx/core over the slice grid', () => {
  let worst = 0
  for (let l = 0; l <= 1.001; l += 0.05) {
    for (let c = 0; c <= 0.47; c += 0.02) {
      for (let h = 0; h < 360; h += 12.5) {
        oklchToLinearInto(out, l, c, h)
        worst = Math.max(worst, maxDiff(oklchToLinearSrgb(l, c, h), out))
      }
    }
  }
  assert.ok(worst < TOL, `max diff ${worst}`)
})

test('lch (D50) → linear sRGB matches @colordx/core over the slice grid', () => {
  let worst = 0
  for (let l = 0; l <= 100.01; l += 5) {
    for (let c = 0; c <= 195; c += 7.5) {
      for (let h = 0; h < 360; h += 12.5) {
        lchToLinearSrgbInto(out, l, c, h)
        worst = Math.max(worst, maxDiff(lchToLinearSrgb(l, c, h), out))
      }
    }
  }
  assert.ok(worst < TOL, `max diff ${worst}`)
})

test('linear sRGB → P3 channels matches @colordx/core', () => {
  let worst = 0
  for (let r = -0.4; r <= 1.4; r += 0.2) {
    for (let g = -0.4; g <= 1.4; g += 0.2) {
      for (let b = -0.4; b <= 1.4; b += 0.2) {
        linearToP3ChannelsInto(out, r, g, b)
        const mine = srgbLinearToP3Linear(r, g, b).map(srgbFromLinear)
        worst = Math.max(worst, maxDiff(mine, out))
      }
    }
  }
  assert.ok(worst < TOL, `max diff ${worst}`)
})

test('linear sRGB → Rec2020 linear matches @colordx/core gamut classification', () => {
  // colordx returns gamma-encoded channels; the renderer classifies on linear
  // values. Verify the classification (in/out of [0,1]) agrees everywhere.
  for (let r = -0.4; r <= 1.4; r += 0.1) {
    for (let g = -0.4; g <= 1.4; g += 0.1) {
      for (let b = -0.4; b <= 1.4; b += 0.1) {
        linearToRec2020ChannelsInto(out, r, g, b)
        const enc = [...out]
        const lin = srgbLinearToRec2020Linear(r, g, b)
        const inEnc = enc.every(v => v >= -1e-7 && v <= 1 + 1e-7)
        const inLin = lin.every(v => v >= -1e-7 && v <= 1 + 1e-7)
        // allow disagreement only within float noise of the boundary
        const nearEdge = lin.some(v => Math.abs(v) < 1e-6 || Math.abs(v - 1) < 1e-6)
        assert.ok(inEnc === inLin || nearEdge, `classification differs at lin ${lin}`)
      }
    }
  }
})
