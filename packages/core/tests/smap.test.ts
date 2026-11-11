import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as L from 'leaflet'
import { SMap } from '../src'
import { dragTo, handles, pointer, vectorSafe } from './helpers'

let container: HTMLElement
let smap: SMap | undefined

function create(options: ConstructorParameters<typeof SMap>[1] = {}) {
  smap = new SMap('#map', { center: [31.82, 117.23], zoom: 12, ...vectorSafe(), ...options })
  return smap
}

beforeEach(() => {
  container = document.createElement('div')
  container.id = 'map'
  document.body.appendChild(container)
})

afterEach(() => {
  smap?.destroy()
  smap = undefined
  container.remove()
})

describe('SMap', () => {
  it('accepts "#id", "id" and an element as container', () => {
    expect(create().instance.getContainer()).toBe(container)
    smap!.destroy()
    smap = new SMap('map', { center: [0, 0], zoom: 1 })
    expect(smap.instance.getContainer()).toBe(container)
    smap.destroy()
    smap = new SMap(container, { center: [0, 0], zoom: 1 })
    expect(smap.instance.getContainer()).toBe(container)
  })

  it('emits loaded / tileLoaded to listeners attached right after construction', async () => {
    const loaded = vi.fn()
    const tileLoaded = vi.fn()
    const map = create({ tileType: 'GaoDe.Normal.Map' })
    map.on('loaded', loaded)
    map.on('tileLoaded', tileLoaded)

    expect(loaded).not.toHaveBeenCalled()
    await Promise.resolve()

    expect(loaded).toHaveBeenCalledTimes(1)
    expect(loaded).toHaveBeenCalledWith(map.instance)
    expect(tileLoaded).toHaveBeenCalledTimes(1)
  })

  it('does not emit loaded when destroyed before the microtask runs', async () => {
    const loaded = vi.fn()
    const map = create()
    map.on('loaded', loaded)
    map.destroy()
    await Promise.resolve()
    expect(loaded).not.toHaveBeenCalled()
  })

  it('replaces tile layers with setTileLayer and stacks them with addTileLayer', () => {
    const map = create({ tileType: 'GaoDe.Normal.Map' })
    expect(map.getTileLayers()).toHaveLength(1)

    map.setTileLayer(['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'])
    expect(map.getTileLayers()).toHaveLength(2)

    map.addTileLayer('OSM.Normal.Map')
    expect(map.getTileLayers()).toHaveLength(3)

    map.clearTileLayers()
    expect(map.getTileLayers()).toHaveLength(0)
  })

  it('gives each provider its own credential', () => {
    const map = create({ tdtKey: 'TDT', mapboxToken: 'MBX' })
    const key = (type: string) => (map.setTileLayer(type)[0].options as any).key

    expect(key('TianDiTu.Normal.Map')).toBe('TDT')
    expect(key('Mapbox.Satellite.Map')).toBe('MBX')
    expect(key('GaoDe.Normal.Map')).not.toBe('TDT')
  })

  it('manages controls by type', () => {
    const map = create()
    const first = map.control.add('zoom')
    const second = map.control.add('zoom')
    expect(first).not.toBe(second)
    expect(container.querySelectorAll('.leaflet-control-zoom')).toHaveLength(1)

    map.control.add('scale')
    map.control.removeAll()
    expect(container.querySelector('.leaflet-control-zoom')).toBeNull()
    expect(container.querySelector('.leaflet-control-scale')).toBeNull()
  })

  it('a canvas redraw that fires after the renderer is gone is ignored', () => {
    create()
    // 渲染器被移除后没有绘图上下文；Leaflet 遗留的那一帧再跑到这里不应抛错
    const orphan = Object.assign(Object.create(L.Canvas.prototype), { _redrawRequest: 7 })
    expect(() => orphan._redraw()).not.toThrow()
    expect(orphan._redrawRequest).toBeNull()
  })

  it('destroy() is idempotent', () => {
    const map = create()
    map.destroy()
    expect(() => map.destroy()).not.toThrow()
  })
})

describe('measure tools', () => {
  // 合肥附近沿经线各约 0.01°（≈1.11 km）的点
  const A: [number, number] = [31.8, 117.2]
  const B: [number, number] = [31.81, 117.2]
  const C: [number, number] = [31.82, 117.2]
  const D: [number, number] = [31.81, 117.21]

  const labels = () =>
    [...container.querySelectorAll('.smap-measure-label')].map((el) =>
      el.textContent!.replace('×', '').trim(),
    )

  it('measures a line: one click per vertex, the last vertex again to finish', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline')
    tool.enable()
    pointer.path(map.instance, [A, B])

    const [result] = tool.getResults()
    expect(result.type).toBe('polyline')
    expect(result.layer).toBeInstanceOf(L.Polyline)
    expect(map.instance.hasLayer(result.layer)).toBe(true)
    expect(result.latlngs.map((p) => [p.lat, p.lng])).toEqual([A, B])
    expect(result.distance).toBeGreaterThan(1100)
    expect(result.distance).toBeLessThan(1120)
    expect(tool.measuring).toBe(false)
  })

  it('measures a polygon, closed by clicking its first vertex', async () => {
    const map = create()
    const tool = await map.createMeasure('polygon')
    tool.enable()
    ;[A, B, D].forEach((point) => pointer.click(map.instance, point))
    pointer.click(map.instance, A)

    const [result] = tool.getResults()
    expect(result.layer).toBeInstanceOf(L.Polygon)
    expect(result.latlngs).toHaveLength(3)
    // 直角边约 1.11 km × 0.95 km 的三角形 ≈ 0.53 km²
    expect(result.area).toBeGreaterThan(450_000)
    expect(result.area).toBeLessThan(600_000)
  })

  it('measures a rectangle and a circle by dragging', async () => {
    const map = create()
    const rect = await map.createMeasure('rectangle')
    rect.enable()
    pointer.drag(map.instance, A, D)
    const [box] = rect.getResults()
    expect(box.layer).toBeInstanceOf(L.Rectangle)
    // 约 1.11 km × 0.95 km
    expect(box.area).toBeGreaterThan(1_000_000)
    expect(box.area).toBeLessThan(1_100_000)

    const circle = await map.createMeasure('circle')
    circle.enable()
    pointer.drag(map.instance, A, B)
    const [round] = circle.getResults()
    expect(round.layer).toBeInstanceOf(L.Circle)
    expect(round.center).toEqual(L.latLng(A))
    expect(round.radius).toBeGreaterThan(1100)
    expect(round.radius).toBeLessThan(1120)
    expect(round.area).toBeCloseTo(Math.PI * round.radius! ** 2, 3)
  })

  it('rectangles and circles can also be drawn with two clicks', async () => {
    const map = create()
    const tool = await map.createMeasure('rectangle')
    tool.enable()
    // 鼠标点一下：按下、抬起、click；触屏点一下只有 click
    pointer.down(map.instance, A)
    pointer.up(map.instance, A)
    pointer.click(map.instance, A)
    expect(tool.measuring).toBe(true)
    pointer.move(map.instance, D)
    pointer.click(map.instance, D)
    expect(tool.getResults()).toHaveLength(1)

    tool.enable()
    pointer.click(map.instance, A)
    pointer.click(map.instance, D)
    expect(tool.getResults()).toHaveLength(2)
  })

  it('needs enough points before a shape can be finished', async () => {
    const map = create()
    const tool = await map.createMeasure('polygon')
    tool.enable()
    pointer.click(map.instance, A)
    pointer.click(map.instance, B)
    pointer.click(map.instance, B)
    expect(tool.getResults()).toEqual([])
    expect(tool.measuring).toBe(true)
    expect(container.querySelector('.smap-draw-hint.is-error')).not.toBeNull()

    pointer.click(map.instance, D)
    pointer.click(map.instance, D)
    expect(tool.getResults()).toHaveLength(1)
  })

  it('Backspace takes back the last vertex, Enter finishes, Esc cancels', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline')
    tool.enable()
    ;[A, B, C].forEach((point) => pointer.click(map.instance, point))
    pointer.key('Backspace')
    pointer.key('Enter')
    expect(tool.getResults()[0].latlngs).toHaveLength(2)

    tool.enable()
    pointer.click(map.instance, A)
    pointer.key('Escape')
    expect(tool.measuring).toBe(false)
    expect(tool.getResults()).toHaveLength(1)
  })

  it('only one tool draws at a time; starting another cancels the first', async () => {
    const map = create()
    const distance = await map.createMeasure('polyline')
    const area = await map.createMeasure('polygon')
    const onStop = vi.fn()
    distance.on('stop', onStop)

    distance.enable()
    pointer.click(map.instance, A)
    area.enable()
    expect(distance.measuring).toBe(false)
    expect(onStop).toHaveBeenCalledWith({ type: 'polyline', completed: false })

    ;[A, B, D].forEach((point) => pointer.click(map.instance, point))
    pointer.click(map.instance, A)
    expect(area.getResults()).toHaveLength(1)
    expect(distance.getResults()).toEqual([])
  })

  it('leaves the map as it found it', async () => {
    const map = create()
    const before = {
      zoom: map.instance.doubleClickZoom.enabled(),
      drag: map.instance.dragging.enabled(),
    }
    const line = await map.createMeasure('polyline')
    const box = await map.createMeasure('rectangle')

    line.enable()
    expect(map.instance.doubleClickZoom.enabled()).toBe(false)
    expect(container.classList.contains('smap-drawing')).toBe(true)
    line.disable()

    box.enable()
    expect(map.instance.dragging.enabled()).toBe(false)
    box.disable()

    expect(map.instance.doubleClickZoom.enabled()).toBe(before.zoom)
    expect(map.instance.dragging.enabled()).toBe(before.drag)
    expect(container.classList.contains('smap-drawing')).toBe(false)
    expect(container.querySelector('.smap-draw-hint')).toBeNull()
  })

  it('reports when measuring starts and how it ended', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline')
    const onStart = vi.fn()
    const onStop = vi.fn()
    const onMapStop = vi.fn()
    tool.on('start', onStart)
    tool.on('stop', onStop)
    map.on('measure:stop', onMapStop)

    expect(tool.measuring).toBe(false)
    tool.enable()
    expect(tool.measuring).toBe(true)
    expect(onStart).toHaveBeenCalledWith({ type: 'polyline' })

    tool.disable()
    expect(tool.measuring).toBe(false)
    expect(onStop).toHaveBeenLastCalledWith({ type: 'polyline', completed: false })
    expect(tool.getResults()).toEqual([])

    tool.enable()
    pointer.path(map.instance, [A, B])
    expect(onStop).toHaveBeenLastCalledWith({ type: 'polyline', completed: true })
    expect(onMapStop).toHaveBeenCalledTimes(2)
    expect(tool.getResults()).toHaveLength(1)
  })

  it('a listener can start the next measurement from the stop event', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline')
    let rounds = 0
    tool.on('stop', ({ completed }) => {
      if (completed && ++rounds < 3) tool.enable()
    })
    tool.enable()
    pointer.path(map.instance, [A, B])
    pointer.path(map.instance, [B, C])
    pointer.path(map.instance, [A, C])
    expect(tool.getResults()).toHaveLength(3)
    expect(tool.measuring).toBe(false)
  })

  it('reports results through events and getResults()', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline')
    const onCreated = vi.fn()
    const onRemoved = vi.fn()
    const onMap = vi.fn()
    tool.on('created', onCreated)
    tool.on('removed', onRemoved)
    map.on('measure:created', onMap)

    tool.enable()
    pointer.path(map.instance, [A, B])

    const result = onCreated.mock.calls[0][0]
    expect(tool.getResults()).toEqual([result])
    expect(onMap).toHaveBeenCalledWith(result)

    tool.remove(result.id)
    expect(onRemoved).toHaveBeenCalledWith({ id: result.id, type: 'polyline' })
    expect(tool.getResults()).toEqual([])
    expect(map.instance.hasLayer(result.layer)).toBe(false)
  })

  it('labels a line at every vertex while drawing and marks the result', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { showMarker: true })
    tool.enable()
    pointer.click(map.instance, A)
    pointer.click(map.instance, B)
    expect(labels()).toEqual(['起点', '1.11 km'])

    pointer.click(map.instance, C)
    pointer.click(map.instance, C)
    expect(labels()).toEqual(['起点', '1.11 km', '共 2.22 km'])
    expect(container.querySelectorAll('.smap-measure-label--result')).toHaveLength(1)
  })

  it('removes the half-drawn labels when a measurement is cancelled', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { showMarker: true })
    tool.enable()
    pointer.click(map.instance, A)
    pointer.click(map.instance, B)
    tool.disable()
    expect(labels()).toEqual([])
  })

  it('shows no labels unless showMarker is set', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline')
    tool.enable()
    pointer.path(map.instance, [A, B])
    expect(labels()).toEqual([])
    expect(tool.getResults()).toHaveLength(1)
  })

  it('formatLabel receives the measurement, with partial set on running totals', async () => {
    const map = create()
    const formatLabel = vi.fn((label) =>
      label.partial ? `~${Math.round(label.distance)}` : `=${Math.round(label.distance)}`,
    )
    const tool = await map.createMeasure('polyline', { showMarker: true, formatLabel })
    tool.enable()
    pointer.path(map.instance, [A, B, C])

    // 起点固定显示「起点」，不经过格式化函数
    expect(labels()).toEqual(['起点', '~1112', '=2224'])
    const final = formatLabel.mock.calls.at(-1)![0]
    expect(final).toMatchObject({ type: 'polyline', partial: false })
    expect(final.latlngs).toHaveLength(3)
    expect(final).not.toHaveProperty('layer')
  })

  it('the deprecated valueFormatter keeps working with its old arguments', async () => {
    const map = create()

    const distance = vi.fn((value) => `${(value as number).toFixed(0)}米`)
    const lineTool = await map.createMeasure('polyline', {
      showMarker: true,
      valueFormatter: distance,
    })
    lineTool.enable()
    pointer.path(map.instance, [A, B])
    expect(labels()).toEqual(['起点', '共 1112米'])
    lineTool.clearAll()

    const vertices = vi.fn(() => '面')
    const areaTool = await map.createMeasure('polygon', {
      showMarker: true,
      valueFormatter: vertices,
    })
    areaTool.enable()
    pointer.path(map.instance, [A, B, D])
    expect(labels()).toEqual(['面'])
    expect(vertices.mock.calls[0][0]).toHaveLength(3)
    areaTool.clearAll()

    const radius = vi.fn((value) => `半径${Math.round(value as number)}`)
    const circleTool = await map.createMeasure('circle', {
      showMarker: true,
      valueFormatter: radius,
    })
    circleTool.enable()
    pointer.drag(map.instance, A, B)
    expect(labels()).toEqual(['半径1112'])
  })

  it('the × on a result label removes that measurement and its labels', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { showMarker: true })
    const other = await map.createMeasure('polygon', { showMarker: true })
    tool.enable()
    pointer.path(map.instance, [A, B])
    other.enable()
    pointer.path(map.instance, [A, B, D])
    expect(labels()).toHaveLength(3)

    const button = container.querySelector<HTMLElement>(
      `[data-measure-id="${tool.getResults()[0].id}"]`,
    )!
    button.click()

    expect(tool.getResults()).toEqual([])
    expect(other.getResults()).toHaveLength(1)
    expect(labels()).toHaveLength(1)
  })

  it('shows the units it is told to, and can switch them afterwards', async () => {
    const map = create()
    const area = await map.createMeasure('rectangle', { showMarker: true, areaUnit: 'mu' })
    area.enable()
    pointer.drag(map.instance, A, D)
    // 约 1.06 km² ≈ 1585 亩
    expect(labels()[0]).toMatch(/^15\d\d\.\d\d 亩$/)

    area.setOptions({ areaUnit: 'ha' })
    expect(labels()[0]).toMatch(/^10\d\.\d\d 公顷$/)
    area.setOptions({ areaUnit: 'km2' })
    expect(labels()[0]).toMatch(/^1\.0\d km²$/)

    const line = await map.createMeasure('polyline', { showMarker: true, lengthUnit: 'm' })
    line.enable()
    pointer.path(map.instance, [A, B])
    expect(labels().at(-1)).toMatch(/^共 111\d\.\d m$/)
  })

  it('setOptions() does not write into the options object it was created with', async () => {
    const map = create()
    const options = { showMarker: true }
    const tool = await map.createMeasure('polyline', options)
    tool.setOptions({ lengthUnit: 'km' })
    expect(options).toEqual({ showMarker: true })
  })

  it('results can be reshaped; numbers and labels follow while dragging', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { showMarker: true })
    const onUpdated = vi.fn()
    const onMapUpdated = vi.fn()
    tool.on('updated', onUpdated)
    map.on('measure:updated', onMapUpdated)
    tool.enable()
    pointer.path(map.instance, [A, B])
    const [result] = tool.getResults()

    tool.startEdit()
    expect(tool.editing).toBe(true)
    // 把终点从 B 拖到 C，长度翻倍
    dragTo(handles(map.instance, 'vertex')[1], C)
    expect(result.distance).toBeGreaterThan(2200)
    expect(labels()).toEqual(['起点', '共 2.22 km'])
    // 保存之前不通知
    expect(onUpdated).not.toHaveBeenCalled()

    tool.finishEdit()
    expect(tool.editing).toBe(false)
    expect(onUpdated).toHaveBeenCalledWith(result)
    expect(onMapUpdated).toHaveBeenCalledWith(result)
    // 还是同一个结果对象
    expect(tool.getResults()[0]).toBe(result)
  })

  it('areas come with their perimeter', async () => {
    const map = create()
    const rect = await map.createMeasure('rectangle')
    rect.enable()
    pointer.drag(map.instance, A, D)
    // 约 1.11 km × 0.95 km 的矩形，周长约 4.1 km
    expect(rect.getResults()[0].perimeter).toBeGreaterThan(4000)
    expect(rect.getResults()[0].perimeter).toBeLessThan(4250)

    const circle = await map.createMeasure('circle')
    circle.enable()
    pointer.drag(map.instance, A, B)
    const [round] = circle.getResults()
    expect(round.perimeter).toBeCloseTo(2 * Math.PI * round.radius!, 6)

    const line = await map.createMeasure('polyline')
    line.enable()
    pointer.path(map.instance, [A, B])
    expect(line.getResults()[0].perimeter).toBeUndefined()
  })

  it('reports a measurement while it is being reshaped, and lets a step be undone', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { showMarker: true })
    const onUpdating = vi.fn()
    const onMapUpdating = vi.fn()
    tool.on('updating', onUpdating)
    map.on('measure:updating', onMapUpdating)
    tool.enable()
    pointer.path(map.instance, [A, B])
    const [result] = tool.getResults()

    tool.startEdit()
    dragTo(handles(map.instance, 'vertex')[1], C)
    expect(onUpdating).toHaveBeenLastCalledWith(result)
    expect(onMapUpdating).toHaveBeenCalled()
    expect(result.distance).toBeGreaterThan(2200)

    expect(tool.undo()).toBe(true)
    expect(result.distance).toBeLessThan(1120)
    expect(labels()).toEqual(['起点', '共 1.11 km'])
    expect(tool.undo()).toBe(false)
  })

  it('can snap new measurements to earlier ones', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { snap: true })
    tool.enable()
    pointer.path(map.instance, [A, B])

    tool.enable()
    const nearB = map.instance.containerPointToLatLng(
      map.instance.latLngToContainerPoint(B).add([6, 0]),
    )
    pointer.path(map.instance, [[nearB.lat, nearB.lng], C])
    expect(tool.getResults()[1].latlngs[0]).toEqual(L.latLng(B))
  })

  it('discarding an edit restores the shape, the numbers and the labels', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { showMarker: true })
    const onUpdated = vi.fn()
    tool.on('updated', onUpdated)
    tool.enable()
    pointer.path(map.instance, [A, B])
    const [result] = tool.getResults()
    const before = result.distance

    tool.startEdit()
    dragTo(handles(map.instance, 'vertex')[1], C)
    tool.finishEdit(false)

    expect(result.distance).toBeCloseTo(before!, 6)
    expect(labels()).toEqual(['起点', '共 1.11 km'])
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('measuring again, removing a result or destroying the tool leaves edit mode', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline')
    tool.enable()
    pointer.path(map.instance, [A, B])

    tool.startEdit()
    tool.enable()
    expect(tool.editing).toBe(false)
    tool.disable()

    tool.startEdit()
    tool.remove(tool.getResults()[0].id)
    expect(tool.editing).toBe(false)
    expect(handles(map.instance, 'vertex')).toEqual([])

    tool.enable()
    pointer.path(map.instance, [A, B])
    tool.startEdit()
    tool.destroy()
    expect(handles(map.instance, 'vertex')).toEqual([])
  })

  it('createMeasure() makes a new tool each time; getMeasure() shares one per type', async () => {
    const map = create()
    expect(await map.createMeasure('polyline')).not.toBe(await map.createMeasure('polyline'))

    const [a, b] = await Promise.all([map.getMeasure('polyline'), map.getMeasure('polyline')])
    expect(a).toBe(b)
    expect(await map.getMeasure('polygon')).not.toBe(a)

    a.destroy()
    expect(await map.getMeasure('polyline')).not.toBe(a)
  })

  it('a destroyed tool cleans up and is forgotten by the map', async () => {
    const map = create()
    const tool = await map.createMeasure('polyline', { showMarker: true })
    tool.enable()
    pointer.path(map.instance, [A, B])
    const { layer } = tool.getResults()[0]
    const onDestroyed = vi.fn()
    tool.on('destroyed', onDestroyed)
    const spy = vi.spyOn(tool, 'destroy')

    tool.destroy()
    expect(onDestroyed).toHaveBeenCalledTimes(1)
    expect(labels()).toEqual([])
    expect(tool.getResults()).toEqual([])
    expect(map.instance.hasLayer(layer)).toBe(false)
    expect(() => tool.destroy()).not.toThrow()

    spy.mockClear()
    map.clearMeasures()
    expect(spy).not.toHaveBeenCalled()
  })

  it('clearMeasures() destroys every tool', async () => {
    const map = create()
    const a = vi.spyOn(await map.createMeasure('polyline'), 'destroy')
    const b = vi.spyOn(await map.getMeasure('circle'), 'destroy')
    map.clearMeasures()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
