// GLSL sources, generated from the same constants module as the JS twin so
// shader math is colordx math by construction.

import {
  D50_TO_D65,
  LAB,
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

const OKLCH_TO_LINEAR = `
vec3 toLinearSrgb(float l, float c, float h) {
  float hr = radians(h);
  float a = c * cos(hr);
  float b = c * sin(hr);
  float l_ = l + ${f(OKLAB.M2I_A_L)} * a + ${f(OKLAB.M2I_B_L)} * b;
  float m_ = l + ${f(OKLAB.M2I_A_M)} * a + ${f(OKLAB.M2I_B_M)} * b;
  float s_ = l + ${f(OKLAB.M2I_A_S)} * a + ${f(OKLAB.M2I_B_S)} * b;
  float l3 = l_ * l_ * l_;
  float m3 = m_ * m_ * m_;
  float s3 = s_ * s_ * s_;
  return vec3(
    ${f(OKLAB.M1I_L_R)} * l3 + ${f(OKLAB.M1I_M_R)} * m3 + ${f(OKLAB.M1I_S_R)} * s3,
    ${f(OKLAB.M1I_L_G)} * l3 + ${f(OKLAB.M1I_M_G)} * m3 + ${f(OKLAB.M1I_S_G)} * s3,
    ${f(OKLAB.M1I_L_B)} * l3 + ${f(OKLAB.M1I_M_B)} * m3 + ${f(OKLAB.M1I_S_B)} * s3);
}`

const LCH_TO_LINEAR = `
vec3 toLinearSrgb(float l, float c, float h) {
  float hr = radians(h);
  float a = c * cos(hr);
  float b = c * sin(hr);
  float fy = (l + 16.0) / 116.0;
  float fx = a / 500.0 + fy;
  float fz = fy - b / 200.0;
  vec3 xyz = vec3(
    (fx * fx * fx > ${f(LAB.EPSILON)} ? fx * fx * fx : (116.0 * fx - 16.0) / ${f(LAB.KAPPA)}) * ${f(LAB.WX)},
    (l > 8.0 ? fy * fy * fy : l / ${f(LAB.KAPPA)}) * ${f(LAB.WY)},
    (fz * fz * fz > ${f(LAB.EPSILON)} ? fz * fz * fz : (116.0 * fz - 16.0) / ${f(LAB.KAPPA)}) * ${f(LAB.WZ)});
  vec3 d65 = ${mul3(D50_TO_D65, 'xyz')};
  return ${mul3(XYZ_TO_SRGB, 'd65')};
}`

const HELPERS = `
vec3 srgbEncode(vec3 c) {
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float overflow(vec3 c) {
  vec3 d = max(c - 1.0, -c);
  return max(d.r, max(d.g, d.b));
}
float contour(float field) {
  float px = max(length(vec2(dFdx(field), dFdy(field))), 1e-12);
  return step(abs(field) / px, 0.5 * u_borderWidth);
}
vec4 blendBorder(vec4 fill, vec4 border, float cov) {
  float a = cov * border.a;
  return vec4(mix(fill.rgb, border.rgb, a), max(fill.a, a));
}`

// Gamuts are independent layers, not a fixed nesting. Shader gamut index order
// is 0 srgb, 1 p3, 2 a98, 3 rec2020, 4 prophoto. u_fill[i]=1 adds gamut i to the
// filled union; u_borderGamut/u_borderColor list the border layers in draw order
// (each draws its own gamut's zero-contour over the filled area, later on top).
export function buildFragment(model) {
  return `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 u_res;
uniform int u_plane;
uniform bool u_transpose;
uniform float u_value;
uniform float u_xMax, u_yMax;
uniform bool u_p3Out;
uniform float u_borderWidth;
uniform int u_fill[5];
uniform int u_borderCount;
uniform int u_borderGamut[5];
uniform vec4 u_borderColor[5];

const float GAP = 1e-7;

${model === 'lch' ? LCH_TO_LINEAR : OKLCH_TO_LINEAR}
${HELPERS}

void main() {
  vec2 uv = (gl_FragCoord.xy + vec2(-0.5, 0.5)) / u_res;
  vec2 g = u_transpose ? uv.yx : uv;
  float l, c, h;
  if (u_plane == 0)      { l = g.x * u_xMax; c = g.y * u_yMax; h = u_value; }
  else if (u_plane == 1) { h = g.x * u_xMax; c = g.y * u_yMax; l = u_value; }
  else                   { h = g.x * u_xMax; l = g.y * u_yMax; c = u_value; }

  vec3 lin = toLinearSrgb(l, c, h);
  vec3 linP3 = ${mul3(SRGB_TO_P3, 'lin')};

  float fld[5];
  fld[0] = overflow(lin);
  fld[1] = overflow(linP3);
  fld[2] = overflow(${mul3(SRGB_TO_A98, 'lin')});
  fld[3] = overflow(${mul3(SRGB_TO_REC2020, 'lin')});
  fld[4] = overflow(${mul3(SRGB_TO_PROPHOTO, 'lin')});

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

  for (int k = 0; k < 5; k++) {
    if (k >= u_borderCount) break;
    if (filled) col = blendBorder(col, u_borderColor[k], contour(fld[u_borderGamut[k]]));
  }

  frag = vec4(col.rgb * col.a, col.a);
}`
}
