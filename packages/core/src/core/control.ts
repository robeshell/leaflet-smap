import * as L from 'leaflet'
import type { LayerManager } from './layer'
import type {
  AttributionOptions,
  ControlOptions,
  ControlType,
  LayersControlOptions,
  OverlaysControlOptions,
  TileType,
} from '../types'

/** What the base-map switcher needs from the map it belongs to */
export interface TileHost {
  setTileLayer(type: TileType | TileType[]): unknown
  getTileType(): TileType[]
  onTileChange(handler: () => void): void
}

const sameTypes = (a: TileType[], b: TileType[]) =>
  a.length === b.length && a.every((type, i) => type === b[i])

export class ControlManager {
  private map: L.Map
  private host?: TileHost
  private controls = new Map<string, L.Control>()
  private layers?: LayerManager
  private refreshLayers: (() => void) | null = null
  private refreshOverlays: (() => void) | null = null

  constructor(map: L.Map, host?: TileHost, layers?: LayerManager) {
    this.map = map
    this.host = host
    this.layers = layers
    host?.onTileChange(() => this.refreshLayers?.())
    layers?.onChange(() => this.refreshOverlays?.())
  }

  /**
   * Add a control by type. Adding the same type again replaces the previous one.
   */
  add(type: 'layers', options: LayersControlOptions): L.Control
  add(type: 'overlays', options?: OverlaysControlOptions): L.Control
  add(
    type: 'attribution' | 'zoom' | 'scale',
    options?: ControlOptions & AttributionOptions,
  ): L.Control
  add(type: ControlType, options?: any): L.Control {
    this.remove(type)

    let control: L.Control

    switch (type) {
      case 'attribution': {
        const attrControl = L.control.attribution({ prefix: options?.prefix ?? '' })
        attrControl.addAttribution(
          options?.content ?? 'smap-leaflet &copy; <a href="https://github.com">SMap</a>',
        )
        control = attrControl
        break
      }
      case 'zoom': {
        control = L.control.zoom({
          position: options?.position ?? 'topright',
          ...options,
        })
        break
      }
      case 'scale': {
        control = L.control.scale({
          position: options?.position ?? 'bottomleft',
          ...options,
        })
        break
      }
      case 'layers': {
        control = this.createLayersControl(options)
        break
      }
      case 'overlays': {
        control = this.createOverlaysControl(options ?? {})
        break
      }
      default:
        throw new Error(`Unknown control type: ${type}`)
    }

    control.addTo(this.map)
    this.controls.set(type, control)
    return control
  }

  /** Base-map switcher: one button per entry, the current one highlighted */
  private createLayersControl(options: LayersControlOptions): L.Control {
    const host = this.host
    if (!host) {
      throw new Error('The "layers" control is only available through smap.control')
    }
    if (!options?.options?.length) {
      throw new Error('The "layers" control needs a non-empty `options` list')
    }

    const entries = options.options.map((entry) => ({
      label: entry.label,
      types: Array.isArray(entry.tileType) ? entry.tileType : [entry.tileType],
    }))

    const control = new L.Control({ position: options.position ?? 'topright' })
    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'smap-layers leaflet-bar')
      container.setAttribute('role', 'group')
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)

      const buttons = entries.map((entry) => {
        const button = L.DomUtil.create('button', 'smap-layers-item', container)
        button.type = 'button'
        button.textContent = entry.label
        button.addEventListener('click', () => host.setTileLayer(entry.types))
        return button
      })

      this.refreshLayers = () => {
        const current = host.getTileType()
        buttons.forEach((button, i) => {
          const active = sameTypes(entries[i].types, current)
          button.classList.toggle('is-active', active)
          button.setAttribute('aria-pressed', String(active))
        })
      }
      this.refreshLayers()
      return container
    }
    control.onRemove = () => {
      this.refreshLayers = null
    }
    return control
  }

  /** Switches for the layers registered in `smap.layer` */
  private createOverlaysControl(options: OverlaysControlOptions): L.Control {
    const layers = this.layers
    if (!layers) {
      throw new Error('The "overlays" control is only available through smap.control')
    }

    const control = new L.Control({ position: options.position ?? 'topright' })
    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'smap-overlays leaflet-bar')
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)

      if (options.title) {
        L.DomUtil.create('div', 'smap-overlays-title', container).textContent = options.title
      }
      const list = L.DomUtil.create('div', 'smap-overlays-list', container)

      this.refreshOverlays = () => {
        list.textContent = ''
        const items = options.items ?? layers.ids().map((id) => ({ id, label: id }))
        for (const item of items) {
          const row = L.DomUtil.create('label', 'smap-overlays-item', list)
          const box = L.DomUtil.create('input', '', row)
          box.type = 'checkbox'
          box.checked = layers.isVisible(item.id)
          // Listed but not registered (yet): shown, but nothing to switch
          box.disabled = !layers.has(item.id)
          box.addEventListener('change', () => layers.toggle(item.id, box.checked))
          L.DomUtil.create('span', '', row).textContent = item.label
        }
        container.classList.toggle('is-empty', !items.length)
      }
      this.refreshOverlays()
      return container
    }
    control.onRemove = () => {
      this.refreshOverlays = null
    }
    return control
  }

  /**
   * Remove a control by type
   */
  remove(type: string): void {
    const control = this.controls.get(type)
    if (control) {
      control.remove()
      this.controls.delete(type)
    }
  }

  /**
   * Remove all managed controls
   */
  removeAll(): void {
    for (const [, control] of this.controls) {
      control.remove()
    }
    this.controls.clear()
  }
}
