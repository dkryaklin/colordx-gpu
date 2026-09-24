// JS twin of the shader math, built from the same constants module that
// generates the GLSL. Used by the parity test (vs @colordx/core) and usable
// as a reference implementation.

import {
  CHROMA_LUT_SIZE,
  D50_TO_D65,
  LAB,
  OKGAMUT,
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
  // Same shortcut as core's oklabToLinear: the M1⁻¹ rows sum to 1 only to ~16 digits, so an
  // exact grey (a = b = 0) would otherwise come out with channels ~1e-16 apart.
  if (a === 0 && b === 0) {
    const v = L * L * L
    return [v, v, v]
  }
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

// Okhsl / Okhsv (Björn Ottosson): the sRGB gamut as a cylinder over the OKLCH hue. Ported
// line-for-line from core's okgamut.ts / okhsl.ts / okhsv.ts (same constants, same operation
// order) so the parity test can hold them to float noise. h in degrees, s / l / v in 0–100 —
// the scale core's toOkhsl() / toOkhsv() report. sRGB-only by definition.
const K3 = (1 + OKGAMUT.K1) / (1 + OKGAMUT.K2)

// OKLab L → L_r (the "toe"). toe(0) = 0, toe(1) = 1.
function toe(x) {
  const { K1, K2 } = OKGAMUT
  return 0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) * (K3 * x - K1) + 4 * K2 * K3 * x))
}

// L_r → OKLab L. Exact inverse of toe.
function toeInv(x) {
  const { K1, K2 } = OKGAMUT
  return (x * x + K1 * x) / (K3 * (x + K2))
}

// Largest saturation S = C / L inside sRGB for the unit hue direction (a, b): per-sector
// polynomial fit plus one Halley step. Error under 1e-6 except for some blues (reference behaviour).
function computeMaxSaturation(a, b) {
  const { RED, GREEN, BLUE } = OKGAMUT
  const sec = RED.test[0] * a + RED.test[1] * b > 1 ? RED : GREEN.test[0] * a + GREEN.test[1] * b > 1 ? GREEN : BLUE
  const [k0, k1, k2, k3, k4] = sec.k
  const [wl, wm, ws] = sec.w

  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b

  const k_l = OKLAB.M2I_A_L * a + OKLAB.M2I_B_L * b
  const k_m = OKLAB.M2I_A_M * a + OKLAB.M2I_B_M * b
  const k_s = OKLAB.M2I_A_S * a + OKLAB.M2I_B_S * b

  const l_ = 1 + S * k_l
  const m_ = 1 + S * k_m
  const s_ = 1 + S * k_s

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const l_dS = 3 * k_l * l_ * l_
  const m_dS = 3 * k_m * m_ * m_
  const s_dS = 3 * k_s * s_ * s_

  const l_dS2 = 6 * k_l * k_l * l_
  const m_dS2 = 6 * k_m * k_m * m_
  const s_dS2 = 6 * k_s * k_s * s_

  const f = wl * l + wm * m + ws * s
  const f1 = wl * l_dS + wm * m_dS + ws * s_dS
  const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2

  S = S - (f * f1) / (f1 * f1 - 0.5 * f * f2)
  return S
}

// The cusp of the sRGB gamut slice at hue direction (a, b): [L_cusp, C_cusp].
function findCusp(a, b) {
  const S_cusp = computeMaxSaturation(a, b)
  const lin = oklabToLinearSrgb(1, S_cusp * a, S_cusp * b)
  const L_cusp = Math.cbrt(1 / Math.max(lin[0], lin[1], lin[2]))
  return [L_cusp, L_cusp * S_cusp]
}

// Where the line L = L0 (1 − t) + t L1, C = t C1 leaves the sRGB gamut, as t.
function findGamutIntersection(a, b, L1, C1, L0, cuspL, cuspC) {
  let t
  if ((L1 - L0) * cuspC - (cuspL - L0) * C1 <= 0) {
    t = (cuspC * L0) / (C1 * cuspL + cuspC * (L0 - L1))
  } else {
    t = (cuspC * (L0 - 1)) / (C1 * (cuspL - 1) + cuspC * (L0 - L1))

    const dL = L1 - L0
    const dC = C1

    const k_l = OKLAB.M2I_A_L * a + OKLAB.M2I_B_L * b
    const k_m = OKLAB.M2I_A_M * a + OKLAB.M2I_B_M * b
    const k_s = OKLAB.M2I_A_S * a + OKLAB.M2I_B_S * b

    const l_dt = dL + dC * k_l
    const m_dt = dL + dC * k_m
    const s_dt = dL + dC * k_s

    const L = L0 * (1 - t) + t * L1
    const C = t * C1

    const l_ = L + C * k_l
    const m_ = L + C * k_m
    const s_ = L + C * k_s

    const l = l_ * l_ * l_
    const m = m_ * m_ * m_
    const s = s_ * s_ * s_

    const ldt = 3 * l_dt * l_ * l_
    const mdt = 3 * m_dt * m_ * m_
    const sdt = 3 * s_dt * s_ * s_

    const ldt2 = 6 * l_dt * l_dt * l_
    const mdt2 = 6 * m_dt * m_dt * m_
    const sdt2 = 6 * s_dt * s_dt * s_

    const r = OKLAB.M1I_L_R * l + OKLAB.M1I_M_R * m + OKLAB.M1I_S_R * s - 1
    const r1 = OKLAB.M1I_L_R * ldt + OKLAB.M1I_M_R * mdt + OKLAB.M1I_S_R * sdt
    const r2 = OKLAB.M1I_L_R * ldt2 + OKLAB.M1I_M_R * mdt2 + OKLAB.M1I_S_R * sdt2
    const u_r = r1 / (r1 * r1 - 0.5 * r * r2)
    let t_r = -r * u_r

    const g = OKLAB.M1I_L_G * l + OKLAB.M1I_M_G * m + OKLAB.M1I_S_G * s - 1
    const g1 = OKLAB.M1I_L_G * ldt + OKLAB.M1I_M_G * mdt + OKLAB.M1I_S_G * sdt
    const g2 = OKLAB.M1I_L_G * ldt2 + OKLAB.M1I_M_G * mdt2 + OKLAB.M1I_S_G * sdt2
    const u_g = g1 / (g1 * g1 - 0.5 * g * g2)
    let t_g = -g * u_g

    const bb = OKLAB.M1I_L_B * l + OKLAB.M1I_M_B * m + OKLAB.M1I_S_B * s - 1
    const b1 = OKLAB.M1I_L_B * ldt + OKLAB.M1I_M_B * mdt + OKLAB.M1I_S_B * sdt
    const b2 = OKLAB.M1I_L_B * ldt2 + OKLAB.M1I_M_B * mdt2 + OKLAB.M1I_S_B * sdt2
    const u_b = b1 / (b1 * b1 - 0.5 * bb * b2)
    let t_b = -bb * u_b

    t_r = u_r >= 0 ? t_r : 10e5
    t_g = u_g >= 0 ? t_g : 10e5
    t_b = u_b >= 0 ? t_b : 10e5

    t += Math.min(t_r, Math.min(t_g, t_b))
  }
  return t
}

function stMid(P, a, b) {
  return P[0] + 1 / (P[1] + P[2] * b + a * (P[3] + P[4] * b + a * (P[5] + P[6] * b + a * (P[7] + P[8] * b + P[9] * a))))
}

// Okhsl's three chroma scales at OKLab lightness L and hue direction (a, b): [C_0, C_mid, C_max].
function findCs(L, a, b) {
  const [cuspL, cuspC] = findCusp(a, b)

  const C_max = findGamutIntersection(a, b, L, 1, L, cuspL, cuspC)
  const S_max = cuspC / cuspL
  const T_max = cuspC / (1 - cuspL)

  const S_mid = stMid(OKGAMUT.S_MID, a, b)
  const T_mid = stMid(OKGAMUT.T_MID, a, b)

  const k = C_max / Math.min(L * S_max, (1 - L) * T_max)

  let C_a = L * S_mid
  let C_b = (1 - L) * T_mid
  const C_mid = 0.9 * k * Math.sqrt(Math.sqrt(1 / (1 / (C_a * C_a * C_a * C_a) + 1 / (C_b * C_b * C_b * C_b))))

  C_a = L * 0.4
  C_b = (1 - L) * 0.8
  const C_0 = Math.sqrt(1 / (1 / (C_a * C_a) + 1 / (C_b * C_b)))

  return [C_0, C_mid, C_max]
}

/**
 * Okhsl → linear sRGB, unclamped. h in degrees, s and l in 0–100. l ≥ 100 is white and l ≤ 0 is
 * black. s = 100 can land a hair outside the gamut (down to about −0.005) because the reference's
 * gamut cusp is a polynomial fit; the renderer clamps before encoding, as core's okhslToRgb does.
 */
export function okhslToLinearSrgb(h, s, l) {
  const ln = l / 100
  if (ln >= 1) return [1, 1, 1]
  if (ln <= 0) return [0, 0, 0]
  const MID = OKGAMUT.OKHSL_MID
  const MID_INV = 1 / MID
  const sn = s / 100
  const hRad = (h * Math.PI) / 180
  const a_ = Math.cos(hRad)
  const b_ = Math.sin(hRad)
  const L = toeInv(ln)

  const [C_0, C_mid, C_max] = findCs(L, a_, b_)

  let C
  if (sn < MID) {
    const t = MID_INV * sn
    const k_1 = MID * C_0
    const k_2 = 1 - k_1 / C_mid
    C = (t * k_1) / (1 - k_2 * t)
  } else {
    const t = (sn - MID) / (1 - MID)
    const k_1 = ((1 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0
    const k_2 = 1 - k_1 / (C_max - C_mid)
    C = C_mid + (t * k_1) / (1 - k_2 * t)
  }

  return oklabToLinearSrgb(L, C * a_, C * b_)
}

/**
 * Okhsv → linear sRGB, unclamped. h in degrees, s and v in 0–100. s = v = 100 is the gamut cusp
 * for that hue; like Okhsl, the cusp fit can overshoot by a hair, so clamp before encoding.
 */
export function okhsvToLinearSrgb(h, s, v) {
  const S_0 = OKGAMUT.OKHSV_S0
  const sn = s / 100
  const vn = v / 100
  const hRad = (h * Math.PI) / 180
  const a_ = Math.cos(hRad)
  const b_ = Math.sin(hRad)

  const [cuspL, cuspC] = findCusp(a_, b_)
  const S_max = cuspC / cuspL
  const T_max = cuspC / (1 - cuspL)
  const k = 1 - S_0 / S_max

  const denom = S_0 + T_max - T_max * k * sn
  const L_v = 1 - (sn * S_0) / denom
  const C_v = (sn * T_max * S_0) / denom

  const L_vt = toeInv(L_v)
  const C_vt = (C_v * L_vt) / L_v

  const L_new = toeInv(vn * L_v)
  let C = (C_v * L_new) / L_v

  const lin = oklabToLinearSrgb(L_vt, a_ * C_vt, b_ * C_vt)
  const scale_L = Math.cbrt(1 / Math.max(lin[0], lin[1], lin[2], 0))

  const L = L_new * scale_L
  C = C * scale_L

  return oklabToLinearSrgb(L, C * a_, C * b_)
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

// The chroma search is polar; a Cartesian model name means its polar twin.
// Unknown names throw rather than silently computing for the wrong model —
// the result would look plausible and be wrong.
const POLAR_TWIN = { oklch: 'oklch', oklab: 'oklch', lch: 'lch', lab: 'lch' }

function toPolarModel(model) {
  const polar = POLAR_TWIN[model]
  if (!polar) throw new RangeError(`[@colordx/gpu] unknown model "${model}" (oklch, lch, oklab, lab)`)
  return polar
}

function toGamutLinear(gamut) {
  const fn = GAMUT_TO_LINEAR[gamut]
  if (!fn) throw new RangeError(`[@colordx/gpu] unknown gamut "${gamut}" (srgb, p3, a98, rec2020, prophoto)`)
  return fn
}

function assertFinite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`[@colordx/gpu] ${name} must be a finite number, got ${value}`)
  }
}

function inGamut(model, toLinear, l, c, h) {
  const lin = model === 'lch' ? lchToLinearSrgb(l, c, h) : oklchToLinearSrgb(l, c, h)
  const ch = toLinear(lin)
  return ch.every(v => v >= -GAMUT_EPS && v <= 1 + GAMUT_EPS)
}

// Largest in-gamut chroma at this lightness/hue, by bisection on the same
// colordx math the shader runs — so the LUT is parity-correct by construction.
function maxChromaAt(model, toLinear, l, h) {
  if (!inGamut(model, toLinear, l, 0, h)) return 0
  let lo = 0
  let hi = model === 'lch' ? 200 : 0.5
  for (let i = 0; i < 40 && inGamut(model, toLinear, l, hi, h); i++) {
    lo = hi
    hi *= 2
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(model, toLinear, l, mid, h)) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Max in-gamut chroma at one (lightness, hue) point — the value the LUT
 * builders sample on a grid. Use it to clamp a picker's chroma into a gamut,
 * or to place a handle on the true gamut edge. Returns 0 when even the
 * achromatic color at that lightness is out of gamut (L outside 0..L_MAX).
 *
 * @param {object} opts
 * @param {'oklch'|'lch'|'oklab'|'lab'} [opts.model='oklch'] model (a Cartesian name means its polar twin)
 * @param {number} opts.lightness fixed lightness (model's native range: 0..1 ok*, 0..100 CIE)
 * @param {number} opts.hue fixed hue (degrees)
 * @param {'srgb'|'p3'|'a98'|'rec2020'|'prophoto'} [opts.gamut='srgb'] gamut to test against
 * @returns {number}
 */
export function maxChroma({ model = 'oklch', lightness, hue, gamut = 'srgb' } = {}) {
  assertFinite(lightness, 'lightness')
  assertFinite(hue, 'hue')
  return maxChromaAt(toPolarModel(model), toGamutLinear(gamut), lightness, hue)
}

/**
 * Build a per-row chroma stretch LUT for paint({ chromaLUT }). Entry i is the
 * max in-gamut chroma at lightness i/(size-1) of the lightness axis, for a
 * fixed hue — the slice the renderer normalizes so the gamut edge fills the
 * chroma axis. Built by binary search on colordx math, so it matches the
 * shader's own classification.
 *
 * @param {object} opts
 * @param {'oklch'|'lch'|'oklab'|'lab'} [opts.model='oklch'] model the chart renders (a Cartesian name means its polar twin)
 * @param {number} opts.hue fixed hue (degrees)
 * @param {'srgb'|'p3'|'a98'|'rec2020'|'prophoto'} [opts.gamut='srgb'] gamut to fill
 * @param {number} [opts.size=128] entries (any length ≥ 2; the renderer reads the array's length)
 * @returns {Float32Array}
 */
export function maxChromaLUT({ model = 'oklch', hue, gamut = 'srgb', size = CHROMA_LUT_SIZE } = {}) {
  assertFinite(hue, 'hue')
  const polarModel = toPolarModel(model)
  const toLinear = toGamutLinear(gamut)
  const lMax = polarModel === 'lch' ? 100 : 1
  const lut = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const l = size === 1 ? 0 : (i / (size - 1)) * lMax
    lut[i] = maxChromaAt(polarModel, toLinear, l, hue)
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
 * @param {number} [opts.size=128] entries (any length ≥ 2; the renderer reads the array's length)
 * @returns {Float32Array}
 */
export function maxChromaRadialLUT({ model = 'oklch', lightness, gamut = 'srgb', size = CHROMA_LUT_SIZE } = {}) {
  assertFinite(lightness, 'lightness')
  const polarModel = toPolarModel(model)
  const toLinear = toGamutLinear(gamut)
  const lut = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    lut[i] = maxChromaAt(polarModel, toLinear, lightness, (i / size) * 360)
  }
  return lut
}

/**
 * Read a `maxChromaLUT` the way the shader does: linear interpolation between
 * the two nearest entries, clamped to the ends, at normalized lightness t
 * (= L / L_MAX, 0..1). Use it to put a picker handle exactly where the GPU
 * drew the stretched edge: screenY = chroma / sampleChromaLUT(lut, L / L_MAX).
 *
 * @param {ArrayLike<number>} lut
 * @param {number} t normalized lightness, 0..1
 * @returns {number}
 */
export function sampleChromaLUT(lut, t) {
  const n = lut.length
  if (n === 0) return 0
  const x = Math.min(Math.max(t, 0), 1) * (n - 1)
  const i = Math.floor(x)
  const j = Math.min(i + 1, n - 1)
  return lut[i] + (lut[j] - lut[i]) * (x - i)
}

/**
 * Read a `maxChromaRadialLUT` the way the shader does: linear interpolation
 * on the periodic hue grid (entry i at 360*i/length degrees, wrapping the last
 * entry back to the first). Use it to map a picker's (a, b) onto the unit disc
 * the GPU drew: r = chroma / sampleRadialLUT(lut, hue).
 *
 * @param {ArrayLike<number>} lut
 * @param {number} hue degrees, any range (wraps)
 * @returns {number}
 */
export function sampleRadialLUT(lut, hue) {
  const n = lut.length
  if (n === 0) return 0
  const t = hue / 360
  const x = (t - Math.floor(t)) * n
  const i = Math.floor(x)
  const j = i + 1 >= n ? 0 : i + 1
  return lut[i] + (lut[j] - lut[i]) * (x - i)
}
