// Style
import './style/index.scss'

// Main class
export { SMap } from './SMap'

// Types
export type {
  SMapOptions,
  TileType,
  BuiltinTileType,
  TileProviderDefinition,
  MeasureResult,
  MeasureLabel,
  LengthUnit,
  SnapOptions,
  AreaUnit,
  MaskOptions,
  PointInput,
  PointLayerOptions,
  ClusterOptions,
  DrawType,
  DrawOptions,
  DrawEvents,
  ContextMenuItem,
  ContextMenuItems,
  ContextMenuContext,
  ControlType,
  LayersControlOptions,
  OverlaysControlOptions,
  LocateOptions,
  ExportImageOptions,
  LocateResult,
  MeasureEvents,
  SMapEvents,
  TdtPoi,
  TdtSearchResult,
  TdtGeocodeResult,
  TdtReverseGeocodeResult,
  TdtDistrict,
  TdtAdministrativeResult,
  TdtIpLocationResult,
  MeasureOptions,
  MeasureType,
  MeasureTool,
  WFSOptions,
  WMSOptions,
  SearchParams,
  GeocodeParams,
  ReverseGeocodeParams,
  AdministrativeParams,
  AttributionOptions,
  ControlOptions,
  LocationOptions,
  LocationResult,
  CoordType,
} from './types'

export type { Coord } from './plugins/coord-transform'

// Utilities
export { getLocation } from './utils/location'
export { loadScript, loadStyle } from './utils/load-assets'

// Coordinate transform utilities
export {
  wgs84ToGcj02,
  gcj02ToWgs84,
  gcj02ToBd09,
  bd09ToGcj02,
  wgs84ToBd09,
  bd09ToWgs84,
  transformCoord,
  transformGeoJSON,
} from './plugins/coord-transform'

// Plugin internals (for advanced usage)
export {
  providers,
  getCoordType,
  getTileTypes,
  createChinaTileLayer,
  registerProvider,
  BUILTIN_TILE_TYPES,
} from './plugins/chinese-tms-providers'

// Core classes (for advanced usage)
export { LayerManager } from './core/layer'
export { ControlManager } from './core/control'
export { ServiceClient } from './core/service'
export { ContextMenu } from './core/context-menu'
export { ClusterLayer } from './core/cluster'
export { DrawTool } from './core/draw'
export type { ServiceContext } from './core/service'
export {
  BaseMeasureTool,
  PolylineMeasure,
  PolygonMeasure,
  CircleMeasure,
  RectangleMeasure,
} from './core/measure'
export { loadLeafletDraw } from './core/draw-kit'
export { sketchText } from './core/sketch/text'
export { createSnapper } from './core/sketch/snap'
export type { Snapper } from './core/sketch/snap'
export { geodesicArea, pathLength, formatLength, formatArea } from './core/sketch/geometry'
