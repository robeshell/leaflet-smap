import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceClient, SMap } from '../src'

let fetchMock: ReturnType<typeof vi.fn>

/** URL and decoded query of the most recent request */
function lastRequest() {
  const url = new URL(fetchMock.mock.calls.at(-1)![0] as string)
  return { path: url.origin + url.pathname, query: Object.fromEntries(url.searchParams) }
}

beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: 1 }) }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ServiceClient (standalone)', () => {
  it('requires a key', async () => {
    await expect(new ServiceClient().geocode({ keyWord: '合肥' })).rejects.toThrow(/key is missing/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the default key, and an explicit tk wins over it', async () => {
    const client = new ServiceClient({ key: 'DEFAULT' })

    await client.geocode({ keyWord: '合肥' })
    expect(lastRequest().query.tk).toBe('DEFAULT')

    await client.geocode({ keyWord: '合肥', tk: 'EXPLICIT' })
    expect(lastRequest().query.tk).toBe('EXPLICIT')
  })

  it('does not leak tk into the request payload', async () => {
    const client = new ServiceClient()
    await client.geocode({ keyWord: '合肥', tk: 'K' })
    expect(JSON.parse(lastRequest().query.ds)).toEqual({ keyWord: '合肥' })

    await client.reverseGeocode({ lon: 117.23, lat: 31.82, tk: 'K' })
    expect(JSON.parse(lastRequest().query.postStr)).toEqual({ lon: 117.23, lat: 31.82, ver: 1 })
  })

  it('queries districts through the v2 endpoint', async () => {
    const client = new ServiceClient({ key: 'K' })

    await client.getAdministrative({ keyword: '156340100', childLevel: 1, extensions: true })
    expect(lastRequest()).toEqual({
      path: 'https://api.tianditu.gov.cn/v2/administrative',
      query: { keyword: '156340100', childLevel: '1', extensions: 'true', tk: 'K' },
    })

    // 1.x / 2.0 的参数名仍然可用
    await client.getAdministrative({ searchWord: '合肥市' })
    expect(lastRequest().query).toMatchObject({ keyword: '合肥市', childLevel: '0' })

    await expect(client.getAdministrative({})).rejects.toThrow(/keyword/)
  })

  it('search() without a map needs level and mapBound', async () => {
    const client = new ServiceClient({ key: 'K' })
    await expect(client.search({ keyword: '南站' })).rejects.toThrow(/needs a map/)

    await client.search({ keyword: '南站', level: 12, mapBound: '117,31,118,32' })
    expect(JSON.parse(lastRequest().query.postStr)).toMatchObject({
      keyWord: '南站',
      level: 12,
      mapBound: '117,31,118,32',
      queryType: 1,
      start: 0,
      count: 10,
    })
  })

  it('surfaces HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' })
    await expect(new ServiceClient({ key: 'K' }).geocode({ keyWord: 'x' })).rejects.toThrow(/403/)
  })
})

describe('smap.service', () => {
  let container: HTMLElement
  let smap: SMap

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    smap = new SMap(container, { center: [31.82, 117.23], zoom: 12, tdtKey: 'MAPKEY' })
  })

  afterEach(() => {
    smap.destroy()
    container.remove()
  })

  it('search() uses the bound map and tdtKey', async () => {
    await smap.service.search({ keyword: '合肥南站', count: 5 })

    const { path, query } = lastRequest()
    expect(path).toBe('https://api.tianditu.gov.cn/v2/search')
    expect(query.tk).toBe('MAPKEY')

    const post = JSON.parse(query.postStr)
    expect(post).toMatchObject({ keyWord: '合肥南站', level: 12, count: 5 })
    const [west, south, east, north] = post.mapBound.split(',').map(Number)
    expect(west).toBeLessThan(117.23)
    expect(east).toBeGreaterThan(117.23)
    expect(south).toBeLessThan(31.82)
    expect(north).toBeGreaterThan(31.82)
  })

  it('still accepts the legacy search(map, params) form', async () => {
    await smap.service.search(smap.instance, { keyword: '合肥南站', tk: 'OTHER' })
    expect(lastRequest().query.tk).toBe('OTHER')
    expect(JSON.parse(lastRequest().query.postStr).keyWord).toBe('合肥南站')
  })
})
