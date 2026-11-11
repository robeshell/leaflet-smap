import * as L from 'leaflet'
import type { ContextMenuContext, ContextMenuItem, ContextMenuItems } from '../types'

/**
 * Right-click menus for the map and for individual layers.
 */
export class ContextMenu {
  private map: L.Map
  private mapItems: ContextMenuItems | null = null
  private bound = new Map<L.Layer, (e: L.LeafletMouseEvent) => void>()
  private el: HTMLElement | null = null

  constructor(map: L.Map) {
    this.map = map
    this.map.on('click movestart zoomstart resize', this.hide, this)
    document.addEventListener('pointerdown', this.onPointerDown, true)
    document.addEventListener('keydown', this.onKeyDown)
  }

  /** Set the menu shown when right-clicking the map itself. Pass null to remove it */
  setItems(items: ContextMenuItems | null): void {
    // Only listen while there is a menu: a `contextmenu` listener on the map
    // suppresses the browser's own menu.
    this.map.off('contextmenu', this.onMapContextMenu, this)
    this.mapItems = items
    if (items) {
      this.map.on('contextmenu', this.onMapContextMenu, this)
    }
  }

  /** Give a layer its own menu. Returns a function that removes it again */
  bind(layer: L.Layer, items: ContextMenuItems): () => void {
    this.unbind(layer)
    const handler = (e: L.LeafletMouseEvent) => {
      // Keep the map's own menu from opening on top of this one
      L.DomEvent.stopPropagation(e as any)
      e.originalEvent?.preventDefault()
      this.open(items, { latlng: e.latlng, containerPoint: e.containerPoint, layer })
    }
    layer.on('contextmenu', handler as L.LeafletEventHandlerFn)
    this.bound.set(layer, handler)
    return () => this.unbind(layer)
  }

  unbind(layer: L.Layer): void {
    const handler = this.bound.get(layer)
    if (handler) {
      layer.off('contextmenu', handler as L.LeafletEventHandlerFn)
      this.bound.delete(layer)
    }
  }

  /** Close the menu if it is open */
  hide(): void {
    this.el?.remove()
    this.el = null
  }

  destroy(): void {
    this.hide()
    this.setItems(null)
    for (const layer of [...this.bound.keys()]) {
      this.unbind(layer)
    }
    this.map.off('click movestart zoomstart resize', this.hide, this)
    document.removeEventListener('pointerdown', this.onPointerDown, true)
    document.removeEventListener('keydown', this.onKeyDown)
  }

  private onMapContextMenu(e: L.LeafletMouseEvent): void {
    if (this.mapItems) {
      this.open(this.mapItems, { latlng: e.latlng, containerPoint: e.containerPoint })
    }
  }

  private onPointerDown = (e: Event) => {
    if (this.el && !this.el.contains(e.target as Node)) this.hide()
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.hide()
  }

  private open(source: ContextMenuItems, at: Omit<ContextMenuContext, 'map'>): void {
    this.hide()
    const context: ContextMenuContext = { ...at, map: this.map }
    const items = typeof source === 'function' ? source(context) : source
    if (!items.length) return

    const el = L.DomUtil.create('div', 'smap-contextmenu')
    el.setAttribute('role', 'menu')
    L.DomEvent.disableClickPropagation(el)
    L.DomEvent.disableScrollPropagation(el)
    el.addEventListener('contextmenu', (e) => e.preventDefault())

    items.forEach((item) => el.appendChild(this.renderItem(item, context)))

    const container = this.map.getContainer()
    container.appendChild(el)
    this.el = el

    // Keep the menu inside the map
    const left = Math.max(0, Math.min(at.containerPoint.x, container.clientWidth - el.offsetWidth))
    const top = Math.max(0, Math.min(at.containerPoint.y, container.clientHeight - el.offsetHeight))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }

  private renderItem(item: ContextMenuItem, context: ContextMenuContext): HTMLElement {
    if (item === '-') {
      const separator = L.DomUtil.create('div', 'smap-contextmenu-separator')
      separator.setAttribute('role', 'separator')
      return separator
    }

    const button = L.DomUtil.create('button', 'smap-contextmenu-item')
    button.type = 'button'
    button.setAttribute('role', 'menuitem')
    button.textContent = item.text
    button.disabled = !!item.disabled
    if (item.danger) button.classList.add('is-danger')
    button.addEventListener('click', () => {
      this.hide()
      item.onClick?.(context)
    })
    return button
  }
}
