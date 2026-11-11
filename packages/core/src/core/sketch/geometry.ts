import type * as L from 'leaflet'

const EARTH_RADIUS = 6378137
const DEG = Math.PI / 180

/** Area of a ring on the sphere, in square metres */
export function geodesicArea(latlngs: L.LatLng[]): number {
  const n = latlngs.length
  if (n < 3) return 0
  let area = 0
  for (let i = 0; i < n; i++) {
    const a = latlngs[i]
    const b = latlngs[(i + 1) % n]
    area += (b.lng - a.lng) * DEG * (2 + Math.sin(a.lat * DEG) + Math.sin(b.lat * DEG))
  }
  return Math.abs((area * EARTH_RADIUS * EARTH_RADIUS) / 2)
}

/** Length of a path in metres */
export function pathLength(latlngs: L.LatLng[]): number {
  let distance = 0
  for (let i = 1; i < latlngs.length; i++) {
    distance += latlngs[i - 1].distanceTo(latlngs[i])
  }
  return distance
}

export type LengthUnit = 'auto' | 'm' | 'km'
export type AreaUnit = 'auto' | 'm2' | 'km2' | 'ha' | 'mu'

/** Square metres in one mu (亩) */
const MU = 2000 / 3

/** `auto` picks metres or kilometres by size */
export function formatLength(meters: number, unit: LengthUnit = 'auto'): string {
  if (unit === 'km' || (unit === 'auto' && meters >= 1000)) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(1)} m`
}

/** `auto` picks m² or km² by size; `ha` is hectares (公顷), `mu` is 亩 */
export function formatArea(sqMeters: number, unit: AreaUnit = 'auto'): string {
  switch (unit) {
    case 'ha':
      return `${(sqMeters / 1e4).toFixed(2)} 公顷`
    case 'mu':
      return `${(sqMeters / MU).toFixed(2)} 亩`
    case 'km2':
      return `${(sqMeters / 1e6).toFixed(2)} km²`
    case 'm2':
      return `${sqMeters.toFixed(1)} m²`
    default:
      return sqMeters >= 1e6 ? `${(sqMeters / 1e6).toFixed(2)} km²` : `${sqMeters.toFixed(1)} m²`
  }
}
