import * as L from 'leaflet'
import { ClusterLayer } from './cluster'
import type {
  ClusterOptions,
  MaskOptions,
  PointInput,
  PointLayerOptions,
  WFSOptions,
  WMSOptions,
} from '../types'

/** Ring that covers the whole world, used as the outside of a mask */
const WORLD_RING: L.LatLngTuple[] = [
  [-90, -360],
  [90, -360],
  [90, 360],
  [-90, 360],
]

/** Outer ring of every polygon found in a GeoJSON object, as [lat, lng] */
function outerRings(geojson: any): L.LatLngTuple[][] {
  const rings: L.LatLngTuple[][] = []
  const push = (ring: number[][]) => rings.push(ring.map(([lng, lat]) => [lat, lng]))

  const visit = (node: any) => {
    switch (node?.type) {
      case 'FeatureCollection':
        node.features.forEach(visit)
        break
      case 'Feature':
        visit(node.geometry)
        break
      case 'GeometryCollection':
        node.geometries.forEach(visit)
        break
      case 'Polygon':
        push(node.coordinates[0])
        break
      case 'MultiPolygon':
        node.coordinates.forEach((polygon: number[][][]) => push(polygon[0]))
        break
    }
  }
  visit(geojson)
  return rings
}

export class LayerManager {
  private map: L.Map
  private registry = new Map<string, L.Layer>()
  private ownCanvas: L.Canvas | null = null
  private listeners: (() => void)[] = []

  constructor(map: L.Map) {
    this.map = map
  }

  // ============ Registry ============

  /** Be told when a layer is registered, removed, shown or hidden */
  onChange(listener: () => void): void {
    this.listeners.push(listener)
  }

  private changed(): void {
    this.listeners.forEach((listener) => listener())
  }

  /**
   * Put a layer under management and add it to the map.
   * An existing layer with the same id is removed first.
   */
  add<T extends L.Layer>(id: string, layer: T, options: { visible?: boolean } = {}): T {
    this.remove(id)
    this.registry.set(id, layer)
    if (options.visible !== false) {
      layer.addTo(this.map)
    }
    this.changed()
    return layer
  }

  get<T extends L.Layer = L.Layer>(id: string): T | undefined {
    return this.registry.get(id) as T | undefined
  }

  has(id: string): boolean {
    return this.registry.has(id)
  }

  /** Ids of all managed layers, in insertion order */
  ids(): string[] {
    return [...this.registry.keys()]
  }

  isVisible(id: string): boolean {
    const layer = this.registry.get(id)
    return !!layer && this.map.hasLayer(layer)
  }

  /** Show a managed layer. Returns false when the id is unknown */
  show(id: string): boolean {
    const layer = this.registry.get(id)
    if (!layer) return false
    layer.addTo(this.map)
    this.changed()
    return true
  }

  /** Hide a managed layer without forgetting it. Returns false when the id is unknown */
  hide(id: string): boolean {
    const layer = this.registry.get(id)
    if (!layer) return false
    layer.remove()
    this.changed()
    return true
  }

  /** Flip (or set) visibility. Returns the resulting visibility */
  toggle(id: string, visible?: boolean): boolean {
    const next = visible ?? !this.isVisible(id)
    return next ? this.show(id) : (this.hide(id), false)
  }

  /** Remove a managed layer from the map and forget it. Returns false when the id is unknown */
  remove(id: string): boolean {
    const layer = this.registry.get(id)
    if (!layer) return false
    layer.remove()
    this.registry.delete(id)
    this.changed()
    return true
  }

  /** Remove every managed layer */
  clear(): void {
    for (const layer of this.registry.values()) {
      layer.remove()
    }
    this.registry.clear()
    this.changed()
  }

  /** Release everything, including the shared canvas. Called by `smap.destroy()` */
  destroy(): void {
    this.clear()
    this.listeners = []
    this.ownCanvas?.remove()
    this.ownCanvas = null
  }

  /**
   * Renderer option for vector layers created here.
   *
   * Everything must end up on ONE canvas: Leaflet stacks a full-size <canvas> per
   * renderer and only the top one receives mouse events, and a renderer is never
   * removed from the map when its layers are. So: reuse the map's own canvas when
   * it has one (`preferCanvas`, the default), otherwise share a single canvas.
   */
  private canvas(): { renderer?: L.Renderer } {
    if (this.map.options.preferCanvas) return {}
    this.ownCanvas ??= L.canvas({ padding: 0.5 })
    return { renderer: this.ownCanvas }
  }

  private place<T extends L.Layer>(layer: T, id?: string): T {
    return id ? this.add(id, layer) : layer.addTo(this.map)
  }

  // ============ WFS / GeoJSON ============

  /**
   * Fetch GeoJSON from a GeoServer WFS endpoint
   */
  async loadWFS(options: WFSOptions): Promise<any> {
    const params = new URLSearchParams({
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: options.layer,
      outputFormat: options.outputFormat || 'application/json',
    })

    // Merge extra params
    for (const [key, value] of Object.entries(options)) {
      if (!['url', 'layer', 'style', 'outputFormat', 'id'].includes(key) && value != null) {
        params.set(key, String(value))
      }
    }

    const url = `${options.url}?${params.toString()}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`WFS request failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Create a GeoJSON layer from data with optional styling
   */
  createGeoJsonLayer(data: GeoJSON.GeoJsonObject, style?: L.PathOptions): L.GeoJSON {
    return L.geoJSON(data, {
      style: style ? { ...style, ...this.canvas() } : undefined,
    })
  }

  /**
   * Load WFS data and add to map as a GeoJSON layer
   */
  async addWFS(options: WFSOptions): Promise<L.GeoJSON> {
    const data = await this.loadWFS(options)
    return this.place(this.createGeoJsonLayer(data, options.style), options.id)
  }

  // ============ WMS ============

  /**
   * Create a WMS tile layer
   */
  createWMS(options: WMSOptions): L.TileLayer.WMS {
    // `id` is ours; everything else in `rest` is sent to the server as a WMS parameter
    const { url, layer, id: _id, ...rest } = options
    return L.tileLayer.wms(url, {
      layers: layer,
      format: rest.format || 'image/png',
      transparent: rest.transparent !== false,
      crs: rest.crs || L.CRS.EPSG4326,
      ...rest,
    })
  }

  /**
   * Create a WMS tile layer and add to map
   */
  addWMS(options: WMSOptions): L.TileLayer.WMS {
    return this.place(this.createWMS(options), options.id)
  }

  // ============ Mask ============

  /**
   * Build a mask that dims everything outside the given polygon(s).
   * `getBounds()` of the result is the bounds of the highlighted region.
   */
  createMask(geojson: GeoJSON.GeoJsonObject, options: MaskOptions = {}): L.FeatureGroup {
    const rings = outerRings(geojson)
    if (!rings.length) {
      throw new Error('createMask() needs a GeoJSON Polygon or MultiPolygon')
    }

    // One polygon: the world as the outside, each region as a hole
    const shade = L.polygon([WORLD_RING, ...rings], {
      stroke: false,
      fillColor: options.fillColor ?? '#000',
      fillOpacity: options.fillOpacity ?? 0.5,
      interactive: false,
    })
    const layers: L.Layer[] = [shade]

    if (options.outline !== false) {
      layers.push(
        L.polyline(
          rings.map((ring) => [...ring, ring[0]]),
          { color: options.color ?? '#3388ff', weight: options.weight ?? 2, interactive: false },
        ),
      )
    }

    const group = L.featureGroup(layers)
    const bounds = L.latLngBounds(rings.flat())
    group.getBounds = () => bounds
    return group
  }

  /**
   * Add a mask to the map. By default the view is fitted to the region.
   */
  addMask(geojson: GeoJSON.GeoJsonObject, options: MaskOptions = {}): L.FeatureGroup {
    const mask = this.createMask(geojson, options)

    if (options.restrict) {
      // Give the bounds back when the mask goes away, or the map stays locked
      const previous = this.map.options.maxBounds
      mask.once('remove', () => this.map.setMaxBounds(previous as L.LatLngBoundsExpression))
      this.map.setMaxBounds(mask.getBounds())
    }

    this.place(mask, options.id)
    if (options.fit !== false) {
      this.map.fitBounds(mask.getBounds())
    }
    return mask
  }

  // ============ Points ============

  /**
   * Build a layer of many points, drawn on canvas.
   * Suitable for tens of thousands of points, where one marker per point would be too slow.
   */
  createPointLayer<T extends PointInput>(
    points: T[],
    options: PointLayerOptions<T> = {},
  ): L.FeatureGroup {
    const canvas = this.canvas()
    const { style, tooltip, onClick } = options
    const interactive = !!(tooltip || onClick)
    const group = L.featureGroup()

    points.forEach((point, index) => {
      const marker = L.circleMarker(L.latLng(point as L.LatLngExpression), {
        radius: options.radius ?? 4,
        weight: 1,
        color: '#fff',
        fillColor: '#3388ff',
        fillOpacity: 0.9,
        interactive,
        ...(typeof style === 'function' ? style(point, index) : style),
        ...canvas,
      })
      if (tooltip) marker.bindTooltip(() => tooltip(point))
      if (onClick) marker.on('click', (e) => onClick(point, e))
      group.addLayer(marker)
    })

    return group
  }

  /**
   * Add a layer of many points to the map
   */
  addPoints<T extends PointInput>(points: T[], options: PointLayerOptions<T> = {}): L.FeatureGroup {
    return this.place(this.createPointLayer(points, options), options.id)
  }

  // ============ Clusters ============

  /**
   * Build a layer of points that merge into counted bubbles when zoomed out.
   * Use it when there are too many points to tell apart at low zoom.
   */
  createCluster<T extends PointInput>(
    points: T[],
    options: ClusterOptions<T> = {},
  ): ClusterLayer<T> {
    return new ClusterLayer(points, options, this.canvas())
  }

  /**
   * Add a clustered point layer to the map
   */
  addCluster<T extends PointInput>(points: T[], options: ClusterOptions<T> = {}): ClusterLayer<T> {
    return this.place(this.createCluster(points, options), options.id)
  }
}
