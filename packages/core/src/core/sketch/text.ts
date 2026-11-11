/**
 * Texts shown next to the cursor while drawing and editing.
 * Assign to the fields to translate or reword them.
 */
export const sketchText = {
  marker: {
    start: '单击地图放置标记',
  },
  polyline: {
    start: '单击开始绘制线',
    next: '单击继续绘制',
    finish: '再次单击最后一个点完成',
  },
  polygon: {
    start: '单击开始绘制多边形',
    next: '单击继续绘制',
    finish: '单击第一个点闭合',
  },
  rectangle: {
    start: '按住拖动绘制矩形，或单击确定第一个角',
    finish: '松开完成，或再次单击确定对角',
  },
  circle: {
    start: '按住拖动绘制圆，或单击确定圆心',
    finish: '松开完成，或再次单击确定半径',
    radius: '半径',
  },
  /** {n} is replaced by the number of points required */
  tooFewPoints: '至少需要 {n} 个点',
  cancel: '按 Esc 取消',
  edit: '拖动圆点调整形状；单击顶点可删除',
}
