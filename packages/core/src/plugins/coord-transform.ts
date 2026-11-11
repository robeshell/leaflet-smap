/**
 * Coordinate system conversion utilities
 * Supports: WGS-84, GCJ-02 (火星坐标), BD-09 (百度坐标)
 */

// eslint-disable-next-line no-loss-of-precision -- 算法公开常量，按原文保留完整位数
const PI = 3.1415926535897932384626
const A = 6378245.0
// eslint-disable-next-line no-loss-of-precision -- 算法公开常量，按原文保留完整位数
const EE = 0.00669342162296594323
const X_PI = (PI * 3000.0) / 180.0

export interface Coord {
  lng: number
  lat: number
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformGcj(lng: number, lat: number): Coord {
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  return { lat: lat + dLat, lng: lng + dLng }
}

/** WGS-84 → GCJ-02 */
export function wgs84ToGcj02(lng: number, lat: number): Coord {
  if (outOfChina(lat, lng)) return { lng, lat }
  return transformGcj(lng, lat)
}

/** GCJ-02 → WGS-84 */
export function gcj02ToWgs84(lng: number, lat: number): Coord {
  if (outOfChina(lat, lng)) return { lng, lat }
  const coord = transformGcj(lng, lat)
  return { lng: lng * 2 - coord.lng, lat: lat * 2 - coord.lat }
}

/** GCJ-02 → BD-09 */
export function gcj02ToBd09(lng: number, lat: number): Coord {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI)
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI)
  return { lng: z * Math.cos(theta) + 0.0065, lat: z * Math.sin(theta) + 0.006 }
}

/** BD-09 → GCJ-02 */
export function bd09ToGcj02(lng: number, lat: number): Coord {
  const x = lng - 0.0065
  const y = lat - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI)
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI)
  return { lng: z * Math.cos(theta), lat: z * Math.sin(theta) }
}

/** WGS-84 → BD-09 */
export function wgs84ToBd09(lng: number, lat: number): Coord {
  const gcj = wgs84ToGcj02(lng, lat)
  return gcj02ToBd09(gcj.lng, gcj.lat)
}

/** BD-09 → WGS-84 */
export function bd09ToWgs84(lng: number, lat: number): Coord {
  const gcj = bd09ToGcj02(lng, lat)
  return gcj02ToWgs84(gcj.lng, gcj.lat)
}

type CoordSystem = 'wgs84' | 'gcj02' | 'bd09'

const CONVERTERS: Record<string, (lng: number, lat: number) => Coord> = {
  'wgs84>gcj02': wgs84ToGcj02,
  'gcj02>wgs84': gcj02ToWgs84,
  'gcj02>bd09': gcj02ToBd09,
  'bd09>gcj02': bd09ToGcj02,
  'wgs84>bd09': wgs84ToBd09,
  'bd09>wgs84': bd09ToWgs84,
}

/** Convert one coordinate between any two of WGS-84, GCJ-02 and BD-09 */
export function transformCoord(
  lng: number,
  lat: number,
  from: CoordSystem,
  to: CoordSystem,
): Coord {
  if (from === to) return { lng, lat }
  const convert = CONVERTERS[`${from}>${to}`]
  if (!convert) {
    throw new Error(`Unsupported coordinate conversion: ${from} → ${to}`)
  }
  return convert(lng, lat)
}

/**
 * Convert every coordinate in a GeoJSON object. Returns a deep copy; the input is not modified.
 * Typical use: data received in GCJ-02 or BD-09 → WGS-84 before putting it on the map.
 */
export function transformGeoJSON<T>(geojson: T, from: CoordSystem, to: CoordSystem): T {
  const copy = JSON.parse(JSON.stringify(geojson))
  if (from === to) return copy

  const convertPositions = (value: any): any => {
    if (!Array.isArray(value)) return value
    if (typeof value[0] === 'number') {
      const { lng, lat } = transformCoord(value[0], value[1], from, to)
      // Keep altitude and any further members untouched
      return [lng, lat, ...value.slice(2)]
    }
    return value.map(convertPositions)
  }

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    switch (node.type) {
      case 'FeatureCollection':
        node.features?.forEach(visit)
        break
      case 'Feature':
        visit(node.geometry)
        break
      case 'GeometryCollection':
        node.geometries?.forEach(visit)
        break
      default:
        if (node.coordinates) node.coordinates = convertPositions(node.coordinates)
    }
    // A bounding box is no longer valid after the shift
    delete node.bbox
  }
  visit(copy)
  return copy
}
