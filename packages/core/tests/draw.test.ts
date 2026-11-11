import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as L from 'leaflet'
import { SMap } from '../src'
import type { DrawTool } from '../src'
import { dragTo, handles, offset, pointer, vectorSafe } from './helpers'

let container: HTMLElement
let smap: SMap
let map: L.Map
let tool: DrawTool

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  smap = new SMap(container, { center: [31.82, 117.23], zoom: 12, ...vectorSafe() })
  map = smap.instance
  tool = await smap.createDraw()
})

afterEach(() => {
  smap.destroy()
  container.remove()
})

const A: [number, number] = [31.8, 117.2]
const B: [number, number] = [31.81, 117.2]
const C: [number, number] = [31.81, 117.21]
const D: [number, number] = [31.8, 117.21]

const feature = (geometry: GeoJSON.Geometry, properties = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties,
  geometry,
})
const SQUARE = feature({
  type: 'Polygon',
  coordinates: [[A, B, C, D, A].map(([lat, lng]) => [lng, lat])],
})
const coords = (layer: L.Layer) =>
  ((layer as L.Polygon).getLatLngs()[0] as L.LatLng[]).map((p) => [p.lat, p.lng])

describe('drawing', () => {
  it('draws each kind of shape', () => {
    tool.draw('marker')
    pointer.click(map, A)
    tool.draw('polyline')
    pointer.path(map, [A, B])
    tool.draw('polygon')
    pointer.path(map, [A, B, C])
    tool.draw('rectangle')
    pointer.drag(map, A, C)
    tool.draw('circle')
    pointer.drag(map, A, B)

    const [marker, line, polygon, rectangle, circle] = tool.getLayers()
    expect(marker).toBeInstanceOf(L.Marker)
    expect(line).toBeInstanceOf(L.Polyline)
    expect(line).not.toBeInstanceOf(L.Polygon)
    expect(polygon).toBeInstanceOf(L.Polygon)
    expect(rectangle).toBeInstanceOf(L.Rectangle)
    expect(circle).toBeInstanceOf(L.Circle)
    tool.getLayers().forEach((layer) => expect(map.hasLayer(layer)).toBe(true))
  })

  it('tracks the drawing state and reports each step', () => {
    const start = vi.fn()
    const stop = vi.fn()
    const created = vi.fn()
    const change = vi.fn()
    tool.on('drawstart', start)
    tool.on('drawstop', stop)
    tool.on('created', created)
    tool.on('change', change)

    tool.draw('marker')
    expect(tool.drawing).toBe('marker')
    expect(start).toHaveBeenCalledWith({ type: 'marker' })

    tool.cancel()
    expect(tool.drawing).toBeNull()
    expect(stop).toHaveBeenCalledWith({ type: 'marker' })
    expect(tool.getLayers()).toEqual([])

    tool.draw('marker')
    pointer.click(map, A)
    const [layer] = tool.getLayers()
    expect(created).toHaveBeenCalledWith({ layer, type: 'marker' })
    expect(change.mock.calls[0][0].features).toHaveLength(1)
    expect(tool.drawing).toBeNull()
  })

  it('applies the shape style and the marker icon it was given', async () => {
    const icon = L.divIcon({ className: 'custom' })
    const styled = await smap.createDraw({ shapeOptions: { color: '#ff0000' }, markerIcon: icon })
    styled.draw('polyline')
    pointer.path(map, [A, B])
    styled.draw('marker')
    pointer.click(map, A)

    const [line, marker] = styled.getLayers() as [L.Polyline, L.Marker]
    expect(line.options.color).toBe('#ff0000')
    expect(marker.options.icon).toBe(icon)
    // 顶点和提示跟着这个颜色走
    expect(container.style.getPropertyValue('--smap-accent')).toBe('#ff0000')
  })

  it('does not interfere with a measure tool on the same map', async () => {
    const measure = await smap.createMeasure('polyline')

    // 开始测量会取消正在进行的绘制，反之亦然
    tool.draw('polyline')
    measure.enable()
    expect(tool.drawing).toBeNull()
    pointer.path(map, [A, B])
    expect(measure.getResults()).toHaveLength(1)
    expect(tool.getLayers()).toEqual([])

    tool.draw('polyline')
    pointer.path(map, [A, B])
    expect(tool.getLayers()).toHaveLength(1)
    expect(measure.getResults()).toHaveLength(1)
  })
})

describe('GeoJSON', () => {
  it('exports what was drawn; a circle is a Point with a radius', () => {
    tool.draw('polygon')
    pointer.path(map, [A, B, C])
    tool.draw('circle')
    pointer.drag(map, A, B)

    const { features } = tool.toGeoJSON()
    expect(features[0].geometry.type).toBe('Polygon')
    expect(features[1].geometry).toEqual({ type: 'Point', coordinates: [A[1], A[0]] })
    expect(features[1].properties!.radius).toBeGreaterThan(1100)
  })

  it('loads GeoJSON back, restoring circles and keeping properties', () => {
    tool.load({
      type: 'FeatureCollection',
      features: [
        feature({ type: 'Point', coordinates: [117.2, 31.8] }, { name: 'a' }),
        feature({ type: 'Point', coordinates: [117.3, 31.9] }, { radius: 500 }),
        SQUARE,
      ],
    } as GeoJSON.FeatureCollection)

    const [marker, circle, polygon] = tool.getLayers()
    expect(marker).toBeInstanceOf(L.Marker)
    expect(circle).toBeInstanceOf(L.Circle)
    expect((circle as L.Circle).getRadius()).toBe(500)
    expect(polygon).toBeInstanceOf(L.Polygon)

    const exported = tool.toGeoJSON()
    expect(exported.features[0].properties).toEqual({ name: 'a' })
    expect(exported.features[1].properties!.radius).toBe(500)
  })

  it('load() replaces by default and appends on request', () => {
    const point = (lng: number) => feature({ type: 'Point', coordinates: [lng, 31.8] })
    tool.load(point(117.1))
    tool.load(point(117.2))
    expect(tool.getLayers()).toHaveLength(1)
    tool.load(point(117.3), { replace: false })
    expect(tool.getLayers()).toHaveLength(2)
  })

  it('remove() and clear() report what went away', () => {
    const removed = vi.fn()
    tool.on('removed', removed)
    tool.load({
      type: 'FeatureCollection',
      features: [117.1, 117.2, 117.3].map((lng) =>
        feature({ type: 'Point', coordinates: [lng, 31.8] }),
      ),
    } as GeoJSON.FeatureCollection)

    const [first] = tool.getLayers()
    tool.remove(first)
    expect(tool.getLayers()).toHaveLength(2)
    expect(removed).toHaveBeenLastCalledWith({ layers: [first] })

    tool.clear()
    expect(tool.getLayers()).toEqual([])
    expect(removed.mock.calls.at(-1)![0].layers).toHaveLength(2)

    removed.mockClear()
    tool.clear()
    tool.remove(first)
    expect(removed).not.toHaveBeenCalled()
  })
})

describe('editing', () => {
  it('puts a handle on every vertex and every edge of a polygon', () => {
    tool.load(SQUARE)
    tool.startEdit()
    expect(tool.editing).toBe(true)
    expect(handles(map, 'vertex')).toHaveLength(4)
    expect(handles(map, 'mid')).toHaveLength(4)

    tool.finishEdit()
    expect(tool.editing).toBe(false)
    expect(handles(map, 'vertex')).toEqual([])
    expect(handles(map, 'mid')).toEqual([])
  })

  it('an open line has one edge handle fewer than vertices', () => {
    tool.draw('polyline')
    pointer.path(map, [A, B, C])
    tool.startEdit()
    expect(handles(map, 'vertex')).toHaveLength(3)
    expect(handles(map, 'mid')).toHaveLength(2)
  })

  it('dragging a vertex reshapes the polygon and is reported on save', () => {
    const edited = vi.fn()
    const change = vi.fn()
    tool.on('edited', edited)
    tool.load(SQUARE)
    tool.on('change', change)
    const [polygon] = tool.getLayers()

    tool.startEdit()
    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    expect(coords(polygon)[0]).toEqual([31.79, 117.19])
    // 保存之前不发事件
    expect(edited).not.toHaveBeenCalled()

    tool.finishEdit()
    expect(edited).toHaveBeenCalledWith({ layers: [polygon] })
    expect(change).toHaveBeenCalledTimes(1)
    expect(coords(polygon)[0]).toEqual([31.79, 117.19])
  })

  it('discarding puts every shape back', () => {
    const edited = vi.fn()
    tool.on('edited', edited)
    tool.load(SQUARE)
    const [polygon] = tool.getLayers()
    const before = coords(polygon)

    tool.startEdit()
    dragTo(handles(map, 'vertex')[0], [31.7, 117.1])
    dragTo(handles(map, 'mid')[0], [31.75, 117.15])
    tool.finishEdit(false)

    expect(coords(polygon)).toEqual(before)
    expect(edited).not.toHaveBeenCalled()
  })

  it('saving without touching anything reports nothing', () => {
    const edited = vi.fn()
    tool.on('edited', edited)
    tool.load(SQUARE)
    tool.startEdit()
    tool.finishEdit()
    expect(edited).not.toHaveBeenCalled()
  })

  it('dragging the middle of an edge inserts a vertex', () => {
    tool.load(SQUARE)
    const [polygon] = tool.getLayers()
    tool.startEdit()
    dragTo(handles(map, 'mid')[0], [31.805, 117.19])

    expect(coords(polygon)).toHaveLength(5)
    expect(coords(polygon)[1]).toEqual([31.805, 117.19])
    expect(handles(map, 'vertex')).toHaveLength(5)
    expect(handles(map, 'mid')).toHaveLength(5)
  })

  it('clicking a vertex deletes it, but never below the minimum', () => {
    tool.load(SQUARE)
    const [polygon] = tool.getLayers()
    tool.startEdit()

    handles(map, 'vertex')[0].fire('click')
    expect(coords(polygon)).toHaveLength(3)
    handles(map, 'vertex')[0].fire('click')
    expect(coords(polygon)).toHaveLength(3)
  })

  it('the click that ends a drag does not delete the vertex', () => {
    tool.load(SQUARE)
    const [polygon] = tool.getLayers()
    tool.startEdit()
    const [vertex] = handles(map, 'vertex')
    vertex.fire('dragstart')
    vertex.setLatLng([31.79, 117.19])
    vertex.fire('drag')
    vertex.fire('click')
    expect(coords(polygon)).toHaveLength(4)
  })

  it('keeps holes and multi-part shapes intact', () => {
    tool.load(
      feature({
        type: 'Polygon',
        coordinates: [
          [A, B, C, D, A].map(([lat, lng]) => [lng, lat]),
          [
            [117.203, 31.803],
            [117.207, 31.803],
            [117.205, 31.807],
            [117.203, 31.803],
          ],
        ],
      }),
    )
    const [polygon] = tool.getLayers() as [L.Polygon]
    tool.startEdit()
    expect(handles(map, 'vertex')).toHaveLength(7)

    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    const rings = polygon.getLatLngs() as L.LatLng[][]
    expect(rings).toHaveLength(2)
    expect(rings[1]).toHaveLength(3)
    expect([rings[0][0].lat, rings[0][0].lng]).toEqual([31.79, 117.19])
  })

  it('resizes a rectangle from a corner and moves it from its centre', () => {
    tool.draw('rectangle')
    pointer.drag(map, A, C)
    const [rectangle] = tool.getLayers() as [L.Rectangle]
    tool.startEdit()
    expect(handles(map, 'resize')).toHaveLength(4)

    // 西南角拖到更远处，东北角不动
    dragTo(handles(map, 'resize')[0], [31.79, 117.19])
    let bounds = rectangle.getBounds()
    expect([bounds.getSouth(), bounds.getWest()]).toEqual([31.79, 117.19])
    expect([bounds.getNorth(), bounds.getEast()]).toEqual(C)

    const size = [bounds.getNorth() - bounds.getSouth(), bounds.getEast() - bounds.getWest()]
    dragTo(handles(map, 'move')[0], [32, 118])
    bounds = rectangle.getBounds()
    expect(bounds.getCenter().lat).toBeCloseTo(32, 9)
    expect(bounds.getCenter().lng).toBeCloseTo(118, 9)
    expect(bounds.getNorth() - bounds.getSouth()).toBeCloseTo(size[0], 9)
    expect(bounds.getEast() - bounds.getWest()).toBeCloseTo(size[1], 9)
  })

  it('moves and resizes a circle, and can undo both', () => {
    tool.load(feature({ type: 'Point', coordinates: [117.2, 31.8] }, { radius: 500 }))
    const [circle] = tool.getLayers() as [L.Circle]
    tool.startEdit()

    dragTo(handles(map, 'move')[0], [31.9, 117.3])
    expect(circle.getLatLng()).toEqual(L.latLng(31.9, 117.3))

    const target = L.latLng(31.9, 117.31)
    dragTo(handles(map, 'resize')[0], [target.lat, target.lng])
    expect(circle.getRadius()).toBeCloseTo(circle.getLatLng().distanceTo(target), 6)
    expect(tool.toGeoJSON().features[0].properties!.radius).toBeCloseTo(circle.getRadius(), 6)

    tool.finishEdit(false)
    expect(circle.getLatLng()).toEqual(L.latLng(31.8, 117.2))
    expect(circle.getRadius()).toBe(500)
  })

  it('markers are dragged directly', () => {
    const edited = vi.fn()
    tool.on('edited', edited)
    tool.load(feature({ type: 'Point', coordinates: [117.2, 31.8] }))
    const [marker] = tool.getLayers() as [L.Marker]

    tool.startEdit()
    expect(marker.dragging!.enabled()).toBe(true)
    marker.setLatLng([32, 118])
    marker.fire('dragend')
    tool.finishEdit()

    expect(marker.dragging!.enabled()).toBe(false)
    expect(edited).toHaveBeenCalledWith({ layers: [marker] })
    expect(tool.toGeoJSON().features[0].geometry).toEqual({ type: 'Point', coordinates: [118, 32] })
  })

  it('drawing, loading and clearing all leave edit mode', () => {
    tool.load(SQUARE)

    tool.startEdit()
    tool.draw('marker')
    expect(tool.editing).toBe(false)
    tool.cancel()

    tool.startEdit()
    tool.load(SQUARE)
    expect(tool.editing).toBe(false)

    tool.startEdit()
    tool.clear()
    expect(tool.editing).toBe(false)
    expect(handles(map, 'vertex')).toEqual([])
  })

  it('is cleaned up with the map', () => {
    tool.load(SQUARE)
    tool.startEdit()
    const group = tool.group
    tool.destroy()
    expect(map.hasLayer(group)).toBe(false)
    expect(handles(map, 'vertex')).toEqual([])
  })
})

describe('undo', () => {
  it('takes back one gesture at a time, newest first', () => {
    tool.load(SQUARE)
    const [polygon] = tool.getLayers()
    const original = coords(polygon)
    tool.startEdit()
    expect(tool.canUndo).toBe(false)

    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    dragTo(handles(map, 'mid')[1], [31.83, 117.205])
    handles(map, 'vertex')[3].fire('click')
    expect(coords(polygon)).toHaveLength(4)
    expect(tool.canUndo).toBe(true)

    expect(tool.undo()).toBe(true) // 删除的顶点回来
    expect(coords(polygon)).toHaveLength(5)
    expect(tool.undo()).toBe(true) // 插入的顶点消失
    expect(coords(polygon)).toHaveLength(4)
    expect(coords(polygon)[0]).toEqual([31.79, 117.19])
    expect(tool.undo()).toBe(true) // 拖动复位
    expect(coords(polygon)).toEqual(original)

    expect(tool.canUndo).toBe(false)
    expect(tool.undo()).toBe(false)
  })

  it('moves the handles back with the shape', () => {
    tool.load(SQUARE)
    tool.startEdit()
    dragTo(handles(map, 'mid')[0], [31.805, 117.19])
    expect(handles(map, 'vertex')).toHaveLength(5)
    tool.undo()
    expect(handles(map, 'vertex')).toHaveLength(4)
    expect(handles(map, 'vertex')[0].getLatLng()).toEqual(L.latLng(A))
  })

  it('a shape undone back to where it started is not reported as edited', () => {
    const edited = vi.fn()
    tool.on('edited', edited)
    tool.load(SQUARE)
    tool.startEdit()
    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    tool.undo()
    tool.finishEdit()
    expect(edited).not.toHaveBeenCalled()
  })

  it('works across shapes and kinds: rectangle, circle, marker', () => {
    tool.draw('rectangle')
    pointer.drag(map, A, C)
    tool.load(feature({ type: 'Point', coordinates: [117.3, 31.9] }, { radius: 500 }), {
      replace: false,
    })
    tool.load(feature({ type: 'Point', coordinates: [117.4, 31.7] }), { replace: false })
    const [rectangle, circle, marker] = tool.getLayers() as [L.Rectangle, L.Circle, L.Marker]
    const bounds = rectangle.getBounds().toBBoxString()

    tool.startEdit()
    dragTo(handles(map, 'resize')[0], [31.7, 117.1])
    const resizers = handles(map, 'resize')
    dragTo(resizers[resizers.length - 1], [31.9, 117.32])
    dragTo(marker, [32, 118])

    tool.undo()
    expect(marker.getLatLng()).toEqual(L.latLng(31.7, 117.4))
    tool.undo()
    expect(circle.getRadius()).toBe(500)
    tool.undo()
    expect(rectangle.getBounds().toBBoxString()).toBe(bounds)
  })

  it('Ctrl+Z and Cmd+Z undo, but not while typing in a field', () => {
    tool.load(SQUARE)
    const [polygon] = tool.getLayers()
    const original = coords(polygon)
    tool.startEdit()

    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    expect(coords(polygon)[0]).toEqual([31.79, 117.19])
    input.remove()

    pointer.key('z', { ctrlKey: true })
    expect(coords(polygon)).toEqual(original)

    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    pointer.key('z', { metaKey: true })
    expect(coords(polygon)).toEqual(original)

    // 退出编辑后快捷键不再起作用
    tool.finishEdit()
    expect(tool.undo()).toBe(false)
  })

  it('reports each change, including undone ones, while editing', () => {
    const editing = vi.fn()
    tool.on('editing', editing)
    tool.load(SQUARE)
    const [polygon] = tool.getLayers()
    tool.startEdit()
    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    expect(editing).toHaveBeenLastCalledWith({ layer: polygon })
    const calls = editing.mock.calls.length
    tool.undo()
    expect(editing.mock.calls.length).toBe(calls + 1)
  })
})

describe('snapping', () => {
  let snappy: DrawTool

  beforeEach(async () => {
    snappy = await smap.createDraw({ snap: true })
    snappy.load(SQUARE)
  })

  const lastLine = () => {
    const layers = snappy.getLayers()
    return (layers[layers.length - 1] as L.Polyline).getLatLngs() as L.LatLng[]
  }

  it('is off unless asked for', () => {
    tool.load(SQUARE)
    tool.draw('polyline')
    const near = offset(map, A, 5)
    pointer.path(map, [near, [31.7, 117.1]])
    const line = (tool.getLayers()[1] as L.Polyline).getLatLngs() as L.LatLng[]
    expect([line[0].lat, line[0].lng]).toEqual(near)
  })

  it('pulls a click onto a nearby vertex', () => {
    snappy.draw('polyline')
    pointer.path(map, [offset(map, A, 5, 4), [31.7, 117.1]])
    expect(lastLine()[0]).toEqual(L.latLng(A))
  })

  it('pulls a click onto a nearby edge when no vertex is close', () => {
    snappy.draw('polyline')
    // A–B 这条边在经线 117.2 上；点在边中段偏右 6 像素
    const midEdge: [number, number] = [31.805, 117.2]
    pointer.path(map, [offset(map, midEdge, 6), [31.7, 117.1]])
    expect(lastLine()[0].lng).toBeCloseTo(117.2, 9)
    // 纬度基本不变（测试里的点击位置按整像素取，所以只比到小数点后 3 位）
    expect(lastLine()[0].lat).toBeCloseTo(31.805, 3)
  })

  it('leaves positions alone when nothing is within reach', () => {
    snappy.draw('polyline')
    // 向西 40 像素：方块在东边，这里什么都够不着
    const far = offset(map, A, -40)
    pointer.path(map, [far, [31.7, 117.1]])
    expect([lastLine()[0].lat, lastLine()[0].lng]).toEqual(far)
  })

  it('shows where it would snap before the click', () => {
    snappy.draw('polyline')
    pointer.move(map, offset(map, A, 5))
    expect(container.querySelector('.smap-vertex--snap')).not.toBeNull()
    pointer.move(map, offset(map, A, -40))
    expect(container.querySelector('.smap-vertex--snap')).toBeNull()
  })

  it('a closing click that snaps onto the first vertex closes the shape', () => {
    // 第二个多边形从方块的 C 角起笔；闭合时点偏了 10 像素，超出顶点的点击范围，
    // 但会被吸附回 C 角。这应当闭合，而不是在同一位置再加一个顶点
    snappy.draw('polygon')
    pointer.click(map, C)
    pointer.click(map, [31.82, 117.22])
    pointer.click(map, [31.8, 117.22])
    pointer.click(map, offset(map, C, 10))

    expect(snappy.drawing).toBeNull()
    const ring = (snappy.getLayers()[1] as L.Polygon).getLatLngs()[0] as L.LatLng[]
    expect(ring).toHaveLength(3)
  })

  it('respects a custom distance and extra layers', async () => {
    const landmark = L.marker([31.9, 117.3])
    const custom = await smap.createDraw({ snap: { distance: 30, layers: () => [landmark] } })
    custom.draw('polyline')
    pointer.path(map, [offset(map, [31.9, 117.3], 25), [31.7, 117.1]])
    const line = (custom.getLayers()[0] as L.Polyline).getLatLngs() as L.LatLng[]
    expect(line[0]).toEqual(L.latLng(31.9, 117.3))
  })

  it('snaps a dragged vertex to another shape, but never to its own', () => {
    snappy.load(
      feature({
        type: 'LineString',
        coordinates: [
          [117.25, 31.85],
          [117.26, 31.86],
        ],
      }),
      { replace: false },
    )
    const [, line] = snappy.getLayers() as [L.Polygon, L.Polyline]
    snappy.startEdit()

    // 线的第一个顶点拖到方块的 C 角旁边
    const lineHandle = handles(map, 'vertex').find((h) => h.getLatLng().equals([31.85, 117.25]))!
    dragTo(lineHandle, offset(map, C, 6, -5))
    expect((line.getLatLngs() as L.LatLng[])[0]).toEqual(L.latLng(C))

    // 方块自己的 A 角拖到自己的 B 角旁边：不吸附
    const squareHandle = handles(map, 'vertex').find((h) => h.getLatLng().equals(A))!
    const target = offset(map, B, 5)
    dragTo(squareHandle, target)
    expect(coords(snappy.getLayers()[0])[0]).toEqual(target)
  })
})
