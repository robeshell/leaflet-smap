import { describe, expect, it } from 'vitest'
import {
  BUILTIN_TILE_TYPES,
  createChinaTileLayer,
  getCoordType,
  getTileTypes,
  registerProvider,
} from '../src/plugins/chinese-tms-providers'

describe('chinese-tms-providers', () => {
  it('keeps BUILTIN_TILE_TYPES in sync with the provider table', () => {
    expect([...BUILTIN_TILE_TYPES].sort()).toEqual(getTileTypes().sort())
  })

  it('maps providers to their coordinate system', () => {
    expect(getCoordType('GaoDe')).toBe('gcj02')
    expect(getCoordType('Tencent')).toBe('gcj02')
    expect(getCoordType('Baidu')).toBe('bd09')
    expect(getCoordType('TianDiTu')).toBe('wgs84')
    expect(getCoordType('Unknown')).toBe('wgs84')
  })

  it('creates a layer for every built-in tile type', () => {
    for (const type of BUILTIN_TILE_TYPES) {
      expect(() => createChinaTileLayer(type)).not.toThrow()
    }
  })

  it('throws on an unknown tile type', () => {
    expect(() => createChinaTileLayer('Nope.Normal.Map')).toThrow(/Unknown tile provider/)
    expect(() => createChinaTileLayer('GaoDe.Normal.Nope')).toThrow(/Unknown tile provider/)
  })

  it('tags the layer with the coordinate system used for correction', () => {
    const layer = createChinaTileLayer('GaoDe.Normal.Map')
    expect((layer.options as any).corrdType).toBe('gcj02')
  })

  it('passes the key through, and an empty key does not hide the provider default', () => {
    const withKey = createChinaTileLayer('TianDiTu.Normal.Map', { key: 'abc' })
    expect((withKey.options as any).key).toBe('abc')

    const emptyKey = createChinaTileLayer('TianDiTu.Normal.Map', { key: '' })
    const noKey = createChinaTileLayer('TianDiTu.Normal.Map')
    expect((emptyKey.options as any).key).toBe((noKey.options as any).key)
  })
})

describe('registerProvider', () => {
  it('makes a custom provider addressable and applies its settings', () => {
    registerProvider('Intranet', {
      layers: { Satellite: { Map: 'https://tiles{s}.example.com/{z}/{x}/{y}.png?k={key}' } },
      subdomains: ['a', 'b'],
      coordType: 'gcj02',
      key: 'secret',
    })

    expect(getTileTypes()).toContain('Intranet.Satellite.Map')
    expect(getCoordType('Intranet')).toBe('gcj02')

    const layer = createChinaTileLayer('Intranet.Satellite.Map')
    expect((layer.options as any).corrdType).toBe('gcj02')
    expect((layer.options as any).key).toBe('secret')
    expect(layer.options.subdomains).toEqual(['a', 'b'])
  })

  it('re-registering replaces the definition, including the coordinate system', () => {
    registerProvider('Intranet', { layers: { Normal: { Map: 'https://x/{z}/{x}/{y}.png' } } })
    expect(getCoordType('Intranet')).toBe('wgs84')
    expect(getTileTypes()).not.toContain('Intranet.Satellite.Map')
    expect(getTileTypes()).toContain('Intranet.Normal.Map')
  })

  it('rejects names that would break the "a.b.c" addressing', () => {
    expect(() => registerProvider('A.B', { layers: {} })).toThrow(/Invalid tile provider name/)
    expect(() => registerProvider('', { layers: {} })).toThrow(/Invalid tile provider name/)
    expect(() => registerProvider('X', { layers: { Subdomains: { Map: 'u' } } })).toThrow(
      /Invalid tile group name/,
    )
  })
})
