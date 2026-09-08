// Shape checks on the generated GLSL: the renderer's uniform list must exist in
// every model's shader, and the invariants the JS side relies on (LUT length is
// a uniform, not a compile-time constant; lightness scale per model) must hold.
// Compilation itself is verified in a browser, not here.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildFragment, VERTEX } from '../src/glsl.js'

const MODELS = ['oklch', 'lch', 'oklab', 'lab']
const UNIFORMS = [
  'u_res', 'u_xComp', 'u_yComp', 'u_fixedComp', 'u_transpose', 'u_value',
  'u_xMin', 'u_xMax', 'u_yMin', 'u_yMax', 'u_p3Out', 'u_borderWidth',
  'u_fill', 'u_borderCount', 'u_borderGamut', 'u_borderColor',
  'u_stretch', 'u_lutTex', 'u_lutN',
]

test('every model declares every uniform the renderer sets', () => {
  for (const model of MODELS) {
    const src = buildFragment(model)
    for (const u of UNIFORMS) {
      assert.ok(new RegExp(`uniform [^;]*\\b${u}\\b[^;]*;`).test(src), `${model}: missing uniform ${u}`)
    }
  }
})

test('LUT length is a uniform — no hard-coded 128 survives in the shader', () => {
  for (const model of MODELS) {
    const src = buildFragment(model)
    assert.ok(!/LUT_N\b/.test(src), `${model}: LUT_N constant still referenced`)
    assert.ok(!/\b128\b/.test(src), `${model}: literal 128 in shader`)
  }
})

test('lightness scale matches the model (stretch LUT is indexed by L / L_MAX)', () => {
  assert.match(buildFragment('oklch'), /const float L_MAX = 1\.0;/)
  assert.match(buildFragment('oklab'), /const float L_MAX = 1\.0;/)
  assert.match(buildFragment('lch'), /const float L_MAX = 100\.0;/)
  assert.match(buildFragment('lab'), /const float L_MAX = 100\.0;/)
})

test('shaders are ES 3.00 and carry no comments (nothing for a minifier to miss)', () => {
  assert.ok(VERTEX.startsWith('#version 300 es'))
  for (const model of MODELS) {
    const src = buildFragment(model)
    assert.ok(src.startsWith('#version 300 es'), model)
    assert.ok(!src.includes('//') && !src.includes('/*'), `${model}: comment in emitted GLSL`)
  }
})
