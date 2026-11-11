import type * as L from 'leaflet'
import type { MeasureLabel, MeasureResult } from '../../types'
import { BaseMeasureTool } from './base'
import type { LabelSpec, MeasureGeometry } from './base'

/** Distance along a line, with the running total shown at each vertex */
export class PolylineMeasure extends BaseMeasureTool {
  protected readonly drawType = 'polyline'

  protected measure(layer: L.Polyline): MeasureGeometry {
    const latlngs = layer.getLatLngs() as L.LatLng[]
    return { latlngs, distance: this.pathLength(latlngs) }
  }

  protected anchor(result: MeasureResult): L.LatLng {
    return result.latlngs[result.latlngs.length - 1]
  }

  protected defaultText(label: MeasureLabel): string {
    const length = this.formatLength(label.distance ?? 0)
    return label.partial ? length : `共 ${length}`
  }

  protected legacyValue(label: MeasureLabel): number {
    return label.distance ?? 0
  }

  protected draftLabels(latlngs: L.LatLng[]): LabelSpec[] {
    return this.nodeLabels(latlngs)
  }

  protected resultLabels(result: MeasureResult): LabelSpec[] {
    // Every vertex but the last keeps its running total; the last one carries the result
    return [
      ...this.nodeLabels(result.latlngs.slice(0, -1)),
      // The deprecated formatter only returned the number, so it keeps its "共" prefix
      { latlng: this.anchor(result), html: this.resultHtml(result, '共 ') },
    ]
  }

  /** "起点" on the first vertex, the distance so far on the others */
  private nodeLabels(latlngs: L.LatLng[]): LabelSpec[] {
    return latlngs.map((latlng, i) => {
      if (i === 0) return { latlng, html: this.labelHtml('起点') }
      const soFar = latlngs.slice(0, i + 1)
      const text = this.text({
        type: 'polyline',
        latlngs: soFar,
        distance: this.pathLength(soFar),
        partial: true,
      })
      return { latlng, html: this.labelHtml(text) }
    })
  }
}
