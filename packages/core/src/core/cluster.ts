import * as L from 'leaflet'
import type { ClusterOptions, PointInput } from '../types'

interface Item<T> {
  point: T
  latlng: L.LatLng
}

interface Bucket<T> {
  items: Item<T>[]
  lat: number
  lng: number
}

function countText(count: number): string {
  if (count >= 10000) return `${Math.round(count / 1000)}k`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

function clusterIcon(count: number): L.DivIcon {
  const tier = count < 10 ? 's' : count < 100 ? 'm' : 'l'
  const size = { s: 32, m: 38, l: 46 }[tier]
  return L.divIcon({
    className: `smap-cluster smap-cluster--${tier}`,
    html: `<span>${countText(count)}</span>`,
    iconSize: [size, size],
  })
}

/**
 * Points that merge into counted bubbles when they would overlap.
 *
 * Clustering is a grid over the current zoom level: points falling into the same
 * cell become one bubble at their average position. It is recomputed for the
 * visible area on every move, which keeps it cheap for tens of thousands of points.
 */
export class ClusterLayer<T extends PointInput = PointInput> extends L.FeatureGroup {
  private items: Item<T>[] = []
  private clusterOptions: ClusterOptions<T>
  private canvas: { renderer?: L.Renderer }

  constructor(
    points: T[],
    options: ClusterOptions<T> = {},
    canvas: { renderer?: L.Renderer } = {},
  ) {
    super()
    this.clusterOptions = options
    this.canvas = canvas
    this.items = this.index(points)
  }

  /** Replace the data */
  setPoints(points: T[]): this {
    this.items = this.index(points)
    this.refresh()
    return this
  }

  /** Bounds of all points, not just the ones currently drawn */
  getBounds(): L.LatLngBounds {
    return L.latLngBounds(this.items.map((item) => item.latlng))
  }

  onAdd(map: L.Map): this {
    super.onAdd(map)
    map.on('zoomend moveend', this.refresh, this)
    this.refresh()
    return this
  }

  onRemove(map: L.Map): this {
    map.off('zoomend moveend', this.refresh, this)
    return super.onRemove(map)
  }

  private index(points: T[]): Item<T>[] {
    return points.map((point) => ({ point, latlng: L.latLng(point as L.LatLngExpression) }))
  }

  private refresh(): void {
    const map = (this as any)._map as L.Map | undefined
    if (!map) return
    this.clearLayers()

    const zoom = map.getZoom()
    const options = this.clusterOptions
    const cell = options.clusterRadius ?? 60
    const clustering = zoom < (options.disableClusteringAtZoom ?? Infinity)
    // A margin, so bubbles do not pop in at the very edge while panning
    const view = map.getBounds().pad(0.2)

    const buckets = new Map<string, Bucket<T>>()
    this.items.forEach((item, index) => {
      if (!view.contains(item.latlng)) return
      let key = `#${index}`
      if (clustering) {
        const px = map.project(item.latlng, zoom)
        key = `${Math.floor(px.x / cell)}:${Math.floor(px.y / cell)}`
      }
      let bucket = buckets.get(key)
      if (!bucket) buckets.set(key, (bucket = { items: [], lat: 0, lng: 0 }))
      bucket.items.push(item)
      bucket.lat += item.latlng.lat
      bucket.lng += item.latlng.lng
    })

    for (const bucket of buckets.values()) {
      const count = bucket.items.length
      this.addLayer(
        count === 1
          ? this.pointMarker(bucket.items[0])
          : this.clusterMarker(bucket, L.latLng(bucket.lat / count, bucket.lng / count)),
      )
    }
  }

  private pointMarker({ point, latlng }: Item<T>): L.Layer {
    const { style, tooltip, onClick } = this.clusterOptions
    const marker = L.circleMarker(latlng, {
      radius: this.clusterOptions.radius ?? 5,
      weight: 1,
      color: '#fff',
      fillColor: '#1f6feb',
      fillOpacity: 0.9,
      interactive: !!(tooltip || onClick),
      ...(typeof style === 'function' ? style(point, 0) : style),
      ...this.canvas,
    })
    if (tooltip) marker.bindTooltip(() => tooltip(point))
    if (onClick) marker.on('click', (e) => onClick(point, e))
    return marker
  }

  private clusterMarker(bucket: Bucket<T>, center: L.LatLng): L.Layer {
    const marker = L.marker(center, { icon: clusterIcon(bucket.items.length), keyboard: false })
    marker.on('click', (e) => {
      const points = bucket.items.map((item) => item.point)
      if (this.clusterOptions.onClusterClick) {
        this.clusterOptions.onClusterClick(points, e)
        return
      }
      // Default: zoom in until the bubble breaks apart
      const map = (this as any)._map as L.Map
      map.fitBounds(L.latLngBounds(bucket.items.map((item) => item.latlng)), {
        padding: [48, 48],
        maxZoom: map.getMaxZoom(),
      })
    })
    return marker
  }
}
