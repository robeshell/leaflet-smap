import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, isReactive, nextTick, reactive, ref, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { SMap } from 'leaflet-smap'
import {
  SMapCluster,
  SMapContextMenu,
  SMapControl,
  SMapGeoJson,
  SMapMarker,
  SMapMask,
  SMapPoints,
  SMapView,
  useDraw,
  useMeasure,
  useSMap,
} from '../src'
import * as L from 'leaflet'
import type { UseDrawReturn, UseMeasureReturn } from '../src'
import { dragTo, handles, pointer, vectorSafe } from '../../core/tests/helpers'

let wrapper: VueWrapper<any> | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

// vectorSafe：换上一个不画东西的渲染器，jsdom 里才能把矢量图层加到地图上
const baseProps = { center: [31.82, 117.23] as [number, number], zoom: 12 }
const baseOptions = () => vectorSafe()
const A: [number, number] = [31.8, 117.2]
const B: [number, number] = [31.81, 117.2]

/** Mount <SMapView> with optional children in its default slot */
async function mountView(props: Record<string, unknown> = {}, children?: () => unknown) {
  wrapper = mount(SMapView, {
    props: { ...baseProps, ...props, options: { ...baseOptions(), ...(props.options as object) } },
    slots: children ? { default: children } : undefined,
    attachTo: document.body,
  })
  // 地图在 mounted 时创建，插槽内容要到下一次渲染才出现
  await nextTick()
  return wrapper
}

const smapOf = (w: VueWrapper<any>): SMap => w.vm.smap

/** A component that runs `setup` and renders nothing */
const probe = (setup: () => void) =>
  defineComponent({
    setup() {
      setup()
      return () => null
    },
  })

describe('<SMapView>', () => {
  it('creates the map, announces it and exposes it', async () => {
    const w = await mountView({ tileType: 'GaoDe.Normal.Map' })
    const smap = smapOf(w)

    expect(smap).toBeInstanceOf(SMap)
    expect(w.emitted('ready')![0]).toEqual([smap])
    expect(smap.instance.getZoom()).toBe(12)
    expect(smap.getTileType()).toEqual(['GaoDe.Normal.Map'])
    expect(w.find('.leaflet-container').exists()).toBe(true)
  })

  it('passes `options` through and lets explicit props win', async () => {
    const w = await mountView({
      options: { zoom: 5, minZoom: 4, tdtKey: 'FROM_OPTIONS' },
      tdtKey: 'PROP',
    })
    const smap = smapOf(w)
    expect(smap.instance.getZoom()).toBe(12)
    expect(smap.instance.getMinZoom()).toBe(4)
    expect((smap.setTileLayer('TianDiTu.Normal.Map')[0].options as any).key).toBe('PROP')
  })

  it('switches the base map when tileType changes', async () => {
    const w = await mountView({ tileType: 'GaoDe.Normal.Map' })
    const spy = vi.spyOn(smapOf(w), 'setTileLayer')

    await w.setProps({ tileType: ['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'] })
    expect(smapOf(w).getTileType()).toEqual(['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'])

    // 内容相同的新数组不应重建底图
    spy.mockClear()
    await w.setProps({ tileType: ['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion'] })
    expect(spy).not.toHaveBeenCalled()
  })

  it('follows center / zoom props and reports the view back', async () => {
    const w = await mountView()
    const smap = smapOf(w)

    await w.setProps({ zoom: 9 })
    expect(smap.instance.getZoom()).toBe(9)

    await w.setProps({ center: [30.5, 114.3] })
    expect(smap.instance.getCenter().lat).toBeCloseTo(30.5, 6)

    smap.instance.setView([39.9, 116.4], 7, { animate: false })
    const centers = w.emitted('update:center')!
    const [lat, lng] = centers.at(-1)![0] as [number, number]
    expect(lat).toBeCloseTo(39.9, 6)
    expect(lng).toBeCloseTo(116.4, 6)
    expect(w.emitted('update:zoom')!.at(-1)).toEqual([7])
  })

  it('does not move the map when v-model feeds back the value it just emitted', async () => {
    const w = await mountView()
    const smap = smapOf(w)
    smap.instance.setView([39.9, 116.4], 7, { animate: false })
    const spy = vi.spyOn(smap, 'setView')

    const center = w.emitted('update:center')!.at(-1)![0]
    await w.setProps({ center, zoom: 7 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('renders its slot only once the map exists, and hands the map to it', async () => {
    const seen: unknown[] = []
    const w = await mountView({}, () => h(probe(() => seen.push(useSMap()))))
    expect(seen).toEqual([smapOf(w)])
  })

  it('destroys the map on unmount, after its children have cleaned up', async () => {
    const order: string[] = []
    const w = await mountView({}, () => [h(SMapControl, { type: 'zoom' })])
    const smap = smapOf(w)
    const removeControl = vi.spyOn(smap.control, 'remove')
    removeControl.mockImplementation(() => void order.push('child'))
    vi.spyOn(smap, 'destroy').mockImplementation(() => void order.push('map'))

    w.unmount()
    wrapper = undefined
    expect(order).toEqual(['child', 'map'])
  })
})

describe('reactivity safety', () => {
  it('the map is never proxied, even when the app puts it in ref() or reactive()', async () => {
    const w = await mountView()
    const smap = smapOf(w)

    const inRef = ref(smap)
    const inReactive = reactive({ smap })
    expect(inRef.value).toBe(smap)
    expect(inReactive.smap).toBe(smap)
    expect(isReactive(inRef.value)).toBe(false)
    expect(isReactive(inRef.value.instance)).toBe(false)
  })

  it('gives Leaflet the raw data when the parent passes reactive props', async () => {
    // 父组件把数据放在 ref() 里是最常见的写法，传下来的就是深层响应式代理
    const data = ref<GeoJSON.FeatureCollection>({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [117.2, 31.8] },
        },
      ],
    })
    const points = ref([{ lat: 31.8, lng: 117.2 }])
    expect(isReactive(data.value)).toBe(true)

    let geo!: ReturnType<typeof vi.spyOn>
    let pts!: ReturnType<typeof vi.spyOn>
    const Spy = probe(() => {
      const smap = useSMap()
      geo = vi.spyOn(smap.layer, 'createGeoJsonLayer')
      pts = vi.spyOn(smap.layer, 'createPointLayer')
    })
    // visible: false —— jsdom 里矢量图层上不了图，这里只关心传给核心库的是什么
    await mountView({}, () => [
      h(Spy),
      h(SMapGeoJson, { data: data.value, visible: false }),
      h(SMapPoints, { points: points.value, visible: false }),
    ])

    const geoArg = geo.mock.calls[0][0] as GeoJSON.FeatureCollection
    expect(isReactive(geoArg)).toBe(false)
    expect(isReactive(geoArg.features)).toBe(false)
    const ptsArg = pts.mock.calls[0][0] as unknown[]
    expect(isReactive(ptsArg)).toBe(false)
    expect(isReactive(ptsArg[0])).toBe(false)
  })

  it('redraws when the data is replaced, not when it is mutated in place', async () => {
    const data = shallowRef<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] })
    let create!: ReturnType<typeof vi.spyOn>
    const Spy = probe(() => (create = vi.spyOn(useSMap().layer, 'createGeoJsonLayer')))
    await mountView({}, () => [h(Spy), h(SMapGeoJson, { data: data.value, visible: false })])
    expect(create).toHaveBeenCalledTimes(1)

    data.value.features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [117.2, 31.8] },
    })
    await nextTick()
    expect(create).toHaveBeenCalledTimes(1)

    data.value = { ...data.value }
    await nextTick()
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('measure results and tools are not proxied when copied into reactive state', async () => {
    let api!: UseMeasureReturn
    const w = await mountView({}, () => h(probe(() => (api = useMeasure()))))
    await api.start('polyline')
    pointer.path(smapOf(w).instance, [A, B])

    const store = reactive({ list: api.results.value })
    expect(isReactive(store.list[0])).toBe(false)
    expect(isReactive(store.list[0].layer)).toBe(false)
  })
})

describe('useSMap', () => {
  it('throws outside <SMapView>', () => {
    expect(() => mount(probe(() => useSMap()))).toThrow(/inside <SMapView>/)
  })
})

describe('<SMapControl>', () => {
  it('adds the control and removes it when unmounted', async () => {
    const show = ref(true)
    const w = await mountView({}, () => (show.value ? h(SMapControl, { type: 'zoom' }) : null))
    expect(w.find('.leaflet-control-zoom').exists()).toBe(true)

    show.value = false
    await nextTick()
    expect(w.find('.leaflet-control-zoom').exists()).toBe(false)
  })

  it('renders the base-map switcher and keeps it in sync', async () => {
    const options = {
      options: [
        { label: '矢量', tileType: 'GaoDe.Normal.Map' },
        { label: '影像', tileType: 'GaoDe.Satellite.Map' },
      ],
    }
    const w = await mountView({ tileType: 'GaoDe.Normal.Map' }, () =>
      h(SMapControl, { type: 'layers', options }),
    )
    const buttons = () => w.findAll('.smap-layers-item')
    expect(buttons().map((b) => b.text())).toEqual(['矢量', '影像'])

    await buttons()[1].trigger('click')
    expect(smapOf(w).getTileType()).toEqual(['GaoDe.Satellite.Map'])
    expect(buttons()[1].classes()).toContain('is-active')
  })
})

describe('layer components', () => {
  const SQUARE: GeoJSON.Feature = {
    type: 'Feature',
    properties: { name: '方块' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [117.2, 31.8],
          [117.3, 31.8],
          [117.3, 31.9],
          [117.2, 31.8],
        ],
      ],
    },
  }
  const paths = (map: L.Map) => {
    const found: L.Path[] = []
    map.eachLayer((layer) => {
      if (layer instanceof L.Path) found.push(layer)
    })
    return found
  }

  it('<SMapGeoJson> draws its data, follows visible, and leaves with v-if', async () => {
    const state = ref({ show: true, visible: true })
    const onClick = vi.fn()
    const w = await mountView({}, () =>
      state.value.show
        ? h(SMapGeoJson, { data: SQUARE, visible: state.value.visible, onClick })
        : null,
    )
    const map = smapOf(w).instance
    expect(paths(map)).toHaveLength(1)

    // 第三个参数：像真实的鼠标事件那样向上冒泡到图层组
    paths(map)[0].fire('click', { latlng: L.latLng(31.85, 117.25) }, true)
    expect(onClick.mock.calls[0][0].properties).toEqual({ name: '方块' })

    state.value = { show: true, visible: false }
    await nextTick()
    expect(paths(map)).toHaveLength(0)

    state.value = { show: true, visible: true }
    await nextTick()
    expect(paths(map)).toHaveLength(1)

    state.value = { show: false, visible: true }
    await nextTick()
    expect(paths(map)).toHaveLength(0)
  })

  it('<SMapPoints> and <SMapMask> put their layers on the map', async () => {
    const w = await mountView({}, () => [
      h(SMapPoints, { points: [A, B] }),
      h(SMapMask, { data: SQUARE, fit: false }),
    ])
    const all = paths(smapOf(w).instance)
    expect(all.filter((p) => p instanceof L.CircleMarker)).toHaveLength(2)
    // 遮罩：一块带洞的多边形加一条边界线
    expect(all.filter((p) => p instanceof L.Polygon)).toHaveLength(1)
  })

  it('<SMapCluster> merges nearby points and redraws when the data is replaced', async () => {
    const near = [
      { lat: 31.82, lng: 117.23 },
      { lat: 31.8201, lng: 117.2301 },
    ]
    const points = shallowRef(near)
    const w = await mountView({}, () => h(SMapCluster, { points: points.value }))
    // jsdom 里容器没有尺寸，给地图一个视野才有点可画
    const map = smapOf(w).instance
    Object.defineProperty(map.getContainer(), 'clientWidth', { value: 800 })
    Object.defineProperty(map.getContainer(), 'clientHeight', { value: 600 })
    map.invalidateSize()
    map.setView([31.82, 117.23], 12, { animate: false })
    expect(w.findAll('.smap-cluster').map((b) => b.text())).toEqual(['2'])

    points.value = [...near, { lat: 31.8202, lng: 117.2302 }]
    await nextTick()
    expect(w.findAll('.smap-cluster').map((b) => b.text())).toEqual(['3'])
  })

  it('<SMapMarker> follows its position and reports where it was dragged', async () => {
    const position = ref<[number, number]>([...A])
    const onUpdate = vi.fn((value: [number, number]) => (position.value = value))
    const w = await mountView({}, () =>
      h(SMapMarker, { latLng: position.value, draggable: true, 'onUpdate:latLng': onUpdate }),
    )
    const map = smapOf(w).instance
    const marker = () => {
      let found!: L.Marker
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) found = layer
      })
      return found
    }
    expect(marker().getLatLng()).toEqual(L.latLng(A))

    position.value = [...B]
    await nextTick()
    expect(marker().getLatLng()).toEqual(L.latLng(B))

    const same = marker()
    dragTo(same, [31.9, 117.3])
    expect(onUpdate).toHaveBeenCalledWith([31.9, 117.3])
    await nextTick()
    // v-model 把值传回来，不应重建标记
    expect(marker()).toBe(same)
  })

  it('<SMapMarker> shows its slot as a popup that stays reactive', async () => {
    const name = ref('一号站')
    const w = await mountView({}, () =>
      h(SMapMarker, { latLng: A }, { default: () => h('strong', name.value) }),
    )
    let marker!: L.Marker
    smapOf(w).instance.eachLayer((layer) => {
      if (layer instanceof L.Marker) marker = layer
    })

    marker.openPopup()
    expect(w.find('.leaflet-popup .smap-popup-content strong').text()).toBe('一号站')

    name.value = '二号站'
    await nextTick()
    expect(w.find('.leaflet-popup strong').text()).toBe('二号站')
  })

  it('<SMapMarker> can carry its own right-click menu', async () => {
    const onClick = vi.fn()
    const w = await mountView({}, () =>
      h(SMapMarker, { latLng: A, contextMenu: [{ text: '删除', onClick }] }),
    )
    let marker!: L.Marker
    smapOf(w).instance.eachLayer((layer) => {
      if (layer instanceof L.Marker) marker = layer
    })
    marker.fire('contextmenu', {
      latlng: L.latLng(A),
      containerPoint: L.point(10, 10),
      originalEvent: new MouseEvent('contextmenu'),
    })
    await w.find('.smap-contextmenu-item').trigger('click')
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ layer: marker }))
  })

  it('<SMapContextMenu> sets the map menu and takes it away again', async () => {
    const show = ref(true)
    const w = await mountView({}, () =>
      show.value ? h(SMapContextMenu, { items: [{ text: '放大' }] }) : null,
    )
    const rightClick = () =>
      smapOf(w).instance.fire('contextmenu', {
        latlng: L.latLng(A),
        containerPoint: L.point(10, 10),
        originalEvent: new MouseEvent('contextmenu'),
      })

    rightClick()
    expect(w.findAll('.smap-contextmenu-item').map((i) => i.text())).toEqual(['放大'])
    smapOf(w).contextMenu.hide()

    show.value = false
    await nextTick()
    rightClick()
    expect(w.find('.smap-contextmenu').exists()).toBe(false)
  })

  it('<SMapControl type="overlays"> lists registered layers', async () => {
    const w = await mountView({}, () => h(SMapControl, { type: 'overlays' }))
    smapOf(w).layer.add('roads', L.layerGroup())
    await nextTick()
    expect(w.findAll('.smap-overlays-item').map((i) => i.text())).toEqual(['roads'])
  })
})

describe('useMeasure', () => {
  async function mountWithMeasure() {
    let api!: UseMeasureReturn
    const w = await mountView({}, () => h(probe(() => (api = useMeasure()))))
    return { w, api, smap: smapOf(w) }
  }

  it('tracks the active tool and collects results', async () => {
    const { api, smap } = await mountWithMeasure()
    expect(api.results.value).toEqual([])

    await api.start('polyline')
    expect(api.active.value).toBe('polyline')

    pointer.path(smap.instance, [A, B])

    expect(api.active.value).toBeNull()
    expect(api.results.value).toHaveLength(1)
    expect(api.results.value[0].distance).toBeGreaterThan(1100)

    api.remove(api.results.value[0])
    expect(api.results.value).toEqual([])
  })

  it('lets results be reshaped and keeps the list current', async () => {
    const { api, smap } = await mountWithMeasure()
    await api.start('polyline')
    pointer.path(smap.instance, [A, B])
    const before = api.results.value

    api.startEdit()
    expect(api.editing.value).toBe(true)
    dragTo(handles(smap.instance, 'vertex')[1], [31.82, 117.2])
    api.finishEdit()

    expect(api.editing.value).toBe(false)
    expect(api.results.value[0].distance).toBeGreaterThan(2200)
    // 新数组，依赖它的模板才会更新
    expect(api.results.value).not.toBe(before)
  })

  it('keeps the list current while a result is dragged, and can undo', async () => {
    const { api, smap } = await mountWithMeasure()
    await api.start('polyline')
    pointer.path(smap.instance, [A, B])

    api.startEdit()
    const before = api.results.value
    dragTo(handles(smap.instance, 'vertex')[1], [31.82, 117.2])
    // 还没保存，列表已经换成新数组、带着新数值
    expect(api.results.value).not.toBe(before)
    expect(api.results.value[0].distance).toBeGreaterThan(2200)

    expect(api.undo()).toBe(true)
    expect(api.results.value[0].distance).toBeLessThan(1120)
  })

  it('switches units for existing and future measurements', async () => {
    let api!: UseMeasureReturn
    const w = await mountView({}, () => h(probe(() => (api = useMeasure()))))
    const map = smapOf(w).instance
    await api.start('rectangle')
    pointer.drag(map, A, [31.81, 117.21])
    const label = () => w.find('.smap-measure-label').text().replace('×', '')
    expect(label()).toMatch(/km²$/)

    api.setOptions({ areaUnit: 'mu' })
    expect(label()).toMatch(/亩$/)

    api.clear()
    await api.start('polygon')
    pointer.path(map, [A, B, [31.81, 117.21]])
    expect(label()).toMatch(/亩$/)
  })

  it('follows a measurement cancelled with Esc', async () => {
    const { api, smap } = await mountWithMeasure()
    await api.start('polygon')
    pointer.click(smap.instance, A)
    pointer.key('Escape')
    expect(api.active.value).toBeNull()
    expect(api.results.value).toEqual([])
  })

  it('cancel() stops the measurement without a result', async () => {
    const { api } = await mountWithMeasure()
    await api.start('polyline')
    api.cancel()
    expect(api.active.value).toBeNull()
    expect(api.results.value).toEqual([])
  })

  it('reuses one tool per type and clears them all', async () => {
    const { api, smap } = await mountWithMeasure()
    const create = vi.spyOn(smap, 'createMeasure')

    for (let i = 0; i < 2; i++) {
      await api.start('polyline')
      pointer.path(smap.instance, [A, B])
    }
    expect(create).toHaveBeenCalledTimes(1)
    expect(api.results.value).toHaveLength(2)

    api.clear()
    expect(api.results.value).toEqual([])
  })
})

describe('useDraw', () => {
  const point = (lng: number): GeoJSON.Feature => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [lng, 31.8] },
  })

  it('works beside the map when given the map explicitly', async () => {
    // 面板和地图是兄弟组件时的用法：把 ready 事件里拿到的 smap 传进来
    const smap = shallowRef<SMap | null>(null)
    let api!: UseDrawReturn
    const Panel = probe(() => (api = useDraw({ smap })))
    wrapper = mount(
      defineComponent({
        setup: () => () => [
          h(SMapView, {
            ...baseProps,
            options: baseOptions(),
            onReady: (map: SMap) => (smap.value = map),
          }),
          h(Panel),
        ],
      }),
      { attachTo: document.body },
    )

    expect(api.count.value).toBe(0)
    await api.load({ type: 'FeatureCollection', features: [point(117.1), point(117.2)] })
    expect(api.count.value).toBe(2)
    expect(api.geojson.value.features[0].geometry).toEqual(point(117.1).geometry)

    await api.draw('marker')
    expect(api.drawing.value).toBe('marker')
    api.cancel()
    expect(api.drawing.value).toBeNull()

    await api.startEdit()
    expect(api.editing.value).toBe(true)
    api.finishEdit(false)
    expect(api.editing.value).toBe(false)

    api.clear()
    expect(api.count.value).toBe(0)
  })

  it('follows a shape through drawing and editing', async () => {
    let api!: UseDrawReturn
    const w = await mountView({}, () => h(probe(() => (api = useDraw()))))
    const map = smapOf(w).instance

    await api.draw('polygon')
    expect(api.drawing.value).toBe('polygon')
    pointer.path(map, [A, B, [31.81, 117.21]])
    expect(api.drawing.value).toBeNull()
    expect(api.count.value).toBe(1)
    expect(api.geojson.value.features[0].geometry.type).toBe('Polygon')

    await api.startEdit()
    expect(api.editing.value).toBe(true)
    api.finishEdit()
    expect(api.editing.value).toBe(false)
  })

  it('tracks whether there is something to undo', async () => {
    let api!: UseDrawReturn
    const w = await mountView({}, () => h(probe(() => (api = useDraw()))))
    const map = smapOf(w).instance
    await api.draw('polygon')
    pointer.path(map, [A, B, [31.81, 117.21]])

    await api.startEdit()
    expect(api.canUndo.value).toBe(false)
    dragTo(handles(map, 'vertex')[0], [31.79, 117.19])
    expect(api.canUndo.value).toBe(true)

    expect(api.undo()).toBe(true)
    expect(api.canUndo.value).toBe(false)
    expect(api.undo()).toBe(false)
  })

  it('rejects while the map is not ready, and needs a map from somewhere', async () => {
    let api!: UseDrawReturn
    mount(probe(() => (api = useDraw({ smap: () => null }))))
    await expect(api.draw('marker')).rejects.toThrow(/not ready/)

    expect(() => mount(probe(() => useDraw()))).toThrow(/No map found/)
  })

  it('creates the tool once even when called twice before it is ready', async () => {
    let api!: UseDrawReturn
    const w = await mountView({}, () => h(probe(() => (api = useDraw()))))
    const create = vi.spyOn(smapOf(w), 'createDraw')

    await Promise.all([api.load(point(117.1)), api.startEdit()])
    expect(create).toHaveBeenCalledTimes(1)
    expect(api.tool.value).not.toBeNull()
  })
})
