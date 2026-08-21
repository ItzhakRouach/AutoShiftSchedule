import { describe, it, expect } from 'vitest'
import { buildPeriodOptions } from './period-options'

// Published week starts, newest first — the shape the dashboard query returns.
const WEEKS = ['2026-08-30', '2026-08-16', '2026-08-09', '2026-07-26', '2025-12-28']

describe('buildPeriodOptions — week scope', () => {
  it('one option per published week, value = week start', () => {
    const opts = buildPeriodOptions('week', WEEKS)
    expect(opts.map((o) => o.value)).toEqual(WEEKS)
  })

  it('labels a same-month week as d–d.M', () => {
    const [, aug16] = buildPeriodOptions('week', WEEKS)
    expect(aug16.label).toBe('16–22.8')
  })

  it('labels a cross-month week as d.M–d.M', () => {
    const [aug30] = buildPeriodOptions('week', WEEKS)
    expect(aug30.label).toBe('30.8–5.9')
  })

  it('dedupes repeated week starts', () => {
    const opts = buildPeriodOptions('week', ['2026-08-16', '2026-08-16'])
    expect(opts).toHaveLength(1)
  })
})

describe('buildPeriodOptions — month scope', () => {
  it('one option per distinct month, value = first of month, Hebrew label', () => {
    const opts = buildPeriodOptions('month', WEEKS)
    expect(opts.map((o) => o.value)).toEqual(['2026-08-01', '2026-07-01', '2025-12-01'])
    expect(opts[0].label).toBe('אוגוסט 2026')
    expect(opts[2].label).toBe('דצמבר 2025')
  })
})

describe('buildPeriodOptions — year scope', () => {
  it('one option per distinct year, value = Jan 1', () => {
    const opts = buildPeriodOptions('year', WEEKS)
    expect(opts).toEqual([
      { value: '2026-01-01', label: '2026' },
      { value: '2025-01-01', label: '2025' },
    ])
  })
})

describe('buildPeriodOptions — empty input', () => {
  it('returns an empty list for every scope', () => {
    expect(buildPeriodOptions('week', [])).toEqual([])
    expect(buildPeriodOptions('month', [])).toEqual([])
    expect(buildPeriodOptions('year', [])).toEqual([])
  })
})
