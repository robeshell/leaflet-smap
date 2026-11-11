import type * as L from 'leaflet'
import type { MeasureLabel, MeasureResult } from '../../types'
import { BaseMeasureTool } from './base'
import type { MeasureGeometry } from './base'

export class CircleMeasure extends BaseMeasureTool {
  protected readonly drawType = 'circle'

  protected measure(layer: L.Circle): MeasureGeometry {
    const radius = layer.getRadius()
    const center = layer.getLatLng()
    return {
      latlngs: [center],
      center,
      radius,
      area: Math.PI * radius * radius,
      perimeter: 2 * Math.PI * radius,
    }
  }

  protected anchor(result: MeasureResult): L.LatLng {
    return result.center ?? result.latlngs[0]
  }

  protected defaultText(label: MeasureLabel): string {
    return this.formatArea(label.area ?? 0)
  }

  protected legacyValue(label: MeasureLabel): number {
    return label.radius ?? 0
  }
}
