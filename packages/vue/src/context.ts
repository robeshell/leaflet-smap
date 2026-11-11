import { inject, shallowRef, toValue, watch } from 'vue'
import type { InjectionKey, MaybeRefOrGetter, ShallowRef } from 'vue'
import type { SMap } from 'smap-leaflet'

/** The map of the nearest <SMapView>, null until it is created */
export const SMAP_KEY: InjectionKey<ShallowRef<SMap | null>> = Symbol('smap')

/** Where a composable should find its map */
export type SMapSource = MaybeRefOrGetter<SMap | null | undefined>

/**
 * The map of the enclosing <SMapView>.
 * Only works in components rendered inside its default slot, where the map already exists.
 */
export function useSMap(): SMap {
  const smap = inject(SMAP_KEY, null)?.value
  if (!smap) {
    throw new Error('useSMap() must be called in a component placed inside <SMapView>')
  }
  return smap
}

/**
 * Resolve the map for a composable: the one passed in, or else the enclosing <SMapView>'s.
 * `onAvailable` runs each time a map becomes available.
 */
export function resolveSMap(
  source: SMapSource | undefined,
  onAvailable?: (smap: SMap) => void,
): () => SMap | null {
  const injected = source === undefined ? inject(SMAP_KEY, null) : null
  if (source === undefined && !injected) {
    throw new Error('No map found: call this inside <SMapView>, or pass the `smap` option')
  }
  const get = () => (source === undefined ? injected!.value : (toValue(source) ?? null))

  if (onAvailable) {
    watch(get, (smap) => smap && onAvailable(smap), { immediate: true })
  }
  return get
}

/** Internal: a shallowRef typed for the provide side */
export function createSMapRef(): ShallowRef<SMap | null> {
  return shallowRef<SMap | null>(null)
}
