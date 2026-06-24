// resolveLayers maps paint options onto the shader's gamut-layer uniforms.
// These lock the legacy show*/border* shim and the new `gamuts` list so the
// uniform packing can't silently drift (the shader itself is verified in a
// browser; this covers the JS that feeds it).

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveLayers } from '../src/layers.js'

const W = [1, 1, 1, 1]
const G = [0.5, 0.5, 0.5, 1]

test('legacy: sRGB only (no flags) fills srgb, no borders', () => {
  const r = resolveLayers({})
  assert.deepEqual(r.fill, [1, 0, 0, 0, 0])
  assert.equal(r.borderCount, 0)
})

test('legacy: showP3 fills srgb+p3, draws sRGB edge in borderP3', () => {
  const r = resolveLayers({ showP3: true, borderP3: W })
  assert.deepEqual(r.fill, [1, 1, 0, 0, 0])
  assert.equal(r.borderCount, 1)
  assert.equal(r.borderGamut[0], 0) // srgb edge
  assert.deepEqual([...r.borderColor.slice(0, 4)], W)
})

test('legacy: showP3+showRec2020 → sRGB edge borderP3, P3 edge borderRec2020', () => {
  const r = resolveLayers({ showP3: true, showRec2020: true, borderP3: W, borderRec2020: G })
  assert.deepEqual(r.fill, [1, 1, 0, 1, 0])
  assert.equal(r.borderCount, 2)
  assert.equal(r.borderGamut[0], 0) // srgb edge, colored borderP3
  assert.equal(r.borderGamut[1], 1) // p3 edge, colored borderRec2020
  assert.deepEqual([...r.borderColor.slice(0, 4)], W)
  assert.deepEqual([...r.borderColor.slice(4, 8)], G)
})

test('legacy: showRec2020 only → fills srgb+rec2020, sRGB edge in borderRec2020', () => {
  const r = resolveLayers({ showRec2020: true, borderRec2020: G })
  assert.deepEqual(r.fill, [1, 0, 0, 1, 0])
  assert.equal(r.borderCount, 1)
  assert.equal(r.borderGamut[0], 0)
  assert.deepEqual([...r.borderColor.slice(0, 4)], G)
})

test('gamuts: a98 working gamut over an sRGB reference edge', () => {
  const r = resolveLayers({
    gamuts: [
      { space: 'srgb', border: W },
      { space: 'a98', fill: true, border: G },
    ],
  })
  assert.deepEqual(r.fill, [0, 0, 1, 0, 0]) // only a98 fills; srgb is reference-only
  assert.equal(r.borderCount, 2)
  assert.equal(r.borderGamut[0], 0) // srgb edge
  assert.equal(r.borderGamut[1], 2) // a98 edge
})

test('gamuts: prophoto fill + border resolves to index 4', () => {
  const r = resolveLayers({ gamuts: [{ space: 'prophoto', fill: true, border: W }] })
  assert.deepEqual(r.fill, [0, 0, 0, 0, 1])
  assert.equal(r.borderGamut[0], 4)
})

test('gamuts: unknown space is ignored, not packed', () => {
  const r = resolveLayers({ gamuts: [{ space: 'cmyk', fill: true }, { space: 'p3', fill: true }] })
  assert.deepEqual(r.fill, [0, 1, 0, 0, 0])
  assert.equal(r.borderCount, 0)
})

test('gamuts: border layers cap at 5', () => {
  const six = ['srgb', 'p3', 'a98', 'rec2020', 'prophoto', 'srgb'].map(space => ({ space, border: W }))
  const r = resolveLayers({ gamuts: six })
  assert.equal(r.borderCount, 5)
})
