import { describe, it, expect } from 'vitest'
import { ABSENCE_KIND_META, ABSENCE_KIND_OPTIONS, type AbsenceKind } from './kind-meta'

const KINDS: AbsenceKind[] = ['vacation', 'miluim', 'sick']

describe('ABSENCE_KIND_META', () => {
  it('has a label, color and soft background for every kind', () => {
    for (const kind of KINDS) {
      const meta = ABSENCE_KIND_META[kind]
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.color).toMatch(/^var\(--/)
      expect(meta.soft).toMatch(/^var\(--/)
    }
  })

  it('gives each kind a distinct label', () => {
    const labels = KINDS.map((k) => ABSENCE_KIND_META[k].label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('ABSENCE_KIND_OPTIONS', () => {
  it('exposes exactly the three kinds, in order', () => {
    expect(ABSENCE_KIND_OPTIONS.map((o) => o.value)).toEqual(['vacation', 'miluim', 'sick'])
  })

  it('labels match ABSENCE_KIND_META', () => {
    for (const opt of ABSENCE_KIND_OPTIONS) {
      expect(opt.label).toBe(ABSENCE_KIND_META[opt.value].label)
    }
  })
})
