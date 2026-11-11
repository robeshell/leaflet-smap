import { defineComponent, h, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { PropType } from 'vue'
import * as L from 'leaflet'
import type {
  AttributionOptions,
  ContextMenuItems,
  ControlOptions,
  ControlType,
  LayersControlOptions,
  MaskOptions,
  OverlaysControlOptions,
  PointInput,
  SMap,
} from 'smap-leaflet'
import { useSMap } from './context'

/*
 * Reactivity rules for everything in this file:
 * - Data handed to Leaflet goes through toRaw(). A parent that keeps its GeoJSON in
 *   ref() passes a deep reactive proxy; letting Leaflet walk that would create a proxy
 *   for every coordinate array and leave proxies stored inside the layers.
 * - Watchers look at prop identity only (no `deep`): replacing the data redraws,
 *   mutating it in place does not. Deep-watching a large GeoJSON would traverse it
 *   on every change.
 */

/**
 * Keep one Leaflet layer in sync with a component: build it now, rebuild it
 * whenever `deps` change, show / hide it with `visible`, remove it on unmount.
 */
function useManagedLayer(
  smap: SMap,
  create: () => L.Layer | null,
  deps: () => unknown,
  visible: () => boolean,
  afterCreate?: (layer: L.Layer) => void,
): void {
  let layer: L.Layer | null = null

  const render = () => {
    layer?.remove()
    layer = create()
    if (!layer) return
    if (visible()) layer.addTo(smap.instance)
    afterCreate?.(layer)
  }

  watch(deps, render, { immediate: true })
  watch(visible, (show) => {
    if (!layer) return
    if (show) layer.addTo(smap.instance)
    else layer.remove()
  })
  onBeforeUnmount(() => {
    layer?.remove()
    layer = null
  })
}

/** GeoJSON data as a layer */
export const SMapGeoJson = defineComponent({
  name: 'SMapGeoJson',
  props: {
    /** GeoJSON in WGS-84. Replacing it redraws the layer */
    data: { type: Object as PropType<GeoJSON.GeoJsonObject | null>, default: null },
    /** Path style */
    pathStyle: { type: Object as PropType<L.PathOptions>, default: undefined },
    visible: { type: Boolean, default: true },
    /** Fit the view to the layer each time the data changes */
    fit: { type: Boolean, default: false },
  },
  emits: {
    /** A feature was clicked */
    click: (_feature: GeoJSON.Feature, _event: L.LeafletMouseEvent) => true,
  },
  setup(props, { emit }) {
    const smap = useSMap()
    useManagedLayer(
      smap,
      () => {
        if (!props.data) return null
        const layer = smap.layer.createGeoJsonLayer(toRaw(props.data), toRaw(props.pathStyle))
        layer.on('click', (event: L.LeafletMouseEvent) =>
          emit('click', (event.propagatedFrom ?? event.target).feature, event),
        )
        return layer
      },
      () => [props.data, props.pathStyle],
      () => props.visible,
      (layer) => {
        if (props.fit && props.visible) smap.fitToLayer(layer)
      },
    )
    return () => null
  },
})

/** Many points on one canvas */
export const SMapPoints = defineComponent({
  name: 'SMapPoints',
  props: {
    /** `[lat, lng]` pairs, or objects with `lat` and `lng`. Replacing the array redraws */
    points: { type: Array as PropType<PointInput[]>, required: true },
    /** Radius in pixels */
    radius: { type: Number, default: undefined },
    /** Style for all points, or a function returning the style of each */
    pointStyle: {
      type: [Object, Function] as PropType<
        L.CircleMarkerOptions | ((point: any, index: number) => L.CircleMarkerOptions)
      >,
      default: undefined,
    },
    /** Tooltip text for a point */
    tooltip: { type: Function as PropType<(point: any) => string>, default: undefined },
    visible: { type: Boolean, default: true },
    /**
     * `@click="(point, event) => ..."`. Declared as a prop rather than an emit so the
     * component can tell whether anyone listens: points only react to the mouse when they do.
     */
    onClick: {
      type: Function as PropType<(point: any, event: L.LeafletMouseEvent) => void>,
      default: undefined,
    },
  },
  setup(props) {
    const smap = useSMap()
    useManagedLayer(
      smap,
      () =>
        smap.layer.createPointLayer(toRaw(props.points), {
          radius: props.radius,
          style: toRaw(props.pointStyle),
          tooltip: props.tooltip,
          onClick: props.onClick,
        }),
      () => [props.points, props.radius, props.pointStyle, props.tooltip, props.onClick],
      () => props.visible,
    )
    return () => null
  },
})

/** Dim everything outside a region */
export const SMapMask = defineComponent({
  name: 'SMapMask',
  props: {
    /** Polygon / MultiPolygon GeoJSON in WGS-84 */
    data: { type: Object as PropType<GeoJSON.GeoJsonObject | null>, default: null },
    /** fillColor, fillOpacity, color, weight, outline */
    maskStyle: {
      type: Object as PropType<Omit<MaskOptions, 'id' | 'fit' | 'restrict'>>,
      default: undefined,
    },
    visible: { type: Boolean, default: true },
    /** Fit the view to the region each time the data changes */
    fit: { type: Boolean, default: true },
  },
  setup(props) {
    const smap = useSMap()
    useManagedLayer(
      smap,
      () => (props.data ? smap.layer.createMask(toRaw(props.data), toRaw(props.maskStyle)) : null),
      () => [props.data, props.maskStyle],
      () => props.visible,
      (layer) => {
        if (props.fit && props.visible) smap.fitToLayer(layer)
      },
    )
    return () => null
  },
})

/** A map control: zoom, scale, attribution or the base-map switcher */
export const SMapControl = defineComponent({
  name: 'SMapControl',
  props: {
    type: { type: String as PropType<ControlType>, required: true },
    /** Options of that control. Required for `layers`, optional for the others */
    options: {
      type: Object as PropType<
        (ControlOptions & AttributionOptions) | LayersControlOptions | OverlaysControlOptions
      >,
      default: undefined,
    },
  },
  setup(props) {
    const smap = useSMap()
    let added: ControlType | null = null

    watch(
      () => [props.type, props.options] as const,
      ([type, options]) => {
        if (added && added !== type) smap.control.remove(added)
        // The overloads differ by type; the props already carry the right shape
        smap.control.add(type as any, toRaw(options) as any)
        added = type
      },
      { immediate: true, deep: true },
    )
    onBeforeUnmount(() => {
      if (added) smap.control.remove(added)
    })
    return () => null
  },
})

/** Points that merge into counted bubbles when zoomed out */
export const SMapCluster = defineComponent({
  name: 'SMapCluster',
  props: {
    /** `[lat, lng]` pairs, or objects with `lat` and `lng`. Replacing the array redraws */
    points: { type: Array as PropType<PointInput[]>, required: true },
    /** Radius of a single point, in pixels */
    radius: { type: Number, default: undefined },
    /** Style for single points, or a function returning the style of each */
    pointStyle: {
      type: [Object, Function] as PropType<
        L.CircleMarkerOptions | ((point: any, index: number) => L.CircleMarkerOptions)
      >,
      default: undefined,
    },
    /** Tooltip text for a single point */
    tooltip: { type: Function as PropType<(point: any) => string>, default: undefined },
    /** Points closer than this (pixels) merge. Default 60 */
    clusterRadius: { type: Number, default: undefined },
    /** From this zoom level on, every point is shown on its own */
    disableClusteringAtZoom: { type: Number, default: undefined },
    visible: { type: Boolean, default: true },
    /** `@click="(point, event) => ..."` on a single point */
    onClick: {
      type: Function as PropType<(point: any, event: L.LeafletMouseEvent) => void>,
      default: undefined,
    },
    /** `@cluster-click="(points, event) => ..."`. Without it, clicking a bubble zooms in */
    onClusterClick: {
      type: Function as PropType<(points: any[], event: L.LeafletMouseEvent) => void>,
      default: undefined,
    },
  },
  setup(props) {
    const smap = useSMap()
    useManagedLayer(
      smap,
      () =>
        smap.layer.createCluster(toRaw(props.points), {
          radius: props.radius,
          style: toRaw(props.pointStyle),
          tooltip: props.tooltip,
          clusterRadius: props.clusterRadius,
          disableClusteringAtZoom: props.disableClusteringAtZoom,
          onClick: props.onClick,
          onClusterClick: props.onClusterClick,
        }),
      () => [
        props.points,
        props.radius,
        props.pointStyle,
        props.tooltip,
        props.clusterRadius,
        props.disableClusteringAtZoom,
        props.onClick,
        props.onClusterClick,
      ],
      () => props.visible,
    )
    return () => null
  },
})

type LatLngTuple = [number, number]

function defaultMarkerIcon(): L.DivIcon {
  return L.divIcon({ className: 'smap-draw-marker', iconSize: [16, 16], iconAnchor: [8, 8] })
}

/**
 * A marker. Whatever is put in the default slot becomes its popup.
 */
export const SMapMarker = defineComponent({
  name: 'SMapMarker',
  props: {
    /** Position `[lat, lng]`. Supports `v-model:lat-lng` together with `draggable` */
    latLng: { type: Array as unknown as PropType<LatLngTuple>, required: true },
    /** Icon. Defaults to a round dot (Leaflet's own image icon needs bundler setup) */
    icon: { type: Object as PropType<L.Icon | L.DivIcon>, default: undefined },
    /** Let the user drag it */
    draggable: { type: Boolean, default: false },
    /** Text shown on hover */
    tooltip: { type: String, default: undefined },
    /** Right-click menu of this marker */
    contextMenu: {
      type: [Array, Function] as PropType<ContextMenuItems>,
      default: undefined,
    },
    visible: { type: Boolean, default: true },
  },
  emits: {
    click: (_event: L.LeafletMouseEvent) => true,
    /** The user finished dragging it */
    'update:latLng': (_latLng: LatLngTuple) => true,
  },
  setup(props, { emit, slots }) {
    const smap = useSMap()
    const popup = ref<HTMLElement>()

    // markRaw is not needed: the marker never enters reactive state
    const marker = L.marker(toRaw(props.latLng), {
      icon: toRaw(props.icon) ?? defaultMarkerIcon(),
      draggable: props.draggable,
    })
    marker.on('click', (event) => emit('click', event))
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      emit('update:latLng', [lat, lng])
    })
    if (props.visible) marker.addTo(smap.instance)

    watch(
      () => props.latLng,
      ([lat, lng]) => {
        const current = marker.getLatLng()
        // Our own update:latLng coming back through v-model
        if (current.lat !== lat || current.lng !== lng) marker.setLatLng([lat, lng])
      },
      { deep: true },
    )
    watch(
      () => props.icon,
      (icon) => marker.setIcon(toRaw(icon) ?? defaultMarkerIcon()),
    )
    watch(
      () => props.draggable,
      (draggable) => {
        marker.options.draggable = draggable
        if (draggable) marker.dragging?.enable()
        else marker.dragging?.disable()
      },
    )
    watch(
      () => props.tooltip,
      (text) => {
        marker.unbindTooltip()
        if (text) marker.bindTooltip(text)
      },
      { immediate: true },
    )
    watch(
      () => props.contextMenu,
      (items) => {
        smap.contextMenu.unbind(marker)
        if (items) smap.contextMenu.bind(marker, toRaw(items))
      },
      { immediate: true },
    )
    watch(
      () => props.visible,
      (visible) => {
        if (visible) marker.addTo(smap.instance)
        else marker.remove()
      },
    )

    // Leaflet moves this element into the popup; Vue keeps rendering into it
    onMounted(() => {
      if (popup.value) marker.bindPopup(popup.value)
    })
    onBeforeUnmount(() => {
      smap.contextMenu.unbind(marker)
      marker.remove()
    })

    return () =>
      slots.default
        ? h('div', { style: { display: 'none' } }, [
            h('div', { ref: popup, class: 'smap-popup-content' }, slots.default()),
          ])
        : null
  },
})

/** The map's own right-click menu */
export const SMapContextMenu = defineComponent({
  name: 'SMapContextMenu',
  props: {
    /** Menu items, or a function building them for each right click */
    items: { type: [Array, Function] as PropType<ContextMenuItems>, required: true },
  },
  setup(props) {
    const smap = useSMap()
    watch(
      () => props.items,
      (items) => smap.contextMenu.setItems(toRaw(items)),
      { immediate: true },
    )
    onBeforeUnmount(() => smap.contextMenu.setItems(null))
    return () => null
  },
})
