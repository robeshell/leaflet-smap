import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as L from 'leaflet'
import { ClusterLayer, SMap } from '../src'
import { vectorSafe } from './helpers'

let container: HTMLElement
let smap: SMap

beforeEach(() => {
  container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  document.body.appendChild(container)
  smap = new SMap(container, {
    center: [31.82, 117.23],
    zoom: 12,
    tileType: 'GaoDe.Normal.Map',
    ...vectorSafe(),
  })
})

afterEach(() => {
  smap.destroy()
  container.remove()
  vi.unstubAllGlobals()
})

const SQUARE: GeoJSON.Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [117, 31],
        [118, 31],
        [118, 32],
        [117, 32],
        [117, 31],
      ],
    ],
  },
}

describe('layer registry', () => {
  it('tracks, toggles and removes layers by id', () => {
    const layer = L.layerGroup()
    expect(smap.layer.add('a', layer)).toBe(layer)
    expect(smap.layer.has('a')).toBe(true)
    expect(smap.layer.get('a')).toBe(layer)
    expect(smap.layer.isVisible('a')).toBe(true)

    expect(smap.layer.toggle('a')).toBe(false)
    expect(smap.instance.hasLayer(layer)).toBe(false)
    expect(smap.layer.has('a')).toBe(true)

    expect(smap.layer.toggle('a', true)).toBe(true)
    expect(smap.instance.hasLayer(layer)).toBe(true)

    expect(smap.layer.remove('a')).toBe(true)
    expect(smap.layer.has('a')).toBe(false)
    expect(smap.instance.hasLayer(layer)).toBe(false)
  })

  it('adding under an existing id replaces the old layer', () => {
    const first = smap.layer.add('a', L.layerGroup())
    const second = smap.layer.add('a', L.layerGroup())
    expect(smap.instance.hasLayer(first)).toBe(false)
    expect(smap.layer.get('a')).toBe(second)
    expect(smap.layer.ids()).toEqual(['a'])
  })

  it('can register a layer hidden', () => {
    const layer = smap.layer.add('a', L.layerGroup(), { visible: false })
    expect(smap.layer.isVisible('a')).toBe(false)
    smap.layer.show('a')
    expect(smap.instance.hasLayer(layer)).toBe(true)
  })

  it('reports unknown ids instead of throwing', () => {
    expect(smap.layer.show('nope')).toBe(false)
    expect(smap.layer.hide('nope')).toBe(false)
    expect(smap.layer.remove('nope')).toBe(false)
    expect(smap.layer.toggle('nope')).toBe(false)
    expect(smap.layer.get('nope')).toBeUndefined()
  })

  it('clear() and destroy() remove every managed layer', () => {
    const a = smap.layer.add('a', L.layerGroup())
    const b = smap.layer.add('b', L.layerGroup())
    smap.layer.clear()
    expect(smap.layer.ids()).toEqual([])
    expect(smap.instance.hasLayer(a) || smap.instance.hasLayer(b)).toBe(false)
  })

  it('registers a WMS layer under its id without sending the id to the server', () => {
    const wms = smap.layer.addWMS({ url: 'http://host/wms', layer: 'ws:roads', id: 'roads' })
    expect(smap.layer.get('roads')).toBe(wms)
    expect(wms.wmsParams).not.toHaveProperty('id')
    expect(wms.wmsParams.layers).toBe('ws:roads')
  })

  it('does not send the id as a WFS parameter either', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await smap.layer.loadWFS({ url: 'http://host/wfs', layer: 'ws:x', id: 'x', maxFeatures: 5 })
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.has('id')).toBe(false)
    expect(url.searchParams.get('maxFeatures')).toBe('5')
    expect(url.searchParams.get('typeName')).toBe('ws:x')
  })
})

describe('mask', () => {
  it('is the world with the region cut out, plus an outline', () => {
    const mask = smap.layer.createMask(SQUARE)
    const [shade, outline] = mask.getLayers() as [L.Polygon, L.Polyline]

    const rings = shade.getLatLngs() as L.LatLng[][]
    expect(rings).toHaveLength(2)
    // 外环覆盖全世界，内环是区域本身（Leaflet 会去掉闭合点）
    expect(rings[0].map((p) => [p.lat, p.lng])).toContainEqual([90, 360])
    expect(rings[1].map((p) => [p.lat, p.lng])).toEqual([
      [31, 117],
      [31, 118],
      [32, 118],
      [32, 117],
    ])
    expect(shade.options.fillOpacity).toBe(0.5)
    expect(outline).toBeInstanceOf(L.Polyline)
  })

  it('getBounds() is the region, not the world', () => {
    const bounds = smap.layer.createMask(SQUARE).getBounds()
    expect(bounds.getSouthWest()).toEqual(L.latLng(31, 117))
    expect(bounds.getNorthEast()).toEqual(L.latLng(32, 118))
  })

  it('cuts one hole per polygon of a MultiPolygon / FeatureCollection', () => {
    const multi: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        SQUARE,
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [119, 31],
                  [120, 31],
                  [120, 32],
                  [119, 31],
                ],
              ],
              [
                [
                  [121, 31],
                  [122, 31],
                  [122, 32],
                  [121, 31],
                ],
              ],
            ],
          },
        },
      ],
    }
    const [shade] = smap.layer.createMask(multi, { outline: false }).getLayers() as [L.Polygon]
    expect(shade.getLatLngs() as L.LatLng[][]).toHaveLength(4)
  })

  it('rejects GeoJSON without polygons', () => {
    const point: GeoJSON.Geometry = { type: 'Point', coordinates: [117, 31] }
    expect(() => smap.layer.createMask(point)).toThrow(/Polygon/)
  })
})

describe('point layer', () => {
  it('creates one canvas circle per point and accepts both input shapes', () => {
    const layer = smap.layer.createPointLayer([[31.8, 117.2], { lat: 31.9, lng: 117.3, name: 'b' }])
    const markers = layer.getLayers() as L.CircleMarker[]
    expect(markers).toHaveLength(2)
    expect(markers[0].getLatLng()).toEqual(L.latLng(31.8, 117.2))
    expect(markers[1].getLatLng()).toEqual(L.latLng(31.9, 117.3))
    // 地图默认用 canvas 渲染（preferCanvas），点直接画在地图自己的那张 canvas 上
    expect(markers[0].options.renderer).toBeUndefined()
  })

  it('shares a single canvas across layers when the map itself renders with SVG', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const svgMap = new SMap(el, { center: [31.82, 117.23], zoom: 12, preferCanvas: false })

    const [a] = svgMap.layer.createPointLayer([[31.8, 117.2]]).getLayers() as L.CircleMarker[]
    const [b] = svgMap.layer.createPointLayer([[31.9, 117.3]]).getLayers() as L.CircleMarker[]
    // 每个渲染器是一张铺满地图的 canvas，只有最上面一张能收到鼠标事件，所以必须共用
    expect(a.options.renderer).toBeInstanceOf(L.Canvas)
    expect(b.options.renderer).toBe(a.options.renderer)

    const geo = svgMap.layer.createGeoJsonLayer(SQUARE, { color: 'red' })
    expect((geo.getLayers()[0] as L.Path).options.renderer).toBe(a.options.renderer)

    svgMap.destroy()
    el.remove()
  })

  it('applies a per-point style and is only interactive when it needs to be', () => {
    const points = [
      { lat: 31.8, lng: 117.2, online: true },
      { lat: 31.9, lng: 117.3, online: false },
    ]
    const plain = smap.layer.createPointLayer(points, {
      style: (p) => ({ fillColor: p.online ? 'green' : 'gray' }),
    })
    const [a, b] = plain.getLayers() as L.CircleMarker[]
    expect(a.options.fillColor).toBe('green')
    expect(b.options.fillColor).toBe('gray')
    expect(a.options.interactive).toBe(false)

    const onClick = vi.fn()
    const clickable = smap.layer.createPointLayer(points, { onClick })
    const [first] = clickable.getLayers() as L.CircleMarker[]
    expect(first.options.interactive).toBe(true)
    first.fire('click', { latlng: first.getLatLng() })
    expect(onClick).toHaveBeenCalledWith(points[0], expect.anything())
  })
})

describe('base-map switcher control', () => {
  const options = [
    { label: '矢量', tileType: 'GaoDe.Normal.Map' },
    { label: '影像', tileType: ['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'] },
  ]
  const buttons = () => [...container.querySelectorAll<HTMLButtonElement>('.smap-layers-item')]
  const active = () => buttons().map((b) => b.classList.contains('is-active'))

  it('lists the options and highlights the current base map', () => {
    smap.control.add('layers', { options })
    expect(buttons().map((b) => b.textContent)).toEqual(['矢量', '影像'])
    expect(active()).toEqual([true, false])
  })

  it('switches the base map on click', () => {
    smap.control.add('layers', { options })
    buttons()[1].click()
    expect(smap.getTileType()).toEqual(['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'])
    expect(smap.getTileLayers()).toHaveLength(2)
    expect(active()).toEqual([false, true])
  })

  it('follows changes made through setTileLayer()', () => {
    smap.control.add('layers', { options })
    smap.setTileLayer(['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'])
    expect(active()).toEqual([false, true])
    smap.setTileLayer('OSM.Normal.Map')
    expect(active()).toEqual([false, false])
  })

  it('needs options', () => {
    expect(() => smap.control.add('layers', { options: [] })).toThrow(/options/)
  })
})

describe('cluster layer', () => {
  // 三个点挤在一起（相距几十米），另一个在两公里外
  const NEAR = [
    { id: 'a', lat: 31.82, lng: 117.23 },
    { id: 'b', lat: 31.8202, lng: 117.2302 },
    { id: 'c', lat: 31.8198, lng: 117.2301 },
  ]
  const FAR = { id: 'd', lat: 31.84, lng: 117.25 }
  const bubbles = () => [...container.querySelectorAll('.smap-cluster')].map((el) => el.textContent)
  const singles = (layer: ClusterLayer<any>) =>
    layer.getLayers().filter((l) => l instanceof L.CircleMarker).length

  it('merges nearby points into one counted bubble and leaves lone points alone', () => {
    const layer = smap.layer.addCluster([...NEAR, FAR])
    expect(layer).toBeInstanceOf(ClusterLayer)
    expect(bubbles()).toEqual(['3'])
    expect(singles(layer)).toBe(1)
  })

  it('breaks the bubble apart when zoomed in far enough', () => {
    const layer = smap.layer.addCluster(NEAR)
    expect(bubbles()).toEqual(['3'])
    smap.instance.setView([31.82, 117.23], 18, { animate: false })
    expect(bubbles()).toEqual([])
    expect(singles(layer)).toBe(3)
  })

  it('stops clustering from the configured zoom level', () => {
    const layer = smap.layer.addCluster(NEAR, { disableClusteringAtZoom: 12 })
    expect(bubbles()).toEqual([])
    expect(singles(layer)).toBe(3)
  })

  it('only draws what is near the visible area, but knows the full extent', () => {
    const away = { id: 'x', lat: 39.9, lng: 116.4 }
    const layer = smap.layer.addCluster([...NEAR, away])
    expect(layer.getLayers()).toHaveLength(1)
    expect(layer.getBounds().contains([39.9, 116.4])).toBe(true)

    smap.instance.setView([39.9, 116.4], 12, { animate: false })
    expect(bubbles()).toEqual([])
    expect(singles(layer)).toBe(1)
  })

  it('clicking a bubble zooms in on it, unless a handler takes over', () => {
    // 不真的缩放，否则放大后气泡就散开了
    const fit = vi.spyOn(smap.instance, 'fitBounds').mockImplementation(() => smap.instance)
    const layer = smap.layer.addCluster(NEAR)
    layer
      .getLayers()
      .find((l) => l instanceof L.Marker)!
      .fire('click', { latlng: L.latLng(31.82, 117.23) })
    expect(fit).toHaveBeenCalledTimes(1)

    fit.mockClear()
    const onClusterClick = vi.fn()
    const custom = smap.layer.addCluster(NEAR, { onClusterClick })
    custom
      .getLayers()
      .find((l) => l instanceof L.Marker)!
      .fire('click', {})
    expect(onClusterClick.mock.calls[0][0]).toEqual(NEAR)
    expect(fit).not.toHaveBeenCalled()
  })

  it('single points keep their style, tooltip and click handler', () => {
    const onClick = vi.fn()
    const layer = smap.layer.addCluster([FAR], {
      style: (p) => ({ fillColor: p.id === 'd' ? 'red' : 'blue' }),
      onClick,
    })
    const [marker] = layer.getLayers() as L.CircleMarker[]
    expect(marker.options.fillColor).toBe('red')
    marker.fire('click', {})
    expect(onClick).toHaveBeenCalledWith(FAR, expect.anything())
  })

  it('setPoints() replaces the data; removing the layer stops it following the map', () => {
    const layer = smap.layer.addCluster(NEAR, { id: 'devices' })
    layer.setPoints([FAR])
    expect(bubbles()).toEqual([])
    expect(singles(layer)).toBe(1)

    smap.layer.remove('devices')
    const redraw = vi.spyOn(layer, 'clearLayers')
    smap.instance.setView([31.84, 117.25], 14, { animate: false })
    expect(redraw).not.toHaveBeenCalled()
    expect(smap.instance.hasLayer(layer)).toBe(false)
  })

  it('abbreviates large counts', () => {
    const many = Array.from({ length: 1500 }, () => ({ lat: 31.82, lng: 117.23 }))
    smap.layer.addCluster(many)
    expect(bubbles()).toEqual(['1.5k'])
    expect(container.querySelector('.smap-cluster--l')).not.toBeNull()
  })
})

describe('overlays control', () => {
  const rows = () => [...container.querySelectorAll<HTMLLabelElement>('.smap-overlays-item')]
  const boxes = () => rows().map((row) => row.querySelector('input')!)

  it('lists the given layers and switches them', () => {
    const roads = smap.layer.add('roads', L.layerGroup())
    smap.layer.add('pipes', L.layerGroup(), { visible: false })
    smap.control.add('overlays', {
      title: '图层',
      items: [
        { id: 'roads', label: '道路' },
        { id: 'pipes', label: '管线' },
      ],
    })

    expect(container.querySelector('.smap-overlays-title')!.textContent).toBe('图层')
    expect(rows().map((row) => row.textContent)).toEqual(['道路', '管线'])
    expect(boxes().map((box) => box.checked)).toEqual([true, false])

    boxes()[0].click()
    expect(smap.instance.hasLayer(roads)).toBe(false)
    boxes()[1].click()
    expect(smap.layer.isVisible('pipes')).toBe(true)
  })

  it('follows changes made in code', () => {
    smap.layer.add('roads', L.layerGroup())
    smap.control.add('overlays', { items: [{ id: 'roads', label: '道路' }] })

    smap.layer.hide('roads')
    expect(boxes()[0].checked).toBe(false)
    smap.layer.toggle('roads')
    expect(boxes()[0].checked).toBe(true)
  })

  it('shows a layer that is not registered yet as disabled, and enables it later', () => {
    smap.control.add('overlays', { items: [{ id: 'later', label: '稍后加载' }] })
    expect(boxes()[0].disabled).toBe(true)

    smap.layer.add('later', L.layerGroup())
    expect(boxes()[0].disabled).toBe(false)
    expect(boxes()[0].checked).toBe(true)
  })

  it('without items it lists every registered layer by id', () => {
    smap.control.add('overlays')
    expect(rows()).toEqual([])

    smap.layer.add('a', L.layerGroup())
    smap.layer.add('b', L.layerGroup())
    expect(rows().map((row) => row.textContent)).toEqual(['a', 'b'])

    smap.layer.remove('a')
    expect(rows().map((row) => row.textContent)).toEqual(['b'])
  })
})

describe('setTileLayer', () => {
  it('keeps the current base map when the new type is invalid', () => {
    const before = smap.getTileLayers()
    expect(() => smap.setTileLayer(['GaoDe.Satellite.Map', 'Nope.X.Y'])).toThrow(/Unknown tile/)
    expect(smap.getTileLayers()).toEqual(before)
    expect(smap.getTileType()).toEqual(['GaoDe.Normal.Map'])
    expect(smap.instance.hasLayer(before[0])).toBe(true)
  })
})

describe('context menu', () => {
  const menu = () => container.querySelector('.smap-contextmenu')
  const items = () => [...container.querySelectorAll<HTMLButtonElement>('.smap-contextmenu-item')]
  const rightClick = (target: L.Evented = smap.instance) => {
    const latlng = L.latLng(31.82, 117.23)
    target.fire('contextmenu', {
      latlng,
      containerPoint: L.point(100, 100),
      originalEvent: new MouseEvent('contextmenu'),
    })
    return latlng
  }

  it('opens on right click and runs the chosen item with the click position', () => {
    const onClick = vi.fn()
    smap.contextMenu.setItems([{ text: '居中', onClick }, '-', { text: '禁用', disabled: true }])

    const latlng = rightClick()
    expect(items().map((b) => b.textContent)).toEqual(['居中', '禁用'])
    expect(container.querySelectorAll('.smap-contextmenu-separator')).toHaveLength(1)
    expect(items()[1].disabled).toBe(true)

    items()[0].click()
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ latlng, map: smap.instance }))
    expect(menu()).toBeNull()
  })

  it('builds items per click when given a function', () => {
    smap.contextMenu.setItems((ctx) => [{ text: `纬度 ${ctx.latlng.lat}` }])
    rightClick()
    expect(items()[0].textContent).toBe('纬度 31.82')
  })

  it('closes on Escape, on map click and when removed', () => {
    smap.contextMenu.setItems([{ text: 'a' }])

    rightClick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(menu()).toBeNull()

    rightClick()
    smap.instance.fire('click')
    expect(menu()).toBeNull()

    smap.contextMenu.setItems(null)
    rightClick()
    expect(menu()).toBeNull()
  })

  it('a layer menu replaces the map menu for that layer and can be unbound', () => {
    smap.contextMenu.setItems([{ text: '地图菜单' }])
    const marker = L.marker([31.82, 117.23]).addTo(smap.instance)
    const onClick = vi.fn()
    const unbind = smap.contextMenu.bind(marker, [{ text: '删除', danger: true, onClick }])

    rightClick(marker)
    expect(items().map((b) => b.textContent)).toEqual(['删除'])
    expect(items()[0].classList.contains('is-danger')).toBe(true)
    items()[0].click()
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ layer: marker }))

    unbind()
    rightClick(marker)
    expect(menu()).toBeNull()
  })
})

describe('locate', () => {
  it('resolves with the position and moves the map there', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: (success: PositionCallback) => {
          success({ coords: { latitude: 30.5, longitude: 114.3, accuracy: 25 } } as any)
          return 1
        },
        clearWatch: vi.fn(),
      },
    })

    // marker: false —— 位置标记是矢量图层，jsdom 里画不了
    const result = await smap.locate({ marker: false, zoom: 15 })
    expect(result).toMatchObject({ latitude: 30.5, longitude: 114.3, accuracy: 25 })
    expect(result.latlng).toEqual(L.latLng(30.5, 114.3))
    expect(smap.instance.getCenter().lat).toBeCloseTo(30.5, 5)
    expect(smap.instance.getZoom()).toBe(15)
  })

  it('rejects when the browser refuses', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: (_: PositionCallback, failure: PositionErrorCallback) => {
          failure({ code: 1, PERMISSION_DENIED: 1 } as any)
          return 1
        },
        clearWatch: vi.fn(),
      },
    })
    await expect(smap.locate()).rejects.toThrow('定位权限被拒绝')
  })
})
