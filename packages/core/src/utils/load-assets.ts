const loadedScripts = new Set<string>()
const loadedStyles = new Set<string>()

/**
 * Dynamically load an external script. Deduplicates by URL.
 */
export function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = src
    script.onload = () => {
      loadedScripts.add(src)
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * Dynamically load an external stylesheet. Deduplicates by URL.
 */
export function loadStyle(href: string): void {
  if (loadedStyles.has(href)) return

  const link = document.createElement('link')
  link.type = 'text/css'
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
  loadedStyles.add(href)
}
