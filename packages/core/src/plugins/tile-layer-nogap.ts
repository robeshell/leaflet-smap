/**
 * TileLayer NoGap fix - adds 1px to tile size and removes border to prevent gaps between tiles.
 * Uses MutationObserver to catch all tiles including dynamically loaded ones.
 */
import * as L from 'leaflet'

function patchTile(tile: HTMLElement): void {
  if (tile.dataset.nogap) return
  tile.dataset.nogap = '1'
  tile.style.border = 'none'
}

function patchAllTiles(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.leaflet-tile').forEach(patchTile)
}

export function installTileLayerNoGap(): void {
  // Monkey-patch _initTile for early patching
  const originalInitTile = (L.GridLayer.prototype as any)._initTile
  ;(L.GridLayer.prototype as any)._initTile = function (tile: HTMLElement) {
    originalInitTile.call(this, tile)
    tile.style.border = 'none'
    tile.dataset.nogap = '1'
  }
}

/**
 * Observe a map container for new tiles and patch them.
 * Call this after map creation for guaranteed coverage.
 */
export function observeTileNoGap(mapContainer: HTMLElement): MutationObserver {
  // Patch existing tiles
  patchAllTiles(mapContainer)

  // Watch for new tiles
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.classList.contains('leaflet-tile')) {
            patchTile(node)
          } else {
            node.querySelectorAll<HTMLElement>('.leaflet-tile').forEach(patchTile)
          }
        }
      }
    }
  })

  observer.observe(mapContainer, { childList: true, subtree: true })
  return observer
}
