import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'proj4'
import 'proj4leaflet'

import type {
  SMapOptions,
  TileType,
  MeasureOptions,
  MeasureType,
  MeasureTool,
  SMapEvents,
  DrawOptions,
  ExportImageOptions,
  LocateOptions,
  LocateResult,
} from './types'

import {
  createChinaTileLayer,
  installCanvasRedrawGuard,
  installMapCorrection,
  installTileLayerNoGap,
  observeTileNoGap,
} from './plugins'
import { LayerManager } from './core/layer'
import { ControlManager } from './core/control'
import { ServiceClient } from './core/service'
import { ContextMenu } from './core/context-menu'
import type { DrawTool } from './core/draw'
import { getLocation } from './utils/location'
import { downloadBlob, exportMapImage } from './core/export'
import { loadLeafletDraw } from './core/draw-kit'
import { createEmitter } from './utils/emitter'
import './style/index.scss'

// Install plugins once
let pluginsInstalled = false
function ensurePlugins() {
  if (pluginsInstalled) return
  installMapCorrection()
  installTileLayerNoGap()
  installCanvasRedrawGuard()
  pluginsInstalled = true
}

/**
 * Main map class — supports multi-instance, fully typed API
 *
 * @example
 * ```ts
 * const map = new SMap('#map', {
 *   tileType: ['TianDiTu.Normal.Map', 'TianDiTu.Normal.Annotion'],
 *   center: [31.82, 117.23],
 *   zoom: 12,
 *   tdtKey: 'your-key',
 * })
 * ```
 */
export class SMap {
  /** The underlying Leaflet map instance */
  readonly instance: L.Map

  /** Layer management (registry, WFS/WMS, mask, points) */
  readonly layer: LayerManager

  /** Control management (zoom, scale, attribution, base-map switcher) */
  readonly control: ControlManager

  /** TianDiTu web services (search, geocode, etc.) */
  readonly service: ServiceClient

  /** Right-click menus for the map and for layers */
  readonly contextMenu: ContextMenu

  private tileLayers: L.TileLayer[] = []
  private tileTypes: TileType[] = []
  private tileChangeHandlers: (() => void)[] = []
  private drawTools = new Set<DrawTool>()
  private locationLayer: L.Layer | null = null
  private measureTools = new Set<MeasureTool>()
  private sharedMeasures = new Map<MeasureType, Promise<MeasureTool>>()
  private emitter = createEmitter<SMapEvents>()
  private options: SMapOptions
  private tileObserver: MutationObserver | null = null
  private destroyed = false

  constructor(container: string | HTMLElement, options: SMapOptions = {}) {
    ensurePlugins()

    this.options = options

    // Resolve container
    const el =
      typeof container === 'string'
        ? container.startsWith('#')
          ? container.slice(1)
          : container
        : container

    // Create leaflet map
    const { tileType, tdtKey, mapboxToken, container: _, ...leafletOptions } = options

    this.instance = L.map(el as any, {
      attributionControl: false,
      zoomControl: false,
      center: options.center,
      zoom: options.zoom ?? 12,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      maxNativeZoom: options.maxNativeZoom as number | undefined,
      preferCanvas: options.preferCanvas ?? true,
      ...leafletOptions,
    })

    // Sub-modules — all scoped to this instance
    this.layer = new LayerManager(this.instance)
    this.control = new ControlManager(
      this.instance,
      {
        setTileLayer: (type) => this.setTileLayer(type),
        getTileType: () => this.getTileType(),
        onTileChange: (handler) => this.tileChangeHandlers.push(handler),
      },
      this.layer,
    )
    this.contextMenu = new ContextMenu(this.instance)
    this.service = new ServiceClient({
      map: this.instance,
      key: () => this.options.tdtKey,
    })

    // Auto-add tile layers if specified
    if (tileType) {
      this.setTileLayer(tileType)
    }

    // Observe tiles for NoGap fix (MutationObserver approach for guaranteed coverage)
    this.tileObserver = observeTileNoGap(this.instance.getContainer())

    // Defer: listeners can only be attached after the constructor returns,
    // so emit on a microtask to let `new SMap(...).on('loaded', fn)` work.
    queueMicrotask(() => {
      if (this.destroyed) return
      this.emitter.emit('loaded', this.instance)
      if (this.tileLayers.length) {
        this.emitter.emit('tileLoaded', this.tileLayers)
      }
    })
  }

  // ============ Tile Layer ============

  /**
   * Replace current tile layers with new type(s)
   */
  setTileLayer(type: TileType | TileType[]): L.TileLayer[] {
    const types = Array.isArray(type) ? type : [type]
    // Build first: an unknown type throws here and leaves the current base map untouched
    const next = types.map((t, index) =>
      createChinaTileLayer(t, { ...this.resolveKey(t), zIndex: index }),
    )

    this.tileLayers.forEach((tl) => tl.remove())
    next.forEach((tl) => tl.addTo(this.instance))
    this.tileLayers = next
    this.tileTypes = [...types]

    this.notifyTileChange()
    this.emitter.emit('tileLoaded', this.tileLayers)
    return this.tileLayers
  }

  /**
   * Add additional tile layer(s) without removing existing ones
   */
  addTileLayer(type: TileType | TileType[]): L.TileLayer[] {
    const types = Array.isArray(type) ? type : [type]
    const added = types.map((t, index) =>
      createChinaTileLayer(t, {
        ...this.resolveKey(t),
        zIndex: this.tileLayers.length + index,
      }),
    )
    added.forEach((tl) => tl.addTo(this.instance))
    this.tileLayers.push(...added)
    this.tileTypes.push(...types)
    this.notifyTileChange()
    return added
  }

  private notifyTileChange(): void {
    this.tileChangeHandlers.forEach((handler) => handler())
  }

  /**
   * Pick the credential that belongs to the tile provider
   * (TianDiTu → tdtKey, Mapbox → mapboxToken, others → provider default)
   */
  private resolveKey(type: TileType): { key?: string } {
    const provider = type.split('.')[0]
    const key =
      provider === 'Mapbox'
        ? this.options.mapboxToken
        : provider === 'TianDiTu'
          ? this.options.tdtKey
          : undefined
    return key ? { key } : {}
  }

  /**
   * Remove all tile layers
   */
  clearTileLayers(): void {
    this.tileLayers.forEach((tl) => tl.remove())
    this.tileLayers = []
    this.tileTypes = []
    this.notifyTileChange()
  }

  /**
   * Types of the current tile layers, bottom first
   */
  getTileType(): TileType[] {
    return [...this.tileTypes]
  }

  /**
   * Get current tile layers
   */
  getTileLayers(): L.TileLayer[] {
    return [...this.tileLayers]
  }

  // ============ Measure ============

  /**
   * Create a new measure tool.
   *
   * Every call creates another tool; keep the one you get and reuse it, or call
   * its `destroy()` when done. For one shared tool per type use `getMeasure()`.
   */
  async createMeasure(type: MeasureType, options?: MeasureOptions): Promise<MeasureTool> {
    await loadLeafletDraw()
    const classes = await import('./core/measure')
    const Tool = {
      polyline: classes.PolylineMeasure,
      polygon: classes.PolygonMeasure,
      circle: classes.CircleMeasure,
      rectangle: classes.RectangleMeasure,
    }[type]
    if (!Tool) throw new Error(`Unknown measure type: ${type}`)

    const tool: MeasureTool = new Tool(this.instance, options)
    tool.on('start', (info) => this.emitter.emit('measure:start', info))
    tool.on('stop', (info) => this.emitter.emit('measure:stop', info))
    tool.on('created', (result) => this.emitter.emit('measure:created', result))
    tool.on('removed', (info) => this.emitter.emit('measure:removed', info))
    tool.on('updating', (result) => this.emitter.emit('measure:updating', result))
    tool.on('updated', (result) => this.emitter.emit('measure:updated', result))
    // A tool destroyed by its owner must not linger here
    tool.on('destroyed', () => this.measureTools.delete(tool))

    this.measureTools.add(tool)
    return tool
  }

  /**
   * The map's shared measure tool of a type, created on first use.
   * `options` only apply when it is created.
   */
  getMeasure(type: MeasureType, options?: MeasureOptions): Promise<MeasureTool> {
    let shared = this.sharedMeasures.get(type)
    if (!shared) {
      shared = this.createMeasure(type, options).then((tool) => {
        tool.on('destroyed', () => this.sharedMeasures.delete(type))
        return tool
      })
      // A failed load must not be cached
      shared.catch(() => this.sharedMeasures.delete(type))
      this.sharedMeasures.set(type, shared)
    }
    return shared
  }

  /**
   * Destroy all measure tools
   */
  clearMeasures(): void {
    for (const tool of [...this.measureTools]) {
      tool.destroy()
    }
    this.measureTools.clear()
    this.sharedMeasures.clear()
  }

  // ============ Draw ============

  /**
   * Create a tool for drawing and editing shapes (loads leaflet-draw on first call)
   */
  async createDraw(options?: DrawOptions): Promise<DrawTool> {
    await loadLeafletDraw()
    const { DrawTool } = await import('./core/draw')
    const tool = new DrawTool(this.instance, options)
    this.drawTools.add(tool)
    return tool
  }

  // ============ Location ============

  /**
   * Locate the user with the browser's geolocation, show the position and move there.
   * Rejects when permission is denied or the position is unavailable.
   */
  async locate(options: LocateOptions = {}): Promise<LocateResult> {
    const position = await getLocation(options)
    const latlng = L.latLng(position.latitude, position.longitude)
    if (this.destroyed) return { ...position, latlng }

    this.clearLocation()
    if (options.marker !== false) {
      this.locationLayer = L.featureGroup([
        L.circle(latlng, {
          radius: position.accuracy,
          weight: 1,
          color: '#2a7fff',
          fillOpacity: 0.12,
          interactive: false,
        }),
        L.circleMarker(latlng, {
          radius: 6,
          weight: 2,
          color: '#fff',
          fillColor: '#2a7fff',
          fillOpacity: 1,
          interactive: false,
        }),
      ]).addTo(this.instance)
    }
    if (options.setView !== false) {
      this.instance.setView(latlng, options.zoom ?? Math.max(this.instance.getZoom(), 16))
    }
    return { ...position, latlng }
  }

  /** Remove the position shown by `locate()` */
  clearLocation(): void {
    this.locationLayer?.remove()
    this.locationLayer = null
  }

  // ============ Export ============

  /**
   * The map as currently shown, as an image.
   *
   * Contains the base map, vector shapes (lines, areas, circles, point layers) and
   * the library's own labels: measurement labels, cluster bubbles, drawn markers.
   * Other HTML — custom marker icons, popups, controls — is not part of it unless
   * named in `include`. Rejects if a tile server forbids cross-origin reading.
   */
  exportImage(options?: ExportImageOptions): Promise<Blob> {
    return exportMapImage(this.instance, options)
  }

  /** Export the map and save it as a file */
  async downloadImage(filename = 'map.png', options?: ExportImageOptions): Promise<void> {
    downloadBlob(await this.exportImage(options), filename)
  }

  // ============ View ============

  /**
   * Fit map to bounds of a layer
   */
  fitToLayer(layer: L.Layer): void {
    if ('getBounds' in layer && typeof (layer as any).getBounds === 'function') {
      this.instance.fitBounds((layer as any).getBounds())
    }
  }

  /**
   * Set map view
   */
  setView(center: [number, number], zoom?: number): void {
    this.instance.setView(center, zoom)
  }

  // ============ Events ============

  on<K extends keyof SMapEvents>(type: K, handler: (event: SMapEvents[K]) => void): void {
    this.emitter.on(type, handler as any)
  }

  off<K extends keyof SMapEvents>(type: K, handler: (event: SMapEvents[K]) => void): void {
    this.emitter.off(type, handler as any)
  }

  // ============ Lifecycle ============

  /**
   * Destroy the map instance and clean up all resources
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.clearMeasures()
    this.drawTools.forEach((tool) => tool.destroy())
    this.drawTools.clear()
    this.clearLocation()
    this.contextMenu.destroy()
    this.layer.destroy()
    this.tileChangeHandlers = []
    this.control.removeAll()
    this.clearTileLayers()
    this.emitter.all.clear()
    this.tileObserver?.disconnect()
    this.tileObserver = null

    // End any running animation and take everything off the map before Leaflet
    // removes the renderers, so nothing is left asking a dead renderer to redraw.
    // (A frame that slips through anyway is absorbed by installCanvasRedrawGuard.)
    this.instance.stop()
    this.instance.eachLayer((layer) => {
      if (!(layer instanceof L.Renderer)) layer.remove()
    })
    this.instance.remove()
  }
}
