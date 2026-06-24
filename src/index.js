import { buildFragment, VERTEX } from './glsl.js'
import { resolveLayers } from './layers.js'

export * as math from './math.js'

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
      'u_stretch', 'u_chromaLUT',
    ]) {
      uniforms[name] = gl.getUniformLocation(program, name)
    }
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
      program = null
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

      // Chroma stretch is a polar concept (slot 1 = chroma) and needs both
      // lightness and chroma free, which only the 'cl' plane gives. Elsewhere
      // the LUT has no well-defined axis, so leave the renderer in absolute mode.
      if (uniforms.u_stretch) {
        const stretch = polar && opts.plane === 'cl' && opts.chromaLUT != null
        gl.uniform1i(uniforms.u_stretch, stretch ? 1 : 0)
        if (stretch) gl.uniform1fv(uniforms.u_chromaLUT, opts.chromaLUT)
      }

      const { fill, borderGamut, borderColor, borderCount } = resolveLayers(opts)
      gl.uniform1iv(uniforms.u_fill, fill)
      gl.uniform1i(uniforms.u_borderCount, borderCount)
      gl.uniform1iv(uniforms.u_borderGamut, borderGamut)
      gl.uniform4fv(uniforms.u_borderColor, borderColor)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      return true
    },
  }
}
