import { buildFragment, VERTEX } from './glsl.js'
import { resolveLayers } from './layers.js'
import { maxChromaLUT, maxChromaRadialLUT } from './math.js'

export * as math from './math.js'

// Shader gamut index → space name (inverse of layers.GAMUT_INDEX), for building
// per-border position LUTs from the resolved borderGamut indices.
const GAMUT_NAME = ['srgb', 'p3', 'a98', 'rec2020', 'prophoto']

/**
 * Create a WebGL2 chart renderer on the given canvas. Returns null when
 * WebGL2 is unavailable — callers should fall back to a CPU path.
 *
 * The canvas becomes a WebGL canvas: it can no longer hand out a '2d'
 * context, so decide GPU vs CPU before the first paint.
 */
const MODELS = new Set(['oklch', 'lch', 'oklab', 'lab'])

// Which component slot each screen axis carries, per plane. Slots are positional
// — polar models read them as L/C/H, Cartesian models as L/a/b — so one table
// serves both. Polar planes keep their historical pixel mapping exactly.
const PLANE_COMPS = {
  cl: { x: 0, y: 1, fixed: 2 },
  ch: { x: 2, y: 1, fixed: 0 },
  lh: { x: 2, y: 0, fixed: 1 },
  ab: { x: 1, y: 2, fixed: 0 },
  la: { x: 0, y: 1, fixed: 2 },
  lb: { x: 0, y: 2, fixed: 1 },
}

export function createChartRenderer(canvas, options = {}) {
  const model = MODELS.has(options.model) ? options.model : 'oklch'
  const polar = model === 'oklch' || model === 'lch'
  const cartesian = model === 'oklab' || model === 'lab'
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    stencil: false,
  })
  if (!gl || gl.isContextLost()) return null

  // dithering is on by default and driver-dependent; disable it so the
  // float → 8-bit conversion is deterministic everywhere
  gl.disable(gl.DITHER)

  let program = null
  let uniforms = null
  let contextLost = false
  let destroyed = false

  function init() {
    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error('[@colordx/gpu] shader: ' + gl.getShaderInfoLog(s))
      }
      return s
    }
    program = gl.createProgram()
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, buildFragment(model)))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('[@colordx/gpu] link: ' + gl.getProgramInfoLog(program))
    }
    gl.useProgram(program)
    uniforms = {}
    for (const name of [
      'u_res', 'u_xComp', 'u_yComp', 'u_fixedComp', 'u_transpose', 'u_value',
      'u_xMin', 'u_xMax', 'u_yMin', 'u_yMax',
      'u_p3Out', 'u_borderWidth',
      'u_fill', 'u_borderCount', 'u_borderGamut', 'u_borderColor',
      'u_stretch', 'u_lutTex',
    ]) {
      uniforms[name] = gl.getUniformLocation(program, name)
    }
    initLutTex()
  }

  // One R32F texture holds every stretch LUT (row 0 = fill stretch, rows 1.. =
  // per-border position LUTs). NEAREST sampled; the shader does its own linear
  // interpolation, so no float-filtering extension is needed.
  let lutTex = null
  function initLutTex() {
    lutTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, lutTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // 1x1 placeholder keeps the texture complete for non-stretch paints that
    // bind it without sampling (the real LUT rows are uploaded on stretch).
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array(1))
  }

  // Border position LUT for one gamut: pos_g[i] = maxChroma_g[i] / fillLUT[i]
  // (buildEdge builds the numerator on the same grid; 99 parks the line off-axis
  // where the gamut pinches). Cached per gamut for the current slice, cleared
  // when the fixed component changes so scrubbing can't grow it.
  let posLutParam
  const posLutCache = new Map()
  function borderPosLUT(param, gamut, fillLUT, buildEdge) {
    if (param !== posLutParam) {
      posLutCache.clear()
      posLutParam = param
    }
    const hit = posLutCache.get(gamut)
    if (hit && hit.fillLUT === fillLUT) return hit.lut
    const edge = buildEdge(gamut)
    const lut = new Float32Array(fillLUT.length)
    for (let i = 0; i < lut.length; i++) {
      const f = fillLUT[i]
      lut[i] = f > 1e-6 ? edge[i] / f : edge[i] > 1e-6 ? 99 : 0
    }
    posLutCache.set(gamut, { fillLUT, lut })
    return lut
  }

  canvas.addEventListener('webglcontextlost', e => {
    if (destroyed) return
    e.preventDefault()
    contextLost = true
  })
  canvas.addEventListener('webglcontextrestored', () => {
    if (destroyed) return
    contextLost = false
    init()
  })
  init()

  return {
    canvas,
    gl,
    destroy() {
      // Do NOT force-lose the context: a canvas can only ever produce one
      // WebGL context, so losing it would break any later renderer on the
      // same canvas (e.g. a React StrictMode remount). Just release the
      // program and go inert; the context is reclaimed with the canvas.
      destroyed = true
      gl.deleteProgram(program)
      gl.deleteTexture(lutTex)
      program = null
      lutTex = null
    },
    paint(opts) {
      if (destroyed || contextLost || !program) return false

      if ('drawingBufferColorSpace' in gl) {
        try {
          gl.drawingBufferColorSpace = opts.p3Output ? 'display-p3' : 'srgb'
        } catch {
          // browser without display-p3 WebGL support: stay in sRGB
        }
      }

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(uniforms.u_res, canvas.width, canvas.height)

      const comps = PLANE_COMPS[opts.plane] ?? PLANE_COMPS.cl
      gl.uniform1i(uniforms.u_xComp, comps.x)
      gl.uniform1i(uniforms.u_yComp, comps.y)
      gl.uniform1i(uniforms.u_fixedComp, comps.fixed)
      gl.uniform1i(uniforms.u_transpose, opts.transpose ? 1 : 0)
      gl.uniform1f(uniforms.u_value, opts.value)
      gl.uniform1f(uniforms.u_xMin, opts.xMin ?? 0)
      gl.uniform1f(uniforms.u_xMax, opts.xMax)
      gl.uniform1f(uniforms.u_yMin, opts.yMin ?? 0)
      gl.uniform1f(uniforms.u_yMax, opts.yMax)
      gl.uniform1i(uniforms.u_p3Out, opts.p3Output ? 1 : 0)
      gl.uniform1f(uniforms.u_borderWidth, opts.borderWidth ?? 1)

      const { fill, borderGamut, borderColor, borderCount } = resolveLayers(opts)

      // Chroma stretch: polar 'cl' per lightness row (chromaLUT), Cartesian 'ab'
      // radially per hue angle (radialLUT); other planes have no stretch axis and
      // stay absolute. Pack the fill LUT (row 0) + each border's position LUT
      // (rows 1..) into the texture so borders draw analytically.
      if (uniforms.u_stretch) {
        let fillLUT = null
        let buildEdge = null
        if (polar && opts.plane === 'cl' && opts.chromaLUT != null) {
          fillLUT = opts.chromaLUT
          buildEdge = gamut => maxChromaLUT({ model, hue: opts.value, gamut, size: fillLUT.length })
        } else if (cartesian && opts.plane === 'ab' && opts.radialLUT != null) {
          fillLUT = opts.radialLUT
          buildEdge = gamut => maxChromaRadialLUT({ model, lightness: opts.value, gamut, size: fillLUT.length })
        }
        gl.uniform1i(uniforms.u_stretch, fillLUT ? 1 : 0)
        if (fillLUT) {
          const n = fillLUT.length
          const rows = 1 + borderCount
          const data = new Float32Array(n * rows)
          data.set(fillLUT, 0)
          for (let k = 0; k < borderCount; k++) {
            const pos = borderPosLUT(opts.value, GAMUT_NAME[borderGamut[k]], fillLUT, buildEdge)
            data.set(pos, (k + 1) * n)
          }
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, lutTex)
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, n, rows, 0, gl.RED, gl.FLOAT, data)
          gl.uniform1i(uniforms.u_lutTex, 0)
        }
      }

      gl.uniform1iv(uniforms.u_fill, fill)
      gl.uniform1i(uniforms.u_borderCount, borderCount)
      gl.uniform1iv(uniforms.u_borderGamut, borderGamut)
      gl.uniform4fv(uniforms.u_borderColor, borderColor)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      return true
    },
  }
}
