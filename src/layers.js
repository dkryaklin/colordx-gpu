// Resolve paint options into the shader's gamut-layer uniforms. Gamuts are
// independent layers, not a fixed nesting: `fill` adds a gamut to the painted
// union, and each `border` draws that gamut's own zero-contour in list order.
// Kept pure (no WebGL) so the legacy mapping is unit-testable.

export const GAMUT_INDEX = { srgb: 0, p3: 1, a98: 2, rec2020: 3, prophoto: 4 }

// Map the legacy show*/border* flags onto an equivalent layer list. The old
// renderer always filled sRGB, drew the sRGB↔P3 edge in `borderP3`, and the
// P3↔Rec2020 edge in `borderRec2020` (falling back to the sRGB edge when only
// Rec2020 was shown). Each boundary belongs to the inner gamut whose edge it is.
function legacyLayers(opts) {
  const srgb = { space: 'srgb', fill: true }
  const layers = [srgb]
  if (opts.showP3 && opts.showRec2020) {
    srgb.border = opts.borderP3
    layers.push({ space: 'p3', fill: true, border: opts.borderRec2020 })
    layers.push({ space: 'rec2020', fill: true })
  } else if (opts.showP3) {
    srgb.border = opts.borderP3
    layers.push({ space: 'p3', fill: true })
  } else if (opts.showRec2020) {
    srgb.border = opts.borderRec2020
    layers.push({ space: 'rec2020', fill: true })
  }
  return layers
}

export function resolveLayers(opts) {
  const layers = opts.gamuts ?? legacyLayers(opts)
  const fill = [0, 0, 0, 0, 0]
  const borderGamut = [0, 0, 0, 0, 0]
  const borderColor = new Float32Array(20)
  let borderCount = 0
  for (const layer of layers) {
    const gi = GAMUT_INDEX[layer.space]
    if (gi === undefined) continue
    if (layer.fill) fill[gi] = 1
    if (layer.border && borderCount < 5) {
      borderGamut[borderCount] = gi
      borderColor.set(layer.border, borderCount * 4)
      borderCount++
    }
  }
  return { fill, borderGamut, borderColor, borderCount }
}
