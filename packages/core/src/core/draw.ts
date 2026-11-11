import * as L from 'leaflet'
import type { DrawEvents, DrawOptions, DrawType } from '../types'
import { createEmitter } from '../utils/emitter'
import { applyAccent, DEFAULT_ACCENT, DrawSession, loadLeafletDraw } from './draw-kit'
import { ShapeEditor } from './sketch/editors'
import { snapperFor } from './sketch/snap'
import type { Snapper } from './sketch/snap'

const DEFAULT_SHAPE_OPTIONS: L.PathOptions = {
  color: DEFAULT_ACCENT,
  weight: 3,
  lineCap: 'round',
  lineJoin: 'round',
  fillOpacity: 0.15,
}

function defaultMarkerIcon(): L.DivIcon {
  return L.divIcon({ className: 'smap-draw-marker', iconSize: [16, 16], iconAnchor: [8, 8] })
}

/**
 * Draw, edit and export shapes. Create it with `smap.createDraw()`.
 */
export class DrawTool {
  /** Everything drawn or loaded lives in this group */
  readonly group: L.FeatureGroup

  private map: L.Map
  private options: DrawOptions
  private emitter = createEmitter<DrawEvents>()
  private session: DrawSession<DrawType>
  private editor: ShapeEditor | null = null
  private snapper: Snapper | null

  /** @deprecated Nothing needs loading any more. Kept so existing calls keep working */
  static preload(): Promise<void> {
    return loadLeafletDraw()
  }

  constructor(map: L.Map, options: DrawOptions = {}) {
    this.map = map
    this.options = options
    this.group = L.featureGroup().addTo(map)
    this.snapper = snapperFor(map, options.snap, () => this.getLayers())

    this.session = new DrawSession<DrawType>(map, {
      created: (layer, type) => {
        this.group.addLayer(layer)
        this.emitter.emit('created', { layer, type })
        this.emitChange()
      },
      stop: (type) => this.emitter.emit('drawstop', { type }),
    })
  }

  // ============ Drawing ============

  /** Shape currently being drawn, or null */
  get drawing(): DrawType | null {
    return this.session.active
  }

  /** Start drawing one shape. Drawing ends by itself when the shape is finished */
  draw(type: DrawType): void {
    this.finishEdit(true)
    const shapeOptions = this.shapeOptions()
    const { snapper } = this
    this.session.start(
      type,
      {
        shapeOptions,
        markerIcon: this.markerIcon(),
        snap: snapper ? (latlng) => snapper(latlng) : undefined,
      },
      shapeOptions.color,
    )
    this.emitter.emit('drawstart', { type })
  }

  /** Abandon the shape being drawn */
  cancel(): void {
    this.session.cancel()
  }

  // ============ Editing ============

  /** True while shapes can be dragged and reshaped */
  get editing(): boolean {
    return !!this.editor
  }

  /** Make every shape editable: drag vertices, move markers, resize rectangles and circles */
  startEdit(): void {
    if (this.editor) return
    this.cancel()
    applyAccent(this.map, this.shapeOptions().color)
    this.editor = new ShapeEditor(this.map, this.getLayers(), {
      snap: this.snapper,
      onChange: (layer) => this.emitter.emit('editing', { layer }),
    })
    this.editor.enable()
  }

  /** True when there is a change to take back in edit mode */
  get canUndo(): boolean {
    return this.editor?.canUndo ?? false
  }

  /** Take back the last change made in edit mode (also Ctrl/Cmd+Z). Returns false when there is none */
  undo(): boolean {
    return this.editor?.undo() ?? false
  }

  /** Leave edit mode, keeping (`save = true`) or discarding the changes */
  finishEdit(save = true): void {
    const editor = this.editor
    if (!editor) return
    this.editor = null

    const changed = save ? editor.changed() : []
    if (!save) editor.revert()
    editor.disable()

    if (changed.length) {
      this.emitter.emit('edited', { layers: changed })
      this.emitChange()
    }
  }

  // ============ Content ============

  getLayers(): L.Layer[] {
    return this.group.getLayers()
  }

  /** Remove one shape */
  remove(layer: L.Layer): void {
    if (!this.group.hasLayer(layer)) return
    this.group.removeLayer(layer)
    this.emitter.emit('removed', { layers: [layer] })
    this.emitChange()
  }

  /** Remove every shape */
  clear(): void {
    const layers = this.getLayers()
    if (!layers.length) return
    this.finishEdit(false)
    this.group.clearLayers()
    this.emitter.emit('removed', { layers })
    this.emitChange()
  }

  /**
   * Export everything as GeoJSON (WGS-84).
   * A circle becomes a Point with `properties.radius` in metres.
   */
  toGeoJSON(): GeoJSON.FeatureCollection {
    const features = this.getLayers().map((layer: any) => {
      const feature = layer.toGeoJSON() as GeoJSON.Feature
      if (layer instanceof L.Circle) {
        feature.properties = { ...feature.properties, radius: layer.getRadius() }
      }
      return feature
    })
    return { type: 'FeatureCollection', features }
  }

  /**
   * Load shapes from GeoJSON so they can be shown and edited.
   * A Point with `properties.radius` becomes a circle.
   */
  load(geojson: GeoJSON.GeoJsonObject, options: { replace?: boolean } = {}): void {
    this.finishEdit(false)
    if (options.replace !== false) {
      this.group.clearLayers()
    }

    const parsed = L.geoJSON(geojson, {
      style: () => this.shapeOptions(),
      pointToLayer: (feature, latlng) => {
        const radius = Number(feature.properties?.radius)
        return radius > 0
          ? L.circle(latlng, { ...this.shapeOptions(), radius })
          : L.marker(latlng, { icon: this.markerIcon() })
      },
    })
    parsed.eachLayer((layer) => this.group.addLayer(layer))
    this.emitChange()
  }

  // ============ Events / lifecycle ============

  on<K extends keyof DrawEvents>(type: K, handler: (event: DrawEvents[K]) => void): void {
    this.emitter.on(type, handler as any)
  }

  off<K extends keyof DrawEvents>(type: K, handler: (event: DrawEvents[K]) => void): void {
    this.emitter.off(type, handler as any)
  }

  destroy(): void {
    this.session.destroy()
    this.finishEdit(false)
    this.emitter.all.clear()
    this.group.remove()
  }

  private emitChange(): void {
    this.emitter.emit('change', this.toGeoJSON())
  }

  private shapeOptions(): L.PathOptions {
    return { ...DEFAULT_SHAPE_OPTIONS, ...this.options.shapeOptions }
  }

  private markerIcon(): L.Icon | L.DivIcon {
    return this.options.markerIcon ?? defaultMarkerIcon()
  }
}
