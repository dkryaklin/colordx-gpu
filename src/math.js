// JS twin of the shader math, built from the same constants module that
// generates the GLSL. Used by the parity test (vs @colordx/core) and usable
// as a reference implementation.

import { D50_TO_D65, LAB, OKLAB, SRGB_TO_P3, SRGB_TO_REC2020, XYZ_TO_SRGB } from './constants.js'

const DEG_TO_RAD = Math.PI / 180

export function oklchToLinearSrgb(l, c, h) {
  const hr = h * DEG_TO_RAD
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const l_ = l + OKLAB.M2I_A_L * a + OKLAB.M2I_B_L * b
  const m_ = l + OKLAB.M2I_A_M * a + OKLAB.M2I_B_M * b
  const s_ = l + OKLAB.M2I_A_S * a + OKLAB.M2I_B_S * b
  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3
  return [
    OKLAB.M1I_L_R * l3 + OKLAB.M1I_M_R * m3 + OKLAB.M1I_S_R * s3,
    OKLAB.M1I_L_G * l3 + OKLAB.M1I_M_G * m3 + OKLAB.M1I_S_G * s3,
    OKLAB.M1I_L_B * l3 + OKLAB.M1I_M_B * m3 + OKLAB.M1I_S_B * s3,
  ]
}

export function lchToLinearSrgb(l, c, h) {
  const hr = h * DEG_TO_RAD
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const fy = (l + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  const x = (fx ** 3 > LAB.EPSILON ? fx ** 3 : (116 * fx - 16) / LAB.KAPPA) * LAB.WX
  const y = (l > 8 ? fy ** 3 : l / LAB.KAPPA) * LAB.WY
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

// sRGB / Display-P3 transfer, extended sign-preserving per CSS Color 4
export function srgbFromLinear(n) {
  const abs = Math.abs(n)
  const encoded = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055
  return n < 0 ? -encoded : encoded
}
