import { describe, expect, it } from 'vitest'
import {
  bd09ToGcj02,
  bd09ToWgs84,
  gcj02ToBd09,
  gcj02ToWgs84,
  wgs84ToBd09,
  transformCoord,
  transformGeoJSON,
  wgs84ToGcj02,
} from '../src/plugins/coord-transform'

// 合肥市中心附近
const LNG = 117.227219
const LAT = 31.820591

describe('coord-transform', () => {
  it('returns { lng, lat } objects', () => {
    const result = wgs84ToGcj02(LNG, LAT)
    expect(Object.keys(result).sort()).toEqual(['lat', 'lng'])
  })

  it('shifts WGS-84 → GCJ-02 by a few hundred metres', () => {
    const { lng, lat } = wgs84ToGcj02(LNG, LAT)
    expect(Math.abs(lng - LNG)).toBeGreaterThan(0.001)
    expect(Math.abs(lng - LNG)).toBeLessThan(0.01)
    expect(Math.abs(lat - LAT)).toBeGreaterThan(0.0005)
    expect(Math.abs(lat - LAT)).toBeLessThan(0.01)
  })

  it('round-trips WGS-84 ↔ GCJ-02 within ~1 m', () => {
    const gcj = wgs84ToGcj02(LNG, LAT)
    const back = gcj02ToWgs84(gcj.lng, gcj.lat)
    expect(back.lng).toBeCloseTo(LNG, 4)
    expect(back.lat).toBeCloseTo(LAT, 4)
  })

  it('round-trips GCJ-02 ↔ BD-09', () => {
    const bd = gcj02ToBd09(LNG, LAT)
    expect(bd.lng).not.toBeCloseTo(LNG, 3)
    const back = bd09ToGcj02(bd.lng, bd.lat)
    expect(back.lng).toBeCloseTo(LNG, 4)
    expect(back.lat).toBeCloseTo(LAT, 4)
  })

  it('composes WGS-84 ↔ BD-09 through GCJ-02', () => {
    const gcj = wgs84ToGcj02(LNG, LAT)
    expect(wgs84ToBd09(LNG, LAT)).toEqual(gcj02ToBd09(gcj.lng, gcj.lat))

    const bd = wgs84ToBd09(LNG, LAT)
    const back = bd09ToWgs84(bd.lng, bd.lat)
    expect(back.lng).toBeCloseTo(LNG, 4)
    expect(back.lat).toBeCloseTo(LAT, 4)
  })
})

describe('transformCoord', () => {
  it('dispatches to the matching conversion', () => {
    expect(transformCoord(LNG, LAT, 'wgs84', 'gcj02')).toEqual(wgs84ToGcj02(LNG, LAT))
    expect(transformCoord(LNG, LAT, 'bd09', 'wgs84')).toEqual(bd09ToWgs84(LNG, LAT))
  })

  it('returns the input when both systems are the same', () => {
    expect(transformCoord(LNG, LAT, 'gcj02', 'gcj02')).toEqual({ lng: LNG, lat: LAT })
  })
})

describe('transformGeoJSON', () => {
  const gcj = wgs84ToGcj02(LNG, LAT)
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    bbox: [117, 31, 118, 32],
    features: [
      {
        type: 'Feature',
        properties: { name: 'p' },
        geometry: { type: 'Point', coordinates: [LNG, LAT, 42] },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [LNG, LAT],
                [LNG + 0.1, LAT],
                [LNG, LAT + 0.1],
                [LNG, LAT],
              ],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'GeometryCollection',
          geometries: [{ type: 'LineString', coordinates: [[LNG, LAT]] }],
        },
      },
    ],
  }

  it('converts every position at any nesting depth', () => {
    const out = transformGeoJSON(collection, 'wgs84', 'gcj02')
    const point = out.features[0].geometry as GeoJSON.Point
    const polygon = out.features[1].geometry as GeoJSON.MultiPolygon
    const nested = out.features[2].geometry as GeoJSON.GeometryCollection

    expect(point.coordinates.slice(0, 2)).toEqual([gcj.lng, gcj.lat])
    expect(polygon.coordinates[0][0][0]).toEqual([gcj.lng, gcj.lat])
    expect((nested.geometries[0] as GeoJSON.LineString).coordinates[0]).toEqual([gcj.lng, gcj.lat])
  })

  it('keeps altitude and properties, and drops the stale bbox', () => {
    const out = transformGeoJSON(collection, 'wgs84', 'gcj02')
    expect((out.features[0].geometry as GeoJSON.Point).coordinates[2]).toBe(42)
    expect(out.features[0].properties).toEqual({ name: 'p' })
    expect(out.bbox).toBeUndefined()
  })

  it('does not modify its input', () => {
    const before = JSON.stringify(collection)
    transformGeoJSON(collection, 'wgs84', 'bd09')
    expect(JSON.stringify(collection)).toBe(before)
  })

  it('accepts a bare geometry and round-trips', () => {
    const geometry: GeoJSON.Point = { type: 'Point', coordinates: [LNG, LAT] }
    const back = transformGeoJSON(transformGeoJSON(geometry, 'wgs84', 'gcj02'), 'gcj02', 'wgs84')
    expect(back.coordinates[0]).toBeCloseTo(LNG, 4)
    expect(back.coordinates[1]).toBeCloseTo(LAT, 4)
  })
})
