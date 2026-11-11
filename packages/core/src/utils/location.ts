import type { LocationOptions, LocationResult } from '../types'

const DEFAULT_OPTIONS: LocationOptions = {
  timeout: 3000,
  enableHighAccuracy: false,
}

/**
 * HTML5 Geolocation API wrapper
 */
export function getLocation(options?: LocationOptions): Promise<LocationResult> {
  const { timeout, enableHighAccuracy } = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持 HTML5 定位'))
      return
    }

    // Declared first: an implementation may call back before watchPosition returns
    let id = -1
    id = navigator.geolocation.watchPosition(
      (position) => {
        navigator.geolocation.clearWatch(id)
        const { latitude, longitude, accuracy } = position.coords
        resolve({ latitude, longitude, accuracy })
      },
      (error) => {
        navigator.geolocation.clearWatch(id)
        const messages: Record<number, string> = {
          [error.PERMISSION_DENIED]: '定位权限被拒绝',
          [error.POSITION_UNAVAILABLE]: '位置信息不可用',
          [error.TIMEOUT]: '定位超时',
        }
        reject(new Error(messages[error.code] || '定位未知错误'))
      },
      { enableHighAccuracy, timeout, maximumAge: 0 },
    )
  })
}
