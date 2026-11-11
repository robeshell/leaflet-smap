/**
 * Guard against a Leaflet canvas renderer redrawing after it was removed.
 *
 * `L.Canvas` schedules redraws on the next animation frame and cancels the pending
 * one when it is removed. But a redraw that runs directly (on every map `update`)
 * forgets the id of the frame still pending, so that frame can no longer be
 * cancelled. If the map is removed before it fires, it runs against a renderer
 * without a drawing context and throws
 * "Cannot read properties of undefined (reading 'clearRect')".
 * Typical trigger: destroying a map that has vector layers while it is still animating.
 */
import * as L from 'leaflet'

export function installCanvasRedrawGuard(): void {
  const proto = L.Canvas.prototype as any
  const redraw = proto._redraw
  proto._redraw = function (this: any) {
    if (!this._ctx) {
      this._redrawRequest = null
      return
    }
    redraw.call(this)
  }
}
