import { computed, markRaw, onScopeDispose, ref, shallowRef, toRaw } from 'vue'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type {
  DrawOptions,
  DrawTool,
  DrawType,
  MeasureOptions,
  MeasureResult,
  MeasureTool,
  MeasureType,
} from 'smap-leaflet'
import { resolveSMap } from './context'
import type { SMapSource } from './context'

const NOT_READY = 'The map is not ready yet'

// ============ Measure ============

export interface UseMeasureOptions extends MeasureOptions {
  /** The map to measure on. Defaults to the enclosing <SMapView>'s */
  smap?: SMapSource
}

export interface UseMeasureReturn {
  /** Finished measurements still on the map */
  results: ShallowRef<MeasureResult[]>
  /** Tool currently drawing, or null */
  active: Ref<MeasureType | null>
  /** True while the results can be reshaped */
  editing: Ref<boolean>
  /** Start measuring. Cancels a measurement in progress */
  start: (type: MeasureType) => Promise<void>
  /** Abandon the measurement in progress */
  cancel: () => void
  /** Remove one result */
  remove: (result: Pick<MeasureResult, 'id' | 'type'>) => void
  /** Remove every result */
  clear: () => void
  /** Let the user reshape the results; values follow while dragging */
  startEdit: () => void
  /** Leave edit mode, keeping (default) or discarding the changes */
  finishEdit: (save?: boolean) => void
  /** Change options of the tools afterwards, e.g. `{ areaUnit: 'mu' }` */
  setOptions: (options: Partial<MeasureOptions>) => void
  /** Take back the last change made in edit mode. Returns false when there is none */
  undo: () => boolean
}

/**
 * Measuring with reactive state. Results are shown on the map by default
 * (`showMarker: true`); pass `showMarker: false` to keep them off the map.
 */
export function useMeasure(options: UseMeasureOptions = {}): UseMeasureReturn {
  const { smap: source, ...measureOptions } = options
  const results = shallowRef<MeasureResult[]>([])
  const active = ref<MeasureType | null>(null)
  const editing = ref(false)
  const tools = new Map<MeasureType, MeasureTool>()

  // Results carry Leaflet layers. They live in a shallowRef and are marked raw, so
  // copying them into reactive state elsewhere still never proxies the layers.
  const sync = () => {
    results.value = [...tools.values()].flatMap((tool) => tool.getResults()).map(markRaw)
  }
  const getSMap = resolveSMap(source, () => {
    // A different map (the view was recreated): the old tools died with the old map
    tools.clear()
    results.value = []
    active.value = null
    editing.value = false
  })

  async function start(type: MeasureType): Promise<void> {
    const smap = getSMap()
    if (!smap) throw new Error(NOT_READY)
    cancel()

    let tool = tools.get(type)
    if (!tool) {
      tool = markRaw(await smap.createMeasure(type, { showMarker: true, ...measureOptions }))
      tool.on('created', sync)
      tool.on('removed', sync)
      // While a handle is dragged the numbers change; keep the list in step
      tool.on('updating', sync)
      tool.on('updated', sync)
      // Ends for any reason: finished, cancelled here, or cancelled with Esc
      tool.on('stop', () => {
        if (active.value === type) active.value = null
      })
      tools.set(type, tool)
    }
    // Measuring again leaves edit mode
    finishEdit()
    tool.enable()
    active.value = type
  }

  function cancel(): void {
    if (active.value) tools.get(active.value)?.disable()
    active.value = null
  }

  function remove(result: Pick<MeasureResult, 'id' | 'type'>): void {
    finishEdit()
    tools.get(result.type)?.remove(result.id)
  }

  function clear(): void {
    finishEdit()
    tools.forEach((tool) => tool.clearAll())
  }

  function startEdit(): void {
    cancel()
    tools.forEach((tool) => tool.startEdit())
    editing.value = tools.size > 0
  }

  function finishEdit(save = true): void {
    tools.forEach((tool) => tool.finishEdit(save))
    editing.value = false
    // Values changed while dragging; hand out a fresh array either way
    sync()
  }

  function undo(): boolean {
    // Each type has its own tool and history; undo in whichever has something to undo
    for (const tool of tools.values()) {
      if (tool.undo()) return true
    }
    return false
  }

  function setOptions(next: Partial<MeasureOptions>): void {
    // Tools created later start with the new options too
    Object.assign(measureOptions, next)
    tools.forEach((tool) => tool.setOptions(next))
    sync()
  }

  onScopeDispose(() => {
    // If the map is already gone it has destroyed the tools itself
    if (getSMap()) {
      tools.forEach((tool) => tool.destroy())
    }
    tools.clear()
  })

  return {
    results,
    active,
    editing,
    start,
    cancel,
    remove,
    clear,
    startEdit,
    finishEdit,
    setOptions,
    undo,
  }
}

// ============ Draw ============

export interface UseDrawOptions extends DrawOptions {
  /** The map to draw on. Defaults to the enclosing <SMapView>'s */
  smap?: SMapSource
}

export interface UseDrawReturn {
  /** The underlying tool, null until first used */
  tool: ShallowRef<DrawTool | null>
  /** Shape being drawn, or null */
  drawing: Ref<DrawType | null>
  /** True while in edit mode */
  editing: Ref<boolean>
  /** Everything drawn so far, as GeoJSON (WGS-84). Updates after every change */
  geojson: ShallowRef<GeoJSON.FeatureCollection>
  /** Number of shapes */
  count: ComputedRef<number>
  /** Start drawing one shape */
  draw: (type: DrawType) => Promise<void>
  /** Abandon the shape being drawn */
  cancel: () => void
  /** Enter edit mode */
  startEdit: () => Promise<void>
  /** Leave edit mode, saving (default) or discarding the changes */
  finishEdit: (save?: boolean) => void
  /** True when there is a change to take back in edit mode */
  canUndo: Ref<boolean>
  /** Take back the last change made in edit mode. Returns false when there is none */
  undo: () => boolean
  /** Load GeoJSON for display and editing. Replaces the content unless `replace` is false */
  load: (data: GeoJSON.GeoJsonObject, options?: { replace?: boolean }) => Promise<void>
  /** Remove every shape */
  clear: () => void
}

const emptyCollection = (): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: [],
})

/** Drawing and editing with reactive state */
export function useDraw(options: UseDrawOptions = {}): UseDrawReturn {
  const { smap: source, ...drawOptions } = options
  const tool = shallowRef<DrawTool | null>(null)
  const drawing = ref<DrawType | null>(null)
  const editing = ref(false)
  const canUndo = ref(false)
  const geojson = shallowRef(emptyCollection())
  const count = computed(() => geojson.value.features.length)
  let pending: Promise<DrawTool> | null = null

  const getSMap = resolveSMap(source, () => {
    // A different map: start over
    tool.value = null
    pending = null
    drawing.value = null
    editing.value = false
    geojson.value = emptyCollection()
  })

  function ensureTool(): Promise<DrawTool> {
    if (tool.value) return Promise.resolve(tool.value)
    const smap = getSMap()
    if (!smap) return Promise.reject(new Error(NOT_READY))

    pending ??= smap.createDraw(drawOptions).then((created) => {
      created.on('drawstart', ({ type }) => (drawing.value = type))
      created.on('drawstop', () => (drawing.value = null))
      created.on('change', (collection) => (geojson.value = collection))
      // Fired on every edit step, including an undo
      created.on('editing', () => (canUndo.value = created.canUndo))
      tool.value = markRaw(created)
      return created
    })
    return pending
  }

  async function draw(type: DrawType): Promise<void> {
    const current = await ensureTool()
    editing.value = false
    current.draw(type)
  }

  function cancel(): void {
    tool.value?.cancel()
  }

  async function startEdit(): Promise<void> {
    const current = await ensureTool()
    current.startEdit()
    editing.value = true
  }

  function finishEdit(save = true): void {
    tool.value?.finishEdit(save)
    editing.value = false
    canUndo.value = false
  }

  function undo(): boolean {
    return tool.value?.undo() ?? false
  }

  async function load(data: GeoJSON.GeoJsonObject, loadOptions?: { replace?: boolean }) {
    const current = await ensureTool()
    editing.value = false
    current.load(toRaw(data), loadOptions)
  }

  function clear(): void {
    tool.value?.clear()
    editing.value = false
  }

  onScopeDispose(() => {
    if (getSMap()) tool.value?.destroy()
    tool.value = null
  })

  return {
    tool,
    drawing,
    editing,
    canUndo,
    geojson,
    count,
    draw,
    cancel,
    startEdit,
    finishEdit,
    undo,
    load,
    clear,
  }
}
