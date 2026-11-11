import L from 'leaflet'

/**
 * 圆点标记，可带文字标签。
 * 不用 Leaflet 默认图标：它的图片路径在打包工具里需要额外配置。
 */
export function pin(latlng, { label = '', tone = 'brand' } = {}) {
  const el = document.createElement('div')
  el.className = `pin pin--${tone}`
  el.appendChild(document.createElement('i'))
  if (label) {
    const text = document.createElement('span')
    text.textContent = label
    el.appendChild(text)
  }
  return L.marker(latlng, {
    icon: L.divIcon({ className: 'pin-icon', html: el, iconSize: [14, 14], iconAnchor: [7, 7] }),
  })
}
