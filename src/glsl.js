// GLSL sources, generated from the same constants module as the JS twin so
// shader math is colordx math by construction.

import {
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

// format a JS number as a GLSL float literal
const f = n => {
  const s = String(n)
  return /[.e]/.test(s) ? s : s + '.0'
}

// row-major 3x3 → GLSL expression applying it to vec3 `v`
const mulRow = (M, v, row) =>
  `${f(M[row * 3])} * ${v}.x + ${f(M[row * 3 + 1])} * ${v}.y + ${f(M[row * 3 + 2])} * ${v}.z`
const mul3 = (M, v) =>
  `vec3(${mulRow(M, v, 0)}, ${mulRow(M, v, 1)}, ${mulRow(M, v, 2)})`

export const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`

// Cartesian cores: (L, a, b) → linear sRGB. The polar models reach these via a
// thin wrapper that turns (C, H) into (a, b); the Cartesian models call them
// directly, so oklch/oklab (and lch/lab) share one tested conversion.
const OKLAB_CORE = `
vec3 oklabToLinearSrgb(float L, float a, float b) {
  float l_ = L + ${f(OKLAB.M2I_A_L)} * a + ${f(OKLAB.M2I_B_L)} * b;
  float m_ = L + ${f(OKLAB.M2I_A_M)} * a + ${f(OKLAB.M2I_B_M)} * b;
  float s_ = L + ${f(OKLAB.M2I_A_S)} * a + ${f(OKLAB.M2I_B_S)} * b;
  float l3 = l_ * l_ * l_;
  float m3 = m_ * m_ * m_;
  float s3 = s_ * s_ * s_;
  return vec3(
    ${f(OKLAB.M1I_L_R)} * l3 + ${f(OKLAB.M1I_M_R)} * m3 + ${f(OKLAB.M1I_S_R)} * s3,
    ${f(OKLAB.M1I_L_G)} * l3 + ${f(OKLAB.M1I_M_G)} * m3 + ${f(OKLAB.M1I_S_G)} * s3,
    ${f(OKLAB.M1I_L_B)} * l3 + ${f(OKLAB.M1I_M_B)} * m3 + ${f(OKLAB.M1I_S_B)} * s3);
}`

const LAB_CORE = `
vec3 labToLinearSrgb(float L, float a, float b) {
  float fy = (L + 16.0) / 116.0;
  float fx = a / 500.0 + fy;
  float fz = fy - b / 200.0;
  vec3 xyz = vec3(
    (fx * fx * fx > ${f(LAB.EPSILON)} ? fx * fx * fx : (116.0 * fx - 16.0) / ${f(LAB.KAPPA)}) * ${f(LAB.WX)},
    (L > 8.0 ? fy * fy * fy : L / ${f(LAB.KAPPA)}) * ${f(LAB.WY)},
    (fz * fz * fz > ${f(LAB.EPSILON)} ? fz * fz * fz : (116.0 * fz - 16.0) / ${f(LAB.KAPPA)}) * ${f(LAB.WZ)});
  vec3 d65 = ${mul3(D50_TO_D65, 'xyz')};
  return ${mul3(XYZ_TO_SRGB, 'd65')};
}`

// Björn Ottosson's sRGB gamut geometry in OKLab (toe, cusp, gamut intersection, Okhsl chroma
// scales), generated from the same OKGAMUT constants as the JS twin in math.js, line for line.
const sector = sec => `k = vec2(${f(sec.k[0])}, ${f(sec.k[1])}); k2 = vec3(${f(sec.k[2])}, ${f(sec.k[3])}, ${f(sec.k[4])}); w = vec3(${f(sec.w[0])}, ${f(sec.w[1])}, ${f(sec.w[2])});`
const stMid = P =>
  `${f(P[0])} + 1.0 / (${f(P[1])} + ${f(P[2])} * b + a * (${f(P[3])} + ${f(P[4])} * b + a * (${f(P[5])} + ${f(P[6])} * b + a * (${f(P[7])} + ${f(P[8])} * b + ${f(P[9])} * a))))`

const OKGAMUT_CORE = `
const float K1 = ${f(OKGAMUT.K1)};
const float K2 = ${f(OKGAMUT.K2)};
const float K3 = (1.0 + K1) / (1.0 + K2);
float toe(float x) {
  return 0.5 * (K3 * x - K1 + sqrt((K3 * x - K1) * (K3 * x - K1) + 4.0 * K2 * K3 * x));
}
float toeInv(float x) {
  return (x * x + K1 * x) / (K3 * (x + K2));
}
float computeMaxSaturation(float a, float b) {
  vec2 k; vec3 k2; vec3 w;
  if (${f(OKGAMUT.RED.test[0])} * a + ${f(OKGAMUT.RED.test[1])} * b > 1.0) {
    ${sector(OKGAMUT.RED)}
  } else if (${f(OKGAMUT.GREEN.test[0])} * a + ${f(OKGAMUT.GREEN.test[1])} * b > 1.0) {
    ${sector(OKGAMUT.GREEN)}
  } else {
    ${sector(OKGAMUT.BLUE)}
  }
  float S = k.x + k.y * a + k2.x * b + k2.y * a * a + k2.z * a * b;
  float k_l = ${f(OKLAB.M2I_A_L)} * a + ${f(OKLAB.M2I_B_L)} * b;
  float k_m = ${f(OKLAB.M2I_A_M)} * a + ${f(OKLAB.M2I_B_M)} * b;
  float k_s = ${f(OKLAB.M2I_A_S)} * a + ${f(OKLAB.M2I_B_S)} * b;
  float l_ = 1.0 + S * k_l;
  float m_ = 1.0 + S * k_m;
  float s_ = 1.0 + S * k_s;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  float l_dS = 3.0 * k_l * l_ * l_;
  float m_dS = 3.0 * k_m * m_ * m_;
  float s_dS = 3.0 * k_s * s_ * s_;
  float l_dS2 = 6.0 * k_l * k_l * l_;
  float m_dS2 = 6.0 * k_m * k_m * m_;
  float s_dS2 = 6.0 * k_s * k_s * s_;
  float f0 = w.x * l + w.y * m + w.z * s;
  float f1 = w.x * l_dS + w.y * m_dS + w.z * s_dS;
  float f2 = w.x * l_dS2 + w.y * m_dS2 + w.z * s_dS2;
  return S - (f0 * f1) / (f1 * f1 - 0.5 * f0 * f2);
}
vec2 findCusp(float a, float b) {
  float S = computeMaxSaturation(a, b);
  vec3 lin = oklabToLinearSrgb(1.0, S * a, S * b);
  float L = pow(1.0 / max(max(lin.r, lin.g), lin.b), 1.0 / 3.0);
  return vec2(L, L * S);
}`

const OKHSL_CORE = OKGAMUT_CORE + `
float findGamutIntersection(float a, float b, float L1, float C1, float L0, float cuspL, float cuspC) {
  float t;
  if ((L1 - L0) * cuspC - (cuspL - L0) * C1 <= 0.0) {
    t = (cuspC * L0) / (C1 * cuspL + cuspC * (L0 - L1));
  } else {
    t = (cuspC * (L0 - 1.0)) / (C1 * (cuspL - 1.0) + cuspC * (L0 - L1));
    float dL = L1 - L0;
    float dC = C1;
    float k_l = ${f(OKLAB.M2I_A_L)} * a + ${f(OKLAB.M2I_B_L)} * b;
    float k_m = ${f(OKLAB.M2I_A_M)} * a + ${f(OKLAB.M2I_B_M)} * b;
    float k_s = ${f(OKLAB.M2I_A_S)} * a + ${f(OKLAB.M2I_B_S)} * b;
    float l_dt = dL + dC * k_l;
    float m_dt = dL + dC * k_m;
    float s_dt = dL + dC * k_s;
    float L = L0 * (1.0 - t) + t * L1;
    float C = t * C1;
    float l_ = L + C * k_l;
    float m_ = L + C * k_m;
    float s_ = L + C * k_s;
    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;
    float ldt = 3.0 * l_dt * l_ * l_;
    float mdt = 3.0 * m_dt * m_ * m_;
    float sdt = 3.0 * s_dt * s_ * s_;
    float ldt2 = 6.0 * l_dt * l_dt * l_;
    float mdt2 = 6.0 * m_dt * m_dt * m_;
    float sdt2 = 6.0 * s_dt * s_dt * s_;
    float r = ${f(OKLAB.M1I_L_R)} * l + ${f(OKLAB.M1I_M_R)} * m + ${f(OKLAB.M1I_S_R)} * s - 1.0;
    float r1 = ${f(OKLAB.M1I_L_R)} * ldt + ${f(OKLAB.M1I_M_R)} * mdt + ${f(OKLAB.M1I_S_R)} * sdt;
    float r2 = ${f(OKLAB.M1I_L_R)} * ldt2 + ${f(OKLAB.M1I_M_R)} * mdt2 + ${f(OKLAB.M1I_S_R)} * sdt2;
    float u_r = r1 / (r1 * r1 - 0.5 * r * r2);
    float t_r = -r * u_r;
    float g = ${f(OKLAB.M1I_L_G)} * l + ${f(OKLAB.M1I_M_G)} * m + ${f(OKLAB.M1I_S_G)} * s - 1.0;
    float g1 = ${f(OKLAB.M1I_L_G)} * ldt + ${f(OKLAB.M1I_M_G)} * mdt + ${f(OKLAB.M1I_S_G)} * sdt;
    float g2 = ${f(OKLAB.M1I_L_G)} * ldt2 + ${f(OKLAB.M1I_M_G)} * mdt2 + ${f(OKLAB.M1I_S_G)} * sdt2;
    float u_g = g1 / (g1 * g1 - 0.5 * g * g2);
    float t_g = -g * u_g;
    float bb = ${f(OKLAB.M1I_L_B)} * l + ${f(OKLAB.M1I_M_B)} * m + ${f(OKLAB.M1I_S_B)} * s - 1.0;
    float b1 = ${f(OKLAB.M1I_L_B)} * ldt + ${f(OKLAB.M1I_M_B)} * mdt + ${f(OKLAB.M1I_S_B)} * sdt;
    float b2 = ${f(OKLAB.M1I_L_B)} * ldt2 + ${f(OKLAB.M1I_M_B)} * mdt2 + ${f(OKLAB.M1I_S_B)} * sdt2;
    float u_b = b1 / (b1 * b1 - 0.5 * bb * b2);
    float t_b = -bb * u_b;
    t_r = u_r >= 0.0 ? t_r : 1000000.0;
    t_g = u_g >= 0.0 ? t_g : 1000000.0;
    t_b = u_b >= 0.0 ? t_b : 1000000.0;
    t += min(t_r, min(t_g, t_b));
  }
  return t;
}
vec3 findCs(float L, float a, float b) {
  vec2 cusp = findCusp(a, b);
  float cuspL = cusp.x;
  float cuspC = cusp.y;
  float C_max = findGamutIntersection(a, b, L, 1.0, L, cuspL, cuspC);
  float S_max = cuspC / cuspL;
  float T_max = cuspC / (1.0 - cuspL);
  float S_mid = ${stMid(OKGAMUT.S_MID)};
  float T_mid = ${stMid(OKGAMUT.T_MID)};
  float k = C_max / min(L * S_max, (1.0 - L) * T_max);
  float C_a = L * S_mid;
  float C_b = (1.0 - L) * T_mid;
  float C_mid = 0.9 * k * sqrt(sqrt(1.0 / (1.0 / (C_a * C_a * C_a * C_a) + 1.0 / (C_b * C_b * C_b * C_b))));
  C_a = L * 0.4;
  C_b = (1.0 - L) * 0.8;
  float C_0 = sqrt(1.0 / (1.0 / (C_a * C_a) + 1.0 / (C_b * C_b)));
  return vec3(C_0, C_mid, C_max);
}
vec3 toLinearSrgb(float h, float s, float l) {
  float ln = l / 100.0;
  if (ln >= 1.0) return vec3(1.0);
  if (ln <= 0.0) return vec3(0.0);
  const float MID = ${f(OKGAMUT.OKHSL_MID)};
  const float MID_INV = 1.0 / MID;
  float sn = s / 100.0;
  float hRad = radians(h);
  float a_ = cos(hRad);
  float b_ = sin(hRad);
  float L = toeInv(ln);
  vec3 cs = findCs(L, a_, b_);
  float C_0 = cs.x;
  float C_mid = cs.y;
  float C_max = cs.z;
  float C;
  if (sn < MID) {
    float t = MID_INV * sn;
    float k_1 = MID * C_0;
    float k_2 = 1.0 - k_1 / C_mid;
    C = (t * k_1) / (1.0 - k_2 * t);
  } else {
    float t = (sn - MID) / (1.0 - MID);
    float k_1 = ((1.0 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0;
    float k_2 = 1.0 - k_1 / (C_max - C_mid);
    C = C_mid + (t * k_1) / (1.0 - k_2 * t);
  }
  return oklabToLinearSrgb(L, C * a_, C * b_);
}`

const OKHSV_CORE = OKGAMUT_CORE + `
vec3 toLinearSrgb(float h, float s, float v) {
  const float S_0 = ${f(OKGAMUT.OKHSV_S0)};
  float sn = s / 100.0;
  float vn = v / 100.0;
  float hRad = radians(h);
  float a_ = cos(hRad);
  float b_ = sin(hRad);
  vec2 cusp = findCusp(a_, b_);
  float S_max = cusp.y / cusp.x;
  float T_max = cusp.y / (1.0 - cusp.x);
  float k = 1.0 - S_0 / S_max;
  float denom = S_0 + T_max - T_max * k * sn;
  float L_v = 1.0 - (sn * S_0) / denom;
  float C_v = (sn * T_max * S_0) / denom;
  float L_vt = toeInv(L_v);
  float C_vt = (C_v * L_vt) / L_v;
  float L_new = toeInv(vn * L_v);
  float C = (C_v * L_new) / L_v;
  vec3 lin = oklabToLinearSrgb(L_vt, a_ * C_vt, b_ * C_vt);
  float scale_L = pow(1.0 / max(max(max(lin.r, lin.g), lin.b), 0.0), 1.0 / 3.0);
  float L = L_new * scale_L;
  C = C * scale_L;
  return oklabToLinearSrgb(L, C * a_, C * b_);
}`

// model → (core, wrapper). Wrapper always exposes toLinearSrgb(c0, c1, c2)
// taking the model's three native components in slot order.
const CONVERSIONS = {
  oklch: OKLAB_CORE + `
vec3 toLinearSrgb(float l, float c, float h) {
  float hr = radians(h);
  return oklabToLinearSrgb(l, c * cos(hr), c * sin(hr));
}`,
  oklab: OKLAB_CORE + `
vec3 toLinearSrgb(float L, float a, float b) { return oklabToLinearSrgb(L, a, b); }`,
  lch: LAB_CORE + `
vec3 toLinearSrgb(float l, float c, float h) {
  float hr = radians(h);
  return labToLinearSrgb(l, c * cos(hr), c * sin(hr));
}`,
  lab: LAB_CORE + `
vec3 toLinearSrgb(float L, float a, float b) { return labToLinearSrgb(L, a, b); }`,
  okhsl: OKLAB_CORE + OKHSL_CORE,
  okhsv: OKLAB_CORE + OKHSV_CORE,
}

export const GAMUT_MODELS = ['oklch', 'lch', 'oklab', 'lab']
export const CYLINDER_MODELS = ['okhsl', 'okhsv']

const HELPERS = `
vec3 srgbEncode(vec3 c) {
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float overflow(vec3 c) {
  vec3 d = max(c - 1.0, -c);
  return max(d.r, max(d.g, d.b));
}
float contour(float field, float px) {
  float d = abs(field) / px;
  return clamp(0.5 * u_borderWidth - d + 0.5, 0.0, 1.0);
}
vec4 blendBorder(vec4 fill, vec4 border, float cov) {
  float a = cov * border.a;
  return fill * (1.0 - a) + vec4(border.rgb, 1.0) * a;
}`

// Chroma-stretch LUTs in one R32F texture, texelFetch + manual lerp (no float-
// linear extension, full 32-bit). Row 0 = fill stretch; rows 1.. = per-border
// position LUTs, so borders draw analytically, not from the warped overflow field.
// u_lutN is the texture width (the caller's LUT length), so any size works.
const LUT_TEX = `
uniform bool u_stretch;
uniform highp sampler2D u_lutTex;
uniform int u_lutN;
const float TAU = 6.28318530718;`

// Polar 'cl': stretch chroma per lightness row; border at the analytic position
// pos_g(L) = maxChroma_g(L)/stretchScale(L), perpendicular-distance AA (slope
// term keeps width uniform where the boundary runs steep on screen). The LUT is
// indexed by absolute lightness (t = L / L_MAX), so a partial xMin..xMax range
// still reads the right rows; lightAxisPxT is screen pixels per unit t.
const POLAR_STRETCH = `
float sampleLUTrow(int row, float t) {
  float x = clamp(t, 0.0, 1.0) * float(u_lutN - 1);
  int i = int(floor(x));
  int j = min(i + 1, u_lutN - 1);
  float a = texelFetch(u_lutTex, ivec2(i, row), 0).r;
  float b = texelFetch(u_lutTex, ivec2(j, row), 0).r;
  return mix(a, b, x - float(i));
}
float samplePosLUT(int row, float t, out float slope) {
  float x = clamp(t, 0.0, 1.0) * float(u_lutN - 1);
  int i = int(floor(x));
  int j = min(i + 1, u_lutN - 1);
  float a = texelFetch(u_lutTex, ivec2(i, row), 0).r;
  float b = texelFetch(u_lutTex, ivec2(j, row), 0).r;
  slope = (b - a) * float(u_lutN - 1);
  return mix(a, b, x - float(i));
}
float stretchBorderCov(int row, float nChroma, float tLight, float chromaAxisPx, float lightAxisPxT) {
  float slope;
  float pos = samplePosLUT(row, tLight, slope);
  float s = slope * chromaAxisPx / lightAxisPxT;
  float dpx = abs(nChroma - pos) * chromaAxisPx / sqrt(1.0 + s * s);
  return clamp(0.5 * u_borderWidth - dpx + 0.5, 0.0, 1.0);
}`

// Radial 'ab': hue-indexed periodic LUT (samplers wrap N-1 → 0). Scale (na, nb)
// so the gamut edge maps to unit radius (disc fill); border distance is |f| over
// the analytic screen-gradient of f = r - pos(angle) — no hardware derivative, so
// the LUT warp can't corrupt the width.
const RADIAL_STRETCH = `
float sampleLUTwrap(int row, float t) {
  float x = fract(t) * float(u_lutN);
  int i = int(floor(x));
  int j = i + 1 >= u_lutN ? 0 : i + 1;
  float a = texelFetch(u_lutTex, ivec2(i, row), 0).r;
  float b = texelFetch(u_lutTex, ivec2(j, row), 0).r;
  return mix(a, b, x - float(i));
}
float samplePosLUTwrap(int row, float t, out float slope) {
  float x = fract(t) * float(u_lutN);
  int i = int(floor(x));
  int j = i + 1 >= u_lutN ? 0 : i + 1;
  float a = texelFetch(u_lutTex, ivec2(i, row), 0).r;
  float b = texelFetch(u_lutTex, ivec2(j, row), 0).r;
  slope = (b - a) * float(u_lutN);
  return mix(a, b, x - float(i));
}
float radialBorderCov(int row, float na, float nb, float ka, float kb) {
  float r = max(length(vec2(na, nb)), 1e-6);
  float dpos;
  float pos = samplePosLUTwrap(row, atan(nb, na) / TAU, dpos);
  float f = r - pos;
  float inv = dpos / (TAU * r * r);
  float dfdna = na / r + nb * inv;
  float dfdnb = nb / r - na * inv;
  float gmag = max(length(vec2(dfdna * ka, dfdnb * kb)), 1e-9);
  return clamp(0.5 * u_borderWidth - abs(f) / gmag + 0.5, 0.0, 1.0);
}`

// Okhsl / Okhsv: the sRGB gamut is the whole plane by construction (a cylinder over the
// OKLCH hue), so there is no gamut to classify, no boundary to draw and no chroma to stretch —
// every fragment is a real sRGB color. The fragment is just the conversion, clamped (the
// reference's cusp fit can overshoot the gamut by a hair at s = 100, exactly as core's
// okhslToRgb / okhsvToRgb clamp) and quantized the same way as the gamut models.
function buildCylinderFragment(model) {
  return `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform int u_xComp, u_yComp, u_fixedComp;
uniform bool u_transpose;
uniform float u_value;
uniform float u_xMin, u_xMax, u_yMin, u_yMax;
uniform bool u_p3Out;

${CONVERSIONS[model]}
vec3 srgbEncode(vec3 c) {
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = (gl_FragCoord.xy + vec2(-0.5, 0.5)) / u_res;
  vec2 g = u_transpose ? uv.yx : uv;

  float comp[3];
  comp[u_xComp] = mix(u_xMin, u_xMax, g.x);
  comp[u_yComp] = mix(u_yMin, u_yMax, g.y);
  comp[u_fixedComp] = u_value;

  vec3 lin = clamp(toLinearSrgb(comp[0], comp[1], comp[2]), 0.0, 1.0);
  vec3 enc = u_p3Out
    ? srgbEncode(clamp(${mul3(SRGB_TO_P3, 'lin')}, 0.0, 1.0))
    : srgbEncode(lin);
  enc = floor(enc * 255.0 + 1e-3) / 255.0;
  frag = vec4(enc, 1.0);
}`
}

// Gamuts are independent layers, not a fixed nesting. Shader gamut index order
// is 0 srgb, 1 p3, 2 a98, 3 rec2020, 4 prophoto. u_fill[i]=1 adds gamut i to the
// filled union; u_borderGamut/u_borderColor list the border layers in draw order.
// A border draws wherever the fragment is filled OR inside the border's own gamut
// (by the same overflow test the fill uses, so the two can never disagree), so an
// outline for a gamut wider than the fill (e.g. a rec2020 edge over an sRGB fill)
// still shows: over the fill it's the usual two-sided line; over transparent it's
// the inner half, drawn premultiplied onto the empty background.
//
// Axes are generic: u_xComp/u_yComp/u_fixedComp pick which of the three model
// components each screen axis carries, so the same shader renders the polar
// planes (L/C/H) and the Cartesian ones (L/a/b). mix(min, max, coord) keeps the
// a/b axes able to span negatives.
//
// Screen-space derivatives (for the unstretched contour width) are taken for all
// five fields up front, in uniform control flow: dFdx/dFdy are undefined inside
// non-uniform branches, and the border loop is exactly that. Earlier builds took
// them inside the loop; on quads straddling the fill edge the result depended on
// what the compiler did with exited lanes, and changed with unrelated edits to
// the shader. Known limitation, unchanged in kind: right at the black cusp a
// channel can dip a hair below zero across a few pixels, so the max-of-channels
// field has a kink and the first-order estimate can paint a faint speck or two.
export function buildFragment(model) {
  if (!CONVERSIONS[model]) throw new RangeError(`[@colordx/gpu] unknown model "${model}" (${Object.keys(CONVERSIONS).join(', ')})`)
  if (CYLINDER_MODELS.includes(model)) return buildCylinderFragment(model)
  const polar = model === 'oklch' || model === 'lch'
  const cartesian = model === 'oklab' || model === 'lab'
  const lMax = model === 'lch' || model === 'lab' ? 100 : 1
  const contourExpr = 'contour(fld[u_borderGamut[k]], fldPx[u_borderGamut[k]])'
  const insideExpr = 'fld[u_borderGamut[k]] <= GAP'
  const borderCov = polar
    ? `u_stretch ? stretchBorderCov(k + 1, nChroma, tLight, chromaAxisPx, lightAxisPxT) : ${contourExpr}`
    : cartesian
      ? `u_stretch ? radialBorderCov(k + 1, na, nb, ka, kb) : ${contourExpr}`
      : contourExpr
  return `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform int u_xComp, u_yComp, u_fixedComp;
uniform bool u_transpose;
uniform float u_value;
uniform float u_xMin, u_xMax, u_yMin, u_yMax;
uniform bool u_p3Out;
uniform float u_borderWidth;
uniform int u_fill[5];
uniform int u_borderCount;
uniform int u_borderGamut[5];
uniform vec4 u_borderColor[5];

const float GAP = 1e-7;
const float L_MAX = ${f(lMax)};

${CONVERSIONS[model]}
${HELPERS}
${polar || cartesian ? LUT_TEX : ''}
${polar ? POLAR_STRETCH : ''}
${cartesian ? RADIAL_STRETCH : ''}

void main() {
  vec2 uv = (gl_FragCoord.xy + vec2(-0.5, 0.5)) / u_res;
  vec2 g = u_transpose ? uv.yx : uv;

  float comp[3];
  comp[u_xComp] = mix(u_xMin, u_xMax, g.x);
  comp[u_yComp] = mix(u_yMin, u_yMax, g.y);
  comp[u_fixedComp] = u_value;
${polar ? `  float nChroma = (u_xComp == 1) ? g.x : g.y;
  float tLight = comp[0] / L_MAX;
  if (u_stretch) {
    comp[1] = nChroma * sampleLUTrow(0, tLight);
  }
` : ''}${cartesian ? `  float na = comp[1];
  float nb = comp[2];
  if (u_stretch) {
    float maxC = sampleLUTwrap(0, atan(nb, na) / TAU);
    comp[1] = na * maxC;
    comp[2] = nb * maxC;
  }
` : ''}
  vec3 lin = toLinearSrgb(comp[0], comp[1], comp[2]);
  vec3 linP3 = ${mul3(SRGB_TO_P3, 'lin')};

  float fld[5];
  fld[0] = overflow(lin);
  fld[1] = overflow(linP3);
  fld[2] = overflow(${mul3(SRGB_TO_A98, 'lin')});
  fld[3] = overflow(${mul3(SRGB_TO_REC2020, 'lin')});
  fld[4] = overflow(${mul3(SRGB_TO_PROPHOTO, 'lin')});

  float fldPx[5];
  for (int i = 0; i < 5; i++) {
    fldPx[i] = max(length(vec2(dFdx(fld[i]), dFdy(fld[i]))), 1e-7);
  }

  bool filled = false;
  for (int i = 0; i < 5; i++) {
    if (u_fill[i] == 1 && fld[i] <= GAP) filled = true;
  }

  vec4 col = vec4(0.0);
  if (filled) {
    vec3 enc = u_p3Out
      ? srgbEncode(clamp(linP3, 0.0, 1.0))
      : srgbEncode(clamp(lin, 0.0, 1.0));
    enc = floor(enc * 255.0 + 1e-3) / 255.0;
    col = vec4(enc, 1.0);
  }

${polar ? `  bool chromaScreenX = (u_xComp == 1) != u_transpose;
  float chromaAxisPx = chromaScreenX ? u_res.x : u_res.y;
  float lightAxisPx = chromaScreenX ? u_res.y : u_res.x;
  float lightRange = (u_xComp == 0) ? (u_xMax - u_xMin) : (u_yMax - u_yMin);
  float lightAxisPxT = lightAxisPx * L_MAX / max(abs(lightRange), 1e-9);
` : ''}${cartesian ? `  float ka = (u_xMax - u_xMin) / (u_transpose ? u_res.y : u_res.x);
  float kb = (u_yMax - u_yMin) / (u_transpose ? u_res.x : u_res.y);
` : ''}
  for (int k = 0; k < 5; k++) {
    if (k >= u_borderCount) break;
    if (!filled && !(${insideExpr})) continue;
    float cov = ${borderCov};
    col = blendBorder(col, u_borderColor[k], cov);
  }

  frag = col;
}`
}
