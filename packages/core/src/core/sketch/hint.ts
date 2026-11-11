import * as L from 'leaflet'

/** The little bubble that follows the cursor and says what to do next */
export class Hint {
  private el: HTMLElement
  private main: HTMLElement
  private sub: HTMLElement

  constructor(map: L.Map) {
    this.el = L.DomUtil.create('div', 'smap-draw-hint', map.getContainer())
    this.main = L.DomUtil.create('div', 'smap-draw-hint-main', this.el)
    this.sub = L.DomUtil.create('div', 'smap-draw-hint-sub', this.el)
    // Nothing to point at until the cursor has been seen (never, on touch screens)
    this.el.style.display = 'none'
  }

  set(text: string, sub = '', error = false): void {
    this.main.textContent = text
    this.sub.textContent = sub
    this.sub.style.display = sub ? '' : 'none'
    this.el.classList.toggle('is-error', error)
  }

  move(point: L.Point): void {
    this.el.style.display = ''
    this.el.style.transform = `translate(${Math.round(point.x) + 16}px, ${Math.round(point.y) + 16}px)`
  }

  remove(): void {
    this.el.remove()
  }
}
