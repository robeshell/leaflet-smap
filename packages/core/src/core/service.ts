import type * as L from 'leaflet'
import type {
  SearchParams,
  GeocodeParams,
  ReverseGeocodeParams,
  AdministrativeParams,
  TdtSearchResult,
  TdtGeocodeResult,
  TdtReverseGeocodeResult,
  TdtAdministrativeResult,
  TdtIpLocationResult,
} from '../types'

const BASE_API = 'https://api.tianditu.gov.cn'

export interface ServiceContext {
  /** Map whose current view scopes `search()` */
  map?: L.Map
  /** Default TianDiTu key, used when a call does not pass `tk` */
  key?: string | (() => string | undefined)
}

/**
 * TianDiTu web services.
 *
 * `smap.service` is bound to its map and to `tdtKey`, so calls need neither.
 * A standalone `new ServiceClient()` must be given `tk` (and, for `search`,
 * a map or `mapBound` + `level`) on every call.
 */
export class ServiceClient {
  private context: ServiceContext

  constructor(context: ServiceContext = {}) {
    this.context = context
  }

  /**
   * POI keyword search within the map's current view
   */
  search(params: SearchParams): Promise<TdtSearchResult>
  /** @deprecated Pass only `params`; `smap.service` already knows its map */
  search(map: L.Map, params: SearchParams): Promise<TdtSearchResult>
  async search(mapOrParams: L.Map | SearchParams, maybeParams?: SearchParams) {
    const params = (maybeParams ?? mapOrParams) as SearchParams
    const map = maybeParams ? (mapOrParams as L.Map) : this.context.map

    let { level, mapBound } = params
    if (map) {
      const bounds = map.getBounds()
      level ??= map.getZoom()
      mapBound ??= [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(
        ',',
      )
    }
    if (level == null || !mapBound) {
      throw new Error('search() needs a map, or both `level` and `mapBound`')
    }

    const postStr = JSON.stringify({
      level,
      mapBound,
      queryType: params.queryType ?? 1,
      start: params.start ?? 0,
      count: params.count ?? 10,
      keyWord: params.keyword,
    })

    return this.request<TdtSearchResult>(`${BASE_API}/v2/search`, {
      postStr,
      type: 'query',
      tk: this.resolveKey(params.tk),
    })
  }

  /**
   * Geocoding: address → coordinates
   */
  async geocode(params: GeocodeParams): Promise<TdtGeocodeResult> {
    const { tk, ...query } = params
    return this.request(`${BASE_API}/geocoder`, {
      ds: JSON.stringify(query),
      tk: this.resolveKey(tk),
    })
  }

  /**
   * Reverse geocoding: coordinates → address
   */
  async reverseGeocode(params: ReverseGeocodeParams): Promise<TdtReverseGeocodeResult> {
    const { tk, ...query } = params
    return this.request(`${BASE_API}/geocoder`, {
      type: 'geocode',
      postStr: JSON.stringify({ ...query, ver: query.ver ?? 1 }),
      tk: this.resolveKey(tk),
    })
  }

  /**
   * Administrative district query (TianDiTu v2 API)
   */
  async getAdministrative(params: AdministrativeParams): Promise<TdtAdministrativeResult> {
    const keyword = params.keyword ?? params.searchWord
    if (!keyword) {
      throw new Error('getAdministrative() needs a `keyword`')
    }
    return this.request(`${BASE_API}/v2/administrative`, {
      keyword,
      childLevel: String(params.childLevel ?? 0),
      extensions: String(params.extensions ?? false),
      tk: this.resolveKey(params.tk),
    })
  }

  /**
   * Get location by IP (no key required)
   */
  async getLocationByIp(): Promise<TdtIpLocationResult> {
    const response = await fetch('https://map.tianditu.gov.cn/data/getCityName')
    if (!response.ok) {
      throw new Error(`IP location request failed: ${response.status}`)
    }
    return response.json()
  }

  private resolveKey(tk?: string): string {
    const fallback = this.context.key
    const key = tk || (typeof fallback === 'function' ? fallback() : fallback)
    if (!key) {
      throw new Error('TianDiTu key is missing: pass `tk`, or set `tdtKey` on the map')
    }
    return key
  }

  private async request<T>(url: string, params: Record<string, string>): Promise<T> {
    const searchParams = new URLSearchParams(params)
    const fullUrl = `${url}?${searchParams.toString()}`

    const response = await fetch(fullUrl)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }
}
