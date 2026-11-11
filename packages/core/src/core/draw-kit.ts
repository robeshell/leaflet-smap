/**
 * What measure and draw tools share: one drawing at a time on a map.
 */
import type * as L from 'leaflet'
import { createDrawer } from './sketch/drawers'
import type { Drawer, SketchOptions, SketchType } from './sketch/drawers'
import { Hint } from './sketch/hint'

export type { SketchOptions, SketchType }

/** Colour shared by the default look of measure and draw tools */
export const DEFAULT_ACCENT = '#1f6feb'

/**
 * Vertex handles and hints are styled in CSS through `--smap-accent`.
 * Point it at the colour of the tool that is about to draw, so they match its lines.
 */
export function applyAccent(map: L.Map, color: string | undefined): void {
  map.getContainer().style.setProperty('--smap-accent', color || DEFAULT_ACCENT)
}

/**
 * @deprecated Drawing no longer depends on leaflet-draw; there is nothing to load.
 * Kept so existing `await loadLeafletDraw()` / `Tool.preload()` calls keep working.
 */
export function loadLeafletDraw(): Promise<void> {
  return Promise.resolve()
}

export interface DrawSessionHooks<T extends SketchType> {
  /** The shape was finished. Called before `stop` */
  created(layer: L.Layer, type: T): void
  /** A vertex was added to (or removed from) the line / polygon being drawn */
  vertex?(latlngs: L.LatLng[], type: T): void
  /** Drawing ended: finished, cancelled by the caller, or cancelled with Esc */
  stop(type: T, completed: boolean): void
}

/** Only one drawing can listen to a map's clicks at a time */
const activeSessions = new WeakMap<L.Map, DrawSession<any>>()

/**
 * Draws one shape at a time.
 *
 * Each tool owns a session. Starting a drawing cancels whichever other drawing is
 * running on the same map, so several measure and draw tools can share a map.
 */
export class DrawSession<T extends SketchType> {
  private map: L.Map
  private hooks: DrawSessionHooks<T>
  private drawer: Drawer | null = null
  private hint: Hint | null = null
  private type: T | null = null

  constructor(map: L.Map, hooks: DrawSessionHooks<T>) {
    this.map = map
    this.hooks = hooks
  }

  /** Type being drawn, or null when idle */
  get active(): T | null {
    return this.type
  }

  /** Start drawing. A drawing already in progress on this map is cancelled first */
  start(type: T, options: SketchOptions, accent?: string): void {
    activeSessions.get(this.map)?.cancel()

    applyAccent(this.map, accent)
    const hint = new Hint(this.map)
    this.hint = hint
    this.type = type
    this.drawer = createDrawer(type, {
      map: this.map,
      options,
      hint,
      finish: (layer) => this.end(true, layer),
      vertex: (latlngs) => this.hooks.vertex?.(latlngs, type),
    })
    activeSessions.set(this.map, this)
    document.addEventListener('keydown', this.onKey)
    this.drawer.enable()
  }

  /** Abandon the drawing in progress */
  cancel(): void {
    this.end(false)
  }

  destroy(): void {
    this.cancel()
  }

  private end(completed: boolean, layer?: L.Layer): void {
    const { type, drawer } = this
    if (!type || !drawer) return

    // Idle before the hooks run, so a hook may start the next drawing
    this.type = null
    this.drawer = null
    drawer.disable()
    this.hint?.remove()
    this.hint = null
    document.removeEventListener('keydown', this.onKey)
    if (activeSessions.get(this.map) === this) activeSessions.delete(this.map)

    if (completed && layer) this.hooks.created(layer, type)
    this.hooks.stop(type, completed)
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cancel()
  }
}
