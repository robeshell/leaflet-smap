import * as L from 'leaflet'

import type {
  MeasureEvents,
  MeasureLabel,
  MeasureOptions,
  MeasureResult,
  MeasureTool,
  MeasureType,
} from '../../types'
import { createEmitter } from '../../utils/emitter'
import { DEFAULT_ACCENT, DrawSession, loadLeafletDraw } from '../draw-kit'
import { ShapeEditor } from '../sketch/editors'
import { formatArea, formatLength, pathLength } from '../sketch/geometry'
import { snapperFor } from '../sketch/snap'
import type { Snapper } from '../sketch/snap'

const DEFAULT_SHAPE_OPTIONS: L.PathOptions = {
  stroke: true,
  color: DEFAULT_ACCENT,
  weight: 3,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
  fillOpacity: 0.12,
}

let idCounter = 0
function generateId(): string {
  return `measure_${++idCounter}_${Date.now()}`
}

/** What a tool works out from a finished shape */
export type MeasureGeometry = Omit<MeasureResult, 'id' | 'type' | 'layer'>

/** A label to put on the map */
export interface LabelSpec {
  latlng: L.LatLng
  html: string
}

/** One finished measurement and what it put on the map */
interface Entry {
  result: MeasureResult
  labels: L.FeatureGroup
}

/**
 * Base class of the measure tools.
 *
 * It owns the whole lifecycle — drawing, labels, results, events, cleanup. A
 * concrete tool only says how to read numbers off a shape and how to word them.
 */
export abstract class BaseMeasureTool implements MeasureTool {
  protected map: L.Map
  protected options: MeasureOptions
  /** Holds the finished shapes */
  protected layerGroup: L.FeatureGroup

  private entries = new Map<string, Entry>()
  /** Labels of the drawing in progress */
  private draft: L.FeatureGroup | null = null
  private session: DrawSession<MeasureType>
  private emitter = createEmitter<MeasureEvents>()
  private clickHandler: (e: MouseEvent) => void
  private editor: ShapeEditor | null = null
  private snapper: Snapper | null
  private destroyed = false

  /** @deprecated Nothing needs loading any more. Kept so existing calls keep working */
  static preload(): Promise<void> {
    return loadLeafletDraw()
  }

  constructor(map: L.Map, options: MeasureOptions = {}) {
    this.map = map
    // A copy: setOptions() must not write into the caller's object
    this.options = { ...options }
    this.layerGroup = L.featureGroup().addTo(map)
    // Later measurements can snap to the earlier ones
    this.snapper = snapperFor(map, options.snap, () => this.layerGroup.getLayers())

    this.session = new DrawSession<MeasureType>(map, {
      created: (layer) => this.handleCreated(layer),
      vertex: (latlngs) => this.handleVertex(latlngs),
      stop: (type, completed) => {
        this.setDraft(null)
        this.emitter.emit('stop', { type, completed })
      },
    })

    // One delegated listener serves the × button of every result label
    this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList?.contains('smap-measure-remove')) {
        const id = target.dataset.measureId
        if (id) this.remove(id)
      }
    }
    map.getContainer().addEventListener('click', this.clickHandler)
  }

  // ============ What a concrete tool provides ============

  /** Which shape this tool draws */
  protected abstract readonly drawType: MeasureType

  /** Read the measurement off a finished shape */
  protected abstract measure(layer: any): MeasureGeometry

  /** Where the result label goes */
  protected abstract anchor(result: MeasureResult): L.LatLng

  /** Default wording of a label */
  protected abstract defaultText(label: MeasureLabel): string

  /** What the deprecated `valueFormatter` option receives for this tool */
  protected abstract legacyValue(label: MeasureLabel): number | L.LatLng[]

  /** Labels to show while drawing; only the distance tool has any */
  protected draftLabels(_latlngs: L.LatLng[]): LabelSpec[] {
    return []
  }

  /** Labels of a finished measurement. By default just the result label */
  protected resultLabels(result: MeasureResult): LabelSpec[] {
    return [{ latlng: this.anchor(result), html: this.resultHtml(result) }]
  }

  // ============ Public API ============

  get type(): MeasureType {
    return this.drawType
  }

  get measuring(): boolean {
    return this.session.active !== null
  }

  enable(): void {
    this.finishEdit(true)
    const shapeOptions = this.getShapeOptions()
    const { snapper } = this
    this.session.start(
      this.drawType,
      {
        shapeOptions,
        vertexIcon: this.options.icon,
        snap: snapper ? (latlng) => snapper(latlng) : undefined,
      },
      shapeOptions.color,
    )
    this.emitter.emit('start', { type: this.drawType })
  }

  disable(): void {
    // The drawing ends by itself when the shape is finished; this cancels one in progress
    this.session.cancel()
  }

  // ============ Editing ============

  get editing(): boolean {
    return !!this.editor
  }

  startEdit(): void {
    if (this.editor) return
    this.disable()
    const byLayer = new Map([...this.entries.values()].map((entry) => [entry.result.layer, entry]))
    this.editor = new ShapeEditor(this.map, [...byLayer.keys()], {
      snap: this.snapper,
      onChange: (layer) => {
        const entry = byLayer.get(layer)
        if (!entry) return
        this.refresh(entry)
        this.emitter.emit('updating', entry.result)
      },
    })
    this.editor.enable()
  }

  undo(): boolean {
    return this.editor?.undo() ?? false
  }

  finishEdit(save = true): void {
    const editor = this.editor
    if (!editor) return
    this.editor = null

    const changed = editor.changed()
    if (!save) editor.revert()
    editor.disable()

    for (const entry of this.entries.values()) {
      if (!changed.includes(entry.result.layer)) continue
      // Reverted shapes need their old numbers and labels back as well
      this.refresh(entry)
      if (save) this.emitter.emit('updated', entry.result)
    }
  }

  /** Read the numbers off the shape again and redraw its labels */
  private refresh(entry: Entry): void {
    // In place: the result object handed out earlier stays the current one
    Object.assign(entry.result, this.measure(entry.result.layer))
    entry.labels.remove()
    entry.labels = this.renderLabels(this.options.showMarker ? this.resultLabels(entry.result) : [])
  }

  setOptions(options: Partial<MeasureOptions>): void {
    Object.assign(this.options, options)
    for (const entry of this.entries.values()) this.refresh(entry)
  }

  getResults(): MeasureResult[] {
    return [...this.entries.values()].map((entry) => entry.result)
  }

  remove(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    // The editor holds handles on this shape
    this.finishEdit(true)
    entry.labels.remove()
    this.layerGroup.removeLayer(entry.result.layer)
    this.entries.delete(id)
    this.emitter.emit('removed', { id, type: this.drawType })
  }

  clearAll(): void {
    for (const id of [...this.entries.keys()]) {
      this.remove(id)
    }
  }

  on<K extends keyof MeasureEvents>(type: K, handler: (event: MeasureEvents[K]) => void): void {
    this.emitter.on(type, handler as any)
  }

  off<K extends keyof MeasureEvents>(type: K, handler: (event: MeasureEvents[K]) => void): void {
    this.emitter.off(type, handler as any)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.session.destroy()
    this.finishEdit(false)
    this.setDraft(null)
    this.clearAll()
    this.layerGroup.remove()
    this.map.getContainer().removeEventListener('click', this.clickHandler)
    this.emitter.emit('destroyed', { type: this.drawType })
    this.emitter.all.clear()
  }

  // ============ Drawing ============

  private handleVertex(latlngs: L.LatLng[]): void {
    if (!this.options.showMarker) return
    const labels = this.draftLabels(latlngs)
    if (labels.length) this.setDraft(this.renderLabels(labels))
  }

  private handleCreated(layer: L.Layer): void {
    const id = generateId()
    this.layerGroup.addLayer(layer)

    const result: MeasureResult = { id, type: this.drawType, layer, ...this.measure(layer) }
    // The final labels are built from the finished shape, not carried over from the draft
    this.setDraft(null)
    const labels = this.renderLabels(this.options.showMarker ? this.resultLabels(result) : [])

    this.entries.set(id, { result, labels })
    this.emitter.emit('created', result)
  }

  private setDraft(group: L.FeatureGroup | null): void {
    this.draft?.remove()
    this.draft = group
  }

  /** Put labels on the map. A label is a permanent tooltip on an invisible marker */
  private renderLabels(specs: LabelSpec[]): L.FeatureGroup {
    const group = L.featureGroup()
    for (const { latlng, html } of specs) {
      L.marker(latlng, { icon: L.divIcon({ className: 'measure-div-icon' }), interactive: false })
        .bindTooltip(html, {
          permanent: true,
          direction: 'right',
          offset: [6, 0],
          className: 'measure-tooltip',
        })
        .addTo(group)
    }
    return group.addTo(this.map)
  }

  // ============ Helpers for concrete tools ============

  protected getShapeOptions(): L.PathOptions {
    return { ...DEFAULT_SHAPE_OPTIONS, ...this.options.shapeOptions }
  }

  /** Text of a label: `formatLabel`, else the deprecated `valueFormatter`, else the default */
  protected text(label: MeasureLabel, legacyPrefix = ''): string {
    if (this.options.formatLabel) return this.options.formatLabel(label)
    if (this.options.valueFormatter) {
      return legacyPrefix + this.options.valueFormatter(this.legacyValue(label))
    }
    return this.defaultText(label)
  }

  /** Plain label, used for intermediate values */
  protected labelHtml(content: string): string {
    return `<div class="smap-measure-label" style="${this.accentStyle()}">${content}</div>`
  }

  /** Emphasised label of a finished measurement, with the button that removes it */
  protected resultHtml(result: MeasureResult, legacyPrefix = ''): string {
    const { id: _id, layer: _layer, ...rest } = result
    const content = this.text({ ...rest, partial: false }, legacyPrefix)
    const removeBtn = `<button type="button" class="smap-measure-remove" data-measure-id="${result.id}" title="删除" aria-label="删除">×</button>`
    return `<div class="smap-measure-label smap-measure-label--result" style="${this.accentStyle()}"><span>${content}</span>${removeBtn}</div>`
  }

  /** Labels take the colour of this tool's lines */
  private accentStyle(): string {
    return `--smap-accent:${this.getShapeOptions().color || DEFAULT_ACCENT}`
  }

  protected formatLength(meters: number): string {
    return formatLength(meters, this.options.lengthUnit)
  }

  protected formatArea(sqMeters: number): string {
    return formatArea(sqMeters, this.options.areaUnit)
  }

  /** Length of a path in metres */
  protected pathLength(latlngs: L.LatLng[]): number {
    return pathLength(latlngs)
  }
}
