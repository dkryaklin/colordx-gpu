// Numeric constants mirrored from @colordx/core source. The parity test in
// test/parity.test.mjs asserts these stay byte-identical with the library, so
// the GPU and CPU pipelines can never silently drift apart.

// src/colorModels/oklab.ts — OKLab → LMS' (a/b contributions) and LMS → linear sRGB
export const OKLAB = {
  M2I_A_L: 0.3963377774,
  M2I_B_L: 0.2158037573,
  M2I_A_M: -0.1055613458,
  M2I_B_M: -0.0638541728,
  M2I_A_S: -0.0894841775,
  M2I_B_S: -1.291485548,
  M1I_L_R: 4.0767416613,
  M1I_M_R: -3.3077115904,
  M1I_S_R: 0.2309699287,
  M1I_L_G: -1.2684380041,
  M1I_M_G: 2.6097574007,
  M1I_S_G: -0.3413193963,
  M1I_L_B: -0.0041960865,
  M1I_M_B: -0.7034186145,
  M1I_S_B: 1.7076147009,
}

// src/colorModels/lab.ts + xyz.ts — CIE Lab (D50) path
export const LAB = {
  EPSILON: 216 / 24389,
  KAPPA: 24389 / 27,
  WX: 96.42956752983539,
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
// (zero blue contributions on the r/g rows are correct per spec)
export const SRGB_TO_P3 = [
  0.8224619687, 0.1775380313, 0,
  0.0331941989, 0.9668058011, 0,
  0.0170826307, 0.0723974407, 0.9105199286,
]

// src/colorModels/rec2020.ts — linear sRGB → linear Rec.2020, row-major
export const SRGB_TO_REC2020 = [
  0.6274038959, 0.3292830384, 0.0433130657,
  0.0690972894, 0.9195403951, 0.0113623156,
  0.0163914389, 0.0880133079, 0.8955952532,
]
