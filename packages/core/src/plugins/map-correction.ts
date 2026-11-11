/**
 * Map coordinate correction for Chinese tile providers
 * Automatically converts WGS-84 to GCJ-02 or BD-09 based on tile layer corrdType
 */
import * as L from 'leaflet'
import { wgs84ToGcj02, wgs84ToBd09 } from './coord-transform'

export function installMapCorrection(): void {
  const GridLayerProto = L.GridLayer.prototype as any

  GridLayerProto._setZoomTransform = function (level: any, _center: L.LatLng, zoom: number) {
    let center: any = _center
    if (center && this.options) {
      if (this.options.corrdType === 'gcj02') {
        center = wgs84ToGcj02(_center.lng, _center.lat)
      } else if (this.options.corrdType === 'bd09') {
        center = wgs84ToBd09(_center.lng, _center.lat)
      }
    }

    const scale = this._map.getZoomScale(zoom, level.zoom)
    const translate = level.origin
      .multiplyBy(scale)
      .subtract(this._map._getNewPixelOrigin(center, zoom))
      .round()

    if (L.Browser.any3d) {
      L.DomUtil.setTransform(level.el, translate, scale)
    } else {
      L.DomUtil.setPosition(level.el, translate)
    }
  }

  GridLayerProto._getTiledPixelBounds = function (_center: L.LatLng) {
    let center: any = _center
    if (center && this.options) {
      if (this.options.corrdType === 'gcj02') {
        center = wgs84ToGcj02(_center.lng, _center.lat)
      } else if (this.options.corrdType === 'bd09') {
        center = wgs84ToBd09(_center.lng, _center.lat)
      }
    }

    const map = this._map
    const mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom()
    const scale = map.getZoomScale(mapZoom, this._tileZoom)
    const pixelCenter = map.project(center, this._tileZoom).floor()
    const halfSize = map.getSize().divideBy(scale * 2)

    return new L.Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize))
  }
}
