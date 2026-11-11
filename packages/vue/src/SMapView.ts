import {
  defineComponent,
  h,
  markRaw,
  onMounted,
  onUnmounted,
  provide,
  ref,
  toRaw,
  watch,
} from 'vue'
import type { PropType } from 'vue'
import { SMap } from 'smap-leaflet'
import type { MeasureResult, SMapOptions, TileType } from 'smap-leaflet'
import { SMAP_KEY, createSMapRef } from './context'

type Center = [number, number]

const sameTypes = (a: TileType[], b: TileType[]) =>
  a.length === b.length && a.every((type, i) => type === b[i])

const toArray = (type: TileType | TileType[]) => (Array.isArray(type) ? type : [type])

/**
 * The map. Fills its parent, so the parent needs a size.
 *
 * Children placed in the default slot are rendered once the map exists and can
 * reach it with `useSMap()`.
 */
export const SMapView = defineComponent({
  name: 'SMapView',

  props: {
    /** Base map. Changing it switches the base map */
    tileType: { type: [String, Array] as PropType<TileType | TileType[]>, default: undefined },
    /** Map centre `[lat, lng]`. Supports `v-model:center` */
    center: { type: Array as unknown as PropType<Center>, default: undefined },
    /** Zoom level. Supports `v-model:zoom` */
    zoom: { type: Number, default: undefined },
    /** TianDiTu key */
    tdtKey: { type: String, default: undefined },
    /** Any other SMapOptions / Leaflet map options. Read once, when the map is created */
    options: { type: Object as PropType<SMapOptions>, default: undefined },
  },

  emits: {
    /** The map has been created */
    ready: (_smap: SMap) => true,
    'update:center': (_center: Center) => true,
    'update:zoom': (_zoom: number) => true,
    /** Any measure tool finished a measurement */
    measureCreated: (_result: MeasureResult) => true,
    /** A measurement was removed */
    measureRemoved: (_info: { id: string; type: MeasureResult['type'] }) => true,
  },

  setup(props, { emit, slots, expose }) {
    const container = ref<HTMLElement>()
    const smap = createSMapRef()
    provide(SMAP_KEY, smap)

    onMounted(() => {
      // markRaw: a Leaflet map is a large graph full of cycles and identity checks.
      // Even if the app stores it in ref() / reactive(), Vue must never proxy it.
      const map = markRaw(
        new SMap(container.value!, {
          // toRaw: hand Leaflet the plain object, not the parent's reactive proxy
          ...toRaw(props.options),
          ...(props.tileType !== undefined && { tileType: props.tileType }),
          ...(props.center !== undefined && { center: props.center }),
          ...(props.zoom !== undefined && { zoom: props.zoom }),
          ...(props.tdtKey !== undefined && { tdtKey: props.tdtKey }),
        }),
      )

      map.instance.on('moveend', () => {
        const center = map.instance.getCenter()
        emit('update:center', [center.lat, center.lng])
        emit('update:zoom', map.instance.getZoom())
      })
      map.on('measure:created', (result) => emit('measureCreated', markRaw(result)))
      map.on('measure:removed', (info) => emit('measureRemoved', info))

      smap.value = map
      emit('ready', map)
    })

    watch(
      () => props.tileType,
      (type) => {
        const map = smap.value
        if (!map || type === undefined) return
        if (!sameTypes(toArray(type), map.getTileType())) {
          map.setTileLayer([...toArray(type)])
        }
      },
      { deep: true },
    )

    watch(
      () => [props.center, props.zoom] as const,
      ([center, zoom]) => {
        const map = smap.value
        if (!map) return
        const current = map.instance.getCenter()
        const nextCenter = center ?? ([current.lat, current.lng] as Center)
        const nextZoom = zoom ?? map.instance.getZoom()
        // The values we emitted ourselves come straight back through v-model; ignore them
        const moved =
          Math.abs(nextCenter[0] - current.lat) > 1e-9 ||
          Math.abs(nextCenter[1] - current.lng) > 1e-9 ||
          nextZoom !== map.instance.getZoom()
        if (moved) map.setView(nextCenter, nextZoom)
      },
      { deep: true },
    )

    // onUnmounted, not onBeforeUnmount: children must remove their layers while the map still exists
    onUnmounted(() => {
      smap.value?.destroy()
      smap.value = null
    })

    expose({ smap })

    return () =>
      h(
        'div',
        { class: 'smap-view', style: { position: 'relative', width: '100%', height: '100%' } },
        [
          h('div', {
            ref: container,
            class: 'smap-view-map',
            style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
          }),
          smap.value ? slots.default?.({ smap: smap.value }) : null,
        ],
      )
  },
})
