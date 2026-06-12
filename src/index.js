import { buildFragment, VERTEX } from './glsl.js'

export * as math from './math.js'

/**
 * Create a WebGL2 chart renderer on the given canvas. Returns null when
 * WebGL2 is unavailable — callers should fall back to a CPU path.
 *
 * The canvas becomes a WebGL canvas: it can no longer hand out a '2d'
 * context, so decide GPU vs CPU before the first paint.
 */
export function createChartRenderer(canvas, options = {}) {
  const model = options.model === 'lch' ? 'lch' : 'oklch'
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
      'u_res', 'u_plane', 'u_value', 'u_xMax', 'u_yMax',
      'u_showP3', 'u_showRec2020', 'u_p3Out',
      'u_borderP3', 'u_borderRec2020', 'u_borderWidth',
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

  const PLANES = { ch: 1, cl: 0, lh: 2 }

  return {
    canvas,
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
      gl.uniform1i(uniforms.u_plane, PLANES[opts.plane] ?? 0)
      gl.uniform1f(uniforms.u_value, opts.value)
      gl.uniform1f(uniforms.u_xMax, opts.xMax)
      gl.uniform1f(uniforms.u_yMax, opts.yMax)
      gl.uniform1i(uniforms.u_showP3, opts.showP3 ? 1 : 0)
      gl.uniform1i(uniforms.u_showRec2020, opts.showRec2020 ? 1 : 0)
      gl.uniform1i(uniforms.u_p3Out, opts.p3Output ? 1 : 0)
      gl.uniform4fv(uniforms.u_borderP3, opts.borderP3)
      gl.uniform4fv(uniforms.u_borderRec2020, opts.borderRec2020)
      gl.uniform1f(uniforms.u_borderWidth, opts.borderWidth ?? 1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      return true
    },
  }
}
