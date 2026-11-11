import * as L from 'leaflet'

export interface SnapOptions {
  /** How close (pixels) the cursor has to be. Default 12 */
  distance?: number
  /** Other layers to snap to, besides the tool's own shapes */
  layers?: L.Layer[] | (() => L.Layer[])
}

/** Returns the position to use: the nearest vertex or edge if one is close, else the input */
export type Snapper = (latlng: L.LatLng, exclude?: L.Layer) => L.LatLng

interface Geometry {
  vertices: L.LatLng[]
  /** Consecutive pairs are edges */
  paths: L.LatLng[][]
}

type Nested = L.LatLng | Nested[]

function collect(layer: L.Layer, exclude: L.Layer | undefined, out: Geometry): void {
  if (layer === exclude) return

  if (layer instanceof L.Polyline) {
    const closed = layer instanceof L.Polygon
    const walk = (latlngs: Nested[]) => {
      if (Array.isArray(latlngs[0])) return (latlngs as Nested[][]).forEach(walk)
      const ring = latlngs as L.LatLng[]
      out.vertices.push(...ring)
      out.paths.push(closed && ring.length ? [...ring, ring[0]] : ring)
    }
    walk(layer.getLatLngs() as Nested[])
  } else if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
    // A circle offers its centre
    out.vertices.push(layer.getLatLng())
  } else if (layer instanceof L.LayerGroup) {
    layer.eachLayer((child) => collect(child, exclude, out))
  }
}

/**
 * Snapping to the vertices and edges of other shapes.
 * A vertex wins over an edge: corners are what people aim for.
 */
export function createSnapper(map: L.Map, sources: () => L.Layer[], distance = 12): Snapper {
  return (latlng, exclude) => {
    const geometry: Geometry = { vertices: [], paths: [] }
    for (const layer of sources()) collect(layer, exclude, geometry)

    // map.project gives unrounded pixels at the current zoom. The container-point
    // helpers round to whole pixels, which is too coarse for landing exactly on an edge.
    const cursor = map.project(latlng)
    let best: L.LatLng | null = null
    let bestDistance = distance

    for (const vertex of geometry.vertices) {
      const d = map.project(vertex).distanceTo(cursor)
      if (d <= bestDistance) {
        best = vertex
        bestDistance = d
      }
    }
    if (best) return L.latLng(best.lat, best.lng)

    let onEdge: L.Point | null = null
    for (const path of geometry.paths) {
      for (let i = 1; i < path.length; i++) {
        const closest = L.LineUtil.closestPointOnSegment(
          cursor,
          map.project(path[i - 1]),
          map.project(path[i]),
        )
        const d = closest.distanceTo(cursor)
        if (d <= bestDistance) {
          onEdge = closest
          bestDistance = d
        }
      }
    }
    return onEdge ? map.unproject(onEdge) : latlng
  }
}

/** Build a snapper from a tool's `snap` option, or null when snapping is off */
export function snapperFor(
  map: L.Map,
  option: boolean | SnapOptions | undefined,
  own: () => L.Layer[],
): Snapper | null {
  if (!option) return null
  const { distance, layers } = option === true ? ({} as SnapOptions) : option
  const extra = () => (typeof layers === 'function' ? layers() : (layers ?? []))
  return createSnapper(map, () => [...own(), ...extra()], distance)
}
