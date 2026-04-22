import { describe, expect, it } from 'vitest'
import {
  buildCountSeries,
  buildMonthlySeries,
  monthKeyFromDate,
  monthLabelFromKey,
} from './analytics'

describe('analytics helpers', () => {
  it('builds month keys and labels safely', () => {
    expect(monthKeyFromDate('2026-04-20')).toBe('2026-04')
    expect(monthKeyFromDate('not-a-date')).toBe('')
    expect(monthLabelFromKey('')).toBe('Unknown')
    expect(monthLabelFromKey('2026-04')).toContain('2026')
  })

  it('builds monthly and count series', () => {
    const monthly = buildMonthlySeries(
      [
        { created_at: '2026-04-02', total: 2 },
        { created_at: '2026-04-18', total: 3 },
        { created_at: '2026-05-01', total: 1 },
        { created_at: 'bad-date', total: 99 },
      ],
      'created_at',
      (item) => item.total
    )

    expect(monthly).toHaveLength(2)
    expect(monthly[0].value).toBe(5)
    expect(monthly[1].value).toBe(1)

    const counts = buildCountSeries(
      [
        { role: 'agent' },
        { role: 'agent' },
        { role: 'tourist' },
        { role: ' ' },
      ],
      (item) => item.role,
      () => 1,
      5
    )

    expect(counts).toEqual([
      { label: 'agent', value: 2 },
      { label: 'tourist', value: 1 },
    ])
  })
})
