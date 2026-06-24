// Parity: the constants-based math that generates the GLSL must match
// @colordx/core exactly (same constants, same operation order). Any drift
// here means the shader no longer renders colordx's colors.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { labToLinearSrgbInto, lchToLinearSrgbInto, oklchToLinearInto } from '@colordx/core'
import { linearToA98ChannelsInto } from '@colordx/core/plugins/a98rgb'
import { linearToP3ChannelsInto } from '@colordx/core/plugins/p3'
import { linearToProphotoChannelsInto } from '@colordx/core/plugins/prophoto'
import { linearToRec2020ChannelsInto } from '@colordx/core/plugins/rec2020'

import {
  labToLinearSrgb,
  lchToLinearSrgb,
  oklabToLinearSrgb,
  oklchToLinearSrgb,
  srgbFromLinear,
  srgbLinearToA98Linear,
  srgbLinearToP3Linear,
  srgbLinearToProphotoLinear,
  srgbLinearToRec2020Linear,
} from '../src/math.js'

const TOL = 1e-9
const out = new Float64Array(3)

function maxDiff(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

// The renderer classifies gamut membership on linear channels (in/out of [0,1]);
// colordx returns gamma-encoded channels. For spaces whose transfer function
// isn't sRGB's (Rec2020, A98, ProPhoto), assert the classification agrees
// everywhere, allowing disagreement only within float noise of the boundary.
function assertClassificationMatches(name, mineLinear, coreEncodedInto) {
  for (let r = -0.4; r <= 1.4; r += 0.1) {
    for (let g = -0.4; g <= 1.4; g += 0.1) {
      for (let b = -0.4; b <= 1.4; b += 0.1) {
        coreEncodedInto(out, r, g, b)
        const inEnc = [...out].every(v => v >= -1e-7 && v <= 1 + 1e-7)
        const lin = mineLinear(r, g, b)
        const inLin = lin.every(v => v >= -1e-7 && v <= 1 + 1e-7)
        const nearEdge = lin.some(v => Math.abs(v) < 1e-6 || Math.abs(v - 1) < 1e-6)
        assert.ok(inEnc === inLin || nearEdge, `${name}: classification differs at lin ${lin}`)
      }
    }
  }
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

// oklab is the Cartesian entry to the same core math: validate it against
// @colordx/core's polar path, converting (a, b) → (C, H) the renderer's wrapper
// way. This pins the no-polar-step core the oklab shader uses.
test('oklab → linear sRGB matches @colordx/core (via polar) over the slice grid', () => {
  let worst = 0
  for (let l = 0; l <= 1.001; l += 0.05) {
    for (let a = -0.4; a <= 0.4001; a += 0.05) {
      for (let b = -0.4; b <= 0.4001; b += 0.05) {
        const c = Math.hypot(a, b)
        const h = (Math.atan2(b, a) * 180) / Math.PI
        oklchToLinearInto(out, l, c, h)
        worst = Math.max(worst, maxDiff(oklabToLinearSrgb(l, a, b), out))
      }
    }
  }
  assert.ok(worst < TOL, `max diff ${worst}`)
})

// lab has a direct Cartesian export in core — compare straight across.
test('lab (D50) → linear sRGB matches @colordx/core over the slice grid', () => {
  let worst = 0
  for (let l = 0; l <= 100.01; l += 5) {
    for (let a = -120; a <= 120.01; a += 15) {
      for (let b = -120; b <= 120.01; b += 15) {
        labToLinearSrgbInto(out, l, a, b)
        worst = Math.max(worst, maxDiff(labToLinearSrgb(l, a, b), out))
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
  assertClassificationMatches('rec2020', srgbLinearToRec2020Linear, linearToRec2020ChannelsInto)
})

test('linear sRGB → A98 linear matches @colordx/core gamut classification', () => {
  assertClassificationMatches('a98', srgbLinearToA98Linear, linearToA98ChannelsInto)
})

test('linear sRGB → ProPhoto linear matches @colordx/core gamut classification', () => {
  assertClassificationMatches('prophoto', srgbLinearToProphotoLinear, linearToProphotoChannelsInto)
})
