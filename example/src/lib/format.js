export const fixed = (n, digits = 6) => Number(n).toFixed(digits)

export function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`
}

export function formatArea(m2) {
  return m2 >= 1e6 ? `${(m2 / 1e6).toFixed(2)} km²` : `${m2.toFixed(0)} m²`
}
