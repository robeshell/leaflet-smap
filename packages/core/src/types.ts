import type * as L from 'leaflet'
import type { BUILTIN_TILE_TYPES } from './plugins/chinese-tms-providers'
import type { AreaUnit, LengthUnit } from './core/sketch/geometry'
import type { SnapOptions } from './core/sketch/snap'

export type { AreaUnit, LengthUnit, SnapOptions }

// ============ Map Config ============

export type TileProviderName =
  'TianDiTu' | 'GaoDe' | 'Google' | 'Geoq' | 'OSM' | 'Baidu' | 'BaiduV3' | 'Tencent' | 'Mapbox'

export type CoordType = 'wgs84' | 'gcj02' | 'bd09'

/** Tile types shipped with the library */
export type BuiltinTileType = (typeof BUILTIN_TILE_TYPES)[number]

/**
 * Tile type string, e.g. "GaoDe.Normal.Map".
 * Built-in types autocomplete; any other string is accepted for providers
 * added through `registerProvider()`.
 */
export type TileType = BuiltinTileType | (string & {})

/** Definition passed to `registerProvider()` */
export interface TileProviderDefinition {
  /**
   * group → type → URL template, addressed as `"<provider>.<group>.<type>"`.
   * Placeholders: `{s}` subdomain, `{x}` `{y}` `{z}`, `{-y}` inverted y, `{key}`.
   */
  layers: Record<string, Record<string, string>>
  /** Values substituted for `{s}` */
  subdomains?: string[]
  /** Coordinate system of the tiles. Non-WGS-84 tiles are shifted to line up with WGS-84 data. Default 'wgs84' */
  coordType?: CoordType
  /** Tiles use TMS (inverted y) numbering */
  tms?: boolean
  /** Value substituted for `{key}` */
  key?: string
}

export interface SMapOptions {
  /** Map container element ID or HTMLElement */
  container?: string | HTMLElement
  /** Tile layer type(s), e.g. "GaoDe.Normal.Map" or ["TianDiTu.Normal.Map", "TianDiTu.Normal.Annotion"] */
  tileType?: TileType | TileType[]
  /** Map center [lat, lng] */
  center?: [number, number]
  /** Initial zoom level */
  zoom?: number
  /** Minimum zoom level */
  minZoom?: number
  /** Maximum zoom level */
  maxZoom?: number
  /** Maximum native zoom */
  maxNativeZoom?: number
  /** Whether to use Canvas renderer */
  preferCanvas?: boolean
  /** TianDiTu API key */
  tdtKey?: string
  /** Mapbox access token */
  mapboxToken?: string
  /** Any additional Leaflet map options */
  [key: string]: unknown
}

// ============ Layer ============

export interface WFSOptions {
  url: string
  layer: string
  /** Register the layer under this id in `smap.layer` */
  id?: string
  style?: L.PathOptions
  outputFormat?: string
  [key: string]: unknown
}

export interface WMSOptions {
  url: string
  layer: string
  /** Register the layer under this id in `smap.layer` */
  id?: string
  format?: string
  transparent?: boolean
  crs?: L.CRS
  [key: string]: unknown
}

export interface MaskOptions {
  /** Register the mask under this id in `smap.layer` */
  id?: string
  /** Colour of the dimmed area. Default '#000' */
  fillColor?: string
  /** Opacity of the dimmed area. Default 0.5 */
  fillOpacity?: number
  /** Draw the region's border. Default true */
  outline?: boolean
  /** Border colour. Default '#3388ff' */
  color?: string
  /** Border width. Default 2 */
  weight?: number
  /** Fit the view to the region when added. Default true */
  fit?: boolean
  /** Keep the map from being panned away from the region while the mask is shown. Default false */
  restrict?: boolean
}

/** A point for `addPoints()`: `[lat, lng]`, or any object with `lat` and `lng` */
export type PointInput = L.LatLngExpression | { lat: number; lng: number }

export interface PointLayerOptions<T = PointInput> {
  /** Register the layer under this id in `smap.layer` */
  id?: string
  /** Radius in pixels. Default 4 */
  radius?: number
  /** Style for all points, or a function returning the style of each one */
  style?: L.CircleMarkerOptions | ((point: T, index: number) => L.CircleMarkerOptions)
  /** Tooltip text for a point */
  tooltip?: (point: T) => string
  /** Called when a point is clicked */
  onClick?: (point: T, event: L.LeafletMouseEvent) => void
}

export interface ClusterOptions<T = PointInput> extends PointLayerOptions<T> {
  /** Points closer than this (pixels) merge into one bubble. Default 60 */
  clusterRadius?: number
  /** From this zoom level on, every point is shown on its own */
  disableClusteringAtZoom?: number
  /** Called when a bubble is clicked. By default the map zooms in on it */
  onClusterClick?: (points: T[], event: L.LeafletMouseEvent) => void
}

// ============ Draw ============

export type DrawType = 'marker' | 'polyline' | 'polygon' | 'rectangle' | 'circle'

export interface DrawOptions {
  /** Style of drawn lines and areas */
  shapeOptions?: L.PathOptions
  /** Icon of drawn markers. Defaults to a round dot */
  markerIcon?: L.Icon | L.DivIcon
  /**
   * Snap to the vertices and edges of the shapes already drawn, while drawing and
   * editing. Pass an object to change the distance or to snap to other layers too.
   */
  snap?: boolean | SnapOptions
}

export type DrawEvents = {
  /** Drawing a shape has started */
  drawstart: { type: DrawType }
  /** Drawing ended, whether a shape was finished or it was cancelled */
  drawstop: { type: DrawType }
  /** A shape was finished */
  created: { layer: L.Layer; type: DrawType }
  /** A shape is being changed in edit mode: fired while dragging, and after an undo */
  editing: { layer: L.Layer }
  /** Shapes were changed in edit mode and saved */
  edited: { layers: L.Layer[] }
  /** Shapes were removed */
  removed: { layers: L.Layer[] }
  /** Anything changed; carries the current content as GeoJSON */
  change: GeoJSON.FeatureCollection
}

// ============ Context menu ============

export interface ContextMenuContext {
  /** Where the right click happened */
  latlng: L.LatLng
  containerPoint: L.Point
  /** The layer that was right-clicked, for menus bound to a layer */
  layer?: L.Layer
  map: L.Map
}

export type ContextMenuItem =
  | {
      text: string
      onClick?: (context: ContextMenuContext) => void
      disabled?: boolean
      /** Render as a destructive action */
      danger?: boolean
    }
  /** Separator */
  | '-'

/** A fixed list, or a function building the list for each right click */
export type ContextMenuItems =
  ContextMenuItem[] | ((context: ContextMenuContext) => ContextMenuItem[])

// ============ Measure ============

export interface MeasureOptions {
  /** Whether to show distance/area markers */
  showMarker?: boolean
  /** Snap to earlier measurements (and to `layers`, if given) while drawing and editing */
  snap?: boolean | SnapOptions
  /** Unit of distances in the default labels. Default 'auto' (m or km by size) */
  lengthUnit?: LengthUnit
  /** Unit of areas in the default labels: 'auto', 'm2', 'km2', 'ha' (公顷) or 'mu' (亩). Default 'auto' */
  areaUnit?: AreaUnit
  /**
   * Custom text for the labels. Receives the measurement; `partial` is true for
   * the running totals shown while a line is being drawn.
   */
  formatLabel?: (label: MeasureLabel) => string
  /**
   * @deprecated Use `formatLabel`. What this receives depends on the tool: the
   * distance for a line, the radius for a circle, the vertices for an area.
   */
  valueFormatter?: (value: number | L.LatLng[]) => string
  /** Style of the measured lines and areas */
  shapeOptions?: L.PathOptions
  /** Icon for draw vertices */
  icon?: L.DivIcon
}

/** Outcome of one finished measurement */
export interface MeasureResult {
  /** Id of this measurement, usable with `tool.remove(id)` */
  id: string
  type: MeasureType
  /** Total length in metres (polyline) */
  distance?: number
  /** Area in square metres (polygon, rectangle, circle) */
  area?: number
  /** Length of the outline in metres (polygon, rectangle, circle) */
  perimeter?: number
  /** Radius in metres (circle) */
  radius?: number
  /** Centre (circle) */
  center?: L.LatLng
  /** Vertices of the shape; for a circle, its centre */
  latlngs: L.LatLng[]
  /** The drawn Leaflet layer */
  layer: L.Layer
}

/** What a label formatter is given */
export type MeasureLabel = Omit<MeasureResult, 'id' | 'layer'> & {
  /** True for an intermediate value, false for the final result */
  partial: boolean
}

export type MeasureEvents = {
  /** Measuring started */
  start: { type: MeasureType }
  /** Measuring ended. `completed` is false when it was cancelled */
  stop: { type: MeasureType; completed: boolean }
  /** A shape was finished */
  created: MeasureResult
  /** A measurement was removed (delete button, `remove()` or `clearAll()`) */
  removed: { id: string; type: MeasureType }
  /** A measurement is being reshaped: fired while dragging, and after an undo */
  updating: MeasureResult
  /** A measurement was reshaped in edit mode and saved */
  updated: MeasureResult
  /** The tool was destroyed */
  destroyed: { type: MeasureType }
}

export interface MeasureTool {
  readonly type: MeasureType
  /** True while a measurement is being drawn */
  readonly measuring: boolean
  /** True while the results can be reshaped */
  readonly editing: boolean
  /** Let the user reshape the finished measurements; values and labels follow live */
  startEdit(): void
  /** Leave edit mode, keeping (default) or discarding the changes */
  finishEdit(save?: boolean): void
  /** Take back the last change made in edit mode. Returns false when there is none */
  undo(): boolean
  /** Change options afterwards, e.g. the units; labels on the map are redrawn */
  setOptions(options: Partial<MeasureOptions>): void
  enable(): void
  disable(): void
  remove(id: string): void
  clearAll(): void
  destroy(): void
  /** Finished measurements still on the map, oldest first */
  getResults(): MeasureResult[]
  on<K extends keyof MeasureEvents>(type: K, handler: (event: MeasureEvents[K]) => void): void
  off<K extends keyof MeasureEvents>(type: K, handler: (event: MeasureEvents[K]) => void): void
}

export type MeasureType = 'polyline' | 'polygon' | 'circle' | 'rectangle'

// ============ Control ============

export interface AttributionOptions {
  prefix?: string
  content?: string
}

export interface ControlOptions {
  position?: L.ControlPosition
  [key: string]: unknown
}

export type ControlType = 'attribution' | 'zoom' | 'scale' | 'layers' | 'overlays'

export interface LayersControlOptions {
  position?: L.ControlPosition
  /** Base maps to choose from */
  options: {
    label: string
    /** One tile type, or several stacked (base + annotation) */
    tileType: TileType | TileType[]
  }[]
}

export interface OverlaysControlOptions {
  position?: L.ControlPosition
  /** Heading shown above the list */
  title?: string
  /**
   * Layers to list, by the id they are registered under in `smap.layer`.
   * Omit to list every registered layer, labelled by its id.
   */
  items?: { id: string; label: string }[]
}

// ============ Service ============

/** Fields shared by every TianDiTu service call */
export interface ServiceKeyParam {
  /** TianDiTu API key. Defaults to the map's `tdtKey` */
  tk?: string
}

export interface SearchParams extends ServiceKeyParam {
  /** Search keyword */
  keyword: string
  /** Number of results to return. Default 10 */
  count?: number
  /** Start index. Default 0 */
  start?: number
  /** TianDiTu query type. Default 1 (keyword search) */
  queryType?: number
  /** Zoom level used for ranking. Defaults to the map's current zoom */
  level?: number
  /** Search extent "minLng,minLat,maxLng,maxLat". Defaults to the map's current view */
  mapBound?: string
}

export interface GeocodeParams extends ServiceKeyParam {
  /** Address to look up */
  keyWord: string
}

export interface ReverseGeocodeParams extends ServiceKeyParam {
  /** Longitude */
  lon: number
  /** Latitude */
  lat: number
  ver?: number
}

export interface AdministrativeParams extends ServiceKeyParam {
  /** District name, or its 9-digit code such as "156340100" */
  keyword?: string
  /** @deprecated Use `keyword` */
  searchWord?: string
  /** How many levels of sub-districts to include (0–3). Default 0 */
  childLevel?: 0 | 1 | 2 | 3
  /** Include boundary geometry (WKT). Default false */
  extensions?: boolean
}

export interface TdtPoi {
  name: string
  address?: string
  phone?: string
  poiType?: string
  source?: string
  hotPointID?: string
  /** "lng,lat" */
  lonlat: string
  [key: string]: unknown
}

export interface TdtSearchResult {
  /** Total number of matches */
  count?: number
  resultType?: number
  keyWord?: string
  /** Present when the search matched POIs */
  pois?: TdtPoi[]
  status: { infocode: number; cndesc: string }
  [key: string]: unknown
}

export interface TdtGeocodeResult {
  /** "0" on success */
  status: string
  msg: string
  location?: {
    /** Longitude, as a string */
    lon: string
    /** Latitude, as a string */
    lat: string
    level?: string
    score?: number
    keyWord?: string
  }
  [key: string]: unknown
}

export interface TdtReverseGeocodeResult {
  /** "0" on success */
  status: string
  msg: string
  result?: {
    formatted_address: string
    location: { lon: number; lat: number }
    addressComponent: {
      nation?: string
      province?: string
      province_code?: string
      city?: string
      city_code?: string
      county?: string
      county_code?: string
      town?: string
      town_code?: string
      road?: string
      road_distance?: number
      address?: string
      address_distance?: number
      address_position?: string
      poi?: string
      poi_distance?: number
      poi_position?: string
    }
  }
  [key: string]: unknown
}

export interface TdtDistrict {
  /** 9-digit district code, e.g. "156340100" */
  gb: string
  /** Parent district code */
  pgb: string
  name: string
  center: { lng: number; lat: number }
  level: number
  /** WKT geometry, present when `extensions` is true */
  boundary?: string
  /** Present when `childLevel` > 0 */
  children?: TdtDistrict[]
}

export interface TdtAdministrativeResult {
  /** 200 on success */
  status: number
  message: string
  data?: {
    district: TdtDistrict[]
    suggestion: unknown[]
  }
  [key: string]: unknown
}

export interface TdtIpLocationResult {
  code: number
  msg: string
  data?: {
    country?: string
    province?: string
    city?: string
    /** Administrative code */
    gb?: string
    /** Latitude, as a string */
    lat?: string
    /** Longitude, as a string */
    lng?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface LocationOptions {
  timeout?: number
  enableHighAccuracy?: boolean
}

export interface LocationResult {
  latitude: number
  longitude: number
  /** Accuracy radius in metres */
  accuracy: number
}

export interface LocateOptions extends LocationOptions {
  /** Move the map to the position. Default true */
  setView?: boolean
  /** Zoom to use when moving. Defaults to at least 16 */
  zoom?: number
  /** Show the position and its accuracy on the map. Default true */
  marker?: boolean
}

export interface LocateResult extends LocationResult {
  latlng: L.LatLng
}

// ============ Export ============

export interface ExportImageOptions {
  /** Image format. Default 'image/png' */
  type?: 'image/png' | 'image/jpeg' | 'image/webp'
  /** Quality from 0 to 1, for JPEG and WebP */
  quality?: number
  /** Pixels per CSS pixel. Defaults to the screen's ratio, at most 2 */
  scale?: number
  /** Colour behind the tiles. Default '#ffffff' */
  background?: string
  /** Draw measurement labels, cluster bubbles and drawn markers into the image. Default true */
  labels?: boolean
  /**
   * CSS selectors of further simple HTML elements to draw: boxes with a background,
   * border, rounded corners and a line of text. Not for images or complex layouts.
   */
  include?: string[]
  /** Longest wait (ms) for the base map to finish loading first. Default 8000 */
  timeout?: number
}

// ============ Events ============

export type SMapEvents = {
  loaded: L.Map
  tileLoaded: L.TileLayer[]
  /** A measurement was finished by any tool created through `createMeasure()` */
  'measure:created': MeasureResult
  /** A measurement was removed */
  'measure:removed': { id: string; type: MeasureType }
  /** A measurement is being reshaped in edit mode */
  'measure:updating': MeasureResult
  /** A measurement was reshaped in edit mode and saved */
  'measure:updated': MeasureResult
  /** A measure tool started drawing */
  'measure:start': { type: MeasureType }
  /** A measure tool stopped drawing. `completed` is false when it was cancelled */
  'measure:stop': { type: MeasureType; completed: boolean }
}

export type SMapEventType = keyof SMapEvents
