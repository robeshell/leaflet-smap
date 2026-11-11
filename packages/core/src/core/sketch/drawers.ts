/**
 * Drawing interactions, one class per kind of shape.
 *
 * A drawer listens to the map, shows a preview, and hands over a finished Leaflet
 * layer. It knows nothing about tools, results or events — that is DrawSession's job.
 */
import * as L from 'leaflet'
import { formatLength } from './geometry'
import type { Hint } from './hint'
import { sketchText } from './text'

export type SketchType = 'marker' | 'polyline' | 'polygon' | 'rectangle' | 'circle'

export interface SketchOptions {
  /** Style of lines and areas */
  shapeOptions?: L.PathOptions
  /** Icon of a drawn marker */
  markerIcon?: L.Icon | L.DivIcon
  /** Icon of the vertices shown while drawing a line or polygon */
  vertexIcon?: L.Icon | L.DivIcon
  /** Adjusts a position to nearby geometry; returns the input when nothing is close */
  snap?: (latlng: L.LatLng) => L.LatLng
}

export interface DrawerHost {
  map: L.Map
  options: SketchOptions
  hint: Hint
  /** The shape is done */
  finish(layer: L.Layer): void
  /** A vertex was added to a line / polygon */
  vertex(latlngs: L.LatLng[]): void
}

/** Clicking this close (px) to a vertex counts as clicking the vertex */
const SNAP = 8
/** Moving less than this (px) between press and release is a click, not a drag */
const DRAG_THRESHOLD = 6

export function vertexIcon(
  kind: 'vertex' | 'mid' | 'move' | 'resize' | 'snap' = 'vertex',
): L.DivIcon {
  return L.divIcon({
    className: `smap-vertex smap-vertex--${kind}`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

export abstract class Drawer {
  protected host: DrawerHost
  protected map: L.Map
  /** Preview layers; removed as one when drawing ends */
  protected scratch: L.FeatureGroup
  /** Ring shown where the cursor has snapped to */
  private snapMark: L.Marker | null = null

  constructor(host: DrawerHost) {
    this.host = host
    this.map = host.map
    this.scratch = L.featureGroup()
  }

  enable(): void {
    this.scratch.addTo(this.map)
    this.map.getContainer().classList.add('smap-drawing')
    this.map.on('mousemove', this.trackHint, this)
    this.start()
  }

  disable(): void {
    this.stop()
    this.map.off('mousemove', this.trackHint, this)
    this.map.getContainer().classList.remove('smap-drawing')
    this.scratch.remove()
  }

  /** Start listening */
  protected abstract start(): void
  /** Stop listening and undo anything changed on the map */
  protected abstract stop(): void

  protected get shape(): L.PathOptions {
    return this.host.options.shapeOptions ?? {}
  }

  /** Style of the not-yet-committed part of a shape */
  protected get ghost(): L.PathOptions {
    return { ...this.shape, dashArray: '4 6', opacity: 0.75, interactive: false }
  }

  /** The position an event stands for: snapped to nearby geometry when there is some */
  protected resolve(e: L.LeafletMouseEvent): L.LatLng {
    const snapped = this.host.options.snap?.(e.latlng) ?? e.latlng
    this.markSnap(snapped !== e.latlng ? snapped : null)
    return snapped
  }

  private markSnap(latlng: L.LatLng | null): void {
    if (!latlng) {
      this.snapMark?.remove()
      this.snapMark = null
    } else if (this.snapMark) {
      this.snapMark.setLatLng(latlng)
    } else {
      this.snapMark = L.marker(latlng, {
        icon: vertexIcon('snap'),
        interactive: false,
        keyboard: false,
      }).addTo(this.scratch)
    }
  }

  private trackHint(e: L.LeafletMouseEvent): void {
    this.host.hint.move(e.containerPoint)
    // Show where a click would land before it happens
    if (this.host.options.snap) this.resolve(e)
  }
}

// ============ Marker ============

export class MarkerDrawer extends Drawer {
  protected start(): void {
    this.host.hint.set(sketchText.marker.start, sketchText.cancel)
    this.map.on('click', this.onClick, this)
  }

  protected stop(): void {
    this.map.off('click', this.onClick, this)
  }

  private onClick(e: L.LeafletMouseEvent): void {
    const icon = this.host.options.markerIcon
    this.host.finish(L.marker(this.resolve(e), icon ? { icon } : {}))
  }
}

// ============ Line and polygon: one click per vertex ============

export class PathDrawer extends Drawer {
  private closed: boolean
  private points: L.LatLng[] = []
  private line!: L.Polyline
  private guide!: L.Polyline
  private fill: L.Polygon | null = null
  private handles = L.layerGroup()
  private hadDoubleClickZoom = false

  constructor(host: DrawerHost, closed: boolean) {
    super(host)
    this.closed = closed
  }

  private get text() {
    return this.closed ? sketchText.polygon : sketchText.polyline
  }

  /** Fewest points that make a shape */
  private get min(): number {
    return this.closed ? 3 : 2
  }

  protected start(): void {
    this.line = L.polyline([], { ...this.shape, fill: false, interactive: false })
    this.guide = L.polyline([], { ...this.ghost, fill: false })
    this.scratch.addLayer(this.line).addLayer(this.guide).addLayer(this.handles)
    if (this.closed) {
      this.fill = L.polygon([], { ...this.shape, stroke: false, interactive: false })
      this.scratch.addLayer(this.fill)
    }

    // A double click must end the shape, not zoom the map
    this.hadDoubleClickZoom = this.map.doubleClickZoom.enabled()
    this.map.doubleClickZoom.disable()

    this.map.on('click', this.onClick, this)
    this.map.on('mousemove', this.onMove, this)
    document.addEventListener('keydown', this.onKey)
    this.host.hint.set(this.text.start, sketchText.cancel)
  }

  protected stop(): void {
    this.map.off('click', this.onClick, this)
    this.map.off('mousemove', this.onMove, this)
    document.removeEventListener('keydown', this.onKey)
    if (this.hadDoubleClickZoom) this.map.doubleClickZoom.enable()
  }

  private near(point: L.Point, latlng: L.LatLng): boolean {
    return this.map.latLngToContainerPoint(latlng).distanceTo(point) <= SNAP
  }

  private onClick(e: L.LeafletMouseEvent): void {
    const { points } = this
    const latlng = this.resolve(e)
    // On a vertex: within reach of it, or snapped onto the very same position
    // (snapping can pull a slightly-off click onto geometry lying under the vertex)
    const hits = (vertex: L.LatLng) => this.near(e.containerPoint, vertex) || latlng.equals(vertex)

    if (points.length) {
      // The second click of a double click lands on the vertex just placed
      if (hits(points[points.length - 1])) return this.tryFinish()
      if (this.closed && hits(points[0])) return this.tryFinish()
    }
    this.add(latlng)
  }

  private add(latlng: L.LatLng): void {
    this.points.push(latlng)
    this.redraw()
    this.host.vertex([...this.points])
  }

  private undo(): void {
    if (!this.points.length) return
    this.points.pop()
    this.guide.setLatLngs([])
    this.redraw()
    this.host.vertex([...this.points])
  }

  private tryFinish(): void {
    if (this.points.length < this.min) {
      this.host.hint.set(sketchText.tooFewPoints.replace('{n}', String(this.min)), '', true)
      return
    }
    const options = { ...this.shape }
    this.host.finish(
      this.closed ? L.polygon(this.points, options) : L.polyline(this.points, options),
    )
  }

  private redraw(): void {
    const { points } = this
    this.line.setLatLngs(points)

    this.handles.clearLayers()
    const icon = this.host.options.vertexIcon ?? vertexIcon()
    points.forEach((latlng, i) => {
      const isFirst = i === 0
      const isLast = i === points.length - 1
      const handle = L.marker(latlng, {
        icon,
        // Only the vertices that end the shape react to the mouse
        interactive: isLast || (this.closed && isFirst),
        keyboard: false,
      })
      if (isLast || (this.closed && isFirst)) handle.on('click', () => this.tryFinish())
      this.handles.addLayer(handle)
    })

    if (!points.length) this.host.hint.set(this.text.start, sketchText.cancel)
    else if (points.length < this.min) this.host.hint.set(this.text.next, sketchText.cancel)
    else this.host.hint.set(this.text.next, this.text.finish)
  }

  private onMove(e: L.LeafletMouseEvent): void {
    const { points } = this
    if (!points.length) return
    const last = points[points.length - 1]
    const to = this.resolve(e)
    // For a polygon the guide also shows the closing edge
    this.guide.setLatLngs(this.closed && points.length > 1 ? [last, to, points[0]] : [last, to])
    this.fill?.setLatLngs([...points, to])
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') this.tryFinish()
    else if (e.key === 'Backspace') this.undo()
  }
}

// ============ Rectangle and circle: press-drag-release, or click twice ============

abstract class TwoPointDrawer extends Drawer {
  protected origin: L.LatLng | null = null
  private originPoint: L.Point | null = null
  /** The button is down since the origin was set */
  private pressing = false
  private dragged = false
  /** The click that set the origin has been seen; the next click finishes */
  private armed = false
  private hadDragging = false

  protected abstract get text(): { start: string; finish: string }
  /** Create the preview once the origin is known */
  protected abstract begin(origin: L.LatLng): void
  /** Update the preview */
  protected abstract update(origin: L.LatLng, to: L.LatLng): void
  /** The finished layer, or null if it has no size yet */
  protected abstract build(origin: L.LatLng, to: L.LatLng): L.Layer | null

  protected start(): void {
    // Dragging has to draw, not pan
    this.hadDragging = this.map.dragging.enabled()
    this.map.dragging.disable()

    this.map.on('mousedown', this.onDown, this)
    this.map.on('mousemove', this.onMove, this)
    this.map.on('mouseup', this.onUp, this)
    this.map.on('click', this.onClick, this)
    this.host.hint.set(this.text.start, sketchText.cancel)
  }

  protected stop(): void {
    this.map.off('mousedown', this.onDown, this)
    this.map.off('mousemove', this.onMove, this)
    this.map.off('mouseup', this.onUp, this)
    this.map.off('click', this.onClick, this)
    if (this.hadDragging) this.map.dragging.enable()
  }

  private setOrigin(e: L.LeafletMouseEvent): void {
    this.origin = this.resolve(e)
    this.originPoint = e.containerPoint
    this.begin(this.origin)
    this.host.hint.set(this.text.finish, sketchText.cancel)
  }

  private onDown(e: L.LeafletMouseEvent): void {
    if (this.origin) return
    this.setOrigin(e)
    this.pressing = true
    this.dragged = false
  }

  private onMove(e: L.LeafletMouseEvent): void {
    if (!this.origin) return
    this.update(this.origin, this.resolve(e))
    if (this.pressing && this.originPoint!.distanceTo(e.containerPoint) > DRAG_THRESHOLD) {
      this.dragged = true
    }
  }

  private onUp(e: L.LeafletMouseEvent): void {
    const wasDrag = this.pressing && this.dragged
    this.pressing = false
    if (wasDrag) this.complete(this.resolve(e))
  }

  private onClick(e: L.LeafletMouseEvent): void {
    if (!this.origin) {
      // No press was seen first: a tap on a touch screen
      this.setOrigin(e)
      this.armed = true
    } else if (!this.armed) {
      // The click that belongs to the press which set the origin
      this.armed = true
    } else {
      this.complete(this.resolve(e))
    }
  }

  private complete(to: L.LatLng): void {
    const layer = this.build(this.origin!, to)
    if (layer) this.host.finish(layer)
  }
}

export class RectangleDrawer extends TwoPointDrawer {
  private preview: L.Rectangle | null = null

  protected get text() {
    return sketchText.rectangle
  }

  protected begin(origin: L.LatLng): void {
    this.preview = L.rectangle(L.latLngBounds(origin, origin), {
      ...this.shape,
      interactive: false,
    })
    this.scratch.addLayer(this.preview)
  }

  protected update(origin: L.LatLng, to: L.LatLng): void {
    this.preview?.setBounds(L.latLngBounds(origin, to))
  }

  protected build(origin: L.LatLng, to: L.LatLng): L.Layer | null {
    if (origin.lat === to.lat || origin.lng === to.lng) return null
    return L.rectangle(L.latLngBounds(origin, to), { ...this.shape })
  }
}

export class CircleDrawer extends TwoPointDrawer {
  private preview: L.Circle | null = null

  protected get text() {
    return sketchText.circle
  }

  protected begin(origin: L.LatLng): void {
    this.preview = L.circle(origin, { ...this.shape, radius: 0, interactive: false })
    this.scratch.addLayer(this.preview)
  }

  protected update(origin: L.LatLng, to: L.LatLng): void {
    const radius = origin.distanceTo(to)
    this.preview?.setRadius(radius)
    this.host.hint.set(this.text.finish, `${sketchText.circle.radius} ${formatLength(radius)}`)
  }

  protected build(origin: L.LatLng, to: L.LatLng): L.Layer | null {
    const radius = origin.distanceTo(to)
    if (!(radius > 0)) return null
    return L.circle(origin, { ...this.shape, radius })
  }
}

export function createDrawer(type: SketchType, host: DrawerHost): Drawer {
  switch (type) {
    case 'marker':
      return new MarkerDrawer(host)
    case 'polyline':
      return new PathDrawer(host, false)
    case 'polygon':
      return new PathDrawer(host, true)
    case 'rectangle':
      return new RectangleDrawer(host)
    case 'circle':
      return new CircleDrawer(host)
    default:
      throw new Error(`Unknown draw type: ${type}`)
  }
}
