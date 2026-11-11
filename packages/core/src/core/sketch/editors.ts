/**
 * Editing: draggable handles on existing shapes.
 *
 * One small editor class per kind of layer. Each can put its handles on the map,
 * capture and restore the shape's state (for undo and for discarding), and tell
 * whether the shape was changed.
 */
import * as L from 'leaflet'
import { vertexIcon } from './drawers'
import type { Snapper } from './snap'

type Kind = 'vertex' | 'mid' | 'move' | 'resize'

function handle(latlng: L.LatLngExpression, kind: Kind): L.Marker {
  return L.marker(latlng, {
    icon: vertexIcon(kind),
    draggable: true,
    keyboard: false,
    // Above the shapes and the app's own markers
    zIndexOffset: 1000,
  })
}

abstract class LayerEditor {
  changed = false
  /** Called on every change, while a handle is still being dragged */
  onChange: (() => void) | null = null
  /** Called right before a gesture changes the shape, so the state can be saved for undo */
  onBegin: (() => void) | null = null
  /** Adjusts a dragged position to nearby geometry */
  snap: ((latlng: L.LatLng) => L.LatLng) | null = null

  protected map: L.Map
  protected handles = L.layerGroup()
  protected enabled = false
  private initial: unknown

  constructor(map: L.Map) {
    this.map = map
  }

  enable(): void {
    this.initial = this.capture()
    this.enabled = true
    this.handles.addTo(this.map)
    this.build()
  }

  disable(): void {
    this.enabled = false
    this.handles.remove()
    this.handles.clearLayers()
    this.cleanup()
  }

  /** Put the shape back as it was when editing started */
  revert(): void {
    this.restore(this.initial)
  }

  /** The shape's current geometry, as a value that `restore` accepts */
  abstract capture(): unknown
  /** Set the shape to a captured geometry and move the handles accordingly */
  abstract restore(state: unknown): void
  /** Create the handles */
  protected abstract build(): void
  /** Undo what `build` did to the layer itself */
  protected cleanup(): void {}

  /** Recreate the handles after the shape changed under them */
  protected refresh(): void {
    if (!this.enabled) return
    this.handles.clearLayers()
    this.build()
  }

  protected begin(): void {
    this.onBegin?.()
  }

  protected touch(): void {
    this.changed = true
    this.onChange?.()
  }

  /** Where a dragged handle should count as being; moves the handle there if it snapped */
  protected position(marker: L.Marker): L.LatLng {
    const latlng = marker.getLatLng()
    const snapped = this.snap ? this.snap(latlng) : latlng
    if (snapped !== latlng) marker.setLatLng(snapped)
    return snapped
  }
}

// ---------- Marker: drag the marker itself ----------

class MarkerEditor extends LayerEditor {
  private layer: L.Marker
  private wasDraggable = false

  constructor(map: L.Map, layer: L.Marker) {
    super(map)
    this.layer = layer
  }

  capture(): L.LatLng {
    return this.layer.getLatLng()
  }

  restore(state: unknown): void {
    this.layer.setLatLng(state as L.LatLng)
  }

  protected build(): void {
    const { dragging } = this.layer
    this.wasDraggable = !!dragging?.enabled()
    dragging?.enable()
    this.layer.on('dragstart', this.begin, this)
    this.layer.on('drag dragend', this.touch, this)
    this.layer.getElement()?.classList.add('smap-marker-editing')
  }

  protected cleanup(): void {
    if (!this.wasDraggable) this.layer.dragging?.disable()
    this.layer.off('dragstart', this.begin, this)
    this.layer.off('drag dragend', this.touch, this)
    this.layer.getElement()?.classList.remove('smap-marker-editing')
  }
}

// ---------- Line and polygon: a handle per vertex, a faint one per edge ----------

type Nested = L.LatLng | Nested[]

function clone(latlngs: Nested): Nested {
  return Array.isArray(latlngs) ? latlngs.map(clone) : L.latLng(latlngs.lat, latlngs.lng)
}

/** The innermost arrays: one per line, or per ring of a polygon */
function rings(latlngs: Nested[]): L.LatLng[][] {
  return Array.isArray(latlngs[0])
    ? (latlngs as Nested[][]).flatMap(rings)
    : [latlngs as L.LatLng[]]
}

class PathEditor extends LayerEditor {
  private layer: L.Polyline
  private closed: boolean
  /** Our own copy of the coordinates; edited in place, then handed to the layer */
  private current: Nested[]
  private originalDash: string | number[] | undefined

  constructor(map: L.Map, layer: L.Polyline) {
    super(map)
    this.layer = layer
    this.closed = layer instanceof L.Polygon
    this.current = clone(layer.getLatLngs() as Nested) as Nested[]
    this.originalDash = layer.options.dashArray
  }

  private get min(): number {
    return this.closed ? 3 : 2
  }

  capture(): Nested {
    return clone(this.current)
  }

  restore(state: unknown): void {
    this.current = clone(state as Nested) as Nested[]
    this.layer.setLatLngs(this.current as L.LatLngExpression[])
    this.refresh()
  }

  private apply(): void {
    this.layer.setLatLngs(this.current as L.LatLngExpression[])
    this.touch()
  }

  enable(): void {
    super.enable()
    this.layer.setStyle({ dashArray: '6 6' })
  }

  protected cleanup(): void {
    this.layer.setStyle({ dashArray: this.originalDash as string })
  }

  protected build(): void {
    for (const ring of rings(this.current)) {
      ring.forEach((latlng, i) => this.addVertex(ring, i, latlng))
      const edges = this.closed ? ring.length : ring.length - 1
      for (let i = 0; i < edges; i++) this.addMidpoint(ring, i)
    }
  }

  private addVertex(ring: L.LatLng[], index: number, latlng: L.LatLng): void {
    const marker = handle(latlng, 'vertex')
    let dragged = false
    marker.on('dragstart', () => {
      dragged = true
      this.begin()
    })
    marker.on('drag', () => {
      ring[index] = this.position(marker)
      this.apply()
    })
    // Midpoints depend on the vertices around them
    marker.on('dragend', () => this.refresh())
    marker.on('click', () => {
      // Leaflet also fires click at the end of a drag
      if (dragged) return void (dragged = false)
      if (ring.length <= this.min) return
      this.begin()
      ring.splice(index, 1)
      this.apply()
      this.refresh()
    })
    this.handles.addLayer(marker)
  }

  private addMidpoint(ring: L.LatLng[], index: number): void {
    const a = ring[index]
    const b = ring[(index + 1) % ring.length]
    const marker = handle([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], 'mid')
    // Dragging the middle of an edge splits it: the handle becomes a new vertex
    marker.on('dragstart', () => {
      this.begin()
      ring.splice(index + 1, 0, marker.getLatLng())
    })
    marker.on('drag', () => {
      ring[index + 1] = this.position(marker)
      this.apply()
    })
    marker.on('dragend', () => this.refresh())
    this.handles.addLayer(marker)
  }
}

// ---------- Rectangle: four corners and a handle to move it ----------

class RectangleEditor extends LayerEditor {
  private layer: L.Rectangle

  constructor(map: L.Map, layer: L.Rectangle) {
    super(map)
    this.layer = layer
  }

  capture(): L.LatLngBounds {
    const bounds = this.layer.getBounds()
    return L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast())
  }

  restore(state: unknown): void {
    this.layer.setBounds(state as L.LatLngBounds)
    this.refresh()
  }

  protected build(): void {
    const bounds = this.layer.getBounds()
    const corners = [
      bounds.getSouthWest(),
      bounds.getNorthWest(),
      bounds.getNorthEast(),
      bounds.getSouthEast(),
    ]

    corners.forEach((corner, i) => {
      const opposite = corners[(i + 2) % 4]
      const marker = handle(corner, 'resize')
      marker.on('dragstart', this.begin, this)
      marker.on('drag', () => {
        this.layer.setBounds(L.latLngBounds(this.position(marker), opposite))
        this.touch()
      })
      marker.on('dragend', () => this.refresh())
      this.handles.addLayer(marker)
    })

    const mover = handle(bounds.getCenter(), 'move')
    mover.on('dragstart', this.begin, this)
    mover.on('drag', () => {
      const from = this.layer.getBounds().getCenter()
      const to = mover.getLatLng()
      const dLat = to.lat - from.lat
      const dLng = to.lng - from.lng
      const b = this.layer.getBounds()
      this.layer.setBounds(
        L.latLngBounds(
          [b.getSouth() + dLat, b.getWest() + dLng],
          [b.getNorth() + dLat, b.getEast() + dLng],
        ),
      )
      this.touch()
    })
    mover.on('dragend', () => this.refresh())
    this.handles.addLayer(mover)
  }
}

// ---------- Circle: centre to move, a handle on the edge to resize ----------

class CircleEditor extends LayerEditor {
  private layer: L.Circle

  constructor(map: L.Map, layer: L.Circle) {
    super(map)
    this.layer = layer
  }

  capture(): { center: L.LatLng; radius: number } {
    return { center: this.layer.getLatLng(), radius: this.layer.getRadius() }
  }

  restore(state: unknown): void {
    const { center, radius } = state as { center: L.LatLng; radius: number }
    this.layer.setLatLng(center)
    this.layer.setRadius(radius)
    this.refresh()
  }

  /** The point due east of the centre, on the circle */
  private edge(): L.LatLng {
    const center = this.layer.getLatLng()
    return L.latLng(center.lat, this.layer.getBounds().getEast())
  }

  protected build(): void {
    const mover = handle(this.layer.getLatLng(), 'move')
    const resizer = handle(this.edge(), 'resize')

    mover.on('dragstart', this.begin, this)
    mover.on('drag', () => {
      this.layer.setLatLng(this.position(mover))
      resizer.setLatLng(this.edge())
      this.touch()
    })
    resizer.on('dragstart', this.begin, this)
    resizer.on('drag', () => {
      this.layer.setRadius(this.layer.getLatLng().distanceTo(this.position(resizer)))
      this.touch()
    })
    // The radius can be dragged in any direction; park the handle back on the east side
    resizer.on('dragend', () => resizer.setLatLng(this.edge()))

    this.handles.addLayer(mover).addLayer(resizer)
  }
}

function editorFor(map: L.Map, layer: L.Layer): LayerEditor | null {
  // Order matters: Rectangle extends Polygon extends Polyline; Circle extends CircleMarker
  if (layer instanceof L.Rectangle) return new RectangleEditor(map, layer)
  if (layer instanceof L.Polyline) return new PathEditor(map, layer)
  if (layer instanceof L.Circle) return new CircleEditor(map, layer)
  if (layer instanceof L.Marker) return new MarkerEditor(map, layer)
  return null
}

export interface ShapeEditorOptions {
  /** Called with the layer on every change, including mid-drag and after an undo */
  onChange?: (layer: L.Layer) => void
  /** Snap dragged handles to nearby geometry */
  snap?: Snapper | null
}

interface HistoryEntry {
  editor: LayerEditor
  layer: L.Layer
  state: unknown
}

/**
 * Makes every shape of a group editable at once, with undo.
 */
export class ShapeEditor {
  private map: L.Map
  private editors = new Map<L.Layer, LayerEditor>()
  private history: HistoryEntry[] = []
  private onChange?: (layer: L.Layer) => void

  constructor(map: L.Map, layers: L.Layer[], options: ShapeEditorOptions = {}) {
    this.map = map
    this.onChange = options.onChange
    const { snap } = options

    for (const layer of layers) {
      const editor = editorFor(map, layer)
      if (!editor) continue
      editor.onChange = () => this.onChange?.(layer)
      // One history entry per gesture: the state right before it
      editor.onBegin = () => this.history.push({ editor, layer, state: editor.capture() })
      // A shape must not snap to itself
      if (snap) editor.snap = (latlng) => snap(latlng, layer)
      this.editors.set(layer, editor)
    }
  }

  enable(): void {
    this.map.getContainer().classList.add('smap-editing')
    this.editors.forEach((editor) => editor.enable())
    document.addEventListener('keydown', this.onKey)
  }

  /** Layers that were changed */
  changed(): L.Layer[] {
    return [...this.editors].filter(([, editor]) => editor.changed).map(([layer]) => layer)
  }

  get canUndo(): boolean {
    return this.history.length > 0
  }

  /** Take back the last drag, insertion or deletion. Returns false when there is none */
  undo(): boolean {
    const entry = this.history.pop()
    if (!entry) return false
    entry.editor.restore(entry.state)
    // Back at the starting state once nothing of this shape is left in the history
    entry.editor.changed = this.history.some((other) => other.editor === entry.editor)
    this.onChange?.(entry.layer)
    return true
  }

  /** Undo every change */
  revert(): void {
    this.editors.forEach((editor) => {
      if (editor.changed) editor.revert()
    })
    this.history = []
  }

  disable(): void {
    document.removeEventListener('keydown', this.onKey)
    this.editors.forEach((editor) => editor.disable())
    this.map.getContainer().classList.remove('smap-editing')
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey) return
    // Leave the browser's own undo alone while the user is typing somewhere
    const target = e.target as HTMLElement | null
    if (target?.closest?.('input, textarea, [contenteditable]')) return
    if (this.undo()) e.preventDefault()
  }
}
