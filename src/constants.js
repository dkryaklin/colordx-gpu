// Numeric constants mirrored from @colordx/core source. The parity test in
// test/parity.test.mjs asserts these stay byte-identical with the library, so
// the GPU and CPU pipelines can never silently drift apart.

// Default entry count for the chroma stretch LUT builders. The shader reads the
// length from the array it's given (u_lutN), so any size works; this is just
// the default that balances edge precision against build time.
export const CHROMA_LUT_SIZE = 128

// src/colorModels/oklab.ts — OKLab → LMS' (a/b contributions) and LMS → linear sRGB.
// Full-precision CSS Color 4 matrices (core 7.0.0): each pair is a float64 inverse,
// unlike Ottosson's published 10-digit values.
export const OKLAB = {
  M2I_A_L: 0.3963377773761749,
  M2I_B_L: 0.2158037573099136,
  M2I_A_M: -0.1055613458156586,
  M2I_B_M: -0.0638541728258133,
  M2I_A_S: -0.0894841775298119,
  M2I_B_S: -1.2914855480194092,
  M1I_L_R: 4.076741636075957,
  M1I_M_R: -3.307711539258061,
  M1I_S_R: 0.23096990318210464,
  M1I_L_G: -1.2684379732850313,
  M1I_M_G: 2.609757349287688,
  M1I_S_G: -0.3413193760026571,
  M1I_L_B: -0.004196076138675536,
  M1I_M_B: -0.7034186179359361,
  M1I_S_B: 1.7076146940746113,
}

// src/colorModels/lab.ts + xyz.ts — CIE Lab (D50) path
export const LAB = {
  EPSILON: 216 / 24389,
  KAPPA: 24389 / 27,
  // D50 X derived from its CSS chromaticity (core 7.0.0), so white is lab(100 0 0) exactly
  WX: (0.3457 / 0.3585) * 100,
  WY: 100,
  WZ: 82.51046025104603,
}

// src/colorModels/xyz.ts — Bradford D50 → D65 (CSS Color 4), row-major
export const D50_TO_D65 = [
  0.955473421488075, -0.02309845494876471, 0.06325924320057072,
  -0.0283697093338637, 1.0099953980813041, 0.021041441191917323,
  0.012314014864481998, -0.020507649298898964, 1.330365926242124,
]

// src/colorModels/xyz.ts — XYZ D65 (0–100 scale) → linear sRGB, row-major
export const XYZ_TO_SRGB = [
  0.032409699419045213, -0.015373831775700935, -0.0049861076029300327,
  -0.0096924363628087984, 0.018759675015077206, 0.00041555057407175612,
  0.00055630079696993608, -0.0020397695888897657, 0.010569715142428786,
]

// src/colorModels/p3.ts — linear sRGB → linear Display-P3, row-major
// (zero blue contributions on the r/g rows are correct per spec: sRGB and P3 share a blue primary)
export const SRGB_TO_P3 = [
  0.8224619687143623, 0.17753803128563772, 0,
  0.03319419885096158, 0.9668058011490382, 0,
  0.017082630721120033, 0.07239744066396347, 0.9105199286149166,
]

// src/colorModels/rec2020.ts — linear sRGB → linear Rec.2020, row-major
export const SRGB_TO_REC2020 = [
  0.627403895934699, 0.3292830383778836, 0.043313065687417246,
  0.06909728935823205, 0.9195403950754587, 0.011362315566309173,
  0.01639143887515028, 0.08801330787722576, 0.895595253247624,
]

// src/colorModels/a98rgb.ts — linear sRGB → linear A98 (Adobe RGB 1998, D65), row-major.
// Sparse by construction: A98 shares sRGB's red/blue primaries and white point, so green
// passes through unchanged (identity row) and there are no red↔blue cross-terms.
export const SRGB_TO_A98 = [
  0.71512560685562476, 0.2848743931443754, 0,
  0, 1, 0,
  0, 0.04116194845011846, 0.95883805154988155,
]

// src/colorModels/prophoto.ts — linear sRGB → linear ProPhoto (ROMM RGB, D50), row-major.
// Composes the prophoto↔XYZ-D50 matrices with the library's Bradford D65↔D50 adaptation,
// so chromatic adaptation matches the Lab/XYZ pipeline.
export const SRGB_TO_PROPHOTO = [
  0.52927697762261172, 0.330154501978493, 0.14056852039889559,
  0.098365859540449255, 0.87347071290696165, 0.028163427552589011,
  0.016875340921386848, 0.11765941425612084, 0.86546524482249232,
]

// src/colorModels/okgamut.ts + okhsl.ts + okhsv.ts — Björn Ottosson's sRGB gamut geometry in
// OKLab (https://bottosson.github.io/posts/colorpicker/), shared by the Okhsl and Okhsv models.
// All of it is sRGB-specific: the max-saturation polynomial, the ST_mid fit and the Halley steps
// are fitted to the sRGB gamut. The wl/wm/ws weights are the OKLab → linear-sRGB row for the
// channel that hits zero first, as printed in the gamut clipping post (they differ from OKLAB.M1I_*
// in the 10th digit; the Halley step converges to the same answer either way).
export const OKGAMUT = {
  // L_r toe: pins a reference white at Y = 1 so L_r tracks CIELab L
  K1: 0.206,
  K2: 0.03,
  // computeMaxSaturation sectors: [test a, test b] (sector when test·(a,b) > 1), k0..k4, [wl, wm, ws]
  RED: {
    test: [-1.88170328, -0.80936493],
    k: [1.19086277, 1.76576728, 0.59662641, 0.75515197, 0.56771245],
    w: [4.0767416621, -3.3077115913, 0.2309699292],
  },
  GREEN: {
    test: [1.81444104, -1.19445276],
    k: [0.73956515, -0.45954404, 0.08285427, 0.1254107, 0.14503204],
    w: [-1.2684380046, 2.6097574011, -0.3413193965],
  },
  BLUE: {
    k: [1.35733652, -0.00915799, -1.1513021, -0.50559606, 0.00692167],
    w: [-0.0041960863, -0.7034186147, 1.707614701],
  },
  // ST_mid: smooth fit of the cusp, P[0] + 1 / (P[1] + P[2] b + a (P[3] + P[4] b + a (P[5] + P[6] b + a (P[7] + P[8] b + P[9] a))))
  S_MID: [0.11516993, 7.4477897, 4.1590124, -2.19557347, 1.75198401, -2.13704948, -10.02301043, -4.24894561, 5.38770819, 4.69891013],
  T_MID: [0.11239642, 1.6132032, -0.68124379, 0.40370612, 0.90148123, -0.27087943, 0.6122399, 0.00299215, -0.45399568, -0.14661872],
  // Okhsl: saturation where the C_0 → C_mid blend hands over to C_mid → C_max
  OKHSL_MID: 0.8,
  // Okhsv: slope of the saturation remap near s = 0 (s = 1 sits at the cusp)
  OKHSV_S0: 0.5,
}
