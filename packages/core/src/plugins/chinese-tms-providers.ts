/**
 * Chinese Tile Map Service Providers for Leaflet
 * Supports: TianDiTu, GaoDe, Google, Geoq, OSM, Baidu, Tencent, Mapbox
 */
import * as L from 'leaflet'
import type { CoordType, TileProviderDefinition } from '../types'

// Baidu CRS (requires proj4leaflet)
const LWithProj = L as typeof L & { Proj?: { CRS: new (...args: any[]) => L.CRS } }
if (LWithProj.Proj) {
  ;(L.CRS as any).Baidu = new LWithProj.Proj.CRS(
    'EPSG:900913',
    '+proj=merc +a=6378206 +b=6356584.314245179 +lat_ts=0.0 +lon_0=0.0 +x_0=0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs',
    {
      resolutions: (() => {
        const level = 19
        const res: number[] = []
        res[0] = Math.pow(2, 18)
        for (let i = 1; i < level; i++) {
          res[i] = Math.pow(2, 18 - i)
        }
        return res
      })(),
      origin: [0, 0],
      bounds: L.bounds([20037508.342789244, 0], [0, 20037508.342789244]),
    },
  )
}

/** Provider definitions: Provider.MapName.MapType -> URL template */
export const providers: Record<string, any> = {
  TianDiTu: {
    Normal: {
      Map: 'https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&X={x}&Y={y}&L={z}&tk={key}',
      Annotion: 'https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&X={x}&Y={y}&L={z}&tk={key}',
    },
    Satellite: {
      Map: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&X={x}&Y={y}&L={z}&tk={key}',
      Annotion: 'https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&X={x}&Y={y}&L={z}&tk={key}',
    },
    Terrain: {
      Map: 'https://t{s}.tianditu.gov.cn/DataServer?T=ter_w&X={x}&Y={y}&L={z}&tk={key}',
      Annotion: 'https://t{s}.tianditu.gov.cn/DataServer?T=cta_w&X={x}&Y={y}&L={z}&tk={key}',
    },
    Subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
  },

  GaoDe: {
    Normal: {
      Map: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    },
    Satellite: {
      Map: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      Annotion: 'https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
    },
    Brief: {
      Map: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    },
    Subdomains: ['1', '2', '3', '4'],
  },

  Google: {
    Normal: {
      Map: 'https://www.google.cn/maps/vt?lyrs=m@189&gl=cn&x={x}&y={y}&z={z}',
    },
    Satellite: {
      Map: 'https://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}',
      Annotion: 'https://www.google.cn/maps/vt?lyrs=y@189&gl=cn&x={x}&y={y}&z={z}',
    },
    Subdomains: [] as string[],
  },

  Geoq: {
    Normal: {
      Map: 'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}',
      PurplishBlue:
        'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetPurplishBlue/MapServer/tile/{z}/{y}/{x}',
      Gray: 'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetGray/MapServer/tile/{z}/{y}/{x}',
      Warm: 'https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetWarm/MapServer/tile/{z}/{y}/{x}',
    },
    Theme: {
      Hydro:
        'https://thematic.geoq.cn/arcgis/rest/services/ThematicMaps/WorldHydroMap/MapServer/tile/{z}/{y}/{x}',
    },
    Subdomains: [] as string[],
  },

  OSM: {
    Normal: {
      Map: 'https://{s}.tile.osm.org/{z}/{x}/{y}.png',
    },
    Subdomains: ['a', 'b', 'c'],
  },

  Baidu: {
    Normal: {
      Map: 'https://online{s}.map.bdimg.com/onlinelabel/?qt=tile&x={x}&y={y}&z={z}&styles=pl&scaler=1&p=1',
    },
    Satellite: {
      Map: 'https://shangetu{s}.map.bdimg.com/it/u=x={x};y={y};z={z};v=009;type=sate&fm=46',
      Annotion: 'https://online{s}.map.bdimg.com/tile/?qt=tile&x={x}&y={y}&z={z}&styles=sl&v=020',
    },
    Subdomains: '0123456789'.split(''),
    tms: true,
  },

  BaiduV3: {
    Normal: {
      Map: 'https://maponline{s}.bdimg.com/tile/?qt=vtile&x={x}&y={y}&z={z}&styles=pl&scaler=2&udt=&from=jsapi3_0',
    },
    Subdomains: '012'.split(''),
    tms: true,
  },

  Tencent: {
    Normal: {
      Map: 'https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={-y}&type=vector&styleid=3',
    },
    Satellite: {
      Map: 'https://p{s}.map.gtimg.com/sateTiles/{z}/{sx}/{sy}/{x}_{-y}.jpg',
    },
    Terrain: {
      Map: 'https://p{s}.map.gtimg.com/demTiles/{z}/{sx}/{sy}/{x}_{-y}.jpg',
    },
    Subdomains: '0123'.split(''),
  },

  Mapbox: {
    Satellite: {
      Map: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.webp?access_token={key}',
    },
    Subdomains: ['0'],
  },
}

/** Map provider name to coordinate type */
const COORD_TYPE_MAP: Record<string, CoordType> = {
  GaoDe: 'gcj02',
  Geoq: 'gcj02',
  Google: 'gcj02',
  Tencent: 'gcj02',
  Baidu: 'bd09',
  BaiduV3: 'bd09',
}

export function getCoordType(providerName: string): CoordType {
  return COORD_TYPE_MAP[providerName] || 'wgs84'
}

/** Every tile type shipped with the library (kept in sync with `providers` by a test) */
export const BUILTIN_TILE_TYPES = [
  'TianDiTu.Normal.Map',
  'TianDiTu.Normal.Annotion',
  'TianDiTu.Satellite.Map',
  'TianDiTu.Satellite.Annotion',
  'TianDiTu.Terrain.Map',
  'TianDiTu.Terrain.Annotion',
  'GaoDe.Normal.Map',
  'GaoDe.Satellite.Map',
  'GaoDe.Satellite.Annotion',
  'GaoDe.Brief.Map',
  'Google.Normal.Map',
  'Google.Satellite.Map',
  'Google.Satellite.Annotion',
  'Geoq.Normal.Map',
  'Geoq.Normal.PurplishBlue',
  'Geoq.Normal.Gray',
  'Geoq.Normal.Warm',
  'Geoq.Theme.Hydro',
  'OSM.Normal.Map',
  'Baidu.Normal.Map',
  'Baidu.Satellite.Map',
  'Baidu.Satellite.Annotion',
  'BaiduV3.Normal.Map',
  'Tencent.Normal.Map',
  'Tencent.Satellite.Map',
  'Tencent.Terrain.Map',
  'Mapbox.Satellite.Map',
] as const

const RESERVED_GROUP_NAMES = ['Subdomains', 'tms', 'key']

/**
 * Register a custom tile provider (or override a built-in one).
 * Its layers are then addressable as `"<name>.<group>.<type>"`.
 *
 * @example
 * ```ts
 * registerProvider('Intranet', {
 *   layers: { Satellite: { Map: 'https://tiles.example.com/{z}/{x}/{y}.png' } },
 *   coordType: 'gcj02',
 * })
 * smap.setTileLayer('Intranet.Satellite.Map')
 * ```
 */
export function registerProvider(name: string, definition: TileProviderDefinition): void {
  if (!name || name.includes('.')) {
    throw new Error(`Invalid tile provider name: "${name}"`)
  }
  for (const group of Object.keys(definition.layers)) {
    if (group.includes('.') || RESERVED_GROUP_NAMES.includes(group)) {
      throw new Error(`Invalid tile group name: "${group}"`)
    }
  }

  providers[name] = {
    ...definition.layers,
    Subdomains: definition.subdomains ?? [],
    ...(definition.tms ? { tms: true } : {}),
    ...(definition.key ? { key: definition.key } : {}),
  }

  if (definition.coordType && definition.coordType !== 'wgs84') {
    COORD_TYPE_MAP[name] = definition.coordType
  } else {
    delete COORD_TYPE_MAP[name]
  }
}

/** List every tile type currently available, including registered ones */
export function getTileTypes(): string[] {
  const types: string[] = []
  for (const [provider, groups] of Object.entries(providers)) {
    for (const [group, layers] of Object.entries(groups as Record<string, unknown>)) {
      if (RESERVED_GROUP_NAMES.includes(group) || typeof layers !== 'object' || !layers) continue
      for (const type of Object.keys(layers)) {
        types.push(`${provider}.${group}.${type}`)
      }
    }
  }
  return types
}

/**
 * Create a china tile layer from type string like "GaoDe.Normal.Map"
 */
export function createChinaTileLayer(
  type: string,
  options: { key?: string; zIndex?: number; [k: string]: any } = {},
): L.TileLayer {
  const parts = type.split('.')
  const providerName = parts[0]
  const mapName = parts[1]
  const mapType = parts[2]

  const provider = providers[providerName]
  if (!provider?.[mapName]?.[mapType]) {
    throw new Error(`Unknown tile provider: ${type}`)
  }

  const url: string = provider[mapName][mapType]
  const tileOptions: Record<string, any> = {
    subdomains: provider.Subdomains || [],
    ...options,
    key: options.key || provider.key || '',
    corrdType: getCoordType(providerName),
  }

  if (provider.tms) {
    tileOptions.tms = true
  }

  const ChinaTileLayer = L.TileLayer.extend({
    getTileUrl(coords: L.Coords) {
      const data: Record<string, any> = {
        s: (this as any)._getSubdomain(coords),
        x: coords.x,
        y: coords.y,
        z: (this as any)._getZoomForUrl(),
      }
      if ((this as any)._map && !(this as any)._map.options.crs.infinite) {
        const invertedY = (this as any)._globalTileRange.max.y - coords.y
        if ((this as any).options.tms) {
          data['y'] = invertedY
        }
        data['-y'] = invertedY
      }
      data.sx = data.x >> 4
      data.sy = ((1 << data.z) - data.y) >> 4

      return L.Util.template((this as any)._url, L.Util.extend(data, (this as any).options))
    },
  }) as any

  return new ChinaTileLayer(url, tileOptions) as L.TileLayer
}
