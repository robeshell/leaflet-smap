const STORAGE_KEY = 'smap-example-tdt-key'

function stored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

const envKey = import.meta.env.VITE_TDT_KEY || ''

/** 天地图密钥：本地开发来自 .env.local 的 VITE_TDT_KEY，在线示例来自访问者在侧栏里填写的值 */
export const tdtKey = envKey || stored()

/** 密钥是访问者自己填的（只存在这个浏览器里），可以清除 */
export const tdtKeyFromBrowser = !envKey && Boolean(tdtKey)

/** 保存或清除（传空）访问者填写的密钥，然后刷新页面让所有地图用上新值 */
export function saveTdtKey(key) {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 浏览器禁用了本地存储时保存不了，刷新后仍是未配置状态
  }
  location.reload()
}

/** 天地图服务类示例的底图：有密钥用天地图，没有时退回不需要密钥的高德 */
export const BASE_TILES = tdtKey
  ? ['TianDiTu.Normal.Map', 'TianDiTu.Normal.Annotion']
  : 'GaoDe.Normal.Map'

/** 合肥市中心，[lat, lng]，WGS-84 */
export const HEFEI = [31.820591, 117.227219]
