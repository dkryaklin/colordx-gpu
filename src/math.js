// JS twin of the shader math, built from the same constants module that
// generates the GLSL. Used by the parity test (vs @colordx/core) and usable
// as a reference implementation.

import {
  CHROMA_LUT_SIZE,
  D50_TO_D65,
  LAB,
  OKLAB,
  SRGB_TO_A98,
  SRGB_TO_P3,
  SRGB_TO_PROPHOTO,
  SRGB_TO_REC2020,
  XYZ_TO_SRGB,
} from './constants.js'

const DEG_TO_RAD = Math.PI / 180

// Cartesian cores: (L, a, b) → linear sRGB. The polar twins reach these by
// turning (C, H) into (a, b) first, so oklch/oklab (and lch/lab) share one
// implementation — exactly as the shader does.
export function oklabToLinearSrgb(L, a, b) {
  const l_ = L + OKLAB.M2I_A_L * a + OKLAB.M2I_B_L * b
  const m_ = L + OKLAB.M2I_A_M * a + OKLAB.M2I_B_M * b
  const s_ = L + OKLAB.M2I_A_S * a + OKLAB.M2I_B_S * b
  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3
  return [
    OKLAB.M1I_L_R * l3 + OKLAB.M1I_M_R * m3 + OKLAB.M1I_S_R * s3,
    OKLAB.M1I_L_G * l3 + OKLAB.M1I_M_G * m3 + OKLAB.M1I_S_G * s3,
    OKLAB.M1I_L_B * l3 + OKLAB.M1I_M_B * m3 + OKLAB.M1I_S_B * s3,
  ]
}

export function labToLinearSrgb(L, a, b) {
  const fy = (L + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  const x = (fx ** 3 > LAB.EPSILON ? fx ** 3 : (116 * fx - 16) / LAB.KAPPA) * LAB.WX
  const y = (L > 8 ? fy ** 3 : L / LAB.KAPPA) * LAB.WY
  const z = (fz ** 3 > LAB.EPSILON ? fz ** 3 : (116 * fz - 16) / LAB.KAPPA) * LAB.WZ
  const M = D50_TO_D65
  const xd65 = M[0] * x + M[1] * y + M[2] * z
  const yd65 = M[3] * x + M[4] * y + M[5] * z
  const zd65 = M[6] * x + M[7] * y + M[8] * z
  const X = XYZ_TO_SRGB
  return [
    X[0] * xd65 + X[1] * yd65 + X[2] * zd65,
    X[3] * xd65 + X[4] * yd65 + X[5] * zd65,
    X[6] * xd65 + X[7] * yd65 + X[8] * zd65,
  ]
}

export function oklchToLinearSrgb(l, c, h) {
  const hr = h * DEG_TO_RAD
  return oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr))
}

export function lchToLinearSrgb(l, c, h) {
  const hr = h * DEG_TO_RAD
  return labToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr))
}

export function srgbLinearToP3Linear(r, g, b) {
  const M = SRGB_TO_P3
  return [
    M[0] * r + M[1] * g + M[2] * b,
    M[3] * r + M[4] * g + M[5] * b,
    M[6] * r + M[7] * g + M[8] * b,
  ]
}

export function srgbLinearToRec2020Linear(r, g, b) {
  const M = SRGB_TO_REC2020
  return [
    M[0] * r + M[1] * g + M[2] * b,
    M[3] * r + M[4] * g + M[5] * b,
    M[6] * r + M[7] * g + M[8] * b,
  ]
}

export function srgbLinearToA98Linear(r, g, b) {
  const M = SRGB_TO_A98
  return [
    M[0] * r + M[1] * g + M[2] * b,
    M[3] * r + M[4] * g + M[5] * b,
    M[6] * r + M[7] * g + M[8] * b,
  ]
}

export function srgbLinearToProphotoLinear(r, g, b) {
  const M = SRGB_TO_PROPHOTO
  return [
    M[0] * r + M[1] * g + M[2] * b,
    M[3] * r + M[4] * g + M[5] * b,
    M[6] * r + M[7] * g + M[8] * b,
  ]
}

// sRGB / Display-P3 transfer, extended sign-preserving per CSS Color 4
export function srgbFromLinear(n) {
  const abs = Math.abs(n)
  const encoded = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055
  return n < 0 ? -encoded : encoded
}

// Gamut membership on linear channels — the same test the shader's overflow()
// makes: every channel of the target gamut within [0, 1]. EPS matches the
// shader's GAP so the LUT lands the boundary where the renderer draws it.
const GAMUT_EPS = 1e-7
const GAMUT_TO_LINEAR = {
  srgb: lin => lin,
  p3: lin => srgbLinearToP3Linear(lin[0], lin[1], lin[2]),
  rec2020: lin => srgbLinearToRec2020Linear(lin[0], lin[1], lin[2]),
  a98: lin => srgbLinearToA98Linear(lin[0], lin[1], lin[2]),
  prophoto: lin => srgbLinearToProphotoLinear(lin[0], lin[1], lin[2]),
}

function inGamut(model, gamut, l, c, h) {
  const lin = model === 'lch' ? lchToLinearSrgb(l, c, h) : oklchToLinearSrgb(l, c, h)
  const ch = (GAMUT_TO_LINEAR[gamut] ?? GAMUT_TO_LINEAR.srgb)(lin)
  return ch.every(v => v >= -GAMUT_EPS && v <= 1 + GAMUT_EPS)
}

// Largest in-gamut chroma at this lightness/hue, by bisection on the same
// colordx math the shader runs — so the LUT is parity-correct by construction.
function maxChromaAt(model, gamut, l, h) {
  if (!inGamut(model, gamut, l, 0, h)) return 0
  let lo = 0
  let hi = model === 'lch' ? 200 : 0.5
  for (let i = 0; i < 40 && inGamut(model, gamut, l, hi, h); i++) {
    lo = hi
    hi *= 2
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(model, gamut, l, mid, h)) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Build a per-row chroma stretch LUT for paint({ chromaLUT }). Entry i is the
 * max in-gamut chroma at lightness i/(size-1) of the lightness axis, for a
 * fixed hue — the slice the renderer normalizes so the gamut edge fills the
 * chroma axis. Built by binary search on colordx math, so it matches the
 * shader's own classification.
 *
 * @param {object} opts
 * @param {'oklch'|'lch'} [opts.model='oklch'] polar model the chart renders
 * @param {number} opts.hue fixed hue (degrees)
 * @param {'srgb'|'p3'|'a98'|'rec2020'|'prophoto'} [opts.gamut='srgb'] gamut to fill
 * @param {number} [opts.size=128] entries (must match the shader; defaults to it)
 * @returns {Float32Array}
 */
export function maxChromaLUT({ model = 'oklch', hue, gamut = 'srgb', size = CHROMA_LUT_SIZE } = {}) {
  const lMax = model === 'lch' ? 100 : 1
  const lut = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const l = size === 1 ? 0 : (i / (size - 1)) * lMax
    lut[i] = maxChromaAt(model, gamut, l, hue)
  }
  return lut
}

/**
 * Build a radial (hue-swept) max-chroma LUT for paint({ radialLUT }) on the
 * Cartesian 'ab' plane. Entry i is the max in-gamut chroma at hue 360*i/size
 * degrees, for a fixed lightness, so the renderer can map the gamut edge to a
 * unit radius (the disc fill). Periodic: the grid is i/size (not i/(size-1)) and
 * the renderer wraps the last entry to the first. Same binary search as
 * maxChromaLUT, so it stays parity-correct.
 *
 * @param {object} opts
 * @param {'oklab'|'lab'|'oklch'|'lch'} [opts.model='oklch'] model the chart renders
 * @param {number} opts.lightness fixed lightness (model's native range: 0..1 oklab, 0..100 lab)
 * @param {'srgb'|'p3'|'a98'|'rec2020'|'prophoto'} [opts.gamut='srgb'] gamut to fill
 * @param {number} [opts.size=128] entries (must match the shader; defaults to it)
 * @returns {Float32Array}
 */
export function maxChromaRadialLUT({ model = 'oklch', lightness, gamut = 'srgb', size = CHROMA_LUT_SIZE } = {}) {
  const polarModel = model === 'lab' || model === 'lch' ? 'lch' : 'oklch'
  const lut = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    lut[i] = maxChromaAt(polarModel, gamut, lightness, (i / size) * 360)
  }
  return lut
}
