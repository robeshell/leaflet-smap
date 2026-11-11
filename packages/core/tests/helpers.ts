import * as L from 'leaflet'

/**
 * A vector renderer that draws nothing.
 *
 * jsdom has neither canvas nor SVG, so Leaflet cannot create a renderer and adding
 * any polyline / polygon / circle to a map throws. Passing this as the map's
 * `renderer` option lets vector layers be added, moved and removed for real, which
 * is all the logic under test needs.
 */
const TestRenderer = (L.Renderer as any).extend({
  _initContainer(this: any) {
    this._container = document.createElement('div')
  },
  _destroyContainer(this: any) {
    this._container?.remove()
    delete this._container
  },
  // _update is inherited: paths need the renderer's bounds to project themselves
  _updatePaths() {},
  _initPath() {},
  _addPath() {},
  _removePath() {},
  _updatePath() {},
  _updateStyle() {},
  _updatePoly() {},
  _updateCircle() {},
  _bringToFront() {},
  _bringToBack() {},
})

/** Map options that make vector layers usable in jsdom */
export function vectorSafe(): { renderer: L.Renderer } {
  return { renderer: new TestRenderer() }
}

type Point = [lat: number, lng: number]

function mouseEvent(map: L.Map, [lat, lng]: Point) {
  const latlng = L.latLng(lat, lng)
  return {
    latlng,
    containerPoint: map.latLngToContainerPoint(latlng),
    layerPoint: map.latLngToLayerPoint(latlng),
    originalEvent: new MouseEvent('click'),
  }
}

/** What the user does on the map, as Leaflet reports it */
export const pointer = {
  click: (map: L.Map, at: Point) => map.fire('click', mouseEvent(map, at)),
  move: (map: L.Map, at: Point) => map.fire('mousemove', mouseEvent(map, at)),
  down: (map: L.Map, at: Point) => map.fire('mousedown', mouseEvent(map, at)),
  up: (map: L.Map, at: Point) => map.fire('mouseup', mouseEvent(map, at)),
  /** Press, move and release: how a rectangle or circle is dragged out */
  drag(map: L.Map, from: Point, to: Point) {
    pointer.down(map, from)
    pointer.move(map, to)
    pointer.up(map, to)
  },
  /** A line or polygon: one click per vertex, then the last vertex again to finish */
  path(map: L.Map, points: Point[]) {
    points.forEach((point) => pointer.click(map, point))
    pointer.click(map, points[points.length - 1])
  },
  key: (key: string, init: KeyboardEventInit = {}) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key, ...init })),
}

/** The editing handles currently on the map, by kind */
export function handles(map: L.Map, kind: 'vertex' | 'mid' | 'move' | 'resize'): L.Marker[] {
  const found: L.Marker[] = []
  map.eachLayer((layer) => {
    const className = (layer as any).options?.icon?.options?.className ?? ''
    if (layer instanceof L.Marker && className.includes(`smap-vertex--${kind}`)) found.push(layer)
  })
  return found
}

/** Drag an editing handle (or a marker) to a new position */
export function dragTo(marker: L.Marker, [lat, lng]: Point): void {
  marker.fire('dragstart')
  marker.setLatLng([lat, lng])
  marker.fire('drag')
  marker.fire('dragend')
}

/**
 * A position a given number of pixels away from a point, at the map's current zoom.
 * Snapping is defined in pixels, so tests need to speak pixels too.
 */
export function offset(map: L.Map, [lat, lng]: Point, dx: number, dy = 0): Point {
  const moved = map.containerPointToLatLng(map.latLngToContainerPoint([lat, lng]).add([dx, dy]))
  return [moved.lat, moved.lng]
}
