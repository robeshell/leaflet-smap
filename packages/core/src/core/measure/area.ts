import type * as L from 'leaflet'
import type { MeasureLabel, MeasureResult } from '../../types'
import { geodesicArea, pathLength } from '../sketch/geometry'
import { BaseMeasureTool } from './base'
import type { MeasureGeometry } from './base'

/** Shared by the tools that measure the area of a ring: polygon and rectangle */
export abstract class RingAreaMeasure extends BaseMeasureTool {
  protected measure(layer: L.Polygon): MeasureGeometry {
    const latlngs = layer.getLatLngs()[0] as L.LatLng[]
    return {
      latlngs,
      area: geodesicArea(latlngs),
      perimeter: latlngs.length ? pathLength([...latlngs, latlngs[0]]) : 0,
    }
  }

  protected anchor(result: MeasureResult): L.LatLng {
    return result.latlngs[0]
  }

  protected defaultText(label: MeasureLabel): string {
    return this.formatArea(label.area ?? 0)
  }

  protected legacyValue(label: MeasureLabel): L.LatLng[] {
    return label.latlngs
  }
}
