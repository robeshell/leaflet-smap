import * as L from 'leaflet'
import type { ExportImageOptions } from '../types'

/**
 * Load an image in a way that lets a canvas read it back.
 * Tiles on the map were loaded without CORS, so they have to be fetched again.
 */
function loadForCanvas(src: string): Promise<HTMLImageElement> {
  const attempt = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(src))
      image.src = url
    })
  // The browser may answer from its cache with the earlier, non-CORS response;
  // a throwaway parameter forces a fresh request.
  return attempt(src).catch(() =>
    attempt(`${src}${src.includes('?') ? '&' : '?'}_cors=${Date.now()}`),
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** The library's own HTML elements that are simple enough to redraw on a canvas */
const OWN_ELEMENTS = ['.smap-measure-label', '.smap-cluster', '.smap-draw-marker']
/** Parts of them that belong to the screen only */
const SCREEN_ONLY = '.smap-measure-remove'

function isTransparent(color: string): boolean {
  return !color || color === 'transparent' || /,\s*0\)$|\/\s*0\)$/.test(color)
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Redraw a simple HTML element: its box (background, border, rounded corners) and
 * its text, then its children. Enough for labels and badges; it is not a general
 * HTML renderer — no shadows, images, pseudo-elements or wrapped text.
 */
function paintElement(ctx: CanvasRenderingContext2D, el: Element, origin: DOMRect): void {
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return
  }
  const rect = el.getBoundingClientRect()
  const x = rect.left - origin.left
  const y = rect.top - origin.top
  if (rect.width > 0 && rect.height > 0) {
    const corner = style.borderTopLeftRadius
    const radius = corner.endsWith('%')
      ? (Math.min(rect.width, rect.height) * parseFloat(corner)) / 100
      : parseFloat(corner) || 0

    if (!isTransparent(style.backgroundColor)) {
      roundedRect(ctx, x, y, rect.width, rect.height, radius)
      ctx.fillStyle = style.backgroundColor
      ctx.fill()
    }
    const border = parseFloat(style.borderTopWidth) || 0
    if (border > 0 && style.borderTopStyle !== 'none' && !isTransparent(style.borderTopColor)) {
      roundedRect(
        ctx,
        x + border / 2,
        y + border / 2,
        rect.width - border,
        rect.height - border,
        radius - border / 2,
      )
      ctx.lineWidth = border
      ctx.strokeStyle = style.borderTopColor
      ctx.stroke()
    }
  }

  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (!text) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      ctx.fillStyle = style.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        text,
        box.left - origin.left + box.width / 2,
        box.top - origin.top + box.height / 2,
      )
    } else if (node instanceof Element && !node.matches(SCREEN_ONLY)) {
      paintElement(ctx, node, origin)
    }
  }
}

/** Resolve once every tile layer has finished loading, or after `timeout` ms */
function tilesReady(map: L.Map, timeout: number): Promise<void> {
  const pending: Promise<void>[] = []
  map.eachLayer((layer) => {
    if (layer instanceof L.GridLayer && layer.isLoading()) {
      pending.push(new Promise((resolve) => layer.once('load', () => resolve())))
    }
  })
  if (!pending.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeout)),
  ])
}

/** Stacking order of an element inside the map: its own z-index, else its parents' */
function zIndexOf(el: Element, root: Element): number {
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    const z = Number((node as HTMLElement).style.zIndex)
    if (z) return z
  }
  return 0
}

/**
 * Render the map as it is currently shown into an image.
 *
 * Included: base map tiles; everything drawn by a vector renderer (lines, polygons,
 * circles, point layers); and the library's own labels and badges — measurement
 * labels, cluster bubbles, drawn markers — plus any simple elements named in
 * `include`. Not included: other HTML — custom marker icons, popups, tooltips, controls.
 */
export async function exportMapImage(map: L.Map, options: ExportImageOptions = {}): Promise<Blob> {
  // Exporting half-loaded tiles would give a patchy or blank picture
  await tilesReady(map, options.timeout ?? 8000)

  const container = map.getContainer()
  const origin = container.getBoundingClientRect()
  const size = map.getSize()
  const scale = options.scale ?? Math.min(window.devicePixelRatio || 1, 2)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size.x * scale)
  canvas.height = Math.round(size.y * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this environment')
  ctx.scale(scale, scale)
  ctx.fillStyle = options.background ?? '#ffffff'
  ctx.fillRect(0, 0, size.x, size.y)

  const place = (el: Element) => {
    const rect = el.getBoundingClientRect()
    return { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height }
  }
  const visible = (box: { x: number; y: number; w: number; h: number }) =>
    box.w > 0 &&
    box.h > 0 &&
    box.x < size.x &&
    box.y < size.y &&
    box.x + box.w > 0 &&
    box.y + box.h > 0

  // ---- Tiles, bottom layer first
  const tiles = [...container.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded')]
    .map((img, order) => ({ img, order, box: place(img), z: zIndexOf(img, container) }))
    .filter((tile) => visible(tile.box))
    .sort((a, b) => a.z - b.z || a.order - b.order)

  const loaded = await Promise.all(
    tiles.map((tile) =>
      loadForCanvas(tile.img.src).catch(() => {
        throw new Error(
          `Cannot export the map: tiles from ${hostOf(tile.img.src)} do not allow cross-origin reading`,
        )
      }),
    ),
  )
  tiles.forEach(({ img, box }, i) => {
    // The layer's own opacity only. A tile's opacity is its fade-in animation, which
    // stands still while the page is not being rendered (a background tab).
    const layer = img.closest<HTMLElement>('.leaflet-layer')
    ctx.globalAlpha = Number(layer?.style.opacity || 1)
    ctx.drawImage(loaded[i], box.x, box.y, box.w, box.h)
  })
  ctx.globalAlpha = 1

  // Leaflet's canvas renderer repaints on the next animation frame, and there may
  // be no next frame for a while (again: a background tab). Paint what is pending now.
  map.eachLayer((layer) => {
    const renderer = layer as any
    if (layer instanceof L.Canvas && renderer._redrawRequest) renderer._redraw()
  })

  // ---- Vector renderers: canvases as they are, SVGs through an image
  for (const el of container.querySelectorAll<HTMLCanvasElement | SVGSVGElement>(
    '.leaflet-pane > canvas, .leaflet-pane > svg',
  )) {
    const box = place(el)
    if (!visible(box)) continue
    if (el instanceof HTMLCanvasElement) {
      ctx.drawImage(el, box.x, box.y, box.w, box.h)
    } else {
      const xml = new XMLSerializer().serializeToString(el)
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
      try {
        ctx.drawImage(await loadForCanvas(url), box.x, box.y, box.w, box.h)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
  }

  // ---- Labels and badges, in document order so later ones end up on top
  const selectors = [...(options.labels === false ? [] : OWN_ELEMENTS), ...(options.include ?? [])]
  if (selectors.length) {
    for (const el of container.querySelectorAll(selectors.join(','))) {
      // An element nested in another matched one is painted with its parent
      if (el.parentElement?.closest(selectors.join(','))) continue
      if (!visible(place(el))) continue
      paintElement(ctx, el, origin)
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode the image'))),
      options.type ?? 'image/png',
      options.quality,
    )
  })
}

/** Offer a blob to the user as a file download */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Give the browser a moment to start the download before the URL goes away
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
