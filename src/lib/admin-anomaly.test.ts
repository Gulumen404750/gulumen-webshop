import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADMIN_ANOMALY_THRESHOLDS,
  buildAdminAnomalySubject,
  getAdminAnomalyThresholds,
  isCountAnomaly,
  justCrossedThreshold,
  parseEnvPositiveInt,
  shouldAlertAdminAnomaly,
} from './admin-anomaly'

describe('parseEnvPositiveInt', () => {
  it('falls back on missing or invalid values', () => {
    expect(parseEnvPositiveInt(undefined, 100)).toBe(100)
    expect(parseEnvPositiveInt('nope', 100)).toBe(100)
    expect(parseEnvPositiveInt('0', 100)).toBe(100)
    expect(parseEnvPositiveInt('250', 100)).toBe(250)
  })
})

describe('getAdminAnomalyThresholds', () => {
  it('uses documented defaults when env is empty', () => {
    expect(getAdminAnomalyThresholds({})).toEqual({
      csvExportMin: 100,
      bulkPriceMin: 10,
      bulkDeleteMin: 5,
      bulkDeleteWindowMs: 10 * 60_000,
    })
    expect(DEFAULT_ADMIN_ANOMALY_THRESHOLDS.csvExportMin).toBe(100)
  })

  it('reads env overrides (delete window is minutes)', () => {
    const t = getAdminAnomalyThresholds({
      ADMIN_ANOMALY_CSV_MIN: '50',
      ADMIN_ANOMALY_BULK_PRICE_MIN: '8',
      ADMIN_ANOMALY_DELETE_MIN: '3',
      ADMIN_ANOMALY_DELETE_WINDOW_MIN: '15',
    })
    expect(t.csvExportMin).toBe(50)
    expect(t.bulkPriceMin).toBe(8)
    expect(t.bulkDeleteMin).toBe(3)
    expect(t.bulkDeleteWindowMs).toBe(15 * 60_000)
  })
})

describe('shouldAlertAdminAnomaly', () => {
  const t = DEFAULT_ADMIN_ANOMALY_THRESHOLDS

  it('alerts on large CSV export and bulk price, not on small ones', () => {
    expect(isCountAnomaly(99, t.csvExportMin)).toBe(false)
    expect(shouldAlertAdminAnomaly('csv_export', 100, t)).toBe(true)
    expect(shouldAlertAdminAnomaly('csv_export', 342, t)).toBe(true)
    expect(shouldAlertAdminAnomaly('bulk_price', 9, t)).toBe(false)
    expect(shouldAlertAdminAnomaly('bulk_price', 10, t)).toBe(true)
    expect(buildAdminAnomalySubject('csv_export', 342)).toContain('nagy CSV-export')
  })

  it('alerts bulk delete only when the window count first crosses the threshold', () => {
    expect(justCrossedThreshold(4, 5)).toBe(false)
    expect(justCrossedThreshold(5, 5)).toBe(true)
    expect(justCrossedThreshold(6, 5)).toBe(false)
    expect(shouldAlertAdminAnomaly('bulk_delete', 5, t)).toBe(true)
    expect(shouldAlertAdminAnomaly('bulk_delete', 12, t)).toBe(false)
  })
})
